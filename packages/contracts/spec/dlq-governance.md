# Dead Letter Queue Governance Model

## Status: Specification (v0.6.0)

---

## 1. Overview

The Dead Letter Queue (DLQ) governance model defines how events that fail validation are stored, managed, monitored, replayed, and cleaned up. It integrates with the `EventValidator` middleware and `SchemaRegistry` to form a closed-loop enforcement system.

**Design principle:** No invalid event is silently dropped. Every rejected event is preserved for human review, with automated retention, monitoring, and alerting to prevent unbounded growth.

---

## 2. DLQ Structure

### 2.1 Storage

Each BullMQ queue has a dedicated DLQ in Redis. The key format follows the queue naming convention from `execution-boundaries.yaml`:

```
Key:    dlq:{queueName}
Type:   Redis LIST (FIFO)
Value:  JSON-serialized DeadLetterEvent
TTL:    30 days (2,592,000 seconds) set on the Redis key via EXPIRE
Max:    10,000 events per DLQ (oldest evicted via LPOP/RPOP when exceeded)
```

### 2.2 Queue-to-DLQ Mapping

| Queue | DLQ Key | Critical Events |
|:---|:---|:---|
| `notification.email` | `dlq:notification.email` | No |
| `notification.sms` | `dlq:notification.sms` | No |
| `notification.push` | `dlq:notification.push` | No |
| `analytics.report` | `dlq:analytics.report` | No |
| `ai.ingestion` | `dlq:ai.ingestion` | No |
| `ai.inference` | `dlq:ai.inference` | No |
| `file.processing` | `dlq:file.processing` | No |
| `commerce.shipping` | `dlq:commerce.shipping` | Yes (90-day retention) |
| `scheduler.repeatable` | `dlq:scheduler.repeatable` | No |
| `webhook.delivery` | `dlq:webhook.delivery` | No |

Additionally, domain event DLQs (for events emitted through the 94-event schema system):

| Event Channel (from event-schemas.yaml) | DLQ Key | Critical Events |
|:---|:---|:---|
| `bullmq:identity.events` | `dlq:identity.events` | Yes (account_locked, role_changed) |
| `bullmq:customer.events` | `dlq:customer.events` | No |
| `bullmq:service.events` | `dlq:service.events` | Yes (order.placed, order.completed, order.cancelled) |
| `bullmq:commerce.events` | `dlq:commerce.events` | Yes (order.placed, payment.completed, payment.failed) |
| `bullmq:support.events` | `dlq:support.events` | No |
| `bullmq:content.events` | `dlq:content.events` | No |
| `bullmq:notification.events` | `dlq:notification.events` | No |
| `bullmq:analytics.events` | `dlq:analytics.events` | No |
| `bullmq:ai.events` | `dlq:ai.events` | No |

### 2.3 DLQ Entry Schema

```json
{
  "eventId": "dlq_01JF8XYKZ3QN7WPA4R5T6BVE8M",
  "eventName": "identity.user.registered",
  "version": "1.0",
  "originalPayload": {
    "userId": "01JF8XYJ11VQZNBG2S3KT4AR6D",
    "role": "customer"
  },
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Event payload failed schema validation",
    "errors": [
      {
        "keyword": "required",
        "instancePath": "",
        "schemaPath": "#/required",
        "params": {
          "missingProperty": "email"
        },
        "message": "must have required property 'email'"
      },
      {
        "keyword": "required",
        "instancePath": "",
        "schemaPath": "#/required",
        "params": {
          "missingProperty": "timestamp"
        },
        "message": "must have required property 'timestamp'"
      }
    ]
  },
  "failedAt": "2026-06-20T12:00:00Z",
  "retryCount": 3,
  "traceId": "01JF8XYJ11VQZNBG2S3KT4AR6D",
  "jobId": "job-01JF8XYKZ3QN7WPA4R5T6BVE8M",
  "queueName": "identity.events",
  "schemaVersion": "1.0"
}
```

### 2.4 TypeScript Type

```typescript
interface DeadLetterEvent {
  eventId: string;
  eventName: string;
  version: string;
  originalPayload: Record<string, unknown>;
  error: {
    code: 'MISSING_EVENT_NAME' | 'SCHEMA_NOT_FOUND' | 'VERSION_MISMATCH'
        | 'VALIDATION_ERROR' | 'SCHEMA_COMPILE_ERROR' | 'SCHEMA_CORRUPTED';
    message: string;
    errors: Array<{
      keyword: string;
      instancePath: string;
      schemaPath: string;
      params: Record<string, unknown>;
      message: string;
    }>;
  };
  failedAt: string;
  retryCount: number;
  traceId: string;
  jobId: string;
  queueName: string;
  schemaVersion: string;
}
```

