# ADR-024: Event Enforcement Parity — Closing the Async Boundary

## Status
Accepted

## Date
2026-06-20

## Context

### The Split-Brain Consistency Problem

As of v0.5.0, the HTTP layer is fully enforced by the Contract Runtime Bridge Layer (CRBL). Every incoming API request is validated by ContractGuard + ContractPipe against the 9 OpenAPI specifications. Every authenticated request passes PolicyGuard evaluation against the 162 RBAC policy rules. Every response is validated by ContractInterceptor. The system's synchronous boundary is contract-enforced and fail-closed.

The asynchronous boundary — the event layer — has no enforcement. The 94 event schemas defined in `specs/contracts/events/event-schemas.yaml` are loaded by SchemaRegistry and compiled into AJV validators. However, no component calls these validators at runtime. The `EventValidator` service exists only as a specification (`apps/api/src/crbl/event-validator.service.ts` is a `SPECIFICATION` stub). Events flow through the 10 BullMQ queues defined in `specs/contracts/execution-boundaries.yaml` without schema validation, version checking, or dead-letter queuing.

This creates **split-brain consistency**: the synchronous path (HTTP → controller → database) is fully validated, but the asynchronous path (event emission → BullMQ → worker handler) is uncontrolled. A single event with a missing required field or invalid format can propagate unchecked through any of the 10 queues and corrupt downstream state — orders with missing `totalAmount`, tickets with invalid `priority`, inventory events with negative `quantityReserved`.

The event layer is the **last remaining uncontrolled boundary** in the system.

### Why This Must Be Closed Now

1. **ADR-023 (Activation Strategy)** establishes the activation order: SchemaRegistry → ContractGuard/ContractPipe → PolicyGuard → ContractInterceptor → EventValidator. Stages 0–3 are complete. Stage 4 (EventValidator) is the final stage. The CRBL activation cannot be declared complete until the event layer is enforced.

2. **ADR-021 (CRBL Architecture)** mandates that every event payload must be validated against its declared contract at runtime. The current state — loaded validators with no activation — violates the CRBL design.

3. **Governance Compliance.** `.governance/enforcement.yaml` requires fail-closed (PERP-FCL) for all system boundaries. The event layer is a system boundary — it is the entry point to the worker layer where emails, SMS, reports, AI inference, and file processing occur. An unvalidated event entering the worker layer violates PERP-FCL.

4. **Developer Trust.** If events can be emitted without validation, developers learn that contracts are optional for async operations. This erodes the culture of contract-first development that CRBL was designed to establish. Over time, event producers will drift from their schemas, and the 94 event contracts will become documentation fiction — exactly what CRBL was built to prevent.

5. **Retrofit Cost Escalation.** If we defer event enforcement past Sprint 0.6, events will be implemented across all 9 domains without validation guardrails. Retrofitting validation after producers and consumers are built is significantly harder: every producer must be audited for compliance, every consumer must be made tolerant of newly-rejected events, and the DLQ replay mechanism must handle events emitted under old (invalid) schemas. Adding enforcement now — before events are widely implemented — is trivially cheaper.

## Decision Drivers

1. **Contract Consistency.** The same contract file (`event-schemas.yaml`) must be authoritative for both synchronous and asynchronous operations. No split-brain.
2. **Fail-Closed.** Every event that fails validation must be rejected to a dead-letter queue — never silently processed.
3. **Zero Developer Overhead.** Event producers emit events as they do today. Validation is transparent BullMQ middleware — no per-producer boilerplate.
4. **Observability.** Every validation pass and failure must be metered. The DLQ must be inspectable and replayable via admin API.
5. **Performance Budget.** Event validation must fit within the < 3ms p95 overhead budget established by the EventValidator design spec.

## Options Considered

### Option A: Full Event Enforcement Now (Chosen)

