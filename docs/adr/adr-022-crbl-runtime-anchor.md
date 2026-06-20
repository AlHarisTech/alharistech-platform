# ADR-022: CRBL Must Attach to Real Runtime Skeleton Before Further Extension

## Status
مقبول (Accepted)

## Date
2026-06-20

## Context
ADR-021 established the Contract Runtime Bridge Layer (CRBL) — a dual enforcement system combining compile-time TypeScript types with runtime AJV validators. Six enforcement components were designed (ContractGuard, ContractInterceptor, ContractPipe, PolicyGuard, EventValidator, SchemaRegistry), along with CI verification gates.

However, the CRBL was designed in isolation — **before any runtime skeleton exists**. This creates a structural inversion:

```
Current:  Contracts → CRBL Enforcement Design → (no runtime exists)
Correct:  Contracts → Minimal Runtime Skeleton → CRBL Binds to Skeleton
```

The enforcement layer is "laws governing roads that haven't been built." Without a runtime anchor, CRBL components have no lifecycle hooks to attach to, no request pipeline to intercept, no event bus to validate against. Integration friction is guaranteed when CRBL is later retrofitted onto a runtime that wasn't designed with its hook points.

## Decision Drivers
1. NestJS lifecycle hooks are the anchor points for CRBL components (Guards, Interceptors, Pipes)
2. CRBL performance budget (5ms p95) cannot be validated without a running baseline
3. BullMQ event validation cannot be tested without actual queue infrastructure
4. SchemaRegistry hot-reload requires a NestJS provider with initialization lifecycle
5. Contract test harness requires HTTP endpoints to test against — even if they return 501

## Options Considered

### Option A: Minimal Runtime Anchor Before CRBL Binding (CHOSEN)
- **Description:** Create a minimal NestJS scaffold with PostgreSQL 16 schema, Redis 7 connection, and empty CRBL hook points. No business logic, no feature code. Just the skeleton.
- **Pros:**
  - CRBL components can be wired to real lifecycle hooks immediately
  - Performance baseline exists for benchmarking
  - Request lifecycle is concrete, not theoretical
  - Contract tests can run against real HTTP endpoints (returning 501)
  - Prevents integration friction when features are added later
- **Cons:**
  - Slight additional upfront cost (1-2 days for scaffold)
  - Requires committing infrastructure code before feature code

### Option B: CRBL First, Retrofit Later
- **Description:** Complete CRBL design fully, then build runtime, then integrate.
- **Pros:**
  - CRBL design is "pure" — not constrained by implementation details
- **Cons:**
  - High integration friction: CRBL designed against theoretical lifecycle, not actual NestJS behavior
  - Performance budgets are speculative
  - Contract tests cannot run (no endpoints)
  - Event validator cannot be tested (no Redis/BullMQ)
  - Schema Registry has no NestJS provider to inject into

### Option C: Skip CRBL, Enforce at Code Review
- **Description:** Rely on code review + ADR compliance instead of automated enforcement.
- **Pros:**
  - Zero tooling overhead
- **Cons:**
  - Contract drift is guaranteed over time
  - Cannot scale beyond 2-3 developers
  - Violates PERP-EVI (Evidence First) and PERP-FCL (Fail Closed)

## Decision
**Option A: Minimal Runtime Anchor Before CRBL Binding.**

The runtime anchor consists of:
1. **NestJS scaffold** (apps/api/) with Fastify adapter — no controllers, no services, no business logic
2. **PostgreSQL 16 schema** via Drizzle ORM (ADR-017) — core tables (users, roles, permissions) with migrations
3. **Redis 7 connection** — ioredis client with pub/sub ready for SchemaRegistry hot-reload
4. **CRBL hook points** — empty Guard, Interceptor, Pipe slots registered in NestJS module, wired to the request lifecycle but passing through all requests (defer to Sprint 0.5.1)
5. **Request lifecycle mapping** — documented exactly where each CRBL component attaches in NestJS lifecycle
6. **No Docker** — direct Node.js + PostgreSQL + Redis on bare metal/VM for development. Docker deferred to later.

This is NOT feature code. It is infrastructure/plumbing code — the minimum viable runtime that CRBL can bind to.

## Consequences

### Positive
- CRBL components have real lifecycle hooks to attach to (Guards, Interceptors, Pipes, Providers)
- Performance benchmarking is possible against real NestJS + PostgreSQL + Redis
- Contract tests can run HTTP requests and receive real responses (even 501)
- Event validator can be tested against real Redis + BullMQ
- No integration friction when Sprint 1 begins — the skeleton already has CRBL slots
- ADR-021's design can be validated against NestJS internals

### Negative
- Requires ~1-2 days of infrastructure scaffold before any feature code
- Commits infrastructure code to the repository (this is intentional and necessary)
- Slight architectural lock-in: CRBL design may need minor adjustments after seeing actual NestJS behavior

### Risks
- **R1: Over-engineering the scaffold.** Mitigation: Strictly minimal — zero business logic, zero controllers, just the skeleton. Gate: scaffold < 500 lines of TypeScript.
- **R2: CRBL design needs rework after binding.** Mitigation: ADR-021's component interfaces were designed against NestJS's documented lifecycle. Minor adjustments expected, major redesign unlikely.
- **R3: Team perceives scaffold as "ready for features."** Mitigation: README in apps/api/ explicitly states "Runtime Anchor — No Business Logic. Do not add features."

## Compliance
- Enforced by: Architecture review gate. No feature code merged until Sprint 1 approval.

## Related Decisions
- ADR-021: Contract Runtime Bridge Layer (CRBL)
- ADR-002: NestJS for Backend Services
- ADR-017: Drizzle ORM
- ADR-004: Redis for Caching & Sessions
- ADR-003: PostgreSQL as Primary Database

## References
- NestJS Lifecycle Hooks: https://docs.nestjs.com/faq/request-lifecycle
- packages/contracts/spec/crbl-architecture.md
