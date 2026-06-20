# CRBL Performance Benchmarks

**Version:** 1.0
**Owner:** Architecture Team
**Package:** `packages/contracts`
**Governance Reference:** `.governance/enforcement.yaml` — PERP-EVI (Evidence First)
**Runtime Budget:** 5ms p95 total CRBL overhead

---

## 1. Runtime Latency Targets

All measurements use Node.js `process.hrtime.bigint()` at component boundaries. Metrics are exposed via the `/api/v1/health/crbl` endpoint and scraped by Prometheus.

### 1.1 Per-Component Targets

| Component | Target (p95) | Measurement Point | Budget Share |
|:---|:---|:---|:---|
| `AuthGuard` | < 1ms | JWT `jwt.verify()` call duration | 20% |
| `PolicyGuard` | < 1ms | `policy-evaluator.evaluate()` wall time | 20% |
| `ContractGuard` | < 3ms | AJV `validate(data)` wall time | 60% |
| `ContractInterceptor` | < 1ms | AJV response `validate(data)` wall time | 20% |
| `ContractPipe` (ValidationPipe) | < 2ms | Zod `schema.parse(data)` wall time | 40% |
| `EventValidator` | < 2ms | AJV `validate(payload)` wall time | 40% |
| **Total CRBL overhead** | **< 5ms p95** | Sum of [PolicyGuard + ContractGuard + ContractInterceptor + ContractPipe] per request | 100% |

### 1.2 Startup / Cold Start Targets

| Operation | Target | Measurement Method |
|:---|:---|:---|
| SchemaRegistry cold start (9 OpenAPI specs + 94 event schemas + 162 policies) | < 50ms | `onApplicationBootstrap()` wall time |
| SchemaRegistry hot reload (single file change) | < 5ms | `watcher.on("change")` → `ready` signal |
| Redis cache miss compile (single validator) | < 2ms | AJV `compile(schema)` wall time per validator |

### 1.3 AJV Compilation Benchmarks

| Spec | Schema Count | Target (total compile) | Notes |
|:---|:---|:---|:---|
| `ai-api.yaml` | ~42 schemas | < 100ms | Largest OpenAPI spec; includes complex nested schemas |
| `commerce-api.yaml` | ~15 schemas | < 30ms | Average-sized spec |
| `identity-api.yaml` | ~18 schemas | < 35ms | Core identity domain |
| `customer-api.yaml` | ~14 schemas | < 30ms | Customer domain |
| `service-api.yaml` | ~20 schemas | < 40ms | Service operations |
| `support-api.yaml` | ~12 schemas | < 25ms | Support ticketing |
| `content-api.yaml` | ~10 schemas | < 20ms | Content management |
| `notification-api.yaml` | ~8 schemas | < 20ms | Notification templates |
| `analytics-api.yaml` | ~14 schemas | < 30ms | Analytics queries |
| All 94 event schemas | 94 schemas | < 200ms | Flat event schemas, no deep nesting |
| **Total (all specs)** | ~247 schemas | **Guidance: < 500ms cold** | Pre-compiled + cached in Redis after first deploy |

---

## 2. Measurement Methodology

### 2.1 Instrumentation

CRBL components are instrumented with high-resolution timers using `process.hrtime.bigint()`:

```typescript
// ContractGuard instrumentation
const start = process.hrtime.bigint();
const valid = validator(data);
const durationNs = Number(process.hrtime.bigint() - start);

crblValidationDuration.observe(
  { component: "ContractGuard", method, path },
  durationNs / 1e9
);
```

### 2.2 Prometheus Metrics

```
# HELP crbl_validation_duration_seconds Contract validation duration by component
# TYPE crbl_validation_duration_seconds histogram
crbl_validation_duration_seconds_bucket{component="ContractGuard",method="POST",path="/api/v1/auth/register",le="0.0001"} 0
crbl_validation_duration_seconds_bucket{component="ContractGuard",method="POST",path="/api/v1/auth/register",le="0.0005"} 12
crbl_validation_duration_seconds_bucket{component="ContractGuard",method="POST",path="/api/v1/auth/register",le="0.001"} 87
crbl_validation_duration_seconds_bucket{component="ContractGuard",method="POST",path="/api/v1/auth/register",le="0.002"} 756
crbl_validation_duration_seconds_bucket{component="ContractGuard",method="POST",path="/api/v1/auth/register",le="0.005"} 998
crbl_validation_duration_seconds_bucket{component="ContractGuard",method="POST",path="/api/v1/auth/register",le="+Inf"} 1000

# HELP crbl_startup_duration_seconds SchemaRegistry startup duration
# TYPE crbl_startup_duration_seconds gauge
crbl_startup_duration_seconds{phase="openapi_load"} 0.012
crbl_startup_duration_seconds{phase="event_schemas_load"} 0.008
crbl_startup_duration_seconds{phase="policy_rules_load"} 0.005
crbl_startup_duration_seconds{phase="ajv_compile_all"} 0.018
crbl_startup_duration_seconds{phase="total"} 0.043

# HELP crbl_compilation_duration_seconds AJV schema compilation duration
# TYPE crbl_compilation_duration_seconds histogram
crbl_compilation_duration_seconds_bucket{spec="ai-api.yaml",le="0.010"} ...
crbl_compilation_duration_seconds_bucket{spec="ai-api.yaml",le="0.050"} ...
crbl_compilation_duration_seconds_bucket{spec="ai-api.yaml",le="0.100"} ...
```

### 2.3 Benchmark Harness

The benchmark harness (`scripts/bench-crbl.ts`) runs isolated performance tests outside the NestJS container:

```typescript
// packages/contracts/src/scripts/bench-crbl.ts
import { performance, PerformanceObserver } from "perf_hooks";
import { SchemaRegistry } from "../registry/schema-registry";

async function bench() {
  const registry = new SchemaRegistry(/* mock deps */);

  // 1. Cold start benchmark
  const coldStart = measure("cold-start", () => registry.onApplicationBootstrap());
  assert(coldStart.p95 < 50, `Cold start: ${coldStart.p95}ms > 50ms`);

  // 2. Per-spec compilation
  for (const spec of specs) {
    const compileTime = measure(`compile:${spec.name}`, () => registry.compileSpec(spec));
    assert(compileTime.p95 < spec.budget, `${spec.name}: ${compileTime.p95}ms > ${spec.budget}ms`);
  }

  // 3. Request validation throughput
  const validator = registry.getRequestValidator("POST", "/api/v1/auth/register");
  const latency = measureBatch(10000, () => validator(validPayload));
  assert(latency.p95 < 3, `ContractGuard p95: ${latency.p95}ms > 3ms`);

  // 4. Policy evaluation throughput
  const latency = measureBatch(50000, () => registry.evaluatePolicy(caller, "identity:users", "read"));
  assert(latency.p95 < 1, `PolicyGuard p95: ${latency.p95}ms > 1ms`);

  // 5. Response validation throughput
  const respValidator = registry.getResponseValidator("POST", "/api/v1/auth/register", 201);
  const latency = measureBatch(10000, () => respValidator(validResponse));
  assert(latency.p95 < 1, `ContractInterceptor p95: ${latency.p95}ms > 1ms`);

  // 6. Event validation throughput
  const eventValidator = registry.getEventValidator("service.order.placed");
  const latency = measureBatch(20000, () => eventValidator(validOrderPayload));
  assert(latency.p95 < 2, `EventValidator p95: ${latency.p95}ms > 2ms`);

  // 7. Hot reload benchmark
  const reloadTime = measure("hot-reload", () => registry.reloadFile("specs/contracts/openapi/identity-api.yaml"));
  assert(reloadTime.p95 < 5, `Hot reload: ${reloadTime.p95}ms > 5ms`);
}
```

### 2.4 Benchmark Execution

```bash
# Run all benchmarks
pnpm --filter @aht/api bench:crbl

# Run specific benchmark
pnpm --filter @aht/api bench:crbl -- --guard=ContractGuard

# Run with warmup iterations
pnpm --filter @aht/api bench:crbl -- --warmup=1000 --iterations=10000

# Run with JSON output for CI comparison
pnpm --filter @aht/api bench:crbl -- --json > bench-results.json
```

---

## 3. CI Performance Gate

### 3.1 Gate Configuration

```yaml
# .github/workflows/crbl-contract-tests.yml
performance-benchmarks:
  runs-on: ubuntu-latest
  if: github.ref == 'refs/heads/main'
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: "22", cache: "pnpm" }
    - run: pnpm install
    - name: Run CRBL benchmarks
      run: pnpm --filter @aht/api bench:crbl -- --json > bench-results.json
    - name: Verify performance budget
      run: |
        node -e "
          const results = JSON.parse(require('fs').readFileSync('bench-results.json','utf8'));
          const budgets = {
            ContractGuard_p95: 3,
            PolicyGuard_p95: 1,
            ContractInterceptor_p95: 1,
            ContractPipe_p95: 2,
            EventValidator_p95: 2,
            total_p95: 5,
            cold_start: 50,
            hot_reload: 5,
          };
          let failed = false;
          for (const [key, budget] of Object.entries(budgets)) {
            if (results[key] > budget) {
              console.error(\`BUDGET VIOLATION: \${key} = \${results[key]}ms (budget: \${budget}ms)\`);
              failed = true;
            }
          }
          if (failed) process.exit(1);
          console.log('All performance budgets met.');
        "
```

### 3.2 Failure Behavior

| Condition | Severity | Action |
|:---|:---|:---|
| Any p95 target exceeded | **ERROR** | Blocks merge to `main`. Comment on PR with benchmark comparison. |
| Startup time > 100ms | **WARNING** | Does not block. Reported in CI summary. |
| Benchmark harness failure | **ERROR** | Blocks merge. Infrastructure issue. |