- **Description:** Activate the EventValidator as a BullMQ worker middleware. Every event emitted into any of the 10 BullMQ queues passes through AJV schema validation before the worker handler processes it. Invalid events go to a dead-letter queue (DLQ) with full metadata for inspection and replay. Event version is embedded in the payload. Schema version is resolved at validate-time from the SchemaRegistry.

- **Activation scope:**
  - All 94 event schemas compiled and validated against
  - All 10 BullMQ queues covered (no skip queues)
  - DLQ enabled per queue (`dlq:{queueName}`) with 30-day TTL
  - Version matching: embedded event version checked against schema version
  - Fail-closed: SchemaRegistry not ready → all events rejected
  - Unknown event name → rejected (not in event catalog)
  - Middleware pattern: applied at BullMQ worker level, transparent to handlers

- **Pros:**
  - **Closes the boundary.** No event processes without validation. System-wide determinism is achieved — both sync and async paths are contract-enforced before Sprint 1.
  - **Prevents drift retrofitting.** Activating now — before events are widely implemented across domains — means producers are built with validation from day one.
  - **Completes CRBL activation.** ADR-023 Stage 4 is the final activation stage. With EventValidator active, the CRBL is fully operational.
  - **DLQ provides safety valve.** Invalid events are not lost — they are stored with full metadata for inspection and replay. Operations can monitor, debug, and replay events without production impact.
  - **Transparent to developers.** Event producers and handlers don't change. The middleware intercepts every job before the handler runs.
  - **SchemaRegistry reuse.** The validators are already compiled by SchemaRegistry at bootstrap. EventValidator simply calls `getEventValidator()` — no additional schema loading or compilation overhead.

- **Cons:**
  - **Adds ~2ms overhead per event.** While within the 3ms budget, this is non-zero latency for async processing. Mitigated by AJV compilation caching.
  - **BullMQ worker infrastructure required.** The worker layer must be deployed and running for events to be processed. This is already defined in `specs/contracts/execution-boundaries.yaml` — the worker processes exist in the deployment topology.
  - **DLQ requires monitoring + replay admin API.** Dead-lettered events accumulate. Operations must monitor DLQ depth and have tooling to inspect and replay events. The admin API endpoints are deferred to Sprint 0.6 but the DLQ storage structure is implemented now.
  - **Schema maintenance discipline.** Every new event type must be added to `event-schemas.yaml` before it can be emitted. CI enforces this, but it requires developer awareness.

### Option B: Defer to Sprint 1

- **Description:** Keep EventValidator as a specification. Implement event processing in Sprint 0.6 without validation. Activate enforcement in Sprint 1 after all 94 events have producer and consumer implementations.

- **Pros:**
  - No middleware overhead during initial event implementation.
  - Developers can iterate on event payloads without schema constraints during Sprint 0.6.

- **Cons:**
  - **Risk of contract drift.** Events implemented without validation will inevitably diverge from their declared schemas. By Sprint 1, the 94 event schemas may not match any actual event payload — they become documentation fiction.
  - **Higher retrofitting cost.** Retrofitting validation after events are implemented requires: (a) auditing all producers for schema compliance, (b) fixing non-compliant producers, (c) updating consumers that depend on non-compliant payload shapes, (d) handling DLQ entries from the non-validated period.
  - **Split-brain continues.** For the duration of Sprint 0.6, the sync path is enforced and the async path is not. This creates an inconsistent security posture.
  - **Governance violation.** PERP-FCL is violated for the entire Sprint 0.6 period.

### Option C: Partial Enforcement — Critical Events Only

- **Description:** Activate EventValidator only for critical event types: orders (service.order.*, commerce.order.*), payments (commerce.payment.*), inventory (commerce.inventory.*), and identity (identity.*). Non-critical events (content, notifications, analytics) pass through unvalidated.

- **Pros:**
  - Reduces validation overhead for non-critical event flows.
  - Focuses enforcement on the highest-risk event types (financial, identity).

