# Contract Test Harness Specification

**Version:** 1.0
**Owner:** AlharisTech Platform Team
**Package:** `packages/contracts`
**Governance Principle:** PERP-API (API First — "OpenAPI spec before implementation")

---

## Purpose

Auto-generate and execute contract compliance tests from the single source of truth:
OpenAPI specs, event schemas, and access-control policy rules. Every endpoint, event,
and policy must pass contract tests before merge.

The harness eliminates hand-written API tests for contract-level concerns. Tests are
derived mechanically from specifications. If a spec changes, the tests update. If an
implementation drifts from spec, tests fail.

## Scope

| Source | Count | Test Category |
|---|---|---|
| `specs/contracts/openapi/*.yaml` | 9 APIs | API Contract Tests |
| `specs/contracts/events/event-schemas.yaml` | 94 events | Event Contract Tests |
| `specs/contracts/policy/access-control.yaml` | 162 rules | Policy Contract Tests |
| `specs/contracts/service-catalog.yaml` | 149 endpoints | Coverage + Drift Detection |

---

## 1. API Contract Tests

Generated from the 9 OpenAPI specs:
`identity-api.yaml`, `content-api.yaml`, `commerce-api.yaml`, `notification-api.yaml`,
`analytics-api.yaml`, `support-api.yaml`, `service-api.yaml`, `customer-api.yaml`,
`ai-api.yaml`.

### 1.1 Test Framework

- **Runner:** Vitest (with `@vitest/coverage-v8`)
- **HTTP client:** `supertest` (tests against running NestJS HTTP server)
- **Schema validation:** `ajv` (JSON Schema validator for response body validation)
- **Environment:** `test` — NestJS application created via `Test.createTestingModule()`
- **Parallelism:** Tests are file-parallel (one spec file per test file), serial within file

### 1.2 Test Cases Generated Per Endpoint

For each `operationId` in each OpenAPI spec, the harness generates:

#### Happy Path

| Test ID | Scenario | Generated Assertion |
|---|---|---|
| `{i}-happy` | Valid request → expected status | Request body built from schema (with valid defaults). Assert HTTP status matches the success status code (2xx). |
| `{i}-happy-schema` | Valid request → response matches schema | Assert response body validates against the success response JSON Schema via ajv. All required fields present, types correct. |

#### Validation (422)

| Test ID | Scenario | Generated Assertion |
|---|---|---|
| `{i}-missing-required` | Missing required field → 422 | For each required field in `requestBody` schema: omit it, assert status 422, assert error response contains field-level detail referencing the omitted field. |
| `{i}-invalid-type` | Invalid type → 422 | For each field in `requestBody` schema: send wrong JSON type (e.g., string where number expected), assert status 422. |
| `{i}-invalid-format` | Invalid format → 422 | For fields with `format` constraint (email, uuid, date-time, uri): send value violating format, assert status 422. |
| `{i}-invalid-enum` | Invalid enum value → 422 | For fields with `enum` constraint: send value outside enum, assert status 422. |
| `{i}-out-of-range` | Value out of range → 422 | For fields with `minimum`/`maximum`/`minLength`/`maxLength`: send value outside range, assert status 422. |

#### Authentication (401)

| Test ID | Scenario | Generated Assertion |
|---|---|---|
| `{i}-no-token` | Missing token → 401 | For endpoints with `security: [{bearerAuth: []}]`: send request without Authorization header, assert status 401. |
| `{i}-expired-token` | Expired token → 401 | Send request with an expired JWT (valid signature, `exp` in past), assert status 401. |
| `{i}-malformed-token` | Malformed token → 401 | Send request with `Authorization: Bearer not-a-jwt`, assert status 401. |

#### Authorization (403)

| Test ID | Scenario | Generated Assertion |
|---|---|---|
| `{i}-wrong-role` | Wrong role → 403 | For each role NOT in the endpoint's allowed roles (from `service-catalog.yaml`): authenticate with that role, assert status 403. |
| `{i}-insufficient-role` | Lower privilege role → 403 | Authenticate as `customer` for admin-only endpoints, assert status 403. |

#### Rate Limiting (429) — Phase 2+

