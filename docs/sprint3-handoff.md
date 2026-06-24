# Sprint 3 Handoff — Platform Operations Runtime

## Session Context
- **Sprint:** 3 — Platform Operations Runtime
- **Period:** v0.9.1 → v0.9.9-rc1
- **Status:** ✅ Closed (Stabilized)
- **Baseline:** `v0.9.9-rc1` (9ba9104)

## What Was Delivered

### Phase 1 — CI Pipeline (v0.9.1–v0.9.5)
- `verify` job: lint, build, 28 tests, bootstrap verification
- `integration` job: real Postgres 16 + Redis 7 via GitHub Actions services
- Deterministic service waits (`pg_isready`, `redis-cli ping` → `timeout`/`nc`)
- Health body assertions (OI-010–OI-013)

### Phase 2 — E2E Dashboard Tests (v0.9.6)
- Playwright infrastructure (chromium, 30s timeout, HTML+HTML reporter)
- 10 dashboard E2E tests (E2E-01–E2E-10)
- `data-testid` attributes, `reuseExistingServer` config

### Phase 3 — Runtime Scenario E2E (v0.9.7–v0.9.9)
- `POST /events/test/publish` (guarded by `RUNTIME_TEST_MODE`)
- 5 runtime tests (RTE-01–RTE-05): publish-trace, DLQ, Redis recovery, idempotency, burst
- Lightweight harness (no Docker Compose — `systemctl`/`docker` commands)
- `waitUntilRedisHealthy()` polling helper
- Adaptive burst size (CI=100, local=25)

### Hardening (v0.9.8–v0.9.9)
- OI-026: afterEach health assertions
- OI-027: behavioral idempotency verification (exact side-effect counts)
- G-05: Runtime Cleanup Gate (afterEach)
- G-06: Runtime Isolation Gate (00-isolation.spec.ts)
- Sequential test execution (fullyParallel: false)
- CI reliability fixes (timeout, nc, reuseExistingServer, host bind, proxy target)

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Lightweight Runtime Harness | 4GB RAM / Core i5 constraint — no Docker Compose in CI |
| `RedisManager` injected for health | `REDIS_CLIENT_TOKEN` not exported — DI scope mismatch |
| Vite `host: 127.0.0.1` | Vite 6 defaults to IPv6 `::1` — curl/Playwright use IPv4 |
| Sequential runtime-e2e | Shared Redis+API state requires test isolation ordering |
| `reuseExistingServer: true` | CI starts API+Vite manually before Playwright |

## Invariants Enforced (OI-001–OI-027)
Full matrix in `docs/architecture/sprint3-blueprint.md`.

## Gates (G-01–G-06)
| Gate | Scope | Enforced By |
|------|-------|-------------|
| G-01 | Schema validation | `EventValidator` |
| G-02 | Publish trace | `EventBus` |
| G-03 | DLQ routing | `DlqRouter` |
| G-04 | Idempotency skip | `IdempotencyService` |
| G-05 | Runtime cleanup | `test.afterEach` |
| G-06 | Runtime isolation | `00-isolation.spec.ts` |

## Deferred to Sprint 4
1. Flakiness validation (10–20 local runs)
2. Docker Compose production deployment model
3. Container registry + release pipeline
4. Auth middleware — locked-down mutation routes need real auth
