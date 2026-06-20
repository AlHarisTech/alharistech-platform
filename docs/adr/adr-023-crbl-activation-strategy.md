# ADR-023: CRBL Activation Strategy

## Status
Accepted

## Date
2026-06-20

## Context

ADR-021 established the Contract Runtime Bridge Layer (CRBL) architecture — a dual compile-time + runtime validation layer that enforces all 9 OpenAPI specs, 94 event schemas, and 162 RBAC policy rules at request time. The CRBL components (SchemaRegistry, ContractGuard, PolicyGuard, ContractInterceptor, ContractPipe, EventValidator) have been designed as NestJS guards, interceptors, and pipes per ADR-022 (Runtime Anchor).

Currently, all CRBL components operate in **pass-through mode** — they return `true` or pass through unvalidated. This was intentional to allow the monorepo to stabilize with the NestJS runtime anchor before activating enforcement. Now that the runtime anchor is operational, we must activate CRBL enforcement.

The question is **how** to activate: all at once, gradually, or behind feature flags.

## Decision Drivers

1. **Safe Rollback.** If CRBL enforcement introduces unexpected rejections in production, we must be able to roll back per-component without reverting all enforcement.
2. **Verifiable Per Stage.** Each activation stage must be independently testable. Contract tests must pass before proceeding to the next stage.
3. **Dependency Order.** Some components depend on others. SchemaRegistry must be operational before any guard, interceptor, or pipe can use it.
4. **Minimal Production Disruption.** Activation must not cause 503s or downtime during the transition.
5. **Developer Visibility.** Teams must know when enforcement is active in their domain and have tooling to test against it locally.

## Options Considered

### Option A: Gradual Activation — Per-Component (Chosen)

- **Description:** Activate CRBL components one at a time in dependency order. Each stage is verified with contract tests and integration tests before proceeding to the next.
- **Activation order:**
  1. **SchemaRegistry** — Load and compile all schemas. Expose health endpoint. No enforcement yet — components still pass-through but can now query the registry. Verify: health endpoint returns `healthy`, all 9 specs + 94 events + 162 policies loaded.
  2. **ContractGuard + ContractPipe** — Request validation against OpenAPI requestBody + parameters. Reject unknown fields (removeAdditional: 'all'). Verify: contract tests pass. Existing integration tests pass.
  3. **PolicyGuard** — RBAC enforcement. Every authenticated endpoint with `security: [bearerAuth]` must pass PolicyGuard evaluation. Verify: policy completeness check passes. All 162 rules evaluated in test suite.
  4. **ContractInterceptor** — Response validation. Strip extra fields. Warn or fail on missing required fields. Verify: contract tests include response validation.
  5. **EventValidator** — Producer-side and consumer-side event schema validation. Verify: event contract tests pass. DLQ flow tested.
- **Pros:**
  - Safe rollback per component. If ContractGuard causes issues, only ContractGuard is rolled back to warn mode — PolicyGuard and SchemaRegistry remain active.
  - Each stage is independently verifiable. Tests for stage N do not depend on components from stage N+1.
  - Dependency order is respected: SchemaRegistry is stable before any consumer uses it.
  - Developers can observe enforcement ramping up incrementally rather than a sudden "everything rejects" event.
  - ~2 weeks total activation time allows adequate soak-in per stage.
- **Cons:**
  - Longer total activation time compared to big-bang (~2 weeks vs ~2 days).
  - During intermediate states, some validation is active while some is not — no single "fully enforced" cutover moment.

### Option B: Big-Bang Activation

- **Description:** Activate all CRBL components simultaneously in a single deployment. All guards, interceptors, and pipes switch from pass-through to active enforcement at once.
- **Pros:**
  - Clean cutover moment. All enforcement is active or none is.
  - Minimal code changes — flip a boolean or environment variable for all components.
  - Fast (~2 days to prepare, 1 deployment to activate).