| Test ID | Scenario | Generated Assertion |
|---|---|---|
| `{i}-rate-limit` | Exceed rate limit → 429 | Send `rate_limit + 1` requests in rapid succession, assert final request returns 429. (Skipped in Phase 1 — configurable) |

#### Pagination Validation — Phase 2+

For endpoints returning arrays with pagination metadata:

| Test ID | Scenario | Generated Assertion |
|---|---|---|
| `{i}-pagination` | Pagination params work | Send `?page=1&perPage=10`, assert response includes pagination metadata (`total`, `perPage`, `currentPage`, `hasNextPage`). |

### 1.3 Endpoints Exempt from Full Test Generation

- **Public endpoints** (`auth: "public"`): Skip auth tests (no token, expired token, wrong role).
- **GraphQL endpoints** (`graphql: true`): Tests generated against GraphQL schema introspected from the endpoint, not OpenAPI request bodies. Validate queries/mutations against schema.
- **File upload endpoints**: Generate multipart/form-data tests. Validate response status and content-type.
- **Webhook endpoints**: Generate signature verification tests only (no auth via JWT).

### 1.4 Test Naming Convention

```
{method} {path} — {scenario}
```

Examples:
- `POST /api/v1/auth/register — valid request returns 201`
- `POST /api/v1/auth/register — missing email returns 422`
- `POST /api/v1/auth/register — missing password returns 422`
- `POST /api/v1/auth/register — invalid email format returns 422`
- `GET /api/v1/users/me — missing token returns 401`
- `GET /api/v1/users/me — expired token returns 401`
- `GET /api/v1/admin/users — wrong role (customer) returns 403`
- `PATCH /api/v1/users/{id}/role — insufficient role (employee) returns 403`

### 1.5 Test Data Factory

The harness includes a test data factory that generates valid request bodies from schemas:

| Schema Type | Generated Value |
|---|---|
| `string` | `"test-{fieldName}"` |
| `string (format: email)` | `"test.{fieldName}@alharistech-test.com"` |
| `string (format: uuid)` | `"00000000-0000-0000-0000-000000000000"` (well-known test UUID) |
| `string (format: date-time)` | `"2026-01-01T00:00:00Z"` |
| `string (format: uri)` | `"https://test.alharistech.com/{fieldName}"` |
| `integer / number` | `1` (or `minimum` value if specified) |
| `boolean` | `true` |
| `enum` | First enum value |
| `array` | Single-element array with generated item |
| `object` | Recursive generation of nested properties |

Factory skips `readOnly: true` and `writeOnly: false` fields when generating request bodies.

---

## 2. Event Contract Tests

Generated from `specs/contracts/events/event-schemas.yaml` (94 events across 9 domains).

### 2.1 Test Framework

- **Runner:** Vitest (pure function tests — no BullMQ, no Redis, no network)
- **Schema validation:** `ajv` compiled from event JSON Schema
- **Location:** `packages/contracts/src/__tests__/events/`

### 2.2 Test Cases Generated Per Event

For each event in `event-schemas.yaml`:

| Test ID | Scenario | Assertion |
|---|---|---|
| `{event}-valid` | Valid payload passes validation | Build a valid payload from the event schema (using the test data factory). Assert `ajv.validate(eventSchema, payload)` returns `true`. |
| `{event}-missing-required` | Missing required field fails | For each field in `required[]`: omit it, assert `ajv.validate(eventSchema, payload)` returns `false`. |
| `{event}-invalid-type` | Invalid type fails | For each property: change type (e.g., string → number), assert validation fails. |
| `{event}-invalid-format` | Invalid format fails | For fields with `format` (uuid, date-time, email): violate format, assert validation fails. |
| `{event}-invalid-enum` | Invalid enum fails | For fields with `enum`: send value outside enum, assert validation fails. |
| `{event}-extra-field` | Extra field is tolerated | Add a field not in schema. Schema allows `additionalProperties` (or is strict if configured). Assert behavior matches schema expectation. |

### 2.3 Test Naming Convention

```
event {domain}.{aggregate}.{action} — {scenario}
```

Examples:
- `event identity.user.registered — valid payload passes validation`
- `event identity.user.registered — missing email fails validation`
- `event commerce.order.created — missing orderId fails validation`
- `event notification.email.sent — invalid email format fails validation`

### 2.4 Event Schema Compilation

Before generating event tests, the harness:

1. Parses `event-schemas.yaml` → extracts each event's `schema` block
2. Validates each schema is valid JSON Schema (Draft 2020-12)
3. Compiles schemas with ajv (with `strict: true` to catch ambiguous keywords)
4. Resolves cross-references if any `$ref` appears

Schema compilation failures are treated as test failures (not harness errors).

---

## 3. Policy Contract Tests

Generated from `specs/contracts/policy/access-control.yaml` (162 policy rules).

### 3.1 Test Framework

- **Runner:** Vitest (unit tests — pure function evaluation)
- **Subject under test:** `PolicyGuard.evaluate(user, resource, action) → boolean`
- **Location:** `packages/contracts/src/__tests__/policies/`

### 3.2 Test Cases Generated Per Policy Rule

For each policy rule in `access-control.yaml`:

#### Allow Rules (`effect: allow`)

| Test ID | Scenario | Assertion |
|---|---|---|
| `{policy}-allow` | Allowed role+resource+action → true | For each role in `roles[]`: call `evaluate(userWithRole, resource, action)` → assert `true`. |
| `{policy}-deny-other-role` | Other role denied → false | For a role NOT in `roles[]`: assert `evaluate(otherUser, resource, action)` → `false`. |
| `{policy}-deny-other-action` | Other action denied → false | For an action NOT in `actions[]`: assert `evaluate(userWithRole, resource, otherAction)` → `false`. |

#### Deny Rules (`effect: deny`)

| Test ID | Scenario | Assertion |
|---|---|---|
| `{policy}-deny` | Denied role+resource+action → false | Assert `evaluate(userWithRole, resource, action)` → `false`. |

#### Conditional Rules (with `conditions[]`)

| Test ID | Scenario | Assertion |
|---|---|---|
| `{policy}-condition-met` | Condition met → allows | Simulate `$caller.id` matching resource owner id → assert `true`. |
| `{policy}-condition-not-met` | Condition not met → denies | Simulate `$caller.id` NOT matching resource owner id → assert `false`. |
| `{policy}-condition-null` | Condition field is null → denies | Resource owner field is `null` → assert `false`. |

### 3.3 Context-Aware Test Scenarios

Generated from condition patterns in policies:

| Pattern | Condition | Test |
|---|---|---|
| **Self-access** | `field: "id", operator: "equals", value: "$caller.id"` | Employee can read own profile (true). Employee cannot read another employee's profile (false). |
| **Ownership** | `field: "userId", operator: "equals", value: "$caller.id"` | Customer can access own orders (true). Customer cannot access another customer's orders (false). |
| **Cross-tenant** | Resource scoped to tenant, user belongs to different tenant | Cross-tenant access denied even if roles match (false). |
| **Default deny** | No matching policy exists | Any not-explicitly-allowed combination → `false`. |

### 3.4 Priority Evaluation Tests

The policy engine uses priority-based evaluation (higher number wins):

```
P1: allow, roles=[admin], priority=100
P2: deny,  roles=[admin], priority=200

→ Deny wins (higher priority).
```

Tests verify priority ordering by constructing conflicting policies and asserting the expected outcome.

### 3.5 Test Naming Convention

```
policy {domain}:{resource} — {scenario}
```

Examples:
- `policy identity:users — admin can read`
- `policy identity:users — customer cannot delete`
- `policy identity:users — employee can read own profile (self-access)`
- `policy identity:users — employee cannot read another employee profile`
- `policy commerce:orders — customer can access own orders`
- `policy commerce:orders — customer cannot access another customer orders`
- `policy identity:roles — manager can read but not delete`

---

## 4. Schema Compilation Tests

Verification that all contract artifacts are syntactically valid and structurally sound.

### 4.1 OpenAPI Compilation

```
Test Suite: Schema Compilation > OpenAPI
```

| Test ID | Check | Assertion |
|---|---|---|
| `compile-openapi-yaml` | All 9 YAML files parseable | `yaml.parse(file)` succeeds without error for each OpenAPI spec. |
| `compile-openapi-json-schema` | All schemas compile to valid JSON Schema | Extract each component schema, validate against JSON Schema meta-schema (Draft 2020-12). |
| `compile-openapi-path-params` | All path parameters defined | Every `{param}` in path strings has a corresponding `parameters` entry. |
| `compile-openapi-refs` | All `$ref` references resolve | No dangling references. Walk all `$ref` targets, verify they point to defined components. |