- **Cons:**
  - **Inconsistent enforcement.** Why are some events validated and not others? The threshold for "critical" is subjective and will drift over time. A "non-critical" event like `customer.profile.updated` may seem harmless now but could carry corrupted data that breaks downstream analytics or integrations.
  - **Complex configuration.** Partial enforcement requires per-event or per-queue skip lists. These must be maintained and justified. Every skip list entry is a governance exception.
  - **False sense of security.** Teams may assume "events are validated" when in fact only a subset is. Non-validated events can still corrupt state.
  - **No architectural justification.** The CRBL architecture does not distinguish between "critical" and "non-critical" events. All events are part of bounded contexts with defined schemas. Partial enforcement is a policy hack, not an architectural decision.

## Decision

We chose **Option A: Full Event Enforcement Now.** Every event emitted into any BullMQ queue must pass schema validation before entering the worker handler. Invalid events are rejected to a dead-letter queue. Event version is embedded in the event payload and checked against the schema version resolved from SchemaRegistry at validate-time.

Rationale:

1. **The split-brain must be closed.** The HTTP layer has been contract-enforced since v0.5.0. The event layer is the last boundary gap. Leaving it open — even temporarily — means the system is only partially deterministic. A fully contract-enforced system is achievable now, not in a future sprint.

2. **The cost of deferral is higher than the cost of activation.** Activating now requires writing ~150 lines of middleware and registering it in the CRBL module. Deferring to Sprint 1 requires auditing, retrofitting, and potentially fixing all 94 event producers and their consumers — days of work vs. hours.

3. **The SchemaRegistry already has the validators compiled.** The AJV validators for all 94 event schemas are compiled at bootstrap and cached in memory. The EventValidator simply calls `getEventValidator()` — there is no additional schema loading, parsing, or compilation cost. The validation overhead is AJV's `validate()` call only (< 2ms on cached validators).

4. **The BullMQ middleware pattern is the correct architectural seam.** BullMQ's worker middleware is designed for exactly this use case: intercept every job before the handler, validate or transform, and either proceed or reject. The EventValidator fits this pattern without monkey-patching or framework hacks.

5. **Option B defers the problem at escalating cost.** The longer validation is deferred, the more events are implemented without enforcement, and the harder it becomes to activate enforcement later. This is the "retrofit cost escalation" problem described in ADR-023.

6. **Option C creates a false sense of security.** "Partial enforcement" is an oxymoron for a fail-closed system. Either the boundary is enforced or it is not. Whitelisting some events and not others creates governance exceptions that erode the entire enforcement model.

## Consequences

### Positive

- **System-wide determinism before Sprint 1.** Both sync (HTTP) and async (event) boundaries are contract-enforced. The system is fail-closed at every ingress point. This achieves the CRBL vision established in ADR-021.
- **CRBL activation complete.** ADR-023 Stage 4 is the final stage. With EventValidator active, the gradual activation strategy is complete. The CRBL dashboard shows all components as `active`.
- **Event contract integrity.** Every event emitted must match its declared schema. Producers that emit invalid events are caught immediately — not discovered when a downstream consumer fails with a cryptic error.
- **DLQ provides operational safety.** Invalid events are not silently dropped. They are stored with full metadata (original payload, AJV errors, retry count, timestamp) for inspection and replay. Operations can monitor DLQ depth and investigate validation failures without production impact.
- **Transparent to event producers and consumers.** The middleware intercepts jobs at the BullMQ worker level. Producers emit events as before. Handlers receive validated events with `_validated = true`.
- **Versioning foundation.** The version check infrastructure is in place from day one. When event schemas evolve (v1.0 → v1.1), the validator will enforce compatibility. This is critical for the multi-version event catalog planned for Sprint 1.

### Negative