---

## 3. Retention Policy

### 3.1 Default Retention

| Tier | TTL | Applies To |
|:---|:---|:---|
| Standard | 30 days | All non-critical queues |
| Critical | 90 days | Events involving orders, payments, account security |
| Ephemeral | 7 days | Cart events, exports, temporary artifacts |

### 3.2 Critical Event Classification

Events in these categories receive 90-day retention:

- **Commerce orders:** `commerce.order.placed`, `commerce.order.status_changed`, `commerce.order.refunded`
- **Commerce payments:** `commerce.payment.completed`, `commerce.payment.failed`
- **Service orders:** `service.order.placed`, `service.order.completed`, `service.order.cancelled`, `service.order.rejected`
- **Identity security:** `identity.user.account_locked`, `identity.auth.password_changed`, `identity.user.role_changed`

### 3.3 Retention Enforcement

```typescript
const CRITICAL_EVENT_PREFIXES = [
  'commerce.order.', 'commerce.payment.',
  'service.order.', 'identity.user.account_',
  'identity.auth.password_', 'identity.user.role_',
];

function getDLQRetention(eventName: string): number {
  const isCritical = CRITICAL_EVENT_PREFIXES.some(p => eventName.startsWith(p));
  return isCritical ? 7776000 : 2592000; // 90 days : 30 days
}
```

### 3.4 Size Limits

| Limit | Value | Enforcement |
|:---|:---|:---|
| Max events per DLQ | 10,000 | Oldest evicted (RPOP) when LLEN exceeds limit on write |
| Max total DLQ events (all queues) | 100,000 | Alert at 80,000, reject writes at 100,000 |
| Max single event size | 64 KB | Events exceeding this are truncated at payload boundary |

---

## 4. Replay Mechanism

### 4.1 Admin API Endpoints

| Endpoint | Method | Purpose | Rate Limit |
|:---|:---|:---|:---|
| `/api/v1/admin/dlq` | GET | List all DLQs with event counts | 30 req/min |
| `/api/v1/admin/dlq/{queueName}` | GET | List events in a DLQ (paginated, 50/page) | 30 req/min |
| `/api/v1/admin/dlq/{queueName}/stats` | GET | Stats: total, by error code, by event name, oldest, newest | 30 req/min |
| `/api/v1/admin/dlq/{queueName}/{eventId}` | GET | Get a single DLQ event with full details | 30 req/min |
| `/api/v1/admin/dlq/{queueName}/replay/{eventId}` | POST | Re-queue a single event | 10 req/min |
| `/api/v1/admin/dlq/{queueName}/replay-all` | POST | Re-queue all events (max 100/minute) | 1 req/min |
| `/api/v1/admin/dlq/{queueName}/discard/{eventId}` | DELETE | Discard a single event (audited) | 10 req/min |
| `/api/v1/admin/dlq/{queueName}/purge` | DELETE | Discard all events in a DLQ (audited) | 1 req/min |

### 4.2 Replay Process (Single Event)

```
POST /api/v1/admin/dlq/identity.events/replay/dlq_01JF8XYKZ3QN7WPA4R5T6BVE8M

1. Authorization: Verify caller has Admin role (RBAC check)
2. Rate Limit: Check admin replay limit (10/minute per admin user)
3. Fetch: Retrieve event from Redis list by eventId
   - If not found → 404
4. Schema Resolution: Look up CURRENT schema version for event name
   - Uses SchemaRegistry.getEventSchema(eventName)
   - If schema not found → 422 (schema removed — event not replayable)
5. Validation: Validate originalPayload against CURRENT schema
   - If valid: Re-queue to original queueName
   - If invalid: Return 422 with validation errors (manual schema fix needed)
6. Re-queue: Publish to original BullMQ queue with metadata
   ```json
   {
     "event": "identity.user.registered",
     "version": "1.0",
     "payload": { ... },
     "timestamp": "2026-06-20T14:00:00Z",
     "traceId": "01JF8XYJ11VQZNBG2S3KT4AR6D",
     "_replayed": true,
     "_originalDLQId": "dlq_01JF8XYKZ3QN7WPA4R5T6BVE8M",
     "_replyCount": 1
   }
   ```
7. Remove: LREM the event from the DLQ list
8. Audit: Log replay action to audit_logs table
   ```json
   {
     "action": "dlq.replay",
     "eventId": "dlq_01JF8XYKZ3QN7WPA4R5T6BVE8M",
     "eventName": "identity.user.registered",
     "queueName": "identity.events",
     "replayedBy": "user-01JF8...",
     "replayedAt": "2026-06-20T14:00:00Z",
     "schemaVersion": "1.0",
     "success": true
   }
   ```
9. Response: 200 with replayed event metadata
```