### 3.3 Baseline Tracking

Benchmark results are committed as a baseline file for regression detection:

```
packages/contracts/spec/benchmarks/
├── baseline.json            # Current accepted baseline
├── history.jsonl            # All historical runs (for trend analysis)
└── regression-thresholds.json  # Per-component regression thresholds
```

```json
{
  "version": "1.0",
  "date": "2026-06-20",
  "commit": "abc1234",
  "environment": {
    "node": "22.12.0",
    "cpu": "AMD EPYC 7763",
    "memory": "16GB"
  },
  "results": {
    "cold_start_ms": { "p50": 38, "p95": 47, "p99": 52 },
    "hot_reload_ms": { "p50": 2.1, "p95": 3.8, "p99": 4.5 },
    "ContractGuard_p95_ms": { "p50": 0.8, "p95": 2.1, "p99": 3.5 },
    "PolicyGuard_p95_ms": { "p50": 0.1, "p95": 0.3, "p99": 0.6 },
    "ContractInterceptor_p95_ms": { "p50": 0.3, "p95": 0.6, "p99": 0.9 },
    "ContractPipe_p95_ms": { "p50": 0.4, "p95": 1.1, "p99": 1.8 },
    "EventValidator_p95_ms": { "p50": 0.3, "p95": 0.8, "p99": 1.5 },
    "total_crbl_overhead_p95_ms": { "p50": 2.1, "p95": 3.8, "p99": 4.7 },
    "ajv_compile_ai_api_ms": { "p50": 65, "p95": 89, "p99": 98 },
    "ajv_compile_commerce_api_ms": { "p50": 15, "p95": 24, "p99": 29 },
    "ajv_compile_all_events_ms": { "p50": 120, "p95": 175, "p99": 195 }
  }
}
```

---

## 4. Performance Degradation Protocol

### 4.1 Regression Thresholds

| Metric | Warning Threshold | Error Threshold |
|:---|:---|:---|
| ContractGuard p95 | +20% vs baseline | +50% vs baseline |
| PolicyGuard p95 | +30% vs baseline | +100% vs baseline |
| Total CRBL overhead p95 | +15% vs baseline | +30% vs baseline |
| Cold start | +50% vs baseline | +100% vs baseline |

### 4.2 Investigation Checklist

When the performance budget is exceeded:

1. Check AJV compilation strategy — are validators being recompiled on every request?
2. Check Redis cache hit rate — are validators being served from cache?
3. Check schema size — has the OpenAPI spec grown beyond expected bounds?
4. Check for synchronous I/O in the validation path (file reads, Redis calls)
5. Check for recursive schema patterns causing AJV backtracking
6. Profile with Node.js `--prof` to identify hot paths
7. Review recent contract changes that may have introduced expensive validation patterns

---

## 5. Health Check Endpoint

### 5.1 Response Schema

```json
{
  "status": "healthy",
  "mode": "strict",
  "loadTime": {
    "openapiSpecs": 0.012,
    "eventSchemas": 0.008,
    "policyRules": 0.005,
    "total": 0.025
  },
  "caches": {
    "requestValidators": { "total": 184, "cached": 184, "hitRate": 1.0 },
    "responseValidators": { "total": 184, "cached": 184, "hitRate": 1.0 },
    "eventValidators": { "total": 94, "cached": 94, "hitRate": 1.0 }
  },
  "metrics": {
    "validationsTotal": 1245783,
    "violationsTotal": 23,
    "violationRate": 0.000018,
    "p95LatencyMs": {
      "ContractGuard": 2.1,
      "PolicyGuard": 0.3,
      "ContractInterceptor": 0.6,
      "ContractPipe": 1.1,
      "EventValidator": 0.8,
      "total": 3.8
    }
  },
  "specs": {
    "openapi": ["identity-api.yaml", "customer-api.yaml", "service-api.yaml", "commerce-api.yaml", "support-api.yaml", "content-api.yaml", "notification-api.yaml", "analytics-api.yaml", "ai-api.yaml"],
    "events": "event-schemas.yaml",
    "policies": "access-control.yaml"
  }
}
```

### 5.2 Scrape Configuration

```yaml
# prometheus scrape config
scrape_configs:
  - job_name: "crbl-health"
    metrics_path: "/api/v1/health/crbl"
    scrape_interval: 15s
    static_configs:
      - targets: ["api:3000"]
```

---

## Appendix A: Measurement Tooling

| Tool | Purpose |
|:---|:---|
| `process.hrtime.bigint()` | High-resolution wall-clock timing in benchmark harness |
| `prom-client` (Prometheus) | Runtime histogram/counter for production monitoring |
| `perf_hooks.PerformanceObserver` | Node.js performance timeline for detailed traces |
| `autocannon` / `k6` | Load-generation for end-to-end latency measurement |
| `clinic.js` | Flame graphs and CPU profiling for hot-path investigation |
