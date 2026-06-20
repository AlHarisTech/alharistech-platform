# ADR-021: Contract Runtime Bridge Layer (CRBL)

## Status
Accepted

## Date
2026-06-20

## Context

As of v0.3.0, the AlharisTech platform has frozen 9 OpenAPI specifications, 94 event schemas, and 162 RBAC policy rules across `specs/contracts/`. These contract artifacts represent the authoritative specification of the platform's API surface, event payloads, and access-control model. They were produced through extensive domain modeling sessions and signed off by stakeholders.

However, these contracts are currently static YAML files. There is no automated mechanism that ensures the running NestJS application actually conforms to them. Without runtime enforcement:

1. **Contract Drift.** Developers may add or modify controller endpoints, request/response fields, or event payloads without updating the corresponding contract files. Over time, the contracts become documentation fiction — describing what the API *should* do rather than what it *actually* does.

2. **Security Gaps.** The `access-control.yaml` defines 162 policy rules with priority-based RBAC logic. If these rules are not enforced at runtime, every controller must manually implement authorization checks. A single missed check creates a privilege escalation vulnerability.

3. **Event Schema Inconsistency.** 94 event types are defined with JSON Schema payloads. If producers emit events with missing required fields or invalid formats, downstream consumers receive malformed data. Event-driven workflows break silently.

4. **CI Blindness.** Contract violations are not detected in CI/CD. A PR that introduces a new response field without updating the OpenAPI spec passes all gates and reaches production — where it causes integration failures with API consumers who rely on the published contract.

The governance rules in `.governance/enforcement.yaml` mandate "OpenAPI spec before implementation" (PERP-API) and "fail closed" (PERP-FCL). Without CRBL, these principles are not technically enforced.

## Decision Drivers

1. **Prevent Contract Drift.** Every request, response, and event must be validated against its declared contract at runtime. Drift must be detected at request time, not discovered in production incidents.
2. **Fail-Closed Security.** Unknown endpoints, unknown fields, unauthorized access, and invalid events must be rejected by default — not silently accepted.
3. **Zero Developer Overhead.** Individual developers must not need to remember to validate contracts. Enforcement must be automatic and transparent via NestJS guards, interceptors, and pipes.
4. **CI/CD Integration.** Contract adherence must be verifiable in CI/CD without a running server. Contract tests must be auto-generated from specifications.
5. **Performance.** Contract validation must not degrade API response latency. The platform's p95 latency budget is < 200ms (enterprise-architecture.md). CRBL must consume < 5ms of that budget.
6. **Observability.** Every contract violation must be logged and metered. Teams need visibility into which endpoints or events are drifting from their contracts.

## Options Considered

### Option A: CRBL — Compile-Time + Runtime Dual Validation (Chosen)

- **Description:** A dedicated Contract Runtime Bridge Layer that enforces contracts at both compile time and runtime. At compile time, TypeScript types are generated from OpenAPI specs via `openapi-typescript`. At runtime, AJV-compiled validators from JSON Schema validate every request body, response body, and event payload. Policy rules are evaluated by a priority-based RBAC engine at request time. All enforcement is automatic via NestJS guards, interceptors, and pipes.
- **Pros:**
  - **Prevents drift.** Runtime validation catches violations the moment they occur — no gap between spec and implementation.
  - **Compile-time safety.** TypeScript types generated from OpenAPI specs enable IDE autocompletion and catch type errors at build time.
  - **Fail-closed by design.** Every validation component defaults to rejection. Unknown fields → 422. Unknown endpoints → 404. Invalid events → dead-letter queue.
  - **Auto-generated contract tests.** OpenAPI specs are parsed to generate test cases: valid request → 2xx, missing field → 422, missing auth → 401, wrong role → 403.
  - **Zero developer overhead.** Guards, interceptors, and pipes are applied globally. Developers write controllers as normal; CRBL wraps them transparently.
  - **Cached performance.** AJV compiled validators run in microseconds. Redis caches validators across process restarts. Total overhead < 5ms p95.
  - **Observable.** Every violation increments a Prometheus counter with labels for component, endpoint, and reason. Dashboards show contract compliance in real time.
  - **Proven technologies.** AJV is the industry standard JSON Schema validator for Node.js (12K+ GitHub stars). OpenAPI → JSON Schema conversion is well-supported. NestJS guards, interceptors, and pipes are idiomatic extension points.