### 4.3 Replay-All Process

```
POST /api/v1/admin/dlq/identity.events/replay-all
Body: { "maxEvents": 100 }

1. Authorization: Verify Admin role
2. Rate Limit: 1 request/minute per admin user
3. Fetch: Retrieve up to maxEvents (default 100) from DLQ list (oldest first)
4. For each event:
   a. Validate against CURRENT schema
   b. If valid → re-queue, remove from DLQ
   c. If invalid → leave in DLQ, increment skip counter
5. Response: 200 with summary
   ```json
   {
     "total": 100,
     "replayed": 87,
     "skipped": 13,
     "skippedReasons": {
       "SCHEMA_NOT_FOUND": 2,
       "VALIDATION_ERROR": 11
     },
     "durationMs": 4523
   }
   ```
```

### 4.4 Idempotency During Replay

Replayed events carry `_replayed: true` and `_originalDLQId`. Handlers MUST check:

```typescript
// In every event handler
async function handleUserRegistered(job: Job): Promise<void> {
  const dedupKey = job.data._replayed
    ? job.data._originalDLQId
    : job.data.eventId;

  const alreadyProcessed = await redis.get(`dedup:${dedupKey}`);
  if (alreadyProcessed) {
    logger.warn(`Duplicate event skipped: ${dedupKey}`);
    return;
  }

  // Process event...
  await redis.set(`dedup:${dedupKey}`, '1', 'EX', 86400); // 24h dedup window
}
```

### 4.5 Safety Constraints

| Constraint | Value |
|:---|:---|
| Replay validates against CURRENT schema | Schema drift may cause replay failure — manual fix required |
| Replay rate limit | 10 events/minute per admin user (single), 100 events/minute (replay-all) |
| Concurrent replays | Only 1 replay-all per queue at a time (Redis lock: `dlq:lock:replay:{queueName}`) |
| Deduplication window | 24 hours (events with same DLQ ID within 24h are skipped) |
| Original event is preserved | Replay copies to queue; DLQ entry removed only on successful re-queue |

---

## 5. Monitoring

### 5.1 Prometheus Metrics

```
# DLQ size per queue
crbl_dlq_size{queue="identity.events"} 42

# DLQ ingress rate (events/minute over 5m window)
crbl_dlq_ingress_rate{queue="identity.events"} 2.3

# DLQ egress (replayed + discarded) rate
crbl_dlq_egress_rate{queue="identity.events"} 1.0

# DLQ event by rejection reason
crbl_dlq_total{queue="identity.events",reason="VALIDATION_ERROR"} 127
crbl_dlq_total{queue="identity.events",reason="SCHEMA_NOT_FOUND"} 3
crbl_dlq_total{queue="identity.events",reason="VERSION_MISMATCH"} 8

# DLQ event age (oldest event in queue)
crbl_dlq_oldest_age_seconds{queue="identity.events"} 604800

# Replay operations
crbl_dlq_replay_total{queue="identity.events",status="success"} 15
crbl_dlq_replay_total{queue="identity.events",status="failed"} 2
```

### 5.2 Health Endpoint

