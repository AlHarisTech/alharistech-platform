# Sprint 3 — Architecture Blueprint: Platform Operations Runtime

## Status
Architecture Contract — Design Freeze

## Date
2026-06-22

## Context

v0.9.1 achieved a stable API core with CI pipeline, observability, DLQ, and idempotency. The system is production-ready at the API level but lacks:

1. A deterministic runtime envelope (Docker containers are defined but never executed)
2. An E2E validation layer (no browser/UI tests)
3. CI/container parity (CI tests run in Node host context, not in containers)
4. Environment stratification (dev/ci/prod use the same `.env.example` with no separation)

Without these, any deployment attempt risks:
- Environment-specific failures not caught in CI
- E2E tests that pass on the host but fail in containers
- No repeatable release artifact (Docker image) to promote through environments

This blueprint freezes the architecture before execution begins. It defines the runtime contract that Docker, CI, and E2E must all satisfy.

---

## 1. Runtime Topology

### 1.1 Service Graph

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  dashboard   │────▶│     api      │────▶│   postgres   │
│  nginx:80    │     │  node:4000   │     │  pg:5432     │
│  SPA static  │     │  NestJS      │     │  Drizzle ORM │
└─────────────┘     │  CRBL        │     └──────────────┘
                    │  Events      │
                    │  Auth        │
                    │  Observability│
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │    redis     │
                    │  redis:6379  │
                    │  BullMQ      │
                    │  DLQ         │
                    │  Idempotency │
                    │  Tracer      │
                    └──────────────┘
```

### 1.2 Service Definitions

| Service    | Container Name | Base Image            | Exposed Port | Internal Port | Depends On        |
|------------|----------------|-----------------------|--------------|---------------|-------------------|
| postgres   | aht-postgres   | postgres:16-alpine    | 5432         | 5432          | —                 |
| redis      | aht-redis      | redis:7-alpine        | 6379         | 6379          | —                 |
| api        | aht-api        | node:22-alpine        | 4000         | 4000          | postgres, redis   |
| dashboard  | aht-dashboard  | nginx:stable-alpine   | 80           | 80            | api               |

### 1.3 Network Boundaries

All services reside on a single bridge network `aht-network`. No service is exposed to the host except:
- `dashboard:80` — the sole ingress point
- `postgres:5432` — exposed for local tooling (DBeaver, psql) in dev only
- `redis:6379` — exposed for local tooling (RedisInsight) in dev only

In CI and production, postgres/redis ports are **not** exposed to the host.

### 1.4 Startup Order (Deterministic)

```
postgres (healthy) ──▶ redis (healthy) ──▶ api (healthy) ──▶ dashboard (healthy)
```

Gating:
- `api` waits for `postgres` + `redis` healthchecks (`condition: service_healthy`)
- `dashboard` waits for `api` healthcheck
- `start_period` prevents premature failure during cold start

### 1.5 Volume Strategy

| Volume          | Mount Point                     | Purpose                     |
|-----------------|----------------------------------|-----------------------------|
| postgres_data   | /var/lib/postgresql/data        | DB persistence              |
| redis_data      | /data                            | Redis persistence (AOF/RDB) |

No bind mounts in production. Dev bind mounts for live reload are optional and documented separately.

---

## 2. CI ↔ Container Parity Model

### 2.1 The Parity Gap (Current)

| Aspect               | CI (current)                        | Container (target)           | Gap                  |
|----------------------|--------------------------------------|------------------------------|----------------------|
| Node version         | 22 (GitHub Actions)                  | 22-alpine                    | None                 |
| OS                   | ubuntu-latest                        | Alpine Linux                 | Different libc       |
| Build output         | pnpm build on host                   | pnpm build in Docker         | Paths may differ     |
| Postgres             | Not available                        | postgres:16-alpine           | Missing in CI        |
| Redis                | Not available                        | redis:7-alpine               | Missing in CI        |
| Bootstrap verify     | node apps/api/dist/.../main.js       | node same path in container  | Same (when env matched) |
| Healthcheck test     | curl to 127.0.0.1:4000               | wget to 127.0.0.1:4000       | Minor (curl vs wget) |

### 2.2 Target: CI-in-Container

The goal is **CI runs inside Docker containers** that match production exactly. Two approaches are considered:

**Option A (Recommended for release): docker compose run in CI**

```yaml
- name: Start services
  run: docker compose up -d postgres redis

- name: Build API
  run: docker compose build api

- name: Run tests
  run: docker compose run --rm api pnpm test

- name: Bootstrap verification
  run: docker compose up -d api && sleep 15
  run: curl -sf http://localhost:4000/health
```

**Option B (Lighter for PRs): Host CI with Docker parity check**

Run lint/build/test on the host (faster, no Docker overhead). Add a separate job that builds the Docker image and runs container-level smoke tests (healthcheck, endpoint scan).

**Decision:** Use **Option B** for v0.9.x (fast feedback for code changes). Add **Option A** as a separate workflow for release candidates only.

### 2.3 Parity Contract

| Rule | Description | Enforced By |
|------|-------------|-------------|
| CP-01 | CI must build the same Docker images that deploy to production | `docker compose build` in CI |
| CP-02 | CI must run tests with the same Node version as the container | `node --version` check in CI |
| CP-03 | CI bootstrap must exercise the same entrypoint as the container | Test `node apps/api/dist/.../main` in CI |
| CP-04 | Container healthchecks must match CI healthcheck assertions | Same `/health` 200 check |
| CP-05 | No CI-only environment variables | Every CI env var must have a default in `.env.example` |
| CP-06 | Docker image tagged with git SHA must be promotable through all environments | Immutable tag per commit |

---

## 3. Environment Stratification

### 3.1 Three-Layer Model

| Layer  | Name       | Purpose                          | Postgres    | Redis       | Docker? | Env File        |
|--------|------------|----------------------------------|-------------|-------------|---------|-----------------|
| dev    | local      | Developer workstation             | Docker      | Docker      | Full    | .env            |
| ci     | ci         | GitHub Actions pipeline           | Docker in CI| Docker in CI| Per job | CI env vars     |
| prod   | production | Deployed stack                    | Managed/RDS | Managed/Upstash | Docker Compose or Swarm | .env.production |

### 3.2 Environment Files

| File                | Used By | Committed? | Contains                    |
|---------------------|---------|------------|-----------------------------|
| .env.example        | All     | Yes        | Documented defaults         |
| .env                | dev     | No         | Developer overrides         |
| .env.ci             | CI      | No (set in GitHub Secrets) | CI-specific overrides |
| .env.production     | prod    | No         | Production secrets          |

### 3.3 Key Differences Between Layers

| Variable       | dev                        | ci                        | prod                    |
|----------------|----------------------------|---------------------------|-------------------------|
| NODE_ENV       | development                | test (or CI)              | production              |
| DB_HOST        | postgres (Docker)          | postgres (Docker in CI)   | rds.endpoint.aws.com    |
| REDIS_HOST     | redis (Docker)             | redis (Docker in CI)      | upstash.endpoint        |
| JWT_SECRET     | dev-secret-change-in-prod  | ci-test-secret            | vault-managed secret    |
| CORS_ORIGIN    | *                          | http://localhost:80       | https://app.example.com |
| CONTRACT_RESPONSE_MODE | lenient             | strict                    | strict                  |

---

## 4. Health Propagation Model

### 4.1 Healthcheck Chain

```
wget http://dashboard:80/       ──▶ 200 (SPA served)
                                       │
                                       │ nginx reverse proxy
                                       ▼
wget http://api:4000/health     ──▶ 200 (API alive)
                                       │
                                       │ checks
                                       ▼
                          ┌────────────┬────────────┐
                          ▼            ▼            ▼
                    postgres       redis      SchemaRegistry
                    pg_isready    redis-cli   9 specs loaded
                    returns OK    PONG        149 endpoints
                                              94 event schemas
                                              162 policy rules
