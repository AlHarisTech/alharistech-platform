# EventValidator Specification

## Status: Design Specification (Sprint 0.5/1)

---

## 1. Overview

**Component:** `EventValidator`
**Type:** BullMQ Worker Middleware
**Purpose:** Validates every event payload before a BullMQ job handler processes it. Rejects invalid events into a dead-letter queue (DLQ) for inspection and replay. Ensures event-driven communication across domains maintains schema integrity.

**Fail-closed:** If the event schema cannot be found or validation fails, the event is rejected to the DLQ — never silently processed with invalid data.

**Source of truth:** `specs/contracts/events/event-schemas.yaml` — 94 event schemas across all 9 domains, following the naming convention `{domain}.{aggregate}.{action}`.

---

## 2. Interface

### 2.1 BullMQ Worker Middleware

BullMQ provides a middleware/processor hook pattern. EventValidator implements this via a wrapper function:

```
function eventValidatorMiddleware(
  schemaRegistry: SchemaRegistry,
  options: EventValidatorOptions
): (job: Job, next: () => Promise<void>) => Promise<void>
```

Applied per-worker:

```
const worker = new Worker('identity.events', identityEventProcessor, {
  connection: redisConnection,
});

worker.use(eventValidatorMiddleware(schemaRegistry, {
  rejectToDLQ: true,
  dlqPrefix: 'dlq',
}));
```

### 2.2 Configuration

```
interface EventValidatorOptions {
  rejectToDLQ: boolean;           // Default: true — send invalid events to DLQ
  dlqPrefix: string;              // Default: "dlq" → Redis list "dlq:{queueName}"
  dlqRetention: number;           // Default: 2592000 (30 days in seconds)
  maxReplayBatch: number;         // Default: 100 — max events to replay at once
  strictVersionCheck: boolean;    // Default: true — reject unknown schema versions
  skipValidationQueues: string[]; // Default: [] — queue names to skip validation
}
```

### 2.3 Admin API (for DLQ Management)

| Endpoint | Method | Purpose |
|:---|:---|:---|
| `/api/system/events/dlq` | GET | List dead-letter queues with event counts |
| `/api/system/events/dlq/:queueName` | GET | List events in a specific DLQ (paginated) |
| `/api/system/events/dlq/:queueName/:eventId` | GET | Get a specific dead-lettered event |
| `/api/system/events/dlq/:queueName/replay` | POST | Replay one or more events from DLQ |
| `/api/system/events/dlq/:queueName/purge` | DELETE | Delete all events from a DLQ |

---

## 3. Behavior

### 3.1 Event Processing Flow

```
BullMQ Job Received
  │
  ├─ 1. Skip Check
  │     If queue name in skipValidationQueues → continue to handler
  │     If job has x-skip-validation flag → continue to handler
  │
  ├─ 2. Event Name Extraction
  │     Extract event name from job data:
  │       job.data.event        → "identity.user.registered"
  │       job.data.eventName    → alternate key
  │       job.data.type         → fallback key
  │     If no event name found → reject to DLQ (SKIPPED: no event identifier)
  │
  ├─ 3. Schema Resolution
  │     event name → schema lookup:
  │       "identity.user.registered" → load schema from event-schemas.yaml
  │     Schema includes:
  │       - event name, domain, version
  │       - JSON Schema for payload
  │       - transport info (channel, type)
  │       - retention policy
  │     If schema not found → reject to DLQ (SCHEMA_NOT_FOUND)
  │
  ├─ 4. Version Check
  │     Extract event version from job data:
  │       job.data.version     → "1.0"
  │       job.data.schemaVersion → alternate key
  │     Match with schema version:
  │       schema.version === job.data.version
  │     If mismatch and strictVersionCheck:
  │       → reject to DLQ (VERSION_MISMATCH: expected v{schema}, got v{data})
  │     If mismatch and !strictVersionCheck:
  │       → log warning, continue with schema version
  │
  ├─ 5. Schema Compilation
  │     Compile JSON Schema → AJV validator (cached)
  │     Same caching strategy as ContractGuard:
  │       L1: in-memory LRU of compiled validators
  │       L2: Redis cache with TTL 1h
  │     Cache key: "event:validator:{eventName}:{version}"
  │
  ├─ 6. Validation
  │     Run AJV validate(job.data.payload || job.data.data)
  │     Validates only the event payload, not metadata (timestamp, tracing)
  │
  ├─ 7. Result
  │     Valid:
  │       → Set job.data._validated = true
  │       → Continue to handler (call next())
  │
  │     Invalid:
  │       → Build error metadata:
  │           {
  │             error: "VALIDATION_ERROR",
  │             errors: [ ... AJV error details ... ],
  │             timestamp: ISO 8601,
  │             validatorVersion: schema.version,
  │             eventName: eventName
  │           }
  │       → Reject to DLQ
  │       → Log error
  │       → Increment counter: event_validation_failures_total{eventName, reason}
  │       → Do NOT call next() (handler never sees invalid event)
  │
  └─ 8. Error Handling
       Schema lookup error → reject to DLQ + log error
       AJV compilation error → reject to DLQ + log error + alert
       DLQ write failure → log error + throw (let BullMQ retry)
```