```
GET /health/dlq

Response (200):
{
  "status": "healthy",
  "queues": {
    "identity.events": { "size": 42, "oldestAge": "7d", "status": "warning" },
    "customer.events": { "size": 3, "oldestAge": "2h", "status": "healthy" },
    "service.events": { "size": 0, "oldestAge": null, "status": "healthy" },
    "commerce.events": { "size": 128, "oldestAge": "3d", "status": "critical" },
    "support.events": { "size": 12, "oldestAge": "1d", "status": "healthy" },
    "content.events": { "size": 0, "oldestAge": null, "status": "healthy" },
    "notification.events": { "size": 7, "oldestAge": "5h", "status": "healthy" },
    "analytics.events": { "size": 1, "oldestAge": "30m", "status": "healthy" },
    "ai.events": { "size": 4, "oldestAge": "12h", "status": "healthy" },
    "notification.email": { "size": 0, "oldestAge": null, "status": "healthy" },
    "notification.sms": { "size": 0, "oldestAge": null, "status": "healthy" },
    "notification.push": { "size": 0, "oldestAge": null, "status": "healthy" },
    "analytics.report": { "size": 0, "oldestAge": null, "status": "healthy" },
    "ai.ingestion": { "size": 2, "oldestAge": "4h", "status": "healthy" },
    "ai.inference": { "size": 0, "oldestAge": null, "status": "healthy" },
    "file.processing": { "size": 0, "oldestAge": null, "status": "healthy" },
    "commerce.shipping": { "size": 5, "oldestAge": "1d", "status": "healthy" },
    "scheduler.repeatable": { "size": 0, "oldestAge": null, "status": "healthy" },
    "webhook.delivery": { "size": 18, "oldestAge": "2d", "status": "healthy" }
  },
  "totals": {
    "totalEvents": 222,
    "totalQueuesWithDLQ": 19,
    "queuesInWarning": 1,
    "queuesInCritical": 1
  }
}

Status per queue:
  "healthy"  — size < 50
  "warning"  — 50 <= size < 100
  "critical" — size >= 100

Overall status:
  "healthy"  — all queues healthy
  "warning"  — any queue in warning
  "critical" — any queue in critical
```

---

## 6. Alerting Rules

### 6.1 Alert Definitions

```yaml
# Prometheus AlertManager rules
groups:
  - name: dlq_alerts
    rules:
      - alert: DLQSizeWarning
        expr: crbl_dlq_size > 50
        for: 5m
        labels:
          severity: warning
          component: event-validator
        annotations:
          summary: "DLQ {{ $labels.queue }} has {{ $value }} events"
          description: "Queue {{ $labels.queue }} DLQ size exceeds 50 events. Investigate schema issues or consumer failures."
          runbook: "https://wiki.alharistech.sa/runbooks/dlq-size-warning"

      - alert: DLQSizeCritical
        expr: crbl_dlq_size > 100
        for: 2m
        labels:
          severity: critical
          component: event-validator
        annotations:
          summary: "DLQ {{ $labels.queue }} has {{ $value }} events — IMMEDIATE ACTION REQUIRED"
          description: "Queue {{ $labels.queue }} DLQ size exceeds 100 events. Requires immediate investigation. Possible schema mismatch or systematic bug."
          runbook: "https://wiki.alharistech.sa/runbooks/dlq-size-critical"

      - alert: DLQIngressRateCritical
        expr: rate(crbl_dlq_total[5m]) > 10
        for: 2m
        labels:
          severity: critical
          component: event-validator
        annotations:
          summary: "DLQ {{ $labels.queue }} ingress rate is {{ $value }}/min"
          description: "High DLQ ingress rate indicates schema mismatch, version incompatibility, or bug in event producer."
          runbook: "https://wiki.alharistech.sa/runbooks/dlq-ingress-rate"

      - alert: DLQEventTooOld
        expr: crbl_dlq_oldest_age_seconds > 2332800  # 27 days
        for: 5m
        labels:
          severity: warning
          component: event-validator
        annotations:
          summary: "DLQ {{ $labels.queue }} oldest event is {{ $value | humanizeDuration }}"
          description: "Events approaching TTL expiry without being replayed or discarded."

      - alert: DLQArchiveEligible
        expr: crbl_dlq_size == 0 and changes(crbl_dlq_size[7d]) == 0
        for: 5m
        labels:
          severity: info
          component: event-validator
        annotations:
          summary: "DLQ {{ $labels.queue }} has been empty for 7 days"
          description: "This DLQ can be archived and the monitoring silenced."
```

### 6.2 Escalation Matrix

| Alert | First Responder | Escalation (after 15 min) | Escalation (after 1 hour) |
|:---|:---|:---|:---|
| DLQSizeWarning | On-call engineer | Tech lead | Platform team |
| DLQSizeCritical | On-call engineer | Tech lead + Platform lead | CTO |
| DLQIngressRateCritical | On-call engineer | Tech lead | Platform team |
| DLQEventTooOld | On-call engineer | Tech lead | — |

### 6.3 Alert Silence Rules

| Condition | Duration | Reason |
|:---|:---|:---|
| Scheduled maintenance | Configurable | DLQ growth during deploys is expected |
| Known schema migration in progress | 2 hours | Events queued during migration |
| Queue disabled | Indefinite | Queue not receiving events |

---

## 7. Cleanup

### 7.1 Automated Cleanup Cron Job