- **Cons:**
  - No per-component rollback. If any component causes issues, all enforcement must be rolled back.
  - Hard to isolate which component is causing rejections when everything activates at once.
  - Higher risk of production disruption — 9 domains x ~200 endpoints x 162 policies all enforced simultaneously with no gradual soak-in.
  - Contract drift may have accumulated during pass-through phase. Big-bang activation could reject previously-accepted requests with no gradual adjustment period.

### Option C: Feature-Flag Activation

- **Description:** Use runtime configuration (environment variables or Redis feature flags) to toggle enforcement per guard and per domain. Flags: `CRBL_CONTRACT_GUARD_ENABLED=true`, `CRBL_POLICY_GUARD_ENABLED=true`, etc. Per-domain flags: `CRBL_DOMAIN_IDENTITY_ENFORCE=true`.
- **Pros:**
  - Maximum flexibility — toggle individual components and domains independently.
  - Can activate enforcement for stable domains before unstable ones.
  - Rollback is instant via config change (no redeploy).
- **Cons:**
  - Configuration complexity. 5 components x 9 domains = 45 potential flags. Increases cognitive load and operational risk.
  - Inconsistent enforcement across domains creates security gaps. If PolicyGuard is active for identity but not for commerce, authorization is partial.
  - Per-request flag evaluation adds latency to every request (reading env var or Redis).
  - Feature flags for security enforcement is an anti-pattern — enforcement should be architectural, not configurable per request.

## Decision

We chose **Option A: Gradual Activation — Per-Component**. The dependency-ordered activation provides safe rollback, independent verification, and minimal risk to production traffic. The ~2 week timeline is acceptable given the platform's current stage (pre-production, v0.4.0).

Rationale:

1. **SchemaRegistry must be first.** It is the dependency for all other CRBL components. Activating it first with health monitoring ensures the schema loading pipeline is stable before any enforcement component consumes its validators.

2. **Request validation before response validation.** ContractGuard and ContractPipe catch invalid inputs at the ingress boundary. If a request is invalid, there is no controller execution and no response to validate. Activating these first gives the most value (invalid inputs are the most common contract violation).

3. **Authorization after input validation.** PolicyGuard depends on the caller context (JWT) and the resource/action mapping. It must activate after ContractGuard because a request that fails contract validation should not proceed to policy evaluation — the 422 response is more informative than a 403.

4. **Response validation after the pipeline is stable.** ContractInterceptor validates controller outputs. If ContractGuard is rejecting malformed requests and PolicyGuard is enforcing authorization, controllers are already operating on clean, authorized inputs. Response validation is the final defense-in-depth layer.

5. **Event validation last.** Events are asynchronous. Invalid events go to a dead-letter queue — they do not block API responses. Activating event validation last allows the synchronous pipeline (request → response) to stabilize first.

6. **Option B is too risky.** The platform is v0.4.0 — pre-production. Contracts may have drifted during the pass-through phase. Activating all enforcement at once could flood the team with contract violations that should have been caught and fixed gradually.

7. **Option C adds unnecessary complexity.** Feature flags for security enforcement create a false sense of flexibility. Either a domain is enforcing contracts or it is not. Per-domain inconsistency invites the question: "if contract enforcement is optional per domain, is it actually enforced?"

## Consequences

### Positive

- **Safe rollback per component.** If ContractGuard causes unexpected 422s in staging, it can be rolled back to warn mode without touching PolicyGuard or ContractInterceptor. Each component is independently toggleable via the `CRBL_MODE` environment variable (`strict` | `warn`).
- **Independent verification.** Each activation stage has its own test suite and acceptance criteria. Gate each stage with:
  - All contract tests pass
  - All integration tests pass
  - Health endpoint returns `healthy`
  - No contract violation alerts for the newly-activated component in staging (24-hour soak)
- **Observable ramp-up.** Metrics dashboard shows enforcement status: which components are in strict mode, which are in warn mode, and which are still pass-through. Teams see the transition happening.
- **Dependency order enforced.** SchemaRegistry activation is the gate — no other component activates until SchemaRegistry is healthy for 24 hours in the target environment.
- **~2 week timeline fits the sprint.** Sprint 0.5 is a 3-week sprint. CRBL activation fits within it with buffer for unexpected issues.

### Negative

- **~2 week activation window.** During this time, enforcement is partial. A request might pass ContractGuard (strict) but bypass PolicyGuard (not yet activated). This is an acceptable transitional state but not the final posture.
- **Intermediate states require careful communication.** The team must track which components are active in which environment. A dashboard in the developer portal will display activation status.
- **Staging must be activated before production.** Each stage soaks in staging for 24 hours before production activation. This adds ~1 day per stage to the timeline.

### Risks

- **Risk 1: Contract drift discovered during activation.** Contracts may have drifted from actual API behavior during the pass-through phase. Activating ContractGuard could reveal endpoints that return fields not in the OpenAPI spec, or accept fields not declared in the requestBody schema.
  - **Mitigation:** Before activating each stage, run the contract test suite against staging. Any failing tests indicate drift that must be fixed (update contract or update controller) before activation. This is a feature — CRBL is doing its job by exposing drift.

- **Risk 2: SchemaRegistry load failure blocks activation.** If SchemaRegistry fails to load all 9 OpenAPI specs in staging or production, no enforcement components can activate (they depend on SchemaRegistry health).
  - **Mitigation:** SchemaRegistry is activated first and monitored for 24 hours. If it fails to load, it emits `SchemaRegistryLoadFailure` (P0 alert). The cause is debugged before any enforcement component activation is attempted.

- **Risk 3: AJV compile errors on specific endpoints.** Some OpenAPI schemas may fail AJV compilation (e.g., circular $ref, unknown format, schema depth violations).
  - **Mitigation:** The `verify-contracts` CI step validates all AJV compilations before deployment. Schema compilation errors are caught in CI — they never reach staging or production.

- **Risk 4: Performance regression during gradual activation.** Each activated component adds latency. The cumulative overhead is within the < 5ms p95 budget, but the team must monitor this as each component activates.
  - **Mitigation:** `crbl_validation_duration_seconds` histogram tracks latency per component per stage. If any component exceeds its latency budget, it is rolled back to warn mode while the root cause is investigated.

## Activation Schedule

| Stage | Component | Activation Date | Soak Period | Acceptance Criteria |
|:---|:---|:---|:---|:---|
| 0 | SchemaRegistry | Sprint Day 1 | 24 hours | Health endpoint returns `healthy`. All 9 specs, 94 events, 162 policies loaded. |
| 1 | ContractGuard + ContractPipe | Sprint Day 3 | 48 hours | Contract tests pass. No unexpected 422s in staging. |
| 2 | PolicyGuard | Sprint Day 6 | 48 hours | Policy tests pass. No unexpected 403s in staging. Policy completeness check passes. |
| 3 | ContractInterceptor | Sprint Day 9 | 48 hours | Response contract tests pass. No `X-Contract-Violation` headers on valid responses. |
| 4 | EventValidator | Sprint Day 12 | 72 hours (over weekend) | Event contract tests pass. No unexpected DLQ entries. |

## Compliance

- Each activation stage must be gated by passing contract tests — enforced by CI pipeline.
- Production activation must be preceded by 24-hour staging soak — enforced by deployment checklist.
- Any CRBL component rolled back to warn mode must trigger a P1 incident for root cause investigation — enforced by incident response policy.
- Activation status must be visible in the developer portal and metrics dashboard — enforced by infrastructure checklist.

## Related Decisions

- [ADR-021: Contract Runtime Bridge Layer (CRBL)](./adr-021-contract-runtime-bridge.md) — Architecture of the enforcement components being activated.
- [ADR-022: CRBL Runtime Anchor (NestJS)](./adr-022-crbl-runtime-anchor.md) — NestJS as the runtime substrate for CRBL enforcement.
- [ADR-002: NestJS for Backend Services](./adr-002-nestjs-backend.md) — The guards/interceptors/pipes pattern that CRBL leverages.