- **Cons:**
  - **Adds ~5ms p95 latency.** While within budget, this is non-zero overhead that does not exist today.
  - **Schema maintenance discipline.** Every API change must update the OpenAPI spec first. This requires developer discipline and tooling support.
  - **Startup cost.** SchemaRegistry loads and compiles all validators at application bootstrap. Adds ~500ms to cold start time (mitigated by Redis cache on warm restarts).
  - **AJV performance risks with very large schemas.** Some OpenAPI specs have deeply nested schemas. Mitigated by compilation caching and lazy loading infrequently accessed validators.
  - **Hot-reload complexity.** During development, changing a contract file must invalidate the compiled validators. chokidar file watching handles this, but it adds complexity.

### Option B: Runtime-Only Validation (Zod at Controller Level)

- **Description:** Use Zod schemas manually defined in each controller's DTO files for runtime validation. No compile-time type generation from OpenAPI. No centralized contract enforcement layer. Each controller validates its own inputs using Zod pipes.
- **Pros:**
  - Simple — uses Zod which is already adopted in the platform per coding-standards.md.
  - No new infrastructure — no SchemaRegistry, no AJV, no Redis validator cache.
  - Developers are already familiar with Zod from existing DTO validation.
- **Cons:**
  - **No contract-source linkage.** Zod schemas are manually written in DTO files. There is no guarantee they match the OpenAPI spec. Contract drift is not prevented — it's just moved to a different file.
  - **No response validation.** Zod at the controller level validates inputs only. Responses can still drift from the contract.
  - **No event validation.** BullMQ workers are not covered by NestJS pipes. Event payload validation must be implemented separately in each handler — easy to forget.
  - **No policy enforcement.** RBAC rules still require manual guard implementation per controller. The 162 policy rules are documentation, not enforcement.
  - **No contract test generation.** Tests must be manually written and maintained alongside the contracts. Likely to rot over time.
  - **CI cannot verify contracts.** Without auto-generation, there is no way to programmatically verify that code matches specs.

### Option C: Compile-Time Only (TypeScript Types, No Runtime Checks)

- **Description:** Generate TypeScript types from OpenAPI specs using `openapi-typescript`. Use these types in controllers and services. Rely on TypeScript's type checker to catch contract violations at build time. No runtime validation.
- **Pros:**
  - Zero runtime overhead — types are erased at compile time.
  - Fast in CI — type checking is already part of the build pipeline.
  - Simple — no new runtime components to maintain.
- **Cons:**
  - **No protection against runtime inputs.** TypeScript types don't exist at runtime. Malformed JSON from clients passes through unchecked.
  - **No protection against dynamic payloads.** `unknown` → `as` assertions bypass type checking. Webhook payloads, file uploads, and third-party API responses are not validated.
  - **No response validation.** Response types are compile-time only. Controllers can return extra fields or omit required fields without detection.
  - **No event validation.** Events emitted at runtime have no type safety — only the producer's discipline ensures correctness.
  - **No policy enforcement.** TypeScript types cannot enforce RBAC rules. Authorization checks remain manual.
  - **No contract test generation.** Types alone don't generate test cases.

### Option D: No Enforcement (Trust Documentation)

- **Description:** Keep the OpenAPI specs, event schemas, and policy rules as documentation. Rely on developers to manually ensure their code matches the contracts. Review contracts during code review.
- **Pros:**
  - No implementation cost — no code to write, no infrastructure to deploy.
  - No performance overhead — no validation at runtime.
  - Maximum developer flexibility — no constraints on implementation.
- **Cons:**
  - **Contract drift is inevitable.** Without automated enforcement, contracts and code will diverge. This is not a question of "if" but "when" and "how fast."
  - **Security vulnerabilities.** RBAC rules in `access-control.yaml` are 162 lines of security policy. Manual enforcement means human error will create privilege escalation bugs.
  - **Integration failures.** API consumers (frontend, partners, mobile apps) rely on contracts. When contracts are inaccurate, integrations break.
  - **Violates governance rules.** PERP-API ("OpenAPI spec before implementation") and PERP-FCL ("Fail Closed") are unenforceable without automation.
  - **No regression protection.** When a developer accidentally breaks a contract, there is no test or validation that catches it before production.
  - **Code review bottleneck.** Reviewers must manually verify contract conformance — slow, error-prone, and inconsistent.

## Decision

We chose **Option A: CRBL — Compile-Time + Runtime Dual Validation**. The Contract Runtime Bridge Layer is the only option that satisfies all decision drivers: prevents contract drift, enforces fail-closed security, requires zero developer overhead for enforcement, integrates with CI/CD, and operates within the < 5ms performance budget.

Rationale:

1. **Dual enforcement is necessary.** Compile-time types catch errors early in the development cycle (IDE, build). Runtime validation catches what compile-time cannot: malformed runtime inputs, dynamic payloads, event data, and response bodies. Together they provide defense-in-depth.