- **~2ms per event overhead.** While within the 3ms budget, this is non-zero async processing latency. For high-throughput queues (notification.email at concurrency 10), the cumulative overhead is negligible but measurable.
- **BullMQ worker infrastructure must be deployed.** The EventValidator is a BullMQ middleware — it requires a running worker process. This is already defined in `specs/contracts/execution-boundaries.yaml` and the Docker Compose deployment topology. The worker app (`apps/worker`) must be built and deployed alongside the API.
- **DLQ storage consumes Redis memory.** Each dead-lettered event stores the full original payload. At ~2-5 KB per entry and 10,000 max entries per queue, each queue's DLQ can consume up to 50 MB of Redis memory. The 30-day TTL and overflow eviction (oldest LPOP'd when full) prevent unbounded growth, but operations must monitor DLQ depth.
- **Replay admin API deferred to Sprint 0.6.** The DLQ stores events with full metadata, but the admin API endpoints for inspection and replay (`GET /api/system/events/dlq`, `POST .../replay`) are not yet implemented. Operations can inspect DLQ entries directly via Redis CLI until the admin API is available.

### Risks

- **Risk 1: Events fail validation due to schema drift during pass-through period.**
  During the period when events were emitted without validation (v0.3.0–v0.5.0), producers may have drifted from the declared schemas. Activating validation could cause a spike in DLQ entries as previously-accepted but non-compliant events are rejected.
  - **Mitigation:** Before activation, run the contract test suite against all 94 event schemas with sample payloads from each domain. Any schema mismatches are fixed (update schema or fix producer) before activation. The activation is gated by passing event contract tests.

- **Risk 2: SchemaRegistry not ready at EventValidator init.**
  If SchemaRegistry fails to load (e.g., missing `event-schemas.yaml` file, YAML parse error), `onModuleInit` sets `ready = false`. All events are rejected (fail-closed).
  - **Mitigation:** SchemaRegistry is activated first (ADR-023 Stage 0) and monitored for 24 hours before EventValidator activation. The health endpoint confirms SchemaRegistry is `healthy` with all 94 event schemas loaded. If SchemaRegistry is unhealthy, EventValidator activation is blocked.

- **Risk 3: Performance regression in worker throughput.**
  AJV validation adds ~2ms per event. At high concurrency (notification.email at 10 concurrent workers), this could reduce throughput if the validation becomes a bottleneck.
  - **Mitigation:** The 3ms p95 budget was established in the EventValidator design spec and validated during CRBL architecture review. AJV's `compile()` mode generates optimized validation functions. The first validation of an event type compiles the validator (~50ms cold start). Subsequent validations use the cached compiled validator (< 2ms). The performance budget is achievable.

- **Risk 4: DLQ accumulation during initial activation.**
  If multiple producers emit invalid events in the first hours after activation, the DLQ could fill rapidly. A full DLQ (10,000 entries) triggers LPOP of oldest entries — events are lost.
  - **Mitigation:** Monitor DLQ depth via Prometheus metrics (`crbl_event_validation_failed`). Set alerts at 50% and 80% capacity. If DLQ fills unexpectedly, investigate and fix the root cause (usually a producer bug or schema mismatch). Replay valid events before they are evicted.

## DLQ Integration Design

The Dead Letter Queue stores rejected events for inspection and replay. The storage structure and operational constraints are defined below.

### Redis Key Structure

| Attribute | Value |
|:---|:---|
| Key pattern | `dlq:{queueName}` |
| Key examples | `dlq:identity.events`, `dlq:commerce.events`, `dlq:support.events` |
| Data type | Redis List (LPUSH for insertion, RPOP for eviction) |
| Max entries | 10,000 per queue |
| TTL | 30 days (2,592,000 seconds) per key |
| Overflow policy | LPOP oldest entry when `LLEN > maxEntries` |

### Per-Event DLQ Entry Structure

