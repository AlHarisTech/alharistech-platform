# Async Consistency Rules

## Status: Specification (v0.6.0)

---

## 1. Overview

The AlharisTech platform spans 9 domains, 10 BullMQ queues, and 94 event types. Every state-changing HTTP request triggers a cascade: HTTP response, database write, event emission, queue deliver, async handler execution. This document defines the rules that keep the system deterministic across sync→async boundaries.

**Core guarantee:** Every state change has exactly one durable event. No lost events. No phantom events. No double-processing.

---

## 2. Principle 1: Event-First Design

Every state-changing operation follows a strict sequence. The order is non-negotiable:

```
HTTP Request
  │
  ├─ 1. Authenticate (JWT validation)
  │
  ├─ 2. Validate (ContractGuard — request body against OpenAPI schema)
  │
  ├─ 3. Authorize (PolicyGuard — RBAC against access-control.yaml)
  │
  ├─ 4. Persist (Database transaction — INSERT/UPDATE/DELETE in domain schema)
  │     └─ Also: INSERT into outbox table (SAME TRANSACTION)
  │
  ├─ 5. Commit (Transaction COMMIT — both state change AND outbox record durable)
  │
  ├─ 6. Return HTTP response (200/201 to caller)
  │
  └─ 7. Async (outbox poller publishes event to BullMQ AFTER user gets response)
         └─ Event validated by EventValidator BEFORE handler processes it
```

### Why This Order