2. **NestJS is the perfect substrate.** ADR-002 chose NestJS specifically for its enterprise patterns — guards, interceptors, and pipes are first-class extensibility points. CRBL plugs into these exactly as designed, without monkey-patching or framework hacks.

3. **AJV is the right validation engine.** AJV's `compile()` mode generates optimized JavaScript functions that execute in microseconds. For typical API payloads (1-10KB JSON), validation completes in < 3ms. The 5ms budget is achievable.

4. **Redis caching eliminates cold-start penalty.** Compiled validators are serialized to Redis after first compilation. On process restart, validators are deserialized rather than recompiled — reducing startup overhead to near zero.

5. **Policy rules are too important to trust to manual enforcement.** The `access-control.yaml` defines 162 rules across 5 roles and 9 domains. A single missed check creates a privilege escalation. The PolicyGuard ensures the rule set is evaluated consistently for every request.

6. **Contract tests close the loop.** Auto-generated tests from OpenAPI specs ensure that every endpoint's response matches its declared contract. These tests run in CI and catch regressions before deployment.

7. **Options B, C, and D all fail to meet the core requirement.** Option B has no contract-source linkage — it's Zod schemas that may or may not match specs. Option C has no runtime checks — compile-time types are erased. Option D is governance non-compliance.

## Consequences

### Positive

- **Contract drift is prevented.** Every request, response, and event is validated against its declared contract. Drift is detected at request time with structured error responses. The OpenAPI specs, event schemas, and policy rules remain the single source of truth.
- **Auto-generated contract tests.** For every endpoint in every OpenAPI spec, CRBL generates test cases: valid input → expected 2xx, missing field → 422, invalid format → 422, missing auth → 401, wrong role → 403. This eliminates the manual effort of writing and maintaining API tests.
- **Fail-closed security posture.** CRBL defaults to denial at every level: unknown endpoint → 404, unknown field → 422, extra response field → stripped, invalid event → dead-letter queue. This aligns with `.governance/enforcement.yaml` PERP-FCL.
- **Observable enforcement.** Prometheus metrics track every validation pass and failure. Dashboards show contract compliance rates per endpoint and per domain. Alerting triggers when violation rates exceed thresholds.
- **Zero developer overhead.** Guards, interceptors, and pipes are applied globally. Developers write NestJS controllers using generated TypeScript types and Zod schemas. CRBL enforcement is transparent.
- **CI/CD integration.** The `verify-contracts` script validates schema compilation, checks generated files are up-to-date, and runs auto-generated contract tests. No contract regression reaches `main`.

### Negative

- **~5ms p95 latency overhead.** While within the platform's < 200ms budget, this is non-zero overhead. Infrequently accessed endpoints may experience slightly higher latency on first request due to lazy compilation (mitigated by Redis cache).
- **Schema maintenance discipline required.** Every API change must follow the sequence: update OpenAPI spec → regenerate types/validators → update implementation. This is enforced by CI (generated files must be up-to-date), but it requires developer training and discipline.
- **Cold start penalty.** First application boot compiles all validators (~500ms). Warm restarts using Redis cache eliminate this. Kubernetes rolling deployments are not affected (new pod is ready before old pod is drained).
- **Tight coupling to contract format.** CRBL assumes OpenAPI 3.1, JSON Schema Draft 2020-12, and YAML policy rules. Changing contract formats requires updating the loaders and compilers in SchemaRegistry.

### Risks

- **Risk 1: AJV performance degradation with very large or deeply nested schemas.** Some OpenAPI requestBody schemas may be large (e.g., CommerceOrder with nested items, shipping, payment). AJV's compile time grows with schema complexity.
  - **Mitigation:** Compile-time validation in CI catches schema issues before deployment. Lazy compilation defers the cost to first request, after which the compiled validator is cached in memory and Redis. Schemas with excessive nesting are flagged by `verify-contracts` (max depth: 10).

- **Risk 2: Redis unavailability blocks validator loading on warm restart.** If Redis is down when the application starts and validators are not yet in the in-memory LRU cache, SchemaRegistry must compile all validators from scratch (~500ms). If Redis is down, validators are compiled in-process on first access. The in-memory LRU cache handles subsequent requests.

- **Risk 3: Contract file changes introduce false rejections in production.** A well-intentioned OpenAPI spec update could tighten validation rules, causing previously-accepted requests to be rejected.
  - **Mitigation:** Contract files are versioned in git alongside the application code. CI runs `verify-contracts` to check schema compilation. Integration tests and auto-generated contract tests catch breaking changes before deployment. Rollback is a git revert + redeploy.