```json
{
  "eventName": "identity.user.registered",
  "version": "1.0",
  "originalPayload": {
    "userId": "018f9a92-3c5f-7a8b-9c0d-1e2f3a4b5c6d",
    "timestamp": "2026-06-20T12:00:00Z"
  },
  "error": {
    "message": "Event payload failed schema validation",
    "errors": [
      {
        "field": "email",
        "message": "must have required property 'email'"
      }
    ]
  },
  "failedAt": "2026-06-20T12:00:01Z",
  "retryCount": 3
}
```

### Replay Flow (Admin API — Sprint 0.6)

```
POST /api/system/events/dlq/{queueName}/replay
Body: { "eventIds": ["dlq_abc123"] }

1. LRANGE dlq:{queueName} 0 -1 → find matching entry by event ID
2. Validate event against current schema version
3. ADD job to original BullMQ queue
4. LREM dlq:{queueName} 1 {entry_json}
5. Log replay action (audit log)
```

### Monitoring (Deferred — Sprint 0.6)

| Metric | Type | Labels |
|:---|:---|:---|
| `crbl_event_validation_total` | Counter | `{eventName, status: valid\|invalid}` |
| `crbl_event_validation_duration_ms` | Histogram | `{eventName}` |
| `crbl_dlq_depth` | Gauge | `{queueName}` |
| `crbl_dlq_replay_total` | Counter | `{queueName}` |

## Activation Gate

Before EventValidator is activated in staging or production, all of the following must pass:

1. **SchemaRegistry healthy for 24 hours** (ADR-023 Stage 0 gate) — verified by health endpoint returning `healthy` with 94 event schemas loaded.
2. **All event contract tests pass** — CI runs auto-generated test cases for all 94 event schemas: valid payload → pass, missing required field → rejection, invalid format → rejection.
3. **AJV compilation verified** — No schema compilation errors for any of the 94 event schemas. `verify-contracts` script runs in CI and checks all compilations.
4. **DLQ write path tested** — Integration test verifies that an invalid event is written to the DLQ Redis list with correct structure and TTL.
5. **No unexpected rejections in staging** — 24-hour soak in staging with monitoring. Zero unexpected `crbl_event_validation_failed` increments for valid events.

## Compliance

- Every event emitted into a BullMQ queue must pass `EventValidator.validate()` before entering handler — enforced by the middleware pattern applied to all workers.
- Unknown event names must be rejected (fail-closed) — enforced by SchemaRegistry lookup returning `undefined` → `EventValidationError`.
- SchemaRegistry not ready → all events rejected (fail-closed) — enforced by `ready` flag check at top of `validate()`.
- DLQ entries must include full error metadata (AJV errors, original payload, retry count) — enforced by `DeadLetterEvent` interface and `sendToDLQ()`.
- Event version must be embedded in payload — enforced by `version` parameter in `validate()` and stored in `ValidatedEvent`.
- Sensitive fields (password, token) must not appear in DLQ entries or logs — enforced by field redaction (deferred to Sprint 0.6, documented in `sendToDLQ`).
- Activation must be gated by passing contract tests and staging soak — enforced by CI pipeline and deployment checklist.

## Related Decisions

- [ADR-021: Contract Runtime Bridge Layer (CRBL)](./adr-021-contract-runtime-bridge.md) — CRBL architecture mandates event enforcement as part of the dual compile-time + runtime validation model.
- [ADR-022: CRBL Runtime Anchor (NestJS)](./adr-022-crbl-runtime-anchor.md) — NestJS as the runtime substrate; EventValidator is a NestJS injectable service used by BullMQ worker middleware.
- [ADR-023: CRBL Activation Strategy](./adr-023-crbl-activation-strategy.md) — Stage 4 (EventValidator) is the final activation stage. This ADR executes Stage 4.
- [ADR-009: BullMQ for Background Jobs](./adr-009-bullmq.md) — BullMQ worker middleware pattern that EventValidator uses for transparent event interception.
- [ADR-004: Redis for Caching & Sessions](./adr-004-redis.md) — Redis stores the DLQ entries and compiled validator cache.