| Step | If Done Earlier | Consequence |
|:---|:---|:---|
| Emit event before DB commit | DB commit fails, event already published | Phantom event (handler processes state that doesn't exist) |
| Return HTTP 200 before DB commit | Client thinks operation succeeded, but DB rollback | Optimistic success, actual failure |
| Emit event before validation | Invalid event enters queue | Handler crashes, event lost to DLQ |
| Skip EventValidator | Malformed event enters handler | Handler crashes with data corruption risk |

### Implementation (NestJS service example)

```typescript
async registerUser(dto: RegisterUserDto, actorId: string): Promise<User> {
  return await this.db.transaction(async (tx) => {
    // Step 4a: Persist state change
    const user = await tx.insert(usersTable).values({
      id: dto.userId,
      email: dto.email,
      role: dto.role,
    }).returning().then(r => r[0]);

    // Step 4b: Record outbox entry (same transaction)
    await tx.insert(outboxTable).values({
      id: generateUlid(),
      aggregateType: 'User',
      aggregateId: user.id,
      eventType: 'identity.user.registered',
      eventVersion: '1.0',
      payload: {
        userId: user.id,
        email: user.email,
        role: user.role,
        timestamp: new Date().toISOString(),
        _eventVersion: '1.0',
      },
      traceId: this.requestContext.traceId,
      status: 'pending',
      createdAt: new Date(),
    });

    // Step 5: Transaction commits (both user + outbox durable)
    return user;
    // Step 6: HTTP response returned AFTER commit
  });
}
```

---

## 3. Principle 2: Transactional Outbox

### 3.1 Outbox Table Schema

```sql
CREATE TABLE public.outbox (
  id            TEXT PRIMARY KEY,                  -- ULID, unique event identifier
  aggregate_type TEXT NOT NULL,                    -- "User", "Order", "Ticket", "Product"
  aggregate_id  TEXT NOT NULL,                     -- UUID of the aggregate
  event_type    TEXT NOT NULL,                     -- "identity.user.registered"
  event_version TEXT NOT NULL DEFAULT '1.0',       -- "1.0"
  payload       JSONB NOT NULL,                    -- Full event payload (validated by schema)
  trace_id      TEXT NOT NULL,                     -- Links HTTP request to async processing
  status        TEXT NOT NULL DEFAULT 'pending',   -- pending | published | failed | skipped
  published_at  TIMESTAMPTZ,                       -- When the event was published to BullMQ
  retry_count   INTEGER NOT NULL DEFAULT 0,        -- Publication retry count
  error_message TEXT,                              -- Last publication error
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT outbox_pk PRIMARY KEY (id)
);

-- Crucial index: Outbox poller reads pending events ordered by creation
CREATE INDEX idx_outbox_status_created ON public.outbox (status, created_at)
  WHERE status = 'pending';

-- Index for tracing
CREATE INDEX idx_outbox_trace_id ON public.outbox (trace_id);

-- Index for aggregate event history
CREATE INDEX idx_outbox_aggregate ON public.outbox (aggregate_type, aggregate_id, created_at);

-- Partition by month for large volumes
-- ALTER TABLE outbox PARTITION BY RANGE (created_at);
```

### 3.2 Outbox Poller

A lightweight process runs alongside the NestJS API server, polling the outbox table and publishing events to BullMQ:

```
┌─────────────────────────────────────────────────────────┐
│ Outbox Poller (every 1 second)                          │
│                                                         │
│  1. SELECT * FROM outbox                                 │
│     WHERE status = 'pending'                             │
│     ORDER BY created_at ASC                              │
│     LIMIT 100                                            │
│     FOR UPDATE SKIP LOCKED                               │
│                                                         │
│  2. For each row:                                        │
│     a. Publish to BullMQ queue determined by event type  │
│        - Look up queue from event-schemas.yaml channel   │
│        - jobId = outbox.id (dedup by event ID)           │
│     b. UPDATE outbox                                      │
│        SET status = 'published',                          │
│            published_at = now()                           │
│        WHERE id = $id                                     │
│                                                         │
│  3. On publish failure:                                  │
│     - UPDATE outbox                                       │
│       SET retry_count = retry_count + 1,                  │
│           error_message = $error,                         │
│           status = CASE WHEN retry_count >= 5             │
│                     THEN 'failed'                         │
│                     ELSE 'pending' END                    │
│       WHERE id = $id                                      │
│                                                         │
│  4. Cleanup (every hour):                                │
│     - DELETE FROM outbox                                  │
│       WHERE status = 'published'                          │
│       AND published_at < now() - INTERVAL '7 days'        │
└─────────────────────────────────────────────────────────┘
```

### 3.3 Guarantees

| Guarantee | Mechanism |
|:---|:---|
| No event lost if DB write succeeds but queue publish fails | Outbox record is durable in DB. Poller retries until published. |
| No duplicate events | BullMQ `jobId = outbox.id`. Second publish with same jobId is a no-op. |
| Event ordering within aggregate | `ORDER BY created_at ASC` ensures events for same aggregate are published in order. |
| No event published if DB write fails | Outbox INSERT is in same transaction. Rollback removes both. |
| At-most-once publication per event | `FOR UPDATE SKIP LOCKED` + `status = 'published'` update makes poller idempotent. |

### 3.4 Queue Routing

The outbox poller routes events to BullMQ queues based on the `transport.channel` field in `event-schemas.yaml`:

```typescript
const eventSchema = schemaRegistry.getEventSchema(eventType);
const queueName = eventSchema.transport.channel.replace('bullmq:', '');
// "bullmq:identity.events" → "identity.events"

await queue.add(eventType, {
  event: eventType,
  version: eventVersion,
  payload: payload,
  traceId: traceId,
  timestamp: new Date().toISOString(),
}, {
  jobId: outboxId,  // Deduplication key
});
```

---

## 4. Principle 3: Idempotency

### 4.1 Idempotency Requirement

**All event handlers MUST be idempotent.** BullMQ's at-least-once delivery semantics mean a handler may execute multiple times for the same event. The handler is responsible for detecting and skipping duplicates.

### 4.2 Event ID as Dedup Key

Every event carries a unique identifier. The `jobId` in BullMQ is set to the outbox record ID:

```json
{
  "jobId": "01JF8XYJ11VQZNBG2S3KT4AR6D",   // Same as outbox.id
  "data": {
    "event": "identity.user.registered",
    "version": "1.0",
    "payload": { ... },
    "traceId": "01JF8XYJ11VQZNBG2S3KT4AR6D",
    "eventId": "01JF8XYJ11VQZNBG2S3KT4AR6D"  // Explicit event ID in payload
  }
}
```

### 4.3 Dedup Table

```sql
CREATE TABLE public.event_dedup (
  event_id     TEXT PRIMARY KEY,           -- outbox.id = jobId
  event_type   TEXT NOT NULL,              -- "identity.user.registered"
  handler_name TEXT NOT NULL,              -- "UserRegisteredHandler"
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status       TEXT NOT NULL DEFAULT 'completed',  -- completed | failed
  result       JSONB                       -- Optional: handler result summary
);

-- Cleanup processed dedup entries after 30 days
CREATE INDEX idx_event_dedup_processed_at ON public.event_dedup (processed_at)
  WHERE processed_at < now() - INTERVAL '30 days';
```

### 4.4 Handler Idempotency Implementation

```typescript
@Processor('identity.events')
export class UserRegisteredHandler {
  constructor(
    private readonly db: Database,
    private readonly redis: Redis,
  ) {}

  @Process('identity.user.registered')
  async handle(job: Job): Promise<void> {
    const eventId = job.data.eventId || job.id;

    // Check dedup table
    const existing = await this.db
      .select()
      .from(eventDedupTable)
      .where(eq(eventDedupTable.eventId, eventId))
      .limit(1);

    if (existing.length > 0) {
      this.logger.warn(`Duplicate event skipped: ${eventId}`);
      return; // Already processed — idempotent skip
    }

    // Process event (business logic)
    try {
      await this.processUserRegistration(job.data.payload);

      // Record dedup
      await this.db.insert(eventDedupTable).values({
        eventId,
        eventType: 'identity.user.registered',
        handlerName: 'UserRegisteredHandler',
        processedAt: new Date(),
        status: 'completed',
      });
    } catch (error) {
      // Record failure for debugging (dedup still written)
      await this.db.insert(eventDedupTable).values({
        eventId,
        eventType: 'identity.user.registered',
        handlerName: 'UserRegisteredHandler',
        processedAt: new Date(),
        status: 'failed',
        result: { error: error.message },
      });
      throw error; // Let BullMQ retry
    }
  }
}
```

### 4.5 Idempotency for Replayed DLQ Events

Replayed events carry `_replayed: true` and `_originalDLQId`. The dedup key for replayed events is the original DLQ entry ID, preventing double-processing if the original event was already processed before DLQ rejection:

```typescript
const dedupKey = job.data._replayed ? job.data._originalDLQId : eventId;
```

---

## 5. Principle 4: Ordering Guarantees

### 5.1 Intra-Aggregate Ordering

Events for the same aggregate (e.g., same `userId`, same `orderId`) are **strictly ordered**:

```
Order events for orderId "01JFX..." are processed in sequence:
  service.order.placed     → processed first
  service.order.assigned   → processed second
  service.order.completed  → processed third
```

**Enforcement:**

- Outbox poller publishes events in `created_at ASC` order
- BullMQ processes events in FIFO order within a queue
- Single worker per aggregate (if strict ordering is required) or use BullMQ group-based rate limiting

```typescript
// When strict ordering is required per aggregate,
// derive the queue name dynamically:
const aggregateQueue = `identity.events.${aggregateId}`;
// All events for this aggregate go to a dedicated FIFO queue
```

### 5.2 Inter-Aggregate Ordering

Events for different aggregates have **no ordering guarantee**:

```
Event A: identity.user.registered (aggregate: user-123)
Event B: commerce.order.placed     (aggregate: order-456)

A and B are independent. B may process before A, or A before B.
```

**This is eventual consistency.** Systems that depend on Event A before Event B must implement their own synchronization (e.g., wait for A's side effect before processing B).

### 5.3 Causality Tracking

When event ordering across aggregates matters, use **causality IDs**:

```json
{
  "event": "commerce.shipment.created",
  "payload": {
    "orderId": "order-456",
    "causedBy": {
      "eventId": "01JFX...",
      "eventType": "commerce.payment.completed"
    }
  }
}

// Handler can check: has the causal event been processed?
// If not → delay processing (retry with backoff)
```

---

## 6. Principle 5: Saga Pattern

### 6.1 Saga Definition

Multi-step workflows that span domains are implemented as **orchestration sagas**. Each step emits an event, which triggers the next handler, which emits the next event.

```
┌──────────────────────────────────────────────────────────────┐
│ Order Fulfillment Saga                                        │
│                                                               │
│  commerce.order.placed                                         │
│    │                                                          │
│    ├─▶ inventory: commerce.inventory.reserved                  │
│    │     │                                                    │
│    │     ├─▶ [success] payment: commerce.payment.completed     │
│    │     │     │                                              │
│    │     │     ├─▶ shipping: commerce.shipment.created         │
│    │     │     │     │                                        │
│    │     │     │     └─▶ notification: notification.delivery.sent │
│    │     │     │                                              │
│    │     │     └─▶ [failure] payment: commerce.payment.failed  │
│    │     │           │                                        │
│    │     │           └─▶ [compensate] inventory: commerce.inventory.released │
│    │     │                                                   │
│    │     └─▶ [failure] inventory: ─ (no compensation needed)   │
│    │                                                          │
│    └─▶ [compensate] commerce.order.cancelled                   │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 Saga State Tracking

```sql
CREATE TABLE public.saga_state (
  saga_id       TEXT PRIMARY KEY,              -- ULID, globally unique saga identifier
  saga_type     TEXT NOT NULL,                 -- "OrderFulfillment", "UserOnboarding"
  aggregate_id  TEXT NOT NULL,                 -- "order-456", "user-123"
  status        TEXT NOT NULL DEFAULT 'active', -- active | completed | compensating | compensated | failed
  current_step  TEXT NOT NULL,                 -- "inventory.reserved", "payment.completed"
  step_history  JSONB NOT NULL DEFAULT '[]',   -- Array of completed steps with timestamps
  payload       JSONB NOT NULL,                -- Saga data carried through steps
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT saga_state_pk PRIMARY KEY (saga_id)
);

CREATE INDEX idx_saga_state_status ON public.saga_state (status, started_at);
CREATE INDEX idx_saga_state_aggregate ON public.saga_state (aggregate_id);
```

### 6.3 Compensation Events

When a step fails, compensation events undo previously completed steps:

| Saga Step | Success Event | Failure Compensation Event |
|:---|:---|:---|
| Reserve inventory | `commerce.inventory.reserved` | `commerce.inventory.released` |
| Process payment | `commerce.payment.completed` | `commerce.order.refunded` |
| Create shipment | `commerce.shipment.created` | Shipment cancellation (carrier API call) |
| Send notification | `notification.delivery.sent` | No compensation (informational only) |

### 6.4 Saga Implementation Template

```typescript
@Processor('commerce.events')
export class OrderFulfillmentSaga {
  constructor(
    private readonly db: Database,
    private readonly eventBus: EventBus,
  ) {}

  // Step 1: Order placed → Reserve inventory
  @Process('commerce.order.placed')
  async onOrderPlaced(job: Job): Promise<void> {
    const { orderId, items } = job.data.payload;

    const sagaId = await this.db.transaction(async (tx) => {
      // Create saga state
      const sagaId = generateUlid();
      await tx.insert(sagaStateTable).values({
        sagaId,
        sagaType: 'OrderFulfillment',
        aggregateId: orderId,
        status: 'active',
        currentStep: 'inventory.reserved',
        stepHistory: JSON.stringify([{
          step: 'order.placed',
          completedAt: new Date().toISOString(),
        }]),
        payload: job.data.payload,
      });

      // Queue inventory reservation
      await this.eventBus.emit('commerce.inventory.reserved', {
        sagaId,
        orderId,
        items,
        _eventVersion: '1.0',
      });

      return sagaId;
    });
  }

  // Step 2: Inventory reserved → Process payment
  @Process('commerce.inventory.reserved')
  async onInventoryReserved(job: Job): Promise<void> {
    const { sagaId, orderId } = job.data.payload;

    // Update saga state
    await this.db.update(sagaStateTable)
      .set({
        currentStep: 'payment.completed',
        stepHistory: sql`step_history || ${JSON.stringify([{
          step: 'inventory.reserved',
          completedAt: new Date().toISOString(),
        }])}::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(sagaStateTable.sagaId, sagaId));

    // Emit payment processing event
    await this.eventBus.emit('commerce.payment.completed', {
      sagaId,
      orderId,
      _eventVersion: '1.0',
    });
  }

  // Step 3 failure: Payment failed → Compensate
  @Process('commerce.payment.failed')
  async onPaymentFailed(job: Job): Promise<void> {
    const { sagaId, orderId, reason } = job.data.payload;

    await this.db.transaction(async (tx) => {
      // Mark saga as compensating
      await tx.update(sagaStateTable)
        .set({
          status: 'compensating',
          stepHistory: sql`step_history || ${JSON.stringify([{
            step: 'payment.failed',
            reason,
            completedAt: new Date().toISOString(),
          }])}::jsonb`,
          updatedAt: new Date(),
        })
        .where(eq(sagaStateTable.sagaId, sagaId));

      // Emit compensation: release inventory
      await this.eventBus.emit('commerce.inventory.released', {
        sagaId,
        orderId,
        reason: `Payment failed: ${reason}`,
        _eventVersion: '1.0',
      });
    });
  }

  // Final step: Inventory released → Saga compensated
  @Process('commerce.inventory.released')
  async onInventoryReleased(job: Job): Promise<void> {
    const { sagaId } = job.data.payload;

    await this.db.update(sagaStateTable)
      .set({
        status: 'compensated',
        currentStep: 'compensated',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sagaStateTable.sagaId, sagaId));
  }
}
```

### 6.5 Saga Timeouts

Sagas that don't complete within a timeout must be escalated:

```typescript
// scheduler.repeatable job: check-saga-timeouts (every 5 minutes)
@Process('check-saga-timeouts')
async checkSagaTimeouts(): Promise<void> {
  const timeoutMinutes = 30;

  const stuckSagas = await this.db
    .select()
    .from(sagaStateTable)
    .where(and(
      eq(sagaStateTable.status, 'active'),
      lt(sagaStateTable.startedAt, new Date(Date.now() - timeoutMinutes * 60_000)),
    ));

  for (const saga of stuckSagas) {
    this.logger.error(`Saga ${saga.sagaId} (${saga.sagaType}) timed out at step ${saga.currentStep}`);
    // Emit alert event
    await this.eventBus.emit('analytics.kpi.threshold_breached', {
      kpiId: 'saga-timeout',
      name: 'Saga Timeout',
      domain: saga.sagaType,
      targetValue: 0,
      currentValue: 1,
      direction: 'above_threshold',
      metadata: { sagaId: saga.sagaId, sagaType: saga.sagaType },
      _eventVersion: '1.0',
    });
  }
}
```

---

## 7. Principle 6: Consistency Boundaries

### 7.1 Domain as Consistency Boundary

Each domain is a **consistency boundary**. Within a boundary, operations are ACID. Across boundaries, consistency is eventually achieved through events.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  IDENTITY    │     │  CUSTOMER    │     │  COMMERCE    │
│  ──────────  │     │  ──────────  │     │  ──────────  │
│  ACID txns   │◄───▶│  ACID txns   │◄───▶│  ACID txns   │
│              │event│              │event│              │
│  users,      │     │  customers,  │     │  products,    │
│  roles,      │     │  comm_logs   │     │  orders,      │
│  sessions    │     │              │     │  payments     │
└─────────────┘     └─────────────┘     └─────────────┘
       │                    │                    │
       └────────────────────┼────────────────────┘
                            │
                    ┌───────┴───────┐
                    │  EVENT BUS     │
                    │  (BullMQ)      │
                    └───────┬───────┘
                            │
       ┌────────────────────┼────────────────────┐
       │                    │                    │
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  SUPPORT     │     │ NOTIFICATION │     │  ANALYTICS   │
│  ──────────  │     │  ──────────  │     │  ──────────  │
│  ACID txns   │     │  ACID txns   │     │  Eventually   │
│              │     │              │     │  consistent   │
│  tickets,    │     │  templates,  │     │  ──────────   │
│  messages,   │     │  logs        │     │  Read models  │
│  SLA         │     │              │     │  from events  │
└─────────────┘     └─────────────┘     └─────────────┘
```

### 7.2 Read Models

Analytics dashboards, reports, and KPI views are **read models** updated asynchronously:

1. Domain emits event (e.g., `commerce.payment.completed`)
2. Analytics handler consumes event
3. Handler updates materialized view / KPI snapshot table
4. Dashboard reads from updated materialized view

**Latency:** Read models are typically 1-5 minutes behind the source of truth. This is an explicit design choice: analytics accuracy is sacrificed for domain isolation and scalability.

### 7.3 Cross-Domain Transaction Pattern

When a business operation spans domains, use the event flow (not distributed transactions):

```
BAD (distributed transaction):
  BEGIN;
    INSERT INTO identity.users ...;   -- Identity DB
    INSERT INTO customer.customers ...; -- Customer DB
  COMMIT;  -- Requires 2PC, complex, fragile

GOOD (event flow):
  BEGIN;
    INSERT INTO identity.users ...;  -- Identity DB only
    INSERT INTO outbox ... (identity.user.registered);
  COMMIT;

  -- Async: Customer domain handles the event
  identity.user.registered → customer domain handler → INSERT INTO customer.customers
```

---

## 8. Principle 7: Dead Letter Handling

### 8.1 Policy

DLQ events are **NOT automatically replayed**. Every DLQ entry represents a failure that requires human judgment:

| Failure Type | Operator Decision |
|:---|:---|
| `VALIDATION_ERROR` — missing required field | Fix the producer code, replay event |
| `VALIDATION_ERROR` — wrong type | Fix the producer code, replay event |
| `SCHEMA_NOT_FOUND` — event name typo | Fix the event name in producer, discard old event |
| `VERSION_MISMATCH` — unknown version | Fix version, replay OR discard if version retired |
| `SCHEMA_COMPILE_ERROR` — schema bug | Fix the schema in event-schemas.yaml, replay event |
| Event is 30+ days old, business irrelevant | Discard |

### 8.2 Replay Decision Workflow

```
DLQ event appears → Alert triggered →
  1. Operator reviews event in Admin UI
  2. Operator identifies root cause (schema, producer, consumer)
  3. Operator decides:
     a. Fix + Replay: Apply fix (code/schema), then replay event
     b. Discard: Event no longer relevant (e.g., expired cart notification)
     c. Defer: Known issue, fix in progress, leave in DLQ
  4. Action logged to audit trail
```

### 8.3 DLQ Auto-Discard (Limited)

Only these event types can be auto-discarded after 7 days in DLQ:

- `commerce.cart.item_added` — cart already expired
- `commerce.cart.item_removed` — cart already expired
- `commerce.cart.abandoned` — already handled by cart timeout
- `analytics.export.expired` — export file already deleted
- `customer.export.completed` — export file already expired (7-day retention)

All other events require explicit operator action.

---

## 9. Principle 8: Monitoring and Tracing

### 9.1 Full Trace Chain

Every event emission creates a trace chain linking the HTTP request through async processing to the final result:

```
Trace ID: 01JF8XYJ11VQZNBG2S3KT4AR6D (generated at HTTP entry point)

Span 1: HTTP Request  POST /api/v1/users/register        (NestJS)
  Span 2: POST /api/v1/customers                         (NestJS → NestJS internal)
    Span 3: DB Transaction  INSERT users + INSERT outbox   (Drizzle ORM)
    Span 4: Event emit  identity.user.registered          (EventBus)
  Span 5: HTTP Response  201 Created                      (NestJS)

Span 6: Outbox Poller  publish to BullMQ                  (OutboxService)
Span 7: BullMQ Queue  identity.events                     (BullMQ)
Span 8: EventValidator  validate                          (EventValidator)
Span 9: UserRegisteredHandler  process                    (Worker)
```

### 9.2 OpenTelemetry Implementation

```typescript
import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('alharistech-events');

async function emitEvent(eventName: string, payload: Record<string, unknown>): Promise<void> {
  const span = tracer.startSpan(`emit.${eventName}`, {
    attributes: {
      'event.name': eventName,
      'event.version': payload._eventVersion as string,
      'event.aggregate_type': extractAggregateType(eventName),
    },
  });

  try {
    await outboxService.insert({
      eventType: eventName,
      payload: {
        ...payload,
        traceId: trace.getActiveSpan()?.spanContext().traceId,
      },
    });
    span.setStatus({ code: SpanStatusCode.OK });
  } catch (error) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    span.recordException(error);
    throw error;
  } finally {
    span.end();
  }
}

async function handleEvent(job: Job): Promise<void> {
  const traceId = job.data.traceId || job.data.payload?.traceId;
  const span = tracer.startSpan(`handle.${job.data.event}`, {
    links: traceId ? [{ context: { traceId, spanId: '' } }] : [],
  });

  // Propagate trace context to downstream calls
  await context.with(
    trace.setSpan(context.active(), span),
    async () => {
      // ... handle event ...
    },
  );
}
```

### 9.3 Key Metrics

```
# Event lifecycle timing
crbl_event_lifecycle_ms{eventName,status}  # HTTP → emitted → queued → processed

# Outbox health
crbl_outbox_pending_count                   # Pending events in outbox
crbl_outbox_publish_duration_ms             # Time to publish to BullMQ
crbl_outbox_failed_count{eventName}          # Failed publications

# Handler health
crbl_event_handler_duration_ms{eventName,status}  # Handler execution time
crbl_event_handler_errors_total{eventName}         # Handler failures

# End-to-end latency
crbl_event_e2e_latency_ms{eventName}
  # Time from HTTP request start to event handler completion
```

### 9.4 Event Logging Standard

Every event lifecycle step emits a structured log:

```json
{
  "level": "info",
  "timestamp": "2026-06-20T12:00:00.000Z",
  "traceId": "01JF8XYJ11VQZNBG2S3KT4AR6D",
  "event": "identity.user.registered",
  "version": "1.0",
  "step": "emitted",
  "aggregateId": "01JF8XYKZ3QN7WPA4R5T6BVE8M",
  "message": "Event emitted"
}
```

```json
{
  "level": "info",
  "timestamp": "2026-06-20T12:00:01.500Z",
  "traceId": "01JF8XYJ11VQZNBG2S3KT4AR6D",
  "event": "identity.user.registered",
  "version": "1.0",
  "step": "published",
  "queue": "identity.events",
  "jobId": "01JF8XYKZ3QN7WPA4R5T6BVE8M",
  "message": "Event published to queue"
}
```

```json
{
  "level": "info",
  "timestamp": "2026-06-20T12:00:02.100Z",
  "traceId": "01JF8XYJ11VQZNBG2S3KT4AR6D",
  "event": "identity.user.registered",
  "version": "1.0",
  "step": "validated",
  "valid": true,
  "validatorDurationMs": 1.2,
  "message": "Event validated"
}
```

```json
{
  "level": "info",
  "timestamp": "2026-06-20T12:00:02.500Z",
  "traceId": "01JF8XYJ11VQZNBG2S3KT4AR6D",
  "event": "identity.user.registered",
  "version": "1.0",
  "step": "handled",
  "handler": "UserRegisteredHandler",
  "handlerDurationMs": 350.0,
  "message": "Event handled successfully"
}
```

---

## 10. Governance Enforcement

### 10.1 CI Gates

| Gate | Check | Blocks |
|:---|:---|:---|
| Outbox usage verification | All DB writes that emit events MUST use outbox | PR merge |
| Idempotency verification | All handlers MUST call dedup check before processing | PR merge |
| Event version check | All emitted events MUST carry `_eventVersion` | PR merge |
| Trace propagation check | All handlers MUST propagate trace context | PR merge |
| Saga compensation check | All sagas MUST define compensation events | PR merge |
| DLQ handling check | No handler silently catches and ignores errors | PR merge |

### 10.2 Architecture Review Checklist

For every new async workflow, the architecture review must verify:

- [ ] Event is emitted AFTER transaction commit (not before)
- [ ] Event is recorded in outbox in the SAME transaction as the state change
- [ ] Handler checks dedup table before processing (idempotent)
- [ ] Handler propagates trace context
- [ ] Cross-domain workflow uses events (not distributed transactions)
- [ ] Saga has compensation events defined for every step
- [ ] Read models are updated through event handlers (not direct queries)
- [ ] DLQ replay strategy is documented
- [ ] Metrics are instrumented (emission, validation, handling duration)

---

## 11. Failure Recovery Scenarios

### 11.1 DB Write Succeeds, Outbox Insert Fails

```
Scenario: INSERT INTO users succeeds, INSERT INTO outbox fails (e.g., constraint violation)

Result: Transaction rolls back. User is NOT created. HTTP 500 returned.
Event NOT emitted.
Recovery: Retry the entire HTTP request.
```

### 11.2 Outbox Inserted, Queue Publish Fails

```
Scenario: Outbox record created, but BullMQ publish fails (e.g., Redis connection lost)

Result: Outbox row has status='pending'. Poller retries every 1 second for up to 5 attempts.
After 5 failures: status='failed', error logged, alert triggered.
Event NOT lost — outbox record persists.
Recovery: Fix Redis connection. Poller picks up on next cycle.
```

### 11.3 Event Published, Handler Crashes Mid-Processing

```
Scenario: Handler begins processing, crashes before completing

Result: BullMQ retries the job (exponential backoff, max 5 attempts).
If handler is idempotent: dedup check prevents double-processing.
If handler is NOT idempotent: double-processing occurs → BUG.
Recovery: Fix handler to be idempotent.
```

### 11.4 Event Validation Fails After Schema Update

```
Scenario: Schema updated to v1.1 (added required field), producer still emits v1.0

Result: Event validated against v1.1 schema → VALIDATION_ERROR → DLQ.
Producer continues to emit, more events accumulate in DLQ.
Recovery: Update producer to emit v1.1, then replay DLQ events.
```

### 11.5 Outbox Poller Crashes

```
Scenario: Outbox poller process terminates

Result: Events accumulate in outbox table (status='pending').
No events are published to BullMQ.
Alert: crbl_outbox_pending_count rises → alert triggers.
Recovery: Restart poller. It reads pending events from where it left off.
```

---

## 12. Integration with Existing Specifications

| Spec | Relationship |
|:---|:---|
| `event-validator.md` | Step between queue delivery and handler execution |
| `dlq-governance.md` | Where invalid events go |
| `event-versioning.md` | Version format and deprecation for emitted events |
| `event-contract-tests.md` | Tests that validate these consistency rules |
| `execution-boundaries.yaml` | Queue topology for event routing |
| `event-schemas.yaml` | Schema source of truth for validation |
| `enforcement.yaml` | Governance rules enforced by CI gates |
---