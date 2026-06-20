# CI Contract Verification Gates

**Version:** 1.0
**Owner:** AlharisTech Platform Team
**Package:** `packages/contracts`
**Governance Reference:** `.governance/enforcement.yaml` — PERP-API, PERP-MOD, PERP-FCL

---

## Purpose

Define the CI/CD gates that enforce contract compliance across all 9 domains, 184 endpoints,
94 events, and 162 policy rules. Each gate maps to a specific `.governance/enforcement.yaml`
principle and has defined failure modes, remediation steps, and phase-dependent behavior.

---

## Gate CRBL-01: Schema Validity

| Attribute | Value |
|---|---|
| **Gate ID** | `CRBL-01` |
| **Name** | Schema Validity |
| **Principle** | PERP-API (API First) |
| **Trigger** | Every push, every PR |
| **Command** | `turbo validate:schemas` |
| **Blocking** | Yes — blocks push/PR |
| **Runtime** | ~5 seconds |

### Checks Performed

| # | Check | Source | Assertion |
|---|---|---|---|
| 1.1 | OpenAPI YAML parseable | `specs/contracts/openapi/*.yaml` × 9 | All 9 YAML files parse without error via `yaml.parse()`. |
| 1.2 | OpenAPI version check | OpenAPI `openapi` field | Version is `3.1.0` for all specs. |
| 1.3 | OperationIds present | OpenAPI `operationId` field | Every operation has a unique `operationId` (kebab-case, domain-prefixed). |
| 1.4 | JSON Schema compilation | OpenAPI `components/schemas` | All embedded schemas are valid JSON Schema (Draft 2020-12). Compiled with `ajv` in strict mode. |
| 1.5 | `$ref` resolution | OpenAPI `$ref` references | All `#/components/schemas/X` references resolve to defined schemas. No dangling refs. |
| 1.6 | Event schemas valid | `specs/contracts/events/event-schemas.yaml` | All 94 event `schema` blocks are valid JSON Schema. |
| 1.7 | Event names unique | `event-schemas.yaml` | No duplicate event names (`domain.aggregate.action`). |
| 1.8 | Event required fields exist | `event-schemas.yaml` | Every field in `required[]` is defined in `properties{}`. |
| 1.9 | Policy rules parseable | `specs/contracts/policy/access-control.yaml` | All 162 policy entries have required fields: `effect`, `roles`, `resources`, `actions`. |
| 1.10 | Policy effects valid | `access-control.yaml` | All `effect` values are `"allow"` or `"deny"`. |
| 1.11 | Policy roles valid | `access-control.yaml` | All role values are from the allowed set: `admin`, `manager`, `employee`, `customer`, `partner`, `*`. |
| 1.12 | Policy actions valid | `access-control.yaml` | All action values are from the allowed set: `create`, `read`, `update`, `delete`, `issue`, `refresh`, `revoke`, `publish`, `unpublish`, `activate`, `execute`, `export`, `import`, `merge`, `grant`, `revoke_permission`. |
| 1.13 | Service catalog parseable | `specs/contracts/service-catalog.yaml` | YAML parses, `services` is an array with 184 entries. |
| 1.14 | Service catalog entries valid | `service-catalog.yaml` | Each entry has `path`, `method`, `domain`, `service`, `description`, `auth`, `roles`, `errors`, `fr_ref`, `phase`. |
| 1.15 | Service catalog domains valid | `service-catalog.yaml` | All `domain` values are from the 9 allowed domains. |
| 1.16 | Service catalog no duplicates | `service-catalog.yaml` | No duplicate `path` + `method` combinations. |
| 1.17 | Cross-spec consistency | All contracts | OpenAPI `operationId`s match `service-catalog.yaml` endpoints. Event catalog event names match event schema names. |

### Execution

```bash
# Runs as part of turbo pipeline
npx turbo validate:schemas
```

Under the hood:
```bash
vitest run --config vitest.contracts.config.ts --project schemas
```

### Failure Behavior

| Failure | Severity | Action |
|---|---|---|
| YAML parse error | **BLOCK** | PR cannot be merged. GitHub status check ❌. |
| Missing operationId | **BLOCK** | PR cannot be merged. Comment lists missing operationIds. |
| $ref not resolved | **BLOCK** | PR cannot be merged. Comment shows dangling reference chain. |
| Invalid event schema | **BLOCK** | PR cannot be merged. Comment shows schema validation error. |
| Policy rule missing field | **BLOCK** | PR cannot be merged. Comment lists rule index + missing field. |
| Invalid policy effect/role/action | **BLOCK** | PR cannot be merged. Comment shows invalid value and allowed values. |
| Cross-spec mismatch | **BLOCK** | PR cannot be merged. Comment shows spec A vs spec B discrepancy. |

### Remediation

| Error | Fix |
|---|---|
| `YAML parse error at line N` | Fix YAML syntax at the indicated line. Common issues: unquoted special characters, inconsistent indentation (use 2 spaces), tabs. |
| `Missing operationId on POST /api/v1/...` | Add `operationId: descriptiveName` to the operation in the OpenAPI spec. Use kebab-case domain-prefixed names (e.g., `identity-register-user`). |
| `$ref #/components/schemas/Foo not found` | Define schema `Foo` in `components/schemas` or fix the reference typo. |
| `Event schema invalid at identity.user.registered` | Fix the event schema in `event-schemas.yaml`. Ensure it conforms to JSON Schema Draft 2020-12. |
| `Policy rule #45 missing 'actions' field` | Add `actions: [...]` to the policy entry. |
| `Invalid role 'supervisor' at policy #12` | Use only allowed roles: `admin`, `manager`, `employee`, `customer`, `partner`. |
| `Cross-spec mismatch: identity.createUser in OpenAPI not in catalog` | Synchronize OpenAPI `operationId` with `service-catalog.yaml` or vice versa. |

### Exit Codes

| Exit Code | Meaning |
|---|---|
| `0` | All schemas valid. Gate passed. |
| `1` | One or more schema validation errors. Gate failed. |
| `2` | Harness error (e.g., file not found). Gate failed — infrastructure issue. |

---

## Gate CRBL-02: Contract Test Execution

| Attribute | Value |
|---|---|
| **Gate ID** | `CRBL-02` |
| **Name** | Contract Test Execution |
| **Principle** | PERP-API (API First), PERP-MNT (Maintainability — "test coverage >= 80%") |
| **Trigger** | Every PR |
| **Command** | `turbo test:contracts` |
| **Blocking** | Yes — blocks PR merge |
| **Runtime** | ~2-5 minutes (depends on endpoint count × test parallelism) |

### Checks Performed

| # | Check | Source | Assertion |
|---|---|---|---|
| 2.1 | All API contract tests pass | Auto-generated from OpenAPI | Every test in `__tests__/api/*.test.ts` passes. Zero failures. |
| 2.2 | All event contract tests pass | Auto-generated from event schemas | Every test in `__tests__/events/*.test.ts` passes. Zero failures. |
| 2.3 | All policy contract tests pass | Auto-generated from access-control | Every test in `__tests__/policies/*.test.ts` passes. Zero failures. |
| 2.4 | All schema compilation tests pass | `__tests__/compile/*.test.ts` | Every compile test passes. |
| 2.5 | No skipped tests | Test runner output | `test.todo()` and `test.skip()` not allowed without explicit approval comment referencing a Jira/Linear ticket. |
| 2.6 | Tests match current specs | Generator verification | Generated test files are up-to-date with spec files. No stale tests. |

### Execution

```bash
# Runs contract tests with coverage
npx turbo test:contracts -- --coverage
```

```bash
# Runs without coverage (faster, for local dev)
npx turbo test:contracts
```

### Test Matrix

| Test Group | File Pattern | Test Count (est.) | Runtime (est.) |
|---|---|---|---|
| API Happy Path | `api/*.test.ts` | ~368 | ~60s |
| API Validation | `api/*.test.ts` | ~920 | ~120s |
| API Auth | `api/*.test.ts` | ~420 | ~45s |
| API Authorization | `api/*.test.ts` | ~240 | ~30s |
| Event Schemas | `events/*.test.ts` | ~470 | ~10s |
| Policy Rules | `policies/*.test.ts` | ~496 | ~5s |
| Schema Compilation | `compile/*.test.ts` | ~15 | ~3s |
| **Total** | | **~2,929** | **~4.5 min** |

### Failure Behavior

| Failure | Severity | Action |
|---|---|---|
| Any test fails | **BLOCK** | PR status check ❌. Comment on PR with failed test names and failure reasons. |
| Test timeout | **BLOCK** | PR status check ❌. Comment suggesting endpoint may hang or be slow. |
| Test generation stale | **BLOCK** | Comment: "Contract tests outdated. Run `npm run generate:contract-tests` and commit." |
| Skipped tests without ticket | **WARNING** | Comment listing skipped tests with no Jira/Linear reference. Does not block. |

### Skipped Test Approval Format

Tests may be skipped only with an inline comment referencing a tracking ticket:

```typescript
// Will be skipped by the generator:
//   test.skip('POST /api/v1/ai/agents — valid request returns 201', ...);

// Approved skip format in OpenAPI spec:
//   x-skip-reason: "Ticket AI-342: Agent endpoint not implemented until Phase 5"
```

The generator reads `x-skip-reason` from OpenAPI extensions and emits `test.skip()` with the reason as the test description.

### Remediation

| Failure | Fix |
|---|---|
| `Expected 422, got 500` | Endpoint is crashing on invalid input. Add error handling — validation pipes should catch before reaching handler. |
| `Expected 401, got 200` | Missing `@UseGuards(JwtAuthGuard)` on controller or route. Add the guard. |
| `Expected 201, got 500` | Implementation bug. Debug and fix the endpoint. |
| `Response schema mismatch` | Response shape doesn't match OpenAPI. Either fix the response serializer or update the OpenAPI spec. |
| `event identity.user.registered — missing email fails` | Event schema lists `email` as required. If this is intentional, the test is correct. If the schema needs updating, change `required[]` in `event-schemas.yaml`. |
| `policy identity:users — customer can read → expected false, got true` | Policy evaluation allows customer access where it shouldn't. Fix the policy engine or update `access-control.yaml`. |

---

## Gate CRBL-03: Contract Coverage

| Attribute | Value |
|---|---|
| **Gate ID** | `CRBL-03` |
| **Name** | Contract Coverage |
| **Principle** | PERP-MNT (Maintainability — "test coverage >= 80%") |
| **Trigger** | Every PR |
| **Command** | `turbo coverage:contracts` |
| **Blocking** | No — warning only, reported but does not block merge |
| **Runtime** | ~5 seconds |

### Checks Performed

| # | Check | Source | Assertion |
|---|---|---|---|
| 3.1 | Endpoint coverage | `service-catalog.yaml` (184 endpoints) | Every endpoint has ≥ 1 valid-request test AND ≥ 1 invalid-request test. Coverage ≥ 95%. |
| 3.2 | Event coverage | `event-catalog.yaml` (94 events) | Every event has ≥ 1 valid-payload test AND ≥ 1 invalid-payload test. Coverage ≥ 95%. |
| 3.3 | Policy coverage | `access-control.yaml` (162 rules) | Every allow rule has ≥ 1 allow test AND ≥ 1 deny test. Every deny rule has ≥ 1 deny test. Coverage ≥ 95%. |
| 3.4 | Domain coverage | All 9 domains | Each domain has contract tests. No domain with 0 tests. |
| 3.5 | OpenAPI spec coverage | 9 OpenAPI specs | Each spec has corresponding test file with ≥ 1 test. |

### Execution

```bash
npx turbo coverage:contracts
```

### Coverage Report Format

```
Contract Coverage Report — 2026-06-20T12:00:00Z
=================================================

Endpoints:  184/184 tested (100.0%) ✓
Events:      94/94  tested (100.0%) ✓
Policies:   162/162 tested (100.0%) ✓
Specs:        9/9   tested (100.0%) ✓
Domains:      9/9   tested (100.0%) ✓

Overall Coverage: 100.0%

The following contract items lack sufficient test coverage:
(empty — coverage threshold met)

Warnings: 0
Errors:   0
```

### Coverage Thresholds

| Metric | Warning | Error (Phase 1) | Error (Phase 2+) |
|---|---|---|---|
| Endpoints | < 100% | < 80% | < 95% |
| Events | < 95% | < 70% | < 90% |
| Policies | < 95% | < 70% | < 90% |
| Domains | < 9/9 | < 5/9 | < 8/9 |

### Failure Behavior

| Condition | Severity | Action |
|---|---|---|
| Coverage < 95% (any metric) | **WARNING** | PR status check ⚠️. Comment with coverage gaps. Does not block merge. |
| Coverage < 80% (Phase 1) | **ERROR** | PR status check ❌. Blocks merge. |
| Coverage < 95% (Phase 2+) | **ERROR** | PR status check ❌. Blocks merge. |
| Domain with 0 tests | **ERROR** | PR status check ❌. Blocks merge. Must add tests for the uncovered domain. |

### Remediation

| Gap | Fix |
|---|---|
| `GET /api/v1/admin/users has no invalid-request test` | Ensure the OpenAPI spec defines a `requestBody` with required fields for this endpoint. If it truly has no request body, add `x-no-invalid-test: true` extension to exempt. |
| `Event commerce.invoice.generated has only valid test` | The event schema has no `required` fields — all properties are optional. Add `x-exempt-invalid: "All fields optional"` to the event schema or add required fields. |
| `Policy #23 (deny rule) has no test` | Every deny rule automatically generates a "deny" test. If test is missing, the generator likely skipped it due to a parsing error. Check the policy syntax. |
| `analytics domain has 0 tests` | No API spec references analytics endpoints? Check `service-catalog.yaml` — analytics has 16 catalog entries. Regenerate tests. |

---

## Gate CRBL-04: Contract Drift Detection

| Attribute | Value |
|---|---|
| **Gate ID** | `CRBL-04` |
| **Name** | Contract Drift Detection |
| **Principle** | PERP-API (API First — "OpenAPI spec before implementation") |
| **Trigger** | Push/merge to `main` |
| **Command** | `turbo drift:detect` |
| **Blocking** | Phase-dependent (warning Phase 1, error Phase 2+) |
| **Runtime** | ~10 seconds |

### Checks Performed

| # | Check | Source | Assertion |
|---|---|---|---|
| 4.1 | Catalog → Implementation | Compare `service-catalog.yaml` vs NestJS `@Controller` decorators | Every cataloged endpoint has a corresponding route decorator. Flagged endpoints are listed. |
| 4.2 | Implementation → Catalog | Compare NestJS `@Controller` decorators vs `service-catalog.yaml` | Every implemented route has a corresponding catalog entry. |
| 4.3 | Event publishers match | Compare `event-catalog.yaml` vs `@EventPattern` / BullMQ producers | Events published in code are documented in the catalog. |
| 4.4 | Domain boundaries respected | Compare imports across packages | No cross-domain direct imports. PERP-MOD violation if detected. |

### Execution

```bash
npx turbo drift:detect
```

### Drift Report Format

```
Contract Drift Report — 2026-06-20T12:00:00Z
=============================================

Endpoints in catalog but not implemented (WARNING):
  - PATCH /api/v1/users/{id}/enable    (FR-114, phase-1)
  - PATCH /api/v1/users/{id}/disable   (FR-115, phase-1)
  Total: 2

Endpoints implemented but not in catalog (ERROR — PERP-API violation):
  - GET /api/v1/internal/health        (not in catalog)
  - POST /api/v1/debug/cache-clear     (not in catalog)
  Total: 2

Events published but not in catalog (WARNING):
  - identity.user.debug_event          (not in event-catalog)
  Total: 1

Cross-domain import violations (ERROR — PERP-MOD violation):
  - packages/customer/src/customer.service.ts imports from packages/commerce
    → Customer domain must not import from Commerce domain directly.
  Total: 1

Severity: ERROR (Phase 2 — undocumented endpoints block)
```

### Phase-Dependent Severity Matrix

| Detection | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 |
|---|---|---|---|---|---|
| Catalog → Implementation gap | WARNING | WARNING | ERROR | ERROR | ERROR |
| Implementation → Catalog gap | WARNING | ERROR | ERROR | ERROR | ERROR |
| Event publication gap | WARNING | WARNING | ERROR | ERROR | ERROR |
| Cross-domain import | WARNING | ERROR | ERROR | ERROR | ERROR |

### Failure Behavior

| Condition | Phase | Action |
|---|---|---|
| Undocumented endpoint (WARNING) | Phase 1 | Slack notification to #platform-eng. Does not block. |
| Undocumented endpoint (ERROR) | Phase 2+ | Creates GitHub issue with label `contract-drift`. Blocks subsequent PRs until resolved. |
| Unimplemented catalog entry (WARNING) | All phases | Reported but does not block. |
| Cross-domain import (ERROR) | Phase 2+ | Blocks further merges until dependency is moved to `packages/` or eliminated. |

### Remediation

| Drift | Fix |
|---|---|
| Endpoint in catalog, not in code | Implement the endpoint. If deferred, update `phase` field in catalog to the correct phase. |
| Endpoint in code, not in catalog | Add endpoint to `service-catalog.yaml` with full metadata (path, method, domain, service, description, auth, roles, errors, fr_ref, phase). This is mandatory per PERP-API. |
| Event in code, not in catalog | Add event to `event-catalog.yaml` and `event-schemas.yaml`. |
| Cross-domain import | Refactor shared logic into `packages/` (shared library). Use events (BullMQ) for domain-to-domain communication. |

---

## Gate CRBL-05: OpenAPI Lint

| Attribute | Value |
|---|---|
| **Gate ID** | `CRBL-05` |
| **Name** | OpenAPI Lint |
| **Principle** | PERP-API (API First) |
| **Trigger** | PR that touches `specs/contracts/openapi/*.yaml` |
| **Command** | `spectral lint specs/contracts/openapi/*.yaml` |
| **Blocking** | Yes — blocks PR |
| **Runtime** | ~3 seconds |

### Checks Performed (Spectral Ruleset)

```yaml
# specs/contracts/.spectral.yaml
extends: [[spectral:oas, all]]

rules:
  # Error — blocks PR
  operation-operationId: error
  operation-description: error
  operation-tags: error
  typed-enum: error
  path-params: error
  oas3-valid-schema-example: error
  oas3-api-servers: error

  # Warning — does not block
  operation-summary: warn
  tag-description: warn
  info-contact: warn
  info-license: warn

  # Custom rules
  alharistech-error-format:
    description: Error responses must follow AlharisTech ErrorResponse schema
    severity: error
    given: $.paths[*][*].responses[?(@property >= 400)].content['application/json'].schema
    then:
      function: schema
      functionOptions:
        schema:
          type: object
          required: [error, meta]
          properties:
            error:
              type: object
              required: [code, message, message_en, statusCode]

  alharistech-bilingual-messages:
    description: All error examples must include both Arabic (message) and English (message_en) messages
    severity: warn
    given: $.paths[*][*].responses[?(@property >= 400)].content['application/json'].example
    then:
      function: truthy

  alharistech-security-scheme:
    description: Endpoints with auth must reference bearerAuth security scheme
    severity: error
    given: $.paths[*][*]
    then:
      field: security
      function: truthy
    unless:
      - field: security
        function: falsy
```

### Execution

```bash
# Via Spectral CLI
npx spectral lint specs/contracts/openapi/*.yaml

# Via turbo
npx turbo openapi-lint
```

### Failure Behavior

| Condition | Severity | Action |
|---|---|---|
| Missing `operationId` | **ERROR** | Blocks PR. Comment lists offending operations. |
| Missing `description` | **ERROR** | Blocks PR. Comment lists undocumented operations. |
| Missing `tags` | **ERROR** | Blocks PR. Comment lists untagged operations. |
| Invalid schema example | **ERROR** | Blocks PR. Comment shows which example doesn't match its schema. |
| Non-standard error format | **ERROR** | Blocks PR. Error responses must use `ErrorResponse` schema with `code`, `message`, `message_en`, `statusCode`. |
| Missing security scheme | **ERROR** | Blocks PR. Protected endpoints must reference `bearerAuth`. |
| Missing `summary` | **WARNING** | Reports but does not block. |
| Missing `tag-description` | **WARNING** | Reports but does not block. |

### Remediation

| Lint Error | Fix |
|---|---|
| `operation-operationId: Operation must have operationId` | Add `operationId: kebab-case-name` to the operation. |
| `operation-description: Operation must have description` | Add `description:` with at least 20 characters explaining what the operation does. |
| `alharistech-error-format` | Restructure error response to match `ErrorResponse` schema: `{ error: { code, message, message_en, statusCode }, meta: { timestamp, requestId } }`. |
| `alharistech-security-scheme` | Add `security: [{ bearerAuth: [] }]` to the operation or at the top level. Public endpoints: explicitly set `security: []`. |

---

## Gate CRBL-06: Breaking Change Detection

| Attribute | Value |
|---|---|
| **Gate ID** | `CRBL-06` |
| **Name** | Breaking Change Detection |
| **Principle** | PERP-API (API First — "breaking changes require version bump") |
| **Trigger** | PR that touches `specs/contracts/openapi/*.yaml` |
| **Command** | `npx @openapi-diff/cli <base> <head>` |
| **Blocking** | No — warning only, requires architecture approval (2 reviewers) |
| **Runtime** | ~10 seconds |

### Checks Performed

| # | Check | Detection Method | Severity |
|---|---|---|---|
| 6.1 | Field removal | Schema `required` field removed or property deleted | **BREAKING** |
| 6.2 | Type change | Property type changed (e.g., `string` → `integer`) | **BREAKING** |
| 6.3 | Required → optional | Required field made optional (clients may depend on it) | **BREAKING** |
| 6.4 | Enum value removal | `enum` value removed | **BREAKING** |
| 6.5 | Endpoint removal | Path+method removed without deprecation | **BREAKING** |
| 6.6 | Status code change | Success code changed (e.g., `200` → `201`) | **BREAKING** |
| 6.7 | Response field removal | Response schema property removed | **BREAKING** |
| 6.8 | New required field | New `required` field in request body | **BREAKING** |
| 6.9 | Format constraint added | New `format` constraint on existing field | **BREAKING** |
| 6.10 | Rate limit tightened | `rate_limit` reduced | **WARNING** |
| 6.11 | Optional → required | Optional field made required | **BREAKING** |
| 6.12 | Max/min constraint tightened | `maxLength` reduced, `minimum` raised | **BREAKING** |
| 6.13 | Endpoint deprecation | Endpoint marked `deprecated: true` (not removal) | **NON-BREAKING** |
| 6.14 | New optional field | New optional field in request/response | **NON-BREAKING** |
| 6.15 | Description/text changes | Only text changes, no structural changes | **NON-BREAKING** |
| 6.16 | New endpoint added | New path+method | **NON-BREAKING** |

### Execution

```bash
# Compare current PR branch against main
for spec in specs/contracts/openapi/*.yaml; do
  base=$(git show origin/main:"$spec")
  npx @openapi-diff/cli <(echo "$base") "$spec" --markdown report.md
done
```

### Breaking Change Report Format

```
Breaking Change Analysis — PR #42
=================================

Spec: identity-api.yaml
Base: main (commit abc1234)
Head: feat/update-user-schema (commit def5678)

BREAKING CHANGES (requires architecture approval):
  ✗ [6.1] Removed field 'middle_name' from User schema
  ✗ [6.2] Changed type of 'age' from integer to string
  ✗ [6.8] Added required field 'national_id' to RegisterRequest

NON-BREAKING CHANGES:
  ✓ [6.14] Added optional field 'avatar_url' to User schema
  ✓ [6.16] Added new endpoint POST /api/v1/auth/mfa-setup

SUMMARY:
  Breaking: 3
  Non-breaking: 2
  Severity: REQUIRES ARCHITECTURE REVIEW
```

### Failure Behavior

| Condition | Severity | Action |
|---|---|---|
| Breaking changes detected | **WARNING** | PR status check ⚠️. Comment with breaking change report. Requires 2 architecture reviewer approvals. |
| No breaking changes | **PASS** | PR status check ✓. Normal review process. |
| Deprecation without sunset date | **WARNING** | Comment: "Deprecated endpoint should include x-sunset-date or deprecation policy link." |
| Error computing diff | **ERROR** | Comment: "Could not compute OpenAPI diff. Check that base branch spec is valid." |

### Architecture Approval Process

When breaking changes are detected:

1. PR author replies to the bot comment with:
   - Reason for the breaking change
   - Migration plan for API consumers
   - Whether a version bump needed (major/minor)
   - Sunset timeline if deprecating

2. Two architecture reviewers approve the PR

3. PR is merged with breaking change acknowledged

### Remediation