### 4.2 Event Schema Compilation

```
Test Suite: Schema Compilation > Events
```

| Test ID | Check | Assertion |
|---|---|---|
| `compile-event-yaml` | Event schemas YAML parseable | `yaml.parse(file)` succeeds. |
| `compile-event-schemas` | All 94 event schemas valid JSON Schema | Validate each event's `schema` block against JSON Schema meta-schema. |
| `compile-event-required` | Required fields exist in properties | Every field in `required[]` exists in `properties{}`. |
| `compile-event-unique-names` | No duplicate event names | All event names (`domain.aggregate.action`) are unique. |

### 4.3 Policy Compilation

```
Test Suite: Schema Compilation > Policies
```

| Test ID | Check | Assertion |
|---|---|---|
| `compile-policy-yaml` | Policy YAML parseable | `yaml.parse(file)` succeeds. |
| `compile-policy-rules` | All 162 rules have required fields | Each rule has `effect`, `roles`, `resources`, `actions`. |
| `compile-policy-effects` | Effects are valid | `effect` is `"allow"` or `"deny"`. |
| `compile-policy-roles` | Roles are valid | Each role in `roles[]` is one of: `admin`, `manager`, `employee`, `customer`, `partner`, `*`. |
| `compile-policy-actions` | Actions are valid | Each action in `actions[]` is one of: `create`, `read`, `update`, `delete`, `issue`, `refresh`, `revoke`, `publish`, `unpublish`, `activate`, `execute`, `export`, `import`, `merge`, `grant`, `revoke_permission`. |
| `compile-policy-conditions` | Condition operators are valid | Each condition `operator` is one of: `equals`, `not_equals`, `in`, `not_in`, `contains`, `gt`, `gte`, `lt`, `lte`. |

### 4.4 Service Catalog Compilation

```
Test Suite: Schema Compilation > Service Catalog
```

| Test ID | Check | Assertion |
|---|---|---|
| `compile-catalog-yaml` | Service catalog YAML parseable | `yaml.parse(file)` succeeds. |
| `compile-catalog-count` | Catalog has 149 endpoints | `services.length === 149`. |
| `compile-catalog-unique` | No duplicate path+method combinations | `Set(path + method).size === services.length`. |
| `compile-catalog-domains` | All domains are valid | Each `domain` is one of: `identity`, `customer`, `service`, `commerce`, `support`, `content`, `notification`, `analytics`, `ai`. |
| `compile-catalog-auth` | Auth field is valid | Each `auth` is `"public"` or `"required"`. |
| `compile-catalog-phases` | Phase field is valid | Each `phase` is `"phase-1"` through `"phase-5"`. |

---

## 5. CI Integration

### 5.1 GitHub Actions Workflow

```yaml
# .github/workflows/contract-tests.yml
name: Contract Tests

on:
  pull_request:
    branches: [main, develop]
    paths:
      - 'specs/contracts/**'
      - 'packages/contracts/**'
      - '.governance/**'
  push:
    branches: [main]
    paths:
      - 'specs/contracts/**'
      - 'packages/contracts/**'
      - '.governance/**'

jobs:
  contract-tests:
    name: Contract Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15

    services:
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: alharistech_test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - run: npm ci

      # Gate CRBL-01: Schema Validity (always runs)
      - name: Validate Schemas
        run: npx turbo validate:schemas

      # Gate CRBL-02/03: Contract Tests + Coverage
      - name: Run Contract Tests
        run: npx turbo test:contracts -- --coverage

      # Generate coverage report
      - name: Contract Coverage Report
        run: npx turbo coverage:contracts

      # Upload results
      - name: Upload Test Results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: contract-test-results
          path: |
            packages/contracts/coverage/
            packages/contracts/test-results/
          retention-days: 30

      # Gate CRBL-04: Drift Detection (only on main push)
      - name: Detect Contract Drift
        if: github.ref == 'refs/heads/main'
        run: npx turbo drift:detect
        continue-on-error: true

  contract-openapi-lint:
    name: OpenAPI Lint
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4

      # Gate CRBL-05
      - name: Spectral Lint
        uses: stoplightio/spectral-action@v0.8.10
        with:
          file_glob: 'specs/contracts/openapi/*.yaml'
          spectral_ruleset: 'specs/contracts/.spectral.yaml'

  contract-breaking-change:
    name: Breaking Change Detection
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      # Gate CRBL-06
      - name: Detect Breaking Changes
        run: |
          for spec in specs/contracts/openapi/*.yaml; do
            echo "Checking $spec..."
            npx @openapi-diff/cli \
              "$(git show origin/main:"$spec")" \
              "$spec" \
              --markdown report.md || true
          done

      - name: Upload Breaking Change Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: breaking-change-report
          path: report.md
```

### 5.2 Package.json Scripts

```json
{
  "scripts": {
    "validate:schemas": "vitest run --config vitest.contracts.config.ts --project schemas",
    "test:contracts": "vitest run --config vitest.contracts.config.ts",
    "coverage:contracts": "tsx packages/contracts/src/scripts/coverage-report.ts",
    "drift:detect": "tsx packages/contracts/src/scripts/drift-detection.ts",
    "openapi-lint": "spectral lint specs/contracts/openapi/*.yaml",
    "openapi-diff": "tsx packages/contracts/src/scripts/breaking-changes.ts"
  }
}
```

### 5.3 Turbo Pipeline Configuration

```jsonc
// turbo.json (contract-related tasks)
{
  "tasks": {
    "validate:schemas": {
      "cache": true,
      "inputs": ["specs/contracts/**"],
      "outputs": []
    },
    "test:contracts": {
      "dependsOn": ["validate:schemas"],
      "cache": true,
      "inputs": [
        "specs/contracts/**",
        "packages/contracts/src/**"
      ],
      "outputs": ["coverage/**", "test-results/**"]
    },
    "coverage:contracts": {
      "dependsOn": ["test:contracts"],
      "cache": false,
      "outputs": ["packages/contracts/coverage-report.json"]
    },
    "drift:detect": {
      "dependsOn": [],
      "cache": false,
      "inputs": [
        "specs/contracts/service-catalog.yaml",
        "packages/contracts/src/routes.ts"
      ],
      "outputs": []
    }
  }
}
```

### 5.4 Vitest Configuration

```typescript
// packages/contracts/vitest.contracts.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'contracts',
    globals: true,
    environment: 'node',
    include: [
      'src/__tests__/api/**/*.test.ts',
      'src/__tests__/events/**/*.test.ts',
      'src/__tests__/policies/**/*.test.ts',
      'src/__tests__/compile/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      thresholds: {
        statements: 95,
        branches: 95,
        functions: 95,
        lines: 95,
      },
    },
    reporters: ['default', 'json'],
    outputFile: {
      json: './test-results/contract-tests.json',
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
```

### 5.5 Contract Coverage Report

The coverage report (`turbo coverage:contracts`) produces:

```json
{
  "timestamp": "2026-06-20T12:00:00Z",
  "endpoints": {
    "total": 149,
    "tested": 149,
    "untested": 0,
    "coverage": 100.0
  },
  "events": {
    "total": 94,
    "tested": 94,
    "untested": 0,
    "coverage": 100.0
  },
  "policies": {
    "total": 162,
    "tested": 162,
    "untested": 0,
    "coverage": 100.0
  },
  "openapiSpecs": {
    "total": 9,
    "valid": 9,
    "invalid": 0
  },
  "overallCoverage": 100.0,
  "warnings": [],
  "errors": []
}
```

Coverage threshold: **≥ 95%** for gate CRBL-03 to pass.

### 5.6 Failure Behavior

| CI Event | Failure | Action |
|---|---|---|
| `validate:schemas` fails | PR / push | **Block.** Comment on PR with specific validation errors. |
| `test:contracts` fails | PR | **Block merge.** PR status check shows ❌. Details link to test report artifact. |
| `coverage:contracts` < 95% | PR | **Warning only.** PR status check shows ⚠️. Does not block merge but reports. |
| `drift:detect` Phase 1 | push to main | **Warning only.** Slack notification to #platform-eng. |
| `drift:detect` Phase 2+ | push to main | **Error.** Slack notification + creates GitHub issue. |
| `openapi-lint` fails | PR to specs/ | **Block.** Must fix lint violations before merge. |
| `breaking-change` detected | PR to specs/ | **Warning.** Requires architecture approval (2 reviewers). |

---

## 6. Contract Drift Detection

### 6.1 Detection Logic

```
drift_detect():
  catalog = parse(service-catalog.yaml)
  implemented = scan_controller_decorators()  # @Controller, @Get, @Post, etc.
  
  for each endpoint in catalog:
    if not found in implemented:
      warn("FR-{fr_ref} '{description}' cataloged but not implemented")
  
  for each route in implemented:
    if not found in catalog:
      error("Route '{path}' implemented but not in service-catalog")
      error("  → PERP-API violation: API-first requires OpenAPI spec before code")
      error("  → Remediation: Add endpoint to service-catalog.yaml OR remove route")
```

### 6.2 Phase-Dependent Severity

| Phase | Undocumented Endpoint | Unimplemented Catalog Entry |
|---|---|---|
| Phase 1 (Foundation) | Warning | Warning |
| Phase 2 (Core Operations) | Error (block) | Warning |
| Phase 3 (Growth) | Error (block) | Error (block) |
| Phase 4 (Mature) | Error (block) | Error (block) |
| Phase 5 (Optimization) | Error (block) | Error (block) |

### 6.3 Scanning Controller Decorators

The drift detector parses NestJS controller files for route decorators:

| Decorator | HTTP Method |
|---|---|
| `@Get()` | GET |
| `@Post()` | POST |
| `@Put()` | PUT |
| `@Patch()` | PATCH |
| `@Delete()` | DELETE |

Extracts path from `@Controller('prefix')` + method decorator path.

---

## 7. Test Generation Pipeline

### 7.1 Architecture

```
specs/contracts/
├── openapi/*.yaml ──────┐
├── events/*.yaml  ──────┤
├── policy/*.yaml  ──────┤
└── service-catalog.yaml ─┤
                          │
                          ▼
              ┌──────────────────────┐
              │   Test Generator     │
              │  (build-time step)   │
              │  tsx generate-tests  │
              └──────┬───────────────┘
                     │
                     ▼
packages/contracts/src/__tests__/
├── api/
│   ├── identity-api.test.ts
│   ├── content-api.test.ts
│   ├── commerce-api.test.ts
│   ├── notification-api.test.ts
│   ├── analytics-api.test.ts
│   ├── support-api.test.ts
│   ├── service-api.test.ts
│   ├── customer-api.test.ts
│   └── ai-api.test.ts
├── events/
│   ├── identity-events.test.ts
│   ├── customer-events.test.ts
│   ├── service-events.test.ts
│   ├── commerce-events.test.ts
│   ├── support-events.test.ts
│   ├── content-events.test.ts
│   ├── notification-events.test.ts
│   ├── analytics-events.test.ts
│   └── ai-events.test.ts
├── policies/
│   ├── identity-policies.test.ts
│   ├── customer-policies.test.ts
│   ├── service-policies.test.ts
│   ├── commerce-policies.test.ts
│   ├── support-policies.test.ts
│   ├── content-policies.test.ts
│   ├── notification-policies.test.ts
│   ├── analytics-policies.test.ts
│   └── ai-policies.test.ts
└── compile/
    ├── openapi-compile.test.ts
    ├── event-schemas-compile.test.ts
    ├── policy-rules-compile.test.ts
    └── service-catalog-compile.test.ts
```

### 7.2 Generation Command

```bash
# Generate all contract tests from specs
npx tsx packages/contracts/src/scripts/generate-contract-tests.ts

# Output: "Generated 1,847 contract tests from 149 endpoints, 94 events, 162 policies."
```

Generated tests are committed to the repository. CI validates that generated tests match specs (test generation is reproducible and deterministic).

### 7.3 Generator Validation

As a safety check, the generator includes a validation step:

```bash
# Verify generated tests are up-to-date with specs
npx tsx packages/contracts/src/scripts/verify-test-generation.ts

# If specs changed but tests not regenerated → CI fails with:
# "Contract tests are stale. Run 'npm run generate:contract-tests' and commit."
```

---

## 8. Remediation Guide

### Schema Validation Failures