A scheduled cleanup job runs every Sunday at 03:00 UTC (configured in `scheduler.repeatable`):

```yaml
# In scheduler.repeatable queue (execution-boundaries.yaml)
- name: "dlq-weekly-cleanup"
  cron: "0 3 * * 0"  # Every Sunday at 3 AM
```

**Process:**

```
1. For each DLQ key (KEYS dlq:*):
   a. Peek all events in the list
   b. Filter events where failedAt > (now - retention)
   c. Archive expired events to S3 (compressed JSON)
   d. LREM expired events from Redis list
   e. Reset TTL on remaining list

2. Archive format (S3):
   Bucket: alharis-dlq-archives
   Key:    dlq/{queueName}/{YYYY}/{MM}/{DD}/dlq-{timestamp}.json.gz
   Content: NDJSON with one DeadLetterEvent per line, gzip compressed

3. Log summary:
   {
     "job": "dlq-weekly-cleanup",
     "executedAt": "2026-06-21T03:00:00Z",
     "queuesScanned": 19,
     "eventsArchived": 145,
     "eventsExpired": 0,
     "bytesArchived": 235040
   }
```

### 7.2 S3 Archive Structure

```
alharis-dlq-archives/
  dlq/
    identity.events/
      2026/
        06/
          15/
            dlq-2026-06-15T03:00:00Z.json.gz
          22/
            dlq-2026-06-22T03:00:00Z.json.gz
    commerce.events/
      2026/
        06/
          15/
            dlq-2026-06-15T03:00:00Z.json.gz
```

### 7.3 Archive Retention

| Tier | S3 Lifecycle |
|:---|:---|
| Standard events | Transition to Glacier Deep Archive after 30 days, delete after 1 year |
| Critical events | Transition to Glacier Deep Archive after 90 days, delete after 7 years |
| Ephemeral events | Delete after 7 days (not archived) |

---

## 8. Access Control

### 8.1 Role-Based Access

| Endpoint | Admin | Manager | Employee | Customer |
|:---|:---|:---|:---|:---|
| `GET /admin/dlq` | Yes | Yes | No | No |
| `GET /admin/dlq/{queueName}` | Yes | Yes | No | No |
| `GET /admin/dlq/{queueName}/stats` | Yes | Yes | No | No |
| `GET /admin/dlq/{queueName}/{eventId}` | Yes | Yes | No | No |
| `POST /admin/dlq/{queueName}/replay/{eventId}` | Yes | No | No | No |
| `POST /admin/dlq/{queueName}/replay-all` | Yes | No | No | No |
| `DELETE /admin/dlq/{queueName}/discard/{eventId}` | Yes | No | No | No |
| `DELETE /admin/dlq/{queueName}/purge` | Yes | No | No | No |
| `GET /health/dlq` | Yes (internal) | — | — | — |

### 8.2 Audit Trail

All DLQ management operations are logged to `audit_logs` table:

```sql
INSERT INTO audit_logs (
  id, action, resource_type, resource_id, actor_id,
  actor_role, details, ip_address, user_agent, created_at
) VALUES (
  gen_random_uuid(),
  'dlq.replay',
  'dlq_event',
  'dlq_01JF8XYKZ3QN7WPA4R5T6BVE8M',
  'user-01JF8...',
  'admin',
  '{"queueName": "identity.events", "eventName": "identity.user.registered", "success": true}',
  '10.0.1.42',
  'Mozilla/5.0 (Admin Dashboard)',
  NOW()
);
```

### 8.3 Sensitive Data Handling

Before storing originalPayload in the DLQ, sensitive fields are redacted:

```
Redaction rules:
  - Field names matching /password|secret|token|key|credential/i → "***REDACTED***"
  - Fields with AJV format: "password" → "***REDACTED***"
  - Fields with AJV format: "email" → partially masked: "us***@domain.com"
  - Fields with AJV format: "phone" → partially masked: "+9665****1234"
  - Nested objects are recursively redacted
```

---

## 9. Integration Points

| System | Direction | Protocol | Purpose |
|:---|:---|:---|:---|
| EventValidator | Produces | Redis LPUSH | Writes rejected events to DLQ |
| Admin API | Reads/Writes | Redis LINDEX/LREM | DLQ inspection and replay |
| SchemaRegistry | Reads | In-memory | Schema lookup during replay validation |
| BullMQ | Consumes/Produces | Redis | Re-queue replayed events |
| S3 (MinIO) | Writes | S3 SDK | Archive expired DLQ events |
| Prometheus | Reads | HTTP /metrics | Export DLQ metrics |
| AlertManager | Consumes | Webhook | Fire alerts on DLQ thresholds |
| audit_logs table | Writes | Drizzle ORM | Persistent audit trail |
| Logger | Writes | stdout | Structured JSON logs |

---

## 10. Implementation Reference

### 10.1 DLQ Service Interface

```typescript
interface DlqService {
  // Push a rejected event to the DLQ
  push(event: DeadLetterEvent): Promise<void>;

  // List DLQs with event counts
  listQueues(): Promise<DlqSummary[]>;

  // Get paginated events from a specific DLQ
  getEvents(queueName: string, cursor: number, limit: number): Promise<DlqPage>;

  // Get stats for a specific DLQ
  getStats(queueName: string): Promise<DlqStats>;

  // Get a single event by ID
  getEvent(queueName: string, eventId: string): Promise<DeadLetterEvent | null>;

  // Replay a single event
  replayEvent(queueName: string, eventId: string, actorId: string): Promise<ReplayResult>;

  // Replay all events (up to maxEvents)
  replayAllEvents(queueName: string, maxEvents: number, actorId: string): Promise<ReplayAllResult>;

  // Discard a single event
  discardEvent(queueName: string, eventId: string, actorId: string): Promise<void>;

  // Purge all events from a DLQ
  purgeQueue(queueName: string, actorId: string): Promise<PurgeResult>;

  // Run weekly cleanup (archive + trim)
  runCleanup(): Promise<CleanupResult>;

  // Get health status
  getHealth(): Promise<DlqHealth>;
}
```

### 10.2 Redis Operations Reference

```
# Push rejected event
LPUSH dlq:identity.events '{...json...}'

# Enforce max size (keep only newest 10,000)
if LLEN dlq:identity.events > 10000: RPOP dlq:identity.events

# Set/refresh TTL
EXPIRE dlq:identity.events 2592000

# List all DLQ keys
KEYS dlq:*

# Get queue size
LLEN dlq:identity.events

# Get event by ID (O(n) — for admin UI, use scan)
for i in range(0, LLEN-1):
  event = LINDEX dlq:identity.events i
  if event.eventId == targetId: return event

# Get paginated events (cursor-based, querying newest first)
LINDEX dlq:identity.events $start through $end

# Remove event by ID
for i in range(0, LLEN-1):
  event = LINDEX dlq:identity.events i
  if event.eventId == targetId:
    LSET dlq:identity.events i "DELETED_PLACEHOLDER"
    LREM dlq:identity.events 1 "DELETED_PLACEHOLDER"

# Count by rejection reason (approximate)
Pipelined LINDEX scan + count by error.code
```

### 10.3 Performance Budget

| Operation | Target | Notes |
|:---|:---|:---|
| DLQ push (LPUSH + LLEN + RPOP if needed) | < 1ms | Single Redis pipeline |
| DLQ size query (LLEN) | < 0.5ms | O(1) Redis operation |
| DLQ page query (LINDEX range) | < 5ms | For 50 events per page |
| DLQ event lookup by ID | < 50ms | Linear scan of up to 10,000 entries |
| Replay single event (validate + re-queue) | < 100ms | Includes AJV validation |
| Replay-all (100 events) | < 10s | Batched validation + re-queue |
| Weekly cleanup (19 queues) | < 60s | Archive to S3 + Redis trim |
| Health endpoint | < 10ms | 19 LLEN calls in pipeline |

---

## 11. Failure Modes and Mitigations

| Failure Mode | Impact | Mitigation |
|:---|:---|:---|
| Redis connection lost during DLQ push | Event lost | BullMQ retry mechanism (event re-processed, validation re-run, DLQ push re-attempted) |
| DLQ list grows unbounded (cleanup fails) | Memory pressure on Redis | Hard cap at 10,000; oldest evicted on push. Independent monitoring alert at 8,000. |
| Schema deleted while events exist in DLQ | Events unreplayable | Archive DLQ before schema removal. Events retain originalPayload — can be extracted for manual processing. |
| Replay causes double-processing | Idempotency violation | Handlers check dedup:{eventId} before processing. BullMQ jobId derived from event ID prevents duplicate jobs. |
| S3 archive write fails during cleanup | Events expire without backup | Cleanup retries 3 times with backoff. Failed archives logged to a separate Redis key for manual retry. |
| Malicious replay attack | System overload | Rate limiting at API level. Audit trail records all replays with actor identity. |
---