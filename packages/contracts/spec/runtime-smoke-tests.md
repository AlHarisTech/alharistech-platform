# Runtime Smoke Tests Specification
## AlharisTech Platform — v0.6.4

**Status:** Specification — Deferred to Sprint 0.5.1 Environment Bootstrap.

---

## Purpose

Runtime smoke tests verify that the minimal runtime anchor (NestJS + PostgreSQL + Redis) is operational. These tests run AFTER `pnpm build` succeeds, confirming the system boots and core infrastructure is reachable.

---

## Smoke Test Suite

### RST-01: NestJS Bootstrap
```bash
# Start API, wait for health, then kill
node dist/main.js &
API_PID=$!
sleep 3
curl -s http://localhost:4000/health | grep '"status":"ok"'
kill $API_PID
```
**Success:** Exit code 0, response contains `"status":"ok"`.

### RST-02: Database Connectivity
```typescript
// tests/smoke/database.smoke.ts
import { db } from '@aht/database';
import { sql } from 'drizzle-orm';

async function testDatabase(): Promise<void> {
  const result = await db.execute(sql`SELECT 1 AS alive`);
  assert(result.rows[0].alive === 1, 'Database not reachable');
}
```
**Success:** Query returns without error.

### RST-03: Redis Connectivity
```typescript
// tests/smoke/redis.smoke.ts
import Redis from 'ioredis';

async function testRedis(): Promise<void> {
  const redis = new Redis({ lazyConnect: true });
  await redis.connect();
  const pong = await redis.ping();
  assert(pong === 'PONG', 'Redis not reachable');
  await redis.quit();
}
```
**Success:** `PONG` response.

### RST-04: SchemaRegistry Load
```typescript
// tests/smoke/schema-registry.smoke.ts
import { SchemaRegistry } from '../src/crbl/schema-registry.service';

async function testSchemaLoad(): Promise<void> {
  const registry = app.get(SchemaRegistry);
  await registry.onModuleInit();
  assert(registry.isReady(), 'SchemaRegistry failed to load');
  const stats = registry.getStats();
  assert(stats.openapiSpecs === 9, 'Expected 9 OpenAPI specs');
  assert(stats.eventSchemas === 94, 'Expected 94 event schemas');
  assert(stats.policyRules === 162, 'Expected 162 policy rules');
}
```
**Success:** All counts match expectations.

### RST-05: CRBL Health Endpoint
```bash
curl -s http://localhost:4000/health/crbl | grep '"status":"healthy"'
```
**Success:** CRBL reports healthy.

### RST-06: Contract Guard Fail-Closed
```bash
# Unknown endpoint should return 404 (fail-closed)
curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/v1/unknown
```
**Success:** HTTP 404.

### RST-07: Health Endpoint Public Access
```bash
# Health endpoint must be accessible without auth
curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/health
```
**Success:** HTTP 200.

---

## CI Integration

```yaml
# .github/workflows/smoke-tests.yml (spec)
jobs:
  smoke:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: alharistech
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: pnpm install
      - run: pnpm build
      - run: node dist/main.js &
      - run: sleep 5 && pnpm test:smoke
```

---

## Implementation Notes

- Smoke tests are NOT unit tests — they require real PostgreSQL + Redis
- They validate infrastructure connectivity, not business logic
- They serve as the first CI gate after environment bootstrap
- Deferred to Sprint 0.5.1 because they require a running NestJS process with DB+Redis