### 3.2 Dead-Letter Queue Format

Each rejected event is stored in a Redis list with this structure:

```
Key:   dlq:{queueName}
Type:  Redis List (FIFO)
Max:   Configurable (default: 10,000 events per queue)

Value: JSON string
{
  "id": "dlq_018f9a92-3c5f-7a8b-9c0d-1e2f3a4b5c6d",
  "queueName": "identity.events",
  "eventName": "identity.user.registered",
  "eventVersion": "1.0",
  "rejectedAt": "2026-06-20T12:00:00Z",
  "rejectionReason": "VALIDATION_ERROR",
  "errors": [
    {
      "keyword": "required",
      "dataPath": "",
      "schemaPath": "#/required",
      "params": { "missingProperty": "email" },
      "message": "must have required property 'email'"
    }
  ],
  "originalJob": {
    "id": "job-abc123",
    "data": { /* original event payload */ },
    "opts": { /* original job options */ },
    "attemptsMade": 0,
    "timestamp": 1718899200000
  },
  "schemaVersion": "1.0",
  "ttl": 2592000
}
```

### 3.3 DLQ Retention & Cleanup

| Policy | Value |
|:---|:---|
| Default TTL | 30 days (2,592,000 seconds) |
| Max events per DLQ | 10,000 (oldest evicted when full) |
| Cleanup mechanism | On each DLQ write, if `LLEN dlq:{queue} > maxEvents`, `LPOP` oldest |
| Per-event TTL | Stored in event metadata; cleanup job runs hourly to remove expired events |

A scheduled job (`EventValidatorCleanupJob`) runs every hour:
1. List all DLQ keys: `KEYS dlq:*`
2. For each DLQ, peek expired events and `LREM` them
3. Log cleanup count and remaining events

### 3.4 Versioning

Event schemas follow semantic versioning. The version is embedded in each event:

```
// Event payload from producer
{
  "event": "identity.user.registered",
  "version": "1.0",
  "payload": { ... },
  "timestamp": "2026-06-20T12:00:00Z",
  "traceId": "018f9a92-..."
}
```

**Version matching rules:**

| Scenario | strictVersionCheck=true | strictVersionCheck=false |
|:---|:---|:---|
| Event version matches schema | Allow | Allow |
| Event version = 1.0, schema = 1.1 (patch bump) | Allow if backward-compatible | Allow + warn |
| Event version = 1.0, schema = 2.0 (major bump) | Reject to DLQ | Allow + warn |
| Event version not found in registry | Reject to DLQ | Allow + error log |

**Backward compatibility check (for patch versions):**
- Schema version 1.1 must be a superset of 1.0 (additive changes only)
- New required fields in 1.1 → not backward-compatible → reject
- New optional fields in 1.1 → backward-compatible → allow

### 3.5 Event Replay

Events in the DLQ can be replayed via the admin API:

```
POST /api/system/events/dlq/identity.events/replay
Body: { "eventIds": ["dlq_abc123", "dlq_def456"] }
```

Replay process:
1. Fetch event(s) from DLQ list
2. Validate event still matches current schema version
3. Re-add to the original queue `identity.events`
4. Remove from DLQ list
5. Log replay action (audit log)

**Replay safety:**
- Events are replayed to the ORIGINAL queue (not a special replay queue)
- The handler must be idempotent (events may be processed multiple times)
- Replay is rate-limited: 10 replays per minute per admin user
- Replay is idempotent: replaying the same event twice only processes it once (dedup by event ID)

---

## 4. Schema Resolution

### 4.1 Event Name to Schema Mapping

Event names follow the convention `{domain}.{aggregate}.{action}`:

```
identity.user.registered     → identity domain, user aggregate, registered action
customer.profile.created     → customer domain, profile aggregate, created action
service.order.status_changed → service domain, order aggregate, status_changed action
commerce.product.price_changed → commerce domain, product aggregate, price_changed action
```

The SchemaRegistry maintains a map of event names to schemas:

```
eventSchemaMap: Map<string, EventSchema> = {
  "identity.user.registered": { domain: "identity", event: "UserRegistered", version: "1.0", schema: {...} },
  "identity.user.verified":   { domain: "identity", event: "UserVerified",   version: "1.0", schema: {...} },
  // ... 94 entries
};
```

### 4.2 Schema Loading

Same mechanism as ContractGuard (Section 3.2):
- **dev:** Load from `specs/contracts/events/event-schemas.yaml` (file watcher for hot-reload)
- **prod:** Load from Redis (populated by SchemaRegistry at startup)
- **In-memory cache:** Always used as L1, Redis as L2

---

## 5. Error Handling

### 5.1 Rejection Reasons

| Reason | Code | Description |
|:---|:---|:---|
| No event name in job data | `MISSING_EVENT_NAME` | Job data has no event/eventName/type field |
| Schema not found | `SCHEMA_NOT_FOUND` | Event name has no matching schema in registry |
| Version mismatch | `VERSION_MISMATCH` | Event version doesn't match schema version |
| Validation error | `VALIDATION_ERROR` | Payload doesn't match JSON Schema |
| Schema compilation error | `SCHEMA_COMPILE_ERROR` | AJV failed to compile the JSON Schema |
| Schema corrupted | `SCHEMA_CORRUPTED` | Schema YAML/JSON is unparseable |

### 5.2 Error Schema (stored with DLQ event)

```
{
  "errors": [
    {
      "keyword": "required",
      "dataPath": ".payload",
      "schemaPath": "#/required",
      "params": { "missingProperty": "userId" },
      "message": "must have required property 'userId'"
    }
  ]
}
```

---

## 6. Performance Budget

| Metric | Target | Notes |
|:---|:---|:---|
| Schema lookup | < 1ms | In-memory Map lookup by event name |
| AJV schema compilation (first use) | < 50ms | Cached; only on first event of that type |
| AJV validate (cached) | < 2ms | Typical event payload (5-15 fields) |
| AJV validate (complex schema) | < 5ms | Complex schema with nested objects and arrays |
| DLQ write | < 1ms | Redis LPUSH |
| Total overhead per event | < 3ms | Schema lookup + validation (cached) |
| Total overhead (cold start) | < 55ms | Schema lookup + compilation + validation |

**Monitoring:** Prometheus metric `event_validator_duration_ms` histogram with labels `{eventName, status: valid|invalid|error}`. Counter `event_validation_failures_total{eventName, reason}`.

---

## 7. Configuration

### 7.1 Environment Variables

| Variable | Type | Default | Description |
|:---|:---|:---|
| `EVENT_SCHEMA_SOURCE` | `local` \| `redis` | `local` | Where to load event schemas from |
| `EVENT_SCHEMA_PATH` | string | `specs/contracts/events/event-schemas.yaml` | Local file path |
| `EVENT_DLQ_ENABLED` | boolean | `true` | Enable dead-letter queue |
| `EVENT_DLQ_PREFIX` | string | `dlq` | Redis key prefix for DLQ |
| `EVENT_DLQ_RETENTION_SECONDS` | integer | `2592000` | 30 days |
| `EVENT_DLQ_MAX_EVENTS` | integer | `10000` | Max events per DLQ |
| `EVENT_STRICT_VERSION` | boolean | `true` | Reject events with unknown schema versions |
| `EVENT_SKIP_VALIDATION_QUEUES` | string[] | `[]` | Comma-separated queue names to skip |

### 7.2 Queue-Level Configuration

Individual queues can be configured via `EventValidatorOptions` per worker:

```
// Skip validation for internal system events
worker.use(eventValidatorMiddleware(schemaRegistry, {
  rejectToDLQ: true,
  skipValidationQueues: ['system.internal', 'metrics.collector'],
}));
```

---

## 8. Integration Points

| System | Direction | Purpose |
|:---|:---|:---|
| SchemaRegistry | Reads | Get event schema by name |
| BullMQ Worker | Middleware | Hooks into job processing pipeline |
| Redis | Reads/Writes | DLQ storage, cache |
| Logger | Writes | Log validation errors and DLQ operations |
| Prometheus | Writes | Export validation metrics |
| Admin API | Serves | DLQ inspection and replay endpoints |

### 8.1 BullMQ Worker Integration

```
// packages/contracts/src/event-validator/event-validator.middleware.ts

import { Worker, Job } from 'bullmq';

export function createValidatedWorker(
  queueName: string,
  processor: (job: Job) => Promise<void>,
  schemaRegistry: SchemaRegistry,
  options: EventValidatorOptions,
  workerOptions?: WorkerOptions,
): Worker {
  const worker = new Worker(queueName, processor, workerOptions);
  worker.use(eventValidatorMiddleware(schemaRegistry, options));
  return worker;
}
```

---

## 9. Testing Strategy

### 9.1 Unit Tests

| Test | Description |
|:---|:---|
| `should allow valid event matching schema` | Valid payload for identity.user.registered → passes |
| `should reject event with missing required field` | Missing userId → DLQ with VALIDATION_ERROR |
| `should reject event with wrong type` | userId as number instead of string → DLQ |
| `should reject event with no event name` | Job data has no event identifier → DLQ |
| `should reject event with unknown schema name` | "unknown.event.test" → DLQ with SCHEMA_NOT_FOUND |
| `should reject event with mismatched version in strict mode` | Event v2.0, schema v1.0 → DLQ with VERSION_MISMATCH |
| `should allow event with patch version bump in non-strict mode` | Event v1.1, schema also v1.1 → pass |
| `should use cached validator on second call` | Same event type → cache hit, < 1ms |
| `should write rejection to DLQ with full metadata` | Invalid event → DLQ entry with errors + original job |
| `should skip validation for excluded queues` | Queue in skipValidationQueues → pass through |

### 9.2 Integration Tests

| Test | Description |
|:---|:---|
| `should validate all 94 event schemas are compilable` | Compile AJV validators for all events |
| `should reject all 94 events when payload is empty` | Empty payload → DLQ for each event |
| `should handle concurrent event processing` | Multiple workers → no race conditions |
| `should replay event from DLQ to original queue` | Admin API replay → event processed |
| `should clean up expired DLQ events` | After TTL, events removed from DLQ |
| `should not exceed 3ms overhead (cached)` | Benchmark with 10,000 events |

### 9.3 E2E Tests

| Test | Description |
|:---|:---|
| `identity.user.registered event flows through validation` | Valid event → pick up → validate → handler |
| `invalid event → DLQ → inspect → replay → success` | Full DLQ lifecycle |

---

## 10. Dependencies

### 10.1 Runtime Dependencies

| Package | Version | Purpose |
|:---|:---|:---|
| `bullmq` | ^5.x | Queue worker and middleware |
| `ajv` | ^8.12+ | JSON Schema validation |
| `ioredis` | ^5.x | Redis for DLQ + cache |
| `js-yaml` | ^4.x | YAML parsing |
| `lru-cache` | ^10.x | In-memory LRU cache |

---

## 11. Implementation Notes

### 11.1 BullMQ Middleware Pattern

BullMQ workers support middleware via the `.use()` method (BullMQ v5+). The middleware receives the job and a `next()` function:

```
function eventValidatorMiddleware(
  schemaRegistry: SchemaRegistry,
  options: EventValidatorOptions,
) {
  return async (job: Job, next: () => Promise<void>): Promise<void> => {
    const schema = schemaRegistry.getEventSchema(job.data.event);
    if (!schema) {
      await rejectToDLQ(job, 'SCHEMA_NOT_FOUND', options);
      return; // Do NOT call next()
    }

    const validate = await getValidator(schema);
    const payload = job.data.payload || job.data.data;

    if (!validate(payload)) {
      await rejectToDLQ(job, 'VALIDATION_ERROR', {
        errors: validate.errors,
        schemaVersion: schema.version,
      }, options);
      return; // Do NOT call next()
    }

    job.data._validated = true;
    await next();
  };
}
```

### 11.2 DLQ Implementation

```
async function rejectToDLQ(
  job: Job,
  reason: string,
  metadata: any,
  options: EventValidatorOptions,
): Promise<void> {
  const dlqKey = `${options.dlqPrefix}:${job.queueName}`;
  const dlqEntry = {
    id: generateULID(),
    queueName: job.queueName,
    eventName: job.data.event || 'unknown',
    eventVersion: job.data.version || 'unknown',
    rejectedAt: new Date().toISOString(),
    rejectionReason: reason,
    ...metadata,
    originalJob: {
      id: job.id,
      data: sanitizeSensitiveFields(job.data),
      opts: job.opts,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
    },
    ttl: options.dlqRetention || 2592000,
  };

  await redis.lpush(dlqKey, JSON.stringify(dlqEntry));

  // Enforce max size
  const len = await redis.llen(dlqKey);
  if (len > (options.maxDLQEvents || 10000)) {
    await redis.rpop(dlqKey); // Remove oldest
  }

  // Set expiry on the list key
  await redis.expire(dlqKey, options.dlqRetention || 2592000);
}
```

### 11.3 Sensitive Field Sanitization

Before storing in DLQ, sensitive fields must be redacted from the original job data:
- Fields with `format: password` → `"***REDACTED***"`
- Fields matching sensitive patterns (creditCard, ssn, token) → `"***REDACTED***"`
- This prevents secrets from persisting in the DLQ

### 11.4 Memory Considerations

- 94 event schemas compiled ≈ 3-5 MB
- LRU cache of validators ≈ 1-2 MB
- DLQ entries ≈ 2-5 KB each, max 10,000 per queue ≈ 20-50 MB
- DLQ cleanup job prevents unbounded growth

### 11.5 Security Considerations

- **DLQ access control:** Admin API for DLQ inspection and replay requires admin role
- **Sensitive data in DLQ:** Redact sensitive fields before storing in DLQ (see Section 11.3)
- **Replay attack prevention:** Replayed events are rate-limited and audited
- **No event data in logs:** Log only event name and error type, not event payload

### 11.6 Future Considerations

- **Schema evolution with compatibility matrix:** Define which version transitions are backward/forward compatible
- **Event schema registry as a service:** Separate schema registry service for cross-language event validation
- **Dead-letter analytics:** Dashboard showing DLQ trends, most common validation errors, event producers with quality issues
- **Automatic schema inference:** Generate event schemas from TypeScript types / Protobuf definitions