- **Risk 4: Policy condition evaluation complexity.** The PolicyGuard resolves `$caller.*` and `$resource.*` variables at request time. If a variable is unresolvable (e.g., `$resource.owner_id` when the resource type is unknown), the guard must fail-closed (deny).
  - **Mitigation:** The `verify-policies` script validates all condition variable references at build time. Unresolvable variables are rejected during CI. The resource mapping table in `access-control.yaml` defines which variables are available for each resource type.

- **Risk 5: Generated code falls out of sync with source contracts.** If a developer manually edits a generated file instead of updating the source contract, the next regeneration will overwrite their changes.
  - **Mitigation:** Generated files live under `src/generated/` with a header comment `⚠️ AUTO-GENERATED — DO NOT EDIT`. CI checks that generated files match the output of `pnpm run generate` (via `git diff --exit-code`). The linter is configured to skip `src/generated/` entirely.

- **Risk 6: Overhead of dual validation (AJV + Zod) for the same request.** AJV validates against JSON Schema (structural), Zod validates against Zod schema (business rules). Duplicate work adds latency.
  - **Mitigation:** AJV handles structural validation: types, formats, required fields, min/max constraints. Zod handles cross-field validation and business rules that JSON Schema cannot express. The overlap is minimal. Both validations combined fit within the < 5ms budget.

## Compliance

- All contract validation components must default to fail-closed (deny on error, deny on unknown, strip on extra) — enforced by CRBL architecture review and integration tests.
- Every OpenAPI endpoint must have a generated contract test covering valid request, missing fields, invalid formats, missing auth, and wrong role — enforced by CI `verify-contracts` check.
- Every `@Processor` class with event handlers must use `@ValidateEvent()` decorator — enforced by ESLint custom rule and code review.
- Every controller method requiring authorization must use `@RequirePolicy()` decorator — enforced by the PolicyGuard rejecting unannotated endpoints (default deny).
- Generated files must not be manually edited — enforced by CI `git diff --exit-code` after regeneration.
- Sensitive fields (password, token, secret) must not appear in contract violation error messages or logs — enforced by the error serializer and logger transport per security-standards.md.
- CRBL metrics must be exported to Prometheus at `/metrics` for monitoring and alerting — enforced by infrastructure checklist.

## Related Decisions

- [ADR-002: NestJS for Backend Services](./adr-002-nestjs-backend.md) — NestJS guards, interceptors, and pipes are the CRBL extension points. The decorator-based module system enables global enforcement without per-controller boilerplate.
- [ADR-004: Redis for Caching & Sessions](./adr-004-redis.md) — Redis serves as the compiled validator cache, enabling fast warm restarts and cross-process validator sharing.
- [ADR-005: TypeScript Across the Stack](./adr-005-typescript.md) — TypeScript types generated from OpenAPI via `openapi-typescript` provide compile-time contract checking.
- [ADR-009: BullMQ for Background Jobs](./adr-009-bullmq.md) — BullMQ worker middleware validates event payloads before handler execution. DLQ (dead-letter queue) receives invalid events.
- [ADR-015: OpenAPI/Swagger Documentation](./adr-015-openapi-swagger.md) — OpenAPI 3.1 specs are the authoritative contract source. CRBL enforces them at runtime.
- [ADR-016: Domain-Driven Design](./adr-016-ddd.md) — Contract enforcement is organized by bounded context. Each domain's OpenAPI spec maps to its NestJS module.
- [ADR-017: Drizzle ORM](./adr-017-orm-drizzle.md) — CRBL validates request/response/event payloads before they reach the ORM layer. Defense-in-depth: contract validation + parameterized queries.

## References

- [CRBL Architecture Blueprint](../../packages/contracts/spec/crbl-architecture.md) — Complete design specification
- [specs/contracts/openapi/identity-api.yaml](../../specs/contracts/openapi/identity-api.yaml) — OpenAPI spec example
- [specs/contracts/events/event-schemas.yaml](../../specs/contracts/events/event-schemas.yaml) — Event schema registry (94 events)
- [specs/contracts/policy/access-control.yaml](../../specs/contracts/policy/access-control.yaml) — RBAC policy rules (162 rules)
- [specs/contracts/execution-boundaries.yaml](../../specs/contracts/execution-boundaries.yaml) — CRBL runs in the NestJS API Gateway layer
- [AJV Documentation](https://ajv.js.org/) — JSON Schema validator
- [openapi-typescript](https://openapi-ts.dev/) — OpenAPI → TypeScript type generator
- [BullMQ Documentation](https://docs.bullmq.io/) — Queue system for event transport