```

### 4.2 Healthcheck Specifications

```yaml
services:
  postgres:
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 5s
      timeout: 3s
      retries: 5

  redis:
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  api:
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://127.0.0.1:4000/health"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 15s

  dashboard:
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://127.0.0.1:80/"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 10s
```

### 4.3 Health Status Propagation

| Condition | API /health | Dashboard frontend | Docker restart |
|-----------|-------------|--------------------|----------------|
| All healthy | `{"status":"healthy","schemaRegistry":"healthy","database":"connected","redis":"connected"}` | Normal | No |
| Postgres down | `{"status":"degraded","database":"disconnected"}` | Degraded banner | No (API works without DB for cached routes) |
| Redis down | `{"status":"degraded","redis":"disconnected"}` | Degraded banner | No (event runtime disabled, HTTP continues) |
| SchemaRegistry down | `{"status":"degraded","schemaRegistry":"unhealthy"}` | Degraded banner | No (contract validation disabled, CRBL bypassed) |
| API process crash | — | Connection refused | Yes (Docker restart policy) |
| Dashboard nginx crash | — | — | Yes (Docker restart policy) |

---

## 5. E2E Execution Contract

### 5.1 Scope

| Test Type | Tool     | Scope                          | CI Stage     |
|-----------|----------|--------------------------------|--------------|
| Unit      | Jest     | Services, utils, models        | test         |
| Integration | Jest   | Services with InMemoryRedis mock | test       |
| API       | Supertest (via Jest) | HTTP endpoints, CRBL validation | test |
| E2E       | Playwright | Dashboard UI, full API flows via dashboard | e2e (separate job) |

### 5.2 E2E Contract

E2E tests run **only against a fully composed Docker stack** (postgres + redis + api + dashboard). They never run against a host-process API.

```yaml
e2e:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:16-alpine
      env:
        POSTGRES_DB: alharistech
        POSTGRES_USER: postgres
        POSTGRES_PASSWORD: postgres
      ports: [5432:5432]
      options: --health-cmd pg_isready --health-interval 5s

    redis:
      image: redis:7-alpine
      ports: [6379:6379]
      options: --health-cmd "redis-cli ping" --health-interval 5s

  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4 with { version: 9.15.0 }
    - uses: actions/setup-node@v4 with { node-version: 22, cache: pnpm }

    - run: pnpm install --frozen-lockfile
    - run: pnpm build

    - name: Start API
      run: |
        DB_HOST=localhost REDIS_HOST=localhost \
        node apps/api/dist/apps/api/src/main.js &
        sleep 10

    - name: Run E2E tests
      run: pnpm test:e2e

    - name: Run Playwright
      run: npx playwright test
```

### 5.3 E2E Test Cases (Minimum Viable)

| ID     | Test                          | Assertion                                |
|--------|-------------------------------|------------------------------------------|
| E2E-01 | Dashboard loads               | Page title contains "Dashboard"          |
| E2E-02 | Health indicator visible      | Health status pill shows "Healthy"       |
| E2E-03 | Metrics page renders          | Metrics chart containers are present     |
| E2E-04 | Trace search works            | Trace input accepts text, shows results  |
| E2E-05 | DLQ page accessible           | DLQ queue list renders                   |
| E2E-06 | API health from dashboard     | /events/dashboard returns 200            |
| E2E-07 | Events flow end-to-end        | Publish event → appears in trace         |
| E2E-08 | Auth redirect on /admin       | Unauthenticated → redirected to login    |
| E2E-09 | 404 page for unknown routes   | Unknown route → 404 page                 |
| E2E-10 | Responsive layout             | Viewport resize → no overflow            |

---

## 6. Failure Domains & Recovery Strategy

### 6.1 Failure Domains

| Domain         | Scope                          | Blast Radius                       | Recovery                         |
|----------------|--------------------------------|------------------------------------|----------------------------------|
| F-01: Database | postgres container              | All data-dependent API routes      | Docker restart → pg_isready      |
| F-02: Cache    | redis container                 | BullMQ, DLQ, idempotency, tracer   | Docker restart → redis-cli ping  |
| F-03: API      | api container                   | All HTTP routes                    | Docker restart → /health 200     |
| F-04: Frontend | dashboard container             | User interface                     | Docker restart → nginx 200       |
| F-05: Network  | aht-network bridge              | All inter-service communication    | Docker network recreate          |
| F-06: Storage  | postgres_data / redis_data      | Data loss                          | Volume backup + restore          |
| F-07: Secret   | Environment variables           | Auth, encryption, external APIs    | Rotate + restart container       |

### 6.2 Recovery Strategies

| Failure   | Immediate (Docker)                     | Manual                             |
|-----------|----------------------------------------|------------------------------------|
| F-01      | `docker compose restart postgres`      | Restore from pg_dump backup        |
| F-02      | `docker compose restart redis`         | —                                  |
| F-03      | `docker compose restart api`           | Check logs, fix + rebuild image    |
| F-04      | `docker compose restart dashboard`      | Check nginx error logs             |
| F-05      | `docker compose down && docker compose up -d` | —                          |
| F-06      | —                                      | Restore volume from backup         |
| F-07      | Update .env + `docker compose up -d`   | Rotate secrets, restart affected   |

### 6.3 Container Restart Policy

```yaml
services:
  postgres:  restart: unless-stopped
  redis:     restart: unless-stopped
  api:       restart: unless-stopped
  dashboard: restart: unless-stopped
```

`unless-stopped` ensures containers restart on crash or host reboot, but stay stopped if the operator explicitly stops them.

---

## 7. Release Model

### 7.1 Artifact Flow

```
Commit ──▶ CI (lint + build + test)
              │
              ▼
         Docker Image (tag: git-sha)
              │
              ▼
         Container Registry (GHCR)
              │
              ▼
         Staging (docker compose pull && up -d)
              │
              ▼
         Production (docker compose pull && up -d)
