# ADR-025: Lightweight Runtime Harness — Docker-Free Runtime Verification

## Status
Accepted

## Date
2026-06-23

## Context

### The Resource Constraint

The development environment is constrained to 4GB RAM / Core i5. Docker Compose with Postgres 16, Redis 7, the NestJS API, and the Vite dashboard dev server exceeds available memory under load (CI runners offer similar constraints).

### The Docker Problem

Initially the CI pipeline included a Docker build stage (v0.9.2). This was removed (v0.9.3) because:
1. Docker-in-Docker adds ~1GB overhead per job
2. Docker Compose adds 3–5x startup latency vs native services
3. CI job timeout limits (15 min) are tight when container pull + build + test must fit
4. Local development already uses native Postgres/Redis — Docker adds divergence, not parity

### The Verification Requirement

Sprint 3 (Platform Operations Runtime) requires verifying:
- Event publishing → trace recording
- Unhandled events → DLQ routing (5 retries with backoff)
- Redis failure → degraded mode → recovery
- Idempotent deduplication
- Burst load handling (100 events)
- Runtime health after each scenario

Docker Compose would provide infrastructure parity but at prohibitive resource cost.

## Decision

**Adopt a Lightweight Runtime Harness with zero Docker Compose dependency.**

### Architecture

```
┌─────────────────────────────────────────────┐
│  GitHub Actions Runner (ubuntu-latest)       │
│                                               │
│  Services (native containers):                │
│    postgres:16-alpine → localhost:5432       │
│    redis:7-alpine    → localhost:6379        │
│                                               │
│  Runtime (Node processes):                    │
│    API (NestJS, :4000)                       │
│    Dashboard (Vite, :5173)                   │
│                                               │
│  Test Runners:                                │
│    Playwright (chromium, 2 projects)          │
│      ├─ dashboard-e2e (browser tests)        │
│      └─ runtime-e2e  (API scenario tests)    │
└─────────────────────────────────────────────┘
```

### Key Mechanisms

1. **Real dependencies via GitHub Actions services** — Postgres and Redis run as Docker containers directly (not via Compose), managed by the GitHub Actions runner with built-in health checks.

2. **Deterministic service waits** — `pg_isready` and `redis-cli ping` (with `timeout 30` + `nc -z` fallback) ensure services are accepting connections before the API starts. `waitUntilRedisHealthy()` polls `/events/health` after restart instead of fixed sleeps.

3. **Failure injection via shell commands** — Redis restart uses `docker stop/start` (CI) or `systemctl` (local), not Docker Compose commands. No Compose file, no Compose overhead.

4. **Adaptive burst sizing** — `BURST_SIZE = CI ? 100 : 25`. CI gets more resources so it handles more load; local stays within 4GB RAM.

5. **Sequential test execution** — Runtime-e2e tests run serially (`fullyParallel: false`) with numeric order (`00-isolation → 05-burst-load`) because they share the same API and Redis state. Dashboard e2e tests can parallelize since they use Playwright's browser contexts.

6. **Test isolation gates** — `test.afterEach` (G-05) verifies system health after every spec. A dedicated `00-isolation.spec.ts` (G-06) verifies clean state before any spec runs.

### Options Considered

| Option | Resource Cost | Parity | Complexity | Chosen? |
|--------|:---:|:---:|:---:|:---:|
| Full Docker Compose (API + DB + Redis) | High | Full | High | No |
| CI services + Compose for API | Medium | Partial | Medium | No |
| CI services + native API process | Low | Sufficient | Low | Yes |
| All native (no containers) | Minimal | Low | Low | No (no PG/Redis in CI) |

## Consequences

### Positive
- CI job completes in ~4 min (vs ~8 min with Docker Compose)
- Memory usage stays under 3GB even during burst tests
- No Docker-in-Docker complexity — services managed by GitHub Actions
- Failures are deterministic and reproducible
- Test isolation prevents state leakage between scenarios

### Negative
- Local Redis restart (`systemctl`) differs from CI (`docker stop/start`) — minor script divergence
- RTE-03 (Redis recovery) must be skipped in CI when Redis is a shared service container
- Vite dev server must be started manually in CI (Docker Compose would auto-start it)
- Proxy configuration (Vite → API port) is manual and was misconfigured (:3000 instead of :4000)

### Neutral
- The harness is Sprint 3–specific. Sprint 4 (Production Deployment Model) will add Docker Compose for deployment purposes, but CI testing will remain lightweight.
- `reuseExistingServer: true` in Playwright config means servers must be started before tests — acceptable tradeoff for CI control.

## Compliance

- CI must never use `docker-compose` or `docker compose` commands.
- API must start as a native Node process, not inside a container.
- Runtime-e2e tests must not require Docker Compose to run locally.
- Sequential execution order must be maintained for runtime-e2e.
- Every runtime-e2e spec must clean up after itself (G-05) and isolation must be verified before any spec runs (G-06).

## Related Decisions

- [ADR-003: PostgreSQL](./adr-003-postgresql.md) — Postgres 16 as primary database, used as CI service.
- [ADR-004: Redis](./adr-004-redis.md) — Redis 7 for caching and BullMQ, used as CI service.
- [ADR-009: BullMQ for Background Jobs](./adr-009-bullmq.md) — BullMQ queues depend on Redis; harness must run Redis first.
- [ADR-011: Docker for Development & Deployment](./adr-011-docker.md) — Original Docker ADR; this ADR limits Docker scope to deployment only, not CI testing.
- [ADR-024: Event Enforcement Parity](./adr-024-event-enforcement-parity.md) — Event validation requires a running runtime; harness provides the runtime context.