| Breaking Change | Mitigation |
|---|---|
| Field removed | Deprecate first (mark `deprecated: true` + add `x-sunset-date`). Remove in next major version. |
| Type changed | Create new field with new type, deprecate old field, migrate clients, then remove old field. |
| Endpoint removed | Deprecate first (add `deprecated: true` + `x-sunset-date`). Remove after sunset period. |
| New required field | Make optional first with default value. Make required in next major version. |
| Format constraint added | Consider making it a validation warning first, then error in next version. |

---

## Complete CI Pipeline

### GitHub Actions Workflow File

```yaml
# .github/workflows/contract-verification.yml
name: Contract Verification

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

permissions:
  contents: read
  pull-requests: write
  checks: write

jobs:
  # ===========================================================================
  # GATE CRBL-01: Schema Validity
  # ===========================================================================
  gate-schema-validity:
    name: "CRBL-01: Schema Validity"
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - name: Validate Schemas
        id: validate
        run: npx turbo validate:schemas
      - name: Report Failure
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: '❌ **CRBL-01: Schema Validity** failed.\n\nRun `npx turbo validate:schemas` locally to see details.\n\nSee [contract-test-harness.md](packages/contracts/spec/contract-test-harness.md#41-openapi-compilation) for remediation.'
            });

  # ===========================================================================
  # GATE CRBL-02: Contract Test Execution
  # ===========================================================================
  gate-contract-tests:
    name: "CRBL-02: Contract Tests"
    runs-on: ubuntu-latest
    timeout-minutes: 15
    needs: [gate-schema-validity]
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
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - name: Run Contract Tests
        id: tests
        run: npx turbo test:contracts -- --coverage
      - name: Upload Coverage
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: contract-test-results
          path: |
            packages/contracts/coverage/
            packages/contracts/test-results/

  # ===========================================================================
  # GATE CRBL-03: Contract Coverage
  # ===========================================================================
  gate-coverage:
    name: "CRBL-03: Contract Coverage"
    runs-on: ubuntu-latest
    timeout-minutes: 5
    needs: [gate-contract-tests]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - name: Contract Coverage Report
        id: coverage
        run: npx turbo coverage:contracts
        continue-on-error: true
      - name: Report Coverage Gap
        if: steps.coverage.outcome == 'failure'
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: '⚠️ **CRBL-03: Contract Coverage** below threshold.\n\nReview the coverage report artifact for gaps. Coverage < 95% does not block merge but should be addressed.'
            });

  # ===========================================================================
  # GATE CRBL-04: Contract Drift (main only)
  # ===========================================================================
  gate-drift:
    name: "CRBL-04: Contract Drift"
    runs-on: ubuntu-latest
    timeout-minutes: 5
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - name: Detect Drift
        id: drift
        run: npx turbo drift:detect
        continue-on-error: true
      - name: Create Drift Issue
        if: steps.drift.outcome == 'failure'
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: 'Contract Drift Detected on main',
              body: 'Endpoints implemented but not in service-catalog.yaml. PERP-API violation.\n\nRun `npx turbo drift:detect` locally and see report.',
              labels: ['contract-drift', 'PERP-API']
            });

  # ===========================================================================
  # GATE CRBL-05: OpenAPI Lint (PR only)
  # ===========================================================================
  gate-openapi-lint:
    name: "CRBL-05: OpenAPI Lint"
    runs-on: ubuntu-latest
    timeout-minutes: 5
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - name: Spectral Lint
        uses: stoplightio/spectral-action@v0.8.10
        with:
          file_glob: 'specs/contracts/openapi/*.yaml'
          spectral_ruleset: 'specs/contracts/.spectral.yaml'
      - name: Report Failure
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: '❌ **CRBL-05: OpenAPI Lint** failed.\n\nRun `npx spectral lint specs/contracts/openapi/*.yaml` locally.\n\nSee [ci-verification-gates.md](packages/contracts/spec/ci-verification-gates.md#gate-crbl-05-openapi-lint) for rules and remediation.'
            });

  # ===========================================================================
  # GATE CRBL-06: Breaking Change Detection (PR only)
  # ===========================================================================
  gate-breaking-changes:
    name: "CRBL-06: Breaking Changes"
    runs-on: ubuntu-latest
    timeout-minutes: 5
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - name: Detect Breaking Changes
        id: diff
        run: |
          echo "# Breaking Change Report" > breaking-report.md
          for spec in specs/contracts/openapi/*.yaml; do
            echo -e "\n## $spec\n" >> breaking-report.md
            base_content=$(git show origin/main:"$spec" 2>/dev/null || echo "")
            if [ -n "$base_content" ]; then
              npx @openapi-diff/cli \
                <(echo "$base_content") \
                "$spec" \
                --markdown >> breaking-report.md 2>&1 || true
            fi
          done
      - name: Upload Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: breaking-change-report
          path: breaking-report.md
      - name: Comment Breaking Changes
        if: steps.diff.outcome == 'failure'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('breaking-report.md', 'utf8');
            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: '⚠️ **CRBL-06: Breaking Changes Detected**\n\n```\n' + report + '\n```\n\nBreaking changes require **architecture approval** (2 reviewers). See [ci-verification-gates.md](packages/contracts/spec/ci-verification-gates.md#gate-crbl-06-breaking-change-detection) for the approval process.'
            });
```

### Branch Protection Rules (GitHub Repository Settings)

```
main branch:
  Required status checks:
    ✅ "CRBL-01: Schema Validity"
    ✅ "CRBL-02: Contract Tests"
    ⚠️ "CRBL-03: Contract Coverage"      (informational — not required)
    ✅ "Lint Gate"
    ✅ "Test Gate"
    ✅ "Security Gate"
    ✅ "Build Gate"

  Require pull request reviews: 1
  Dismiss stale reviews: true
  Require review from Code Owners: true
  Allow specified actors to bypass: Platform Team

develop branch:
  Required status checks:
    ✅ "CRBL-01: Schema Validity"
    ✅ "CRBL-02: Contract Tests"
    ⚠️ "CRBL-03: Contract Coverage"      (informational)
    ✅ "Lint Gate"
    ✅ "Test Gate"

  Require pull request reviews: 1
```

---

## Gate Summary Matrix

| Gate | Trigger | Blocking | Runtime | Phase 1 | Phase 2+ |
|---|---|---|---|---|---|
| CRBL-01: Schema Validity | Push + PR | Yes | ~5s | BLOCK | BLOCK |
| CRBL-02: Contract Tests | PR | Yes | ~5m | BLOCK | BLOCK |
| CRBL-03: Contract Coverage | PR | No (warn) | ~5s | WARN | WARN (<95%) / BLOCK (<90%) |
| CRBL-04: Contract Drift | Push to main | Phase-dep | ~10s | WARN | ERROR |
| CRBL-05: OpenAPI Lint | PR to specs/ | Yes | ~3s | BLOCK | BLOCK |
| CRBL-06: Breaking Changes | PR to specs/ | No (warn) | ~10s | WARN + 2 reviews | WARN + 2 reviews |

## Compliance with Governance Principles

| Principle | Gate(s) | How Enforced |
|---|---|---|
| PERP-API (API First) | CRBL-01, CRBL-04, CRBL-05, CRBL-06 | OpenAPI specs must exist, be valid, and match implementation. No code without spec. |
| PERP-FCL (Fail Closed) | CRBL-02 | Policy tests verify default-deny behavior. Auth tests verify 401/403 for missing/insufficient credentials. |
| PERP-MOD (Modular First) | CRBL-04 | Drift detection flags cross-domain imports. |
| PERP-MNT (Maintainability) | CRBL-02, CRBL-03 | Contract tests provide ≥ 95% spec coverage. Stale tests detected. |
| PERP-EVI (Evidence First) | CRBL-06 | Breaking changes require documented rationale + migration plan. |

## Quick Reference

```bash
# Run all contract verification gates locally
npx turbo validate:schemas    # CRBL-01
npx turbo test:contracts      # CRBL-02
npx turbo coverage:contracts  # CRBL-03
npx turbo drift:detect        # CRBL-04
npx spectral lint specs/contracts/openapi/*.yaml  # CRBL-05

# Generate contract tests from specs
npx tsx packages/contracts/src/scripts/generate-contract-tests.ts

# Verify generated tests are current
npx tsx packages/contracts/src/scripts/verify-test-generation.ts
```