```

### 7.2 Tagging Strategy

| Tag Pattern        | Example           | Trigger                | Deploy To |
|--------------------|-------------------|------------------------|-----------|
| `v{major}.{minor}.{patch}` | v0.9.1    | Manual release         | Production |
| `sha-{commit}`     | sha-3d7c1f5       | Every push to main     | CI verification |
| `latest`           | latest            | Every push to main     | Staging (auto) |

### 7.3 CI Pipeline (Updated)

| Stage           | Tool                     | Condition                 |
|-----------------|--------------------------|---------------------------|
| install         | pnpm --frozen-lockfile   | Must pass                 |
| lint            | pnpm lint                | Must pass (0 errors)      |
| build           | pnpm build               | Must pass (5 packages)    |
| test            | pnpm test                | Must pass (28/28)         |
| bootstrap       | node + healthcheck       | Must pass (/health 200)   |
| integration     | Postgres + Redis services | Must pass (every push)   |
| e2e             | Playwright               | Must pass (release only)  |

---

## 8. Implementation Sequence

### Phase 1 — CI Parity with Real Dependencies (Current Sprint)

1. Add `integration` job to CI with ephemeral Postgres:16-alpine + Redis:7-alpine (GitHub Actions services)
2. Start API process with real DB_HOST/REDIS_HOST — validate /health, /events/dashboard, /events/metrics, /events/trace all return 200
3. Set CONTRACT_RESPONSE_MODE=strict in integration job
4. Remove docker-build / docker-smoke — no Docker in CI for v0.9.x

### Phase 2 — E2E Infrastructure (Next)

1. Install Playwright (`pnpm add -D @playwright/test`)
2. Create `apps/api/test/e2e/` with Playwright config
3. Implement E2E-01 through E2E-06 (dashboard + health + API flows)
4. Add `e2e` CI job that starts Docker stack, runs Playwright

### Phase 3 — Environment Formalization (Parallel)

1. Create `.env.ci` from `.env.example` with CI-safe overrides
2. Document `.env.production` template (no secrets committed)
3. Add env validation at API bootstrap (fail-fast on missing required vars)

### Phase 4 — Production Deployment Model (v1.0 Gate)

1. Choose orchestrator: Docker Swarm (recommended for Phase 1-4 per ADR-011)
2. Define `docker-stack.yml` with replicated services
3. Set up container registry (GHCR)
4. Implement blue-green or rolling update strategy

---

## 9. Compliance & Verification

### 9.1 Invariants

| ID     | Invariant                                | Enforced By                     |
|--------|------------------------------------------|---------------------------------|
| OI-001 | All services start with `docker compose up -d` | CI smoke test            |
| OI-002 | API healthcheck returns 200 within 15s   | Docker healthcheck               |
| OI-003 | Dashboard proxies /events/* to API       | nginx + curl test                |
| OI-004 | Postgres + Redis are never directly exposed in production | Compose config |
| OI-005 | CI must fail on any stage failure        | GitHub Actions `set -e`          |
| OI-006 | Every image tag is immutable             | No `latest` tags in production   |
| OI-007 | Environment stratification is explicit   | Separate env files per layer     |
| OI-008 | E2E tests only run against Docker stack  | CI workflow separation           |
| OI-009 | API must start and respond 200 with real Postgres + Redis | CI integration job |
| OI-010 | EventRuntime status must be "healthy" with Redis connected | CI /health body assert |
| OI-011 | Workers must be "running", idempotency "available" | CI /events/health body assert |
| OI-012 | SchemaRegistry loads >=9 specs, >=149 endpoints, >=94 schemas | Requires dedicated endpoint (planned);
  indirectly validated: /events/dashboard 200 implies full bootstrap |
| OI-013 | No endpoint may return "degraded" or "unavailable" during integration CI | CI body asserts reject non-healthy |
| OI-014 | Dashboard loads with correct title | Playwright E2E-01 |
| OI-015 | Dashboard can communicate with API (composite endpoints return 200) | Playwright E2E-06, E2E-08 |
| OI-016 | Health indicator shows LIVE status | Playwright E2E-02 |
| OI-017 | Observability cards render (health, metrics, trace) | Playwright E2E-03, E2E-04, E2E-05 |
| OI-018 | Events health endpoint returns healthy with proper status | Playwright E2E-07 |
| OI-019 | Responsive layout passes at mobile viewport | Playwright E2E-10 |
| OI-020 | Playwright suite passes in CI (no flaky failures) | CI e2e job |
| OI-021 | Published events become visible in Trace UI | Runtime E2E RTE-01 |
| OI-022 | Unhandled events are routed to DLQ after max retries | Runtime E2E RTE-02 |
| OI-023 | Runtime recovers after Redis restart | Runtime E2E RTE-03 |
| OI-024 | Duplicate event IDs are skipped by idempotency | Runtime E2E RTE-04 |
| OI-025 | Dashboard remains responsive under burst load (100 events) | Runtime E2E RTE-05 |
| OI-026 | Runtime tests must leave the system healthy | `test.afterEach` in every spec file |
| OI-027 | Duplicate events produce exactly one side effect | Idempotency RTE-04 (exact counts) |

### 9.2 Verification Gates

| Gate     | When                     | Criteria                              |
|----------|--------------------------|---------------------------------------|
| G-01     | After Phase 1            | API starts with real Postgres + Redis, all 4 observability endpoints return 200 |
| G-02     | After Phase 2            | Playwright E2E suite passes (10 tests) |
| G-03     | After Phase 3            | Runtime E2E suite passes (5 tests: RTE-01 to RTE-05) |
| G-04     | Before v1.0              | Production deployment documented and tested on staging |
| G-05     | After every RTE test      | System health restored: redis connected, workers running, idempotency available |
| G-06     | Before all RTE tests      | Runtime Isolation Gate: DLQ empty, metrics at zero, workers active, idempotency available |

## 9.3 Phase 3 — Runtime Scenario Verification (v0.9.7)

### Approach — Lightweight Runtime Harness

Instead of Docker Compose (resource-heavy for 4GB RAM / Core i5), runtime E2E uses a lightweight process-based approach:

```
Playwright
    ↓
API Process (Node)
    ↓
PostgreSQL Service (systemd)
    ↓
Redis Service (systemd)
    ↓
Failure Injection via shell commands
```

### RTE Test Descriptions

| ID     | Scenario                              | OI      | Duration |
|--------|---------------------------------------|---------|----------|
| RTE-01 | Publish event → verify trace entry    | OI-021  | ~3s      |
| RTE-02 | Publish unhandled event → DLQ capture | OI-022  | ~35s     |
| RTE-03 | Stop Redis → degraded → restart → heal | OI-023  | ~20s     |
| RTE-04 | Publish duplicate event ID → idempotency skip | OI-024 | ~35s |
| RTE-05 | Publish 100 events → dashboard responsive | OI-025 | ~10s     |

### CI Strategy

- **Trigger:** `workflow_dispatch` only (not on push/PR)
- **Services:** Postgres + Redis via GitHub Actions service containers (same as integration + e2e jobs)
- **Failure injection:** `docker stop/start` on Redis service container
- **No Docker Compose:** CI reuses existing service-based approach
- **Location:** `apps/runtime-e2e/`
- **Helpers:** `apps/runtime-e2e/helpers/{config,wait-until,redis-control}.ts`

### Invariants Enforced

- All 5 RTE scenarios pass against real Postgres + Redis + running workers
- `POST /events/test/publish` endpoint available (dashboard controller, `@Public()`)
- Idempotency, DLQ, workers, and Redis connectivity all validated at runtime level

---

## 10. Related Decisions

- [ADR-011: Docker for Development & Deployment](../adr/adr-011-docker.md) — Docker Compose + Swarm strategy
- [ADR-012: Monorepo with Turborepo](../adr/adr-012-monorepo-turborepo.md) — Build caching for Docker layers
- [ADR-021: Contract Runtime Bridge Layer](../adr/adr-021-contract-runtime-bridge.md) — CRBL bootstrap in containers
- [ADR-024: Event Enforcement Parity](../adr/adr-024-event-enforcement-parity.md) — DLQ, event validation in runtime

## 11. Open Items (Design Decisions Pending)

| Item | Question | Suggested Resolution |
|------|----------|---------------------|
| OI-01 | CI Docker build: build all images or only changed services? | Resolved: No Docker in CI for v0.9.x. Docker build deferred to Phase 3 (local only). |
| OI-02 | E2E test data: seed via API or direct DB insert? | API-based seeding (tests should not depend on DB internals) |
| OI-03 | Playwright parallel: shard by test file or browser? | Shard by test file (faster, no cross-contamination) |
| OI-04 | Production orchestrator: Swarm or K8s? | Swarm for v1.0 (per ADR-011). Evaluate K8s at Phase 5. |
| OI-05 | Secret management: .env only or HashiCorp Vault? | .env with Docker secrets for Swarm. Vault evaluation at Phase 5. |