| Error | Remediation |
|---|---|
| `OpenAPI YAML parse error` | Fix YAML syntax. Check indentation, quotes, special characters. Use a YAML validator. |
| `$ref not found: #/components/schemas/X` | Schema `X` is referenced but not defined. Define it in `components/schemas` or fix the reference. |
| `Event schema invalid: required field not in properties` | Field listed in `required[]` but missing from `properties{}`. Add the property or remove from required. |
| `Policy rule missing required field: effect` | Add `effect: allow` or `effect: deny` to the policy entry. |

### Contract Test Failures

| Error | Remediation |
|---|---|
| `Expected 201, got 500` | Implementation bug. Fix the endpoint. |
| `Expected 422, got 200` | Missing input validation. Add validation pipe / class-validator decorators. |
| `Expected 401, got 200` | Missing auth guard. Add `@UseGuards(JwtAuthGuard)` to controller or route. |
| `Expected 403, got 200` | Missing role guard. Add `@Roles('admin')` + `@UseGuards(RolesGuard)`. |
| `Response schema mismatch: field X missing` | Response is missing a field defined in OpenAPI. Add field to response or update spec. |
| `Response schema mismatch: field X has wrong type` | Field type in response doesn't match OpenAPI. Fix type or update spec. |

### Drift Detection Warnings/Errors

| Warning/Error | Remediation |
|---|---|
| `Endpoint cataloged but not implemented` | Implement the endpoint or mark it as `phase: "phase-N"` for a future phase. |
| `Endpoint implemented but not in catalog` | Add the endpoint to `service-catalog.yaml` with full metadata. If it's internal-only, document it as `internal: true`. |

### Coverage Gaps

| Gap | Remediation |
|---|---|
| Endpoint has no invalid-request test | Ensure requestBody schema has `required` fields. If truly no required fields, document as exempt. |
| Event has no invalid test | Ensure event schema has `required` fields. If schema accepts any payload, document as exempt. |
| Policy rule has no deny test | If a rule allows for all roles, there's no "wrong role" to test — add a comment explaining. |

---

## Appendix A: Test Count Estimation

| Category | Items | Tests Per Item | Estimated Total |
|---|---|---|---|
| API endpoints (happy path) | 149 | 2 (status + schema) | 368 |
| API endpoints (validation) | 149 | ~5 per endpoint (avg required fields) | ~920 |
| API endpoints (auth) | ~140 (non-public) | 3 (no token, expired, malformed) | 420 |
| API endpoints (authorization) | ~120 (role-restricted) | ~2 per endpoint | ~240 |
| Event schemas | 94 | 5 per event | 470 |
| Policy rules (allow) | ~140 | 3 per rule | 420 |
| Policy rules (deny) | ~22 | 1 per rule | 22 |
| Policy rules (conditional) | ~18 | 3 per condition pattern | 54 |
| Schema compilation | 4 suites | ~15 total | 15 |
| **Total** | | | **~2,929** |

## Appendix B: File Structure

```
packages/contracts/
├── spec/
│   ├── contract-test-harness.md          # This file
│   └── ci-verification-gates.md          # CI/CD gate definitions
├── src/
│   ├── __tests__/
│   │   ├── api/                          # Auto-generated API contract tests
│   │   ├── events/                       # Auto-generated event contract tests
│   │   ├── policies/                     # Auto-generated policy contract tests
│   │   └── compile/                      # Schema compilation tests
│   ├── scripts/
│   │   ├── generate-contract-tests.ts    # Test generation entry point
│   │   ├── verify-test-generation.ts     # Stale-test detection
│   │   ├── coverage-report.ts            # Contract coverage reporter
│   │   └── drift-detection.ts            # Endpoint drift scanner
│   ├── harness/
│   │   ├── test-data-factory.ts          # Schema → valid test data
│   │   ├── openapi-parser.ts             # OpenAPI YAML → test cases
│   │   ├── event-schema-parser.ts        # Event YAML → test cases
│   │   ├── policy-parser.ts              # Policy YAML → test cases
│   │   └── schema-compiler.ts            # Shared JSON Schema compilation
│   └── guards/
│       └── policy-guard.ts               # PolicyGuard.evaluate() implementation
├── vitest.contracts.config.ts            # Vitest configuration
├── tsconfig.json
└── package.json
```
