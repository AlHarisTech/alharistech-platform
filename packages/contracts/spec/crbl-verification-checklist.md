# CRBL Verification Checklist

**Version:** 1.0
**Owner:** Architecture Team
**Package:** `packages/contracts`
**Governance Reference:** `.governance/enforcement.yaml` — PERP-API, PERP-FCL, PERP-MOD, PERP-EVI
**Activation Gate:** All items must pass before CRBL is declared "active" in production.

---

## Purpose

This checklist defines the minimum verifiable criteria that must be satisfied before the Contract Runtime Bridge Layer (CRBL) can be activated in production. Every item is independently testable and has a defined pass/fail condition.

---

## 1. SchemaRegistry — Loading & Compilation

### 1.1 OpenAPI Spec Loading

- [ ] **9/9 OpenAPI specs load without errors**
  - **Test:** `SchemaRegistry.loadOpenApiSpecs()` completes without throwing.
  - **Pass:** All 9 files parsed via `js-yaml.load()`. No `YAMLException` thrown.
  - **Fail:** Any spec fails to parse → CRBL cannot activate.
  - **File:** `specs/contracts/openapi/identity-api.yaml`, `customer-api.yaml`, `service-api.yaml`, `commerce-api.yaml`, `support-api.yaml`, `content-api.yaml`, `notification-api.yaml`, `analytics-api.yaml`, `ai-api.yaml`

- [ ] **All OpenAPI specs pass schema validation**
  - **Test:** Each parsed spec validated against OpenAPI 3.1.0 meta-schema.
  - **Pass:** AJV validates each spec document against the OAS 3.1 schema. Zero errors.
  - **Fail:** Any spec fails structural validation → CRBL cannot activate.

### 1.2 AJV Compilation

- [ ] **All request/response schemas compile via AJV strict mode**
  - **Test:** `AJV.compile(schema)` succeeds for every `requestBody`, `parameters`, and `responses` schema across all 9 specs.
  - **Pass:** Zero `MissingRefError`, zero `SchemaError`. All compiled functions are callable.
  - **Fail:** Any compilation failure → CRBL cannot activate.

- [ ] **All `$ref` references resolve**
  - **Test:** Cross-reference resolution scan across all OpenAPI specs.
  - **Pass:** Every `#/components/schemas/X` and `#/components/parameters/Y` reference resolves to a defined schema.
  - **Fail:** Any dangling reference → CRBL cannot activate.

- [ ] **Duplicate operationId detection**
  - **Test:** Uniqueness scan across all `operationId` values.
  - **Pass:** No duplicate values. Each `{method} {path}` maps to exactly one operation.
  - **Fail:** Duplicate operationIds → ambiguous contract → CRBL cannot activate.

### 1.3 Event Schemas

- [ ] **All 94 event schemas compile**
  - **Test:** `AJV.compile(schema)` succeeds for every event schema in `event-schemas.yaml`.
  - **Pass:** 94 compiled validators. Zero compilation errors.
  - **Fail:** Any event schema fails to compile → event contract enforcement incomplete.

- [ ] **Event names are unique**
  - **Test:** Uniqueness scan across event type identifiers (`domain.aggregate.action`).
  - **Pass:** No duplicate event names.
  - **Fail:** Duplicate event names → ambiguous event routing → CRBL cannot activate.

- [ ] **Event required fields exist in properties**
  - **Test:** For each event schema, every field in `required[]` is defined in `properties{}`.
  - **Pass:** All required fields resolve. No orphaned required field entries.
  - **Fail:** Orphaned required field → invalid schema → CRBL cannot activate.

### 1.4 Policy Rules

- [ ] **All 162 policy rules load**
  - **Test:** `yaml.load("access-control.yaml")` → `PolicyRule[]` parsed without error.
  - **Pass:** 162 rules with all required fields (`effect`, `roles`, `resources`, `actions`).
  - **Fail:** Any rule missing a required field → policy enforcement incomplete.

- [ ] **All policy `effect` values are valid**
  - **Test:** Every rule's `effect` is either `"allow"` or `"deny"`.
  - **Pass:** 162 rules with valid effects.
  - **Fail:** Unknown effect value → policy engine cannot evaluate → CRBL cannot activate.

- [ ] **All policy `roles` are from the allowed set**
  - **Test:** Every role in every rule is one of: `admin`, `manager`, `employee`, `customer`, `partner`, `*`.
  - **Pass:** No unknown roles.
  - **Fail:** Unknown role → undefined RBAC behavior.

- [ ] **All policy `actions` are from the allowed set**
  - **Test:** Every action in every rule is one of: `create`, `read`, `update`, `delete`, `issue`, `refresh`, `revoke`, `publish`, `unpublish`, `activate`, `execute`, `export`, `import`, `merge`, `grant`, `revoke_permission`.
  - **Pass:** No unknown actions.
  - **Fail:** Unknown action → undefined authorization behavior.

- [ ] **Default deny rule (priority 0) is present**
  - **Test:** Rule #0 exists with `effect: "deny"`, `priority: 0`, `resources: "*"`, `actions: "*"`.
  - **Pass:** Default deny rule present and correctly configured.
  - **Fail:** Missing default deny → PERP-FCL violation → CRBL cannot activate.

- [ ] **All condition variables are resolvable**
  - **Test:** Every `$caller.*` and `$resource.*` variable reference in conditions maps to a known resolver.
  - **Pass:** All variables have registered resolvers in `context-resolver.ts`.
  - **Fail:** Unresolvable variable → runtime error during policy evaluation.

---

## 2. ContractGuard — Request Validation

### 2.1 Positive Cases

- [ ] **Valid request passes through**
  - **Test:** `POST /api/v1/auth/register` with fully valid body (matching OpenAPI example).
  - **Pass:** `canActivate()` returns `true`. Request proceeds to controller.
  - **Fail:** Valid request rejected → false positive → ContractGuard misconfigured or schema mismatch.

- [ ] **All 9 domains have at least one validated endpoint**
  - **Test:** Register a guard for at least one route per domain and send a valid request.
  - **Pass:** All 9 domains pass at least one valid request through ContractGuard.

### 2.2 Negative Cases

- [ ] **Invalid request body → 422 + field-level errors**
  - **Test:** Send request missing required field `email` to `POST /api/v1/auth/register`.
  - **Pass:** Returns `422 Unprocessable Entity`. Response body matches `ErrorResponse` envelope. `error.details[]` contains field `email` with `code: "required"`.
  - **Fail:** Returns non-422 status, unhelpful error, or crashes.

- [ ] **Invalid field format → 422 with format detail**
  - **Test:** Send `email: "not-an-email"` in valid request.
  - **Pass:** Returns `422`. `error.details[]` contains `code: "FORMAT"` and `message` indicating email format validation failure.
  - **Fail:** Invalid email accepted, or error message does not identify the field.

- [ ] **Unknown field in request body → 422**
  - **Test:** Add `unknownField: "value"` to valid request body where `forbidNonWhitelisted` is enabled.
  - **Pass:** Returns `422`. `error.details[]` identifies `unknownField` as not allowed.
  - **Fail:** Unknown field silently accepted → contract drift risk.

- [ ] **Unknown query parameter → 422**
  - **Test:** Add `?invalidParam=value` to a request where the spec does not declare `invalidParam`.
  - **Pass:** Returns `422` when `forbidUnknownQueryParams: true`.
  - **Fail:** Unknown query param silently ignored → contract drift risk.

- [ ] **Unknown endpoint → 404**
  - **Test:** `GET /api/v1/nonexistent-endpoint` with a path not in any OpenAPI spec.
  - **Pass:** Returns `404 Not Found`. No CRBL crash, no 500.
  - **Fail:** Returns 500, crashes, or returns 200 with empty body.

### 2.3 Error Envelope

- [ ] **All errors use the standard `ErrorResponse` envelope**
  - **Test:** Trigger multiple validation errors and verify all responses.
  - **Pass:** Every error response has:
    ```json
    {
      "error": {
        "code": "string",
        "message": "string (Arabic)",
        "message_en": "string (English)",
        "statusCode": "number"
      },
      "meta": {
        "timestamp": "ISO 8601",
        "requestId": "UUIDv7"
      }
    }
    ```
  - **Fail:** Any response deviates from this structure → CRBL cannot activate.

---

## 3. PolicyGuard — Authorization

### 3.1 Role-Based Access

- [ ] **Correct role → access granted**
  - **Test:** Admin user requests `GET /api/v1/users` (resource: `identity:users`, action: `read`).
  - **Pass:** `canActivate()` returns `true`. Request proceeds.
  - **Fail:** Authorized user blocked → false positive.

- [ ] **Wrong role → 403 Forbidden**
  - **Test:** Customer user requests `GET /api/v1/users` (admin-only endpoint).
  - **Pass:** `canActivate()` returns `false`. NestJS returns `403 Forbidden`.
  - **Fail:** Unauthorized user gains access → PERP-FCL violation.

- [ ] **Anonymous user → 403 Forbidden**
  - **Test:** No JWT token provided for a protected endpoint.
  - **Pass:** `AuthGuard` returns `401 Unauthorized` OR `PolicyGuard` returns `403 Forbidden`.
  - **Fail:** Anonymous user gains access to protected resource.

### 3.2 Ownership Conditions

- [ ] **Customer owns resource → access granted**
  - **Test:** Customer with `customerId: "cust-1"` requests `GET /api/v1/customers/cust-1/orders` with condition `$caller.customerId equals $resource.owner_id`.
  - **Pass:** Condition evaluates `true`, access granted.
  - **Fail:** Owner denied access to own resource.

- [ ] **Customer does not own resource → 403 Forbidden**
  - **Test:** Customer with `customerId: "cust-1"` requests `GET /api/v1/customers/cust-2/orders`.
  - **Pass:** Condition evaluates `false`, access denied with `403`.
  - **Fail:** Customer gains access to another customer's data.

### 3.3 Priority-Based Evaluation

- [ ] **Explicit deny overrides allow**
  - **Test:** Role has an `allow` rule at priority 10 and a `deny` rule at priority 20 for the same resource/action.
  - **Pass:** Policy engine returns `{ allowed: false, reason: "explicit deny" }`.
  - **Fail:** Allow rule takes precedence despite lower priority.

- [ ] **Higher priority allow overrides lower priority deny**
  - **Test:** Role has a `deny` rule at priority 5 and an `allow` rule at priority 10.
  - **Pass:** Policy engine returns `{ allowed: true }`.
  - **Fail:** Lower priority deny incorrectly overrides higher priority allow.

---

## 4. ContractInterceptor — Response Validation

### 4.1 Positive Cases

- [ ] **Valid response passes through unchanged**
  - **Test:** Controller returns response matching OpenAPI response schema.
  - **Pass:** Response sent to client without modification. No `X-Contract-Violation` header.
  - **Fail:** Valid response modified or rejected.

### 4.2 Negative Cases

- [ ] **Extra response fields are stripped**
  - **Test:** Controller returns a response with a field not declared in the OpenAPI response schema.
  - **Pass:** Extra field removed from response body before sending. Warning logged with `X-Contract-Violation: response` header.
  - **Fail:** Extra field leaked to client → data exposure risk.

- [ ] **Missing required response field → 500 (strict mode)**
  - **Test:** Controller omits a `required` field from the response.
  - **Pass:** `ContractInterceptor` returns `500 Internal Server Error` with contract violation details.
  - **Fail:** Missing required field silently sent to client.

- [ ] **Response contract missing → fail-closed (strict mode)**
  - **Test:** Controller registers a response status code not defined in OpenAPI.
  - **Pass:** `ContractInterceptor` throws `500 Internal Server Error` indicating response contract missing.
  - **Fail:** Response passed without validation → contract drift.

---

## 5. ContractPipe — DTO Validation

### 5.1 Positive Cases

- [ ] **Valid DTO passes Zod validation**
  - **Test:** Body matches Zod schema derived from OpenAPI requestBody.
  - **Pass:** `ContractValidationPipe.transform()` returns the validated/transformed DTO.
  - **Fail:** Valid DTO rejected → false positive.

### 5.2 Negative Cases

- [ ] **Invalid DTO → 422 with field-level errors**
  - **Test:** DTO fails Zod schema validation (e.g., `email` format invalid).
  - **Pass:** Returns `422 Unprocessable Entity` with `error.details[]` containing the Zod error path and message.
  - **Fail:** Generic error, or error message leaks internal implementation details.

---

## 6. EventValidator

### 6.1 Positive Cases

- [ ] **Valid event payload accepted**
  - **Test:** Emit `identity.user.registered` with payload matching event schema.
  - **Pass:** `EventValidator.validate()` returns `{ valid: true }`. Event enqueued in BullMQ.
  - **Fail:** Valid event rejected.

### 6.2 Negative Cases

- [ ] **Missing required field → rejected**
  - **Test:** Emit event with missing `userId` (required field).
  - **Pass:** `EventValidator.validate()` returns `{ valid: false, errors: [...] }`. `EventContractError` thrown. Event NOT enqueued.
  - **Fail:** Invalid event enqueued → downstream consumers receive bad data.

- [ ] **Invalid enum value → rejected**
  - **Test:** Emit event with `role: "superadmin"` (not in enum).
  - **Pass:** Validation fails. Event rejected.
  - **Fail:** Invalid value accepted → data integrity risk.

- [ ] **Consumer-side validation → dead-letter queue**
  - **Test:** Inject invalid payload directly into BullMQ (bypassing producer validation).
  - **Pass:** `EventValidator` consumer middleware rejects the job. Job moved to `{domain}.events.dlq`. Metric `event_contract_violations_total` incremented.
  - **Fail:** Invalid event processed by handler.

---

## 7. Performance

- [ ] **Performance within budget (measured at `/api/v1/health/crbl`)**
  - **Test:** Run benchmark suite (`bench:crbl`) and inspect `/api/v1/health/crbl` after sustained load.
  - **Pass:** All p95 targets met:
    - ContractGuard < 3ms
    - PolicyGuard < 1ms
    - ContractInterceptor < 1ms
    - ContractPipe < 2ms
    - EventValidator < 2ms
    - Total CRBL overhead < 5ms
  - **Fail:** Any budget exceeded → cannot activate. Investigate before proceeding.

- [ ] **Cold start < 50ms**
  - **Test:** Measure `SchemaRegistry.onApplicationBootstrap()` wall time on a cold process.
  - **Pass:** Wall time < 50ms.
  - **Fail:** > 50ms → investigate schema loading or compilation bottlenecks.

- [ ] **Hot reload < 5ms (dev mode)**
  - **Test:** Modify a contract file, measure time from file change detection to validator ready.
  - **Pass:** < 5ms.
  - **Fail:** > 5ms → dev iteration speed impacted.

---

## 8. Dev Mode — Hot-Reload

- [ ] **Hot-reload works in dev mode**
  - **Test:** With `CRBL_MODE=warn` or `NODE_ENV=development`:
    1. Start application
    2. Modify `specs/contracts/openapi/identity-api.yaml` (add a new field to a schema, save)
    3. Send a request with the new field
  - **Pass:** SchemaRegistry detects file change, recompiles affected validators, and new field is accepted within 5ms of file save.
  - **Fail:** Validators not updated until restart → dev workflow broken.

- [ ] **Hot-reload does not drop in-flight requests**
  - **Test:** During hot-reload, in-flight requests continue using previously cached validators.
  - **Pass:** No `503` errors during hot-reload. Zero request failures.
  - **Fail:** Requests rejected during hot-reload → cannot use in development.

---

## 9. Fail-Closed Behavior

- [ ] **Unknown schema → fail-closed**
  - **Test:** Request a path where the OpenAPI spec exists but the request body schema has been deleted (invalid spec state).
  - **Pass:** Returns `500 Internal Server Error` or `404 Not Found` (depending on whether operation exists). Does NOT return `200` or pass through unvalidated.
  - **Fail:** Request passes without validation → PERP-FCL violation.

- [ ] **SchemaRegistry not ready → circuit open (503)**
  - **Test:** Crash SchemaRegistry during bootstrap (simulate). Send a request.
  - **Pass:** All CRBL guards return `503 Service Unavailable`. No requests reach controllers.
  - **Fail:** Requests served without contract enforcement → PERP-FCL violation.

- [ ] **Redis cache unavailable → graceful degradation**
  - **Test:** Shut down Redis. Send a request that requires a compiled validator.
  - **Pass:** SchemaRegistry falls back to in-memory compilation. Request validated. Warning logged. No 503.
  - **Fail:** Application crashes or requests rejected without attempt to compile locally.

---

## 10. Public Routes

- [ ] **`@Public()` routes bypass all CRBL guards**
  - **Test:** Mark an endpoint with `@Public()` decorator (e.g., health check). Send request.
  - **Pass:** `AuthGuard` and `PolicyGuard` are skipped. `ContractGuard` may still validate if configured. Response returned without authorization checks.
  - **Fail:** `@Public()` route requires authentication → configuration error.

- [ ] **`@SkipContractValidation()` routes bypass ContractGuard**
  - **Test:** Mark an endpoint with `@SkipContractValidation()` (e.g., webhook handler). Send request with unknown fields.
  - **Pass:** `ContractGuard` skipped. Unknown fields accepted without 422.
  - **Fail:** `@SkipContractValidation()` ignored → webhook handlers break.

---

## Activation Gate Summary

All boxes must be checked before CRBL is declared "active" in production.

| Section | Items | Critical |
|:---|:---|:---|
| 1. SchemaRegistry | 11 | All |
| 2. ContractGuard | 8 | All |
| 3. PolicyGuard | 6 | All |
| 4. ContractInterceptor | 4 | All |
| 5. ContractPipe | 2 | All |
| 6. EventValidator | 4 | All |
| 7. Performance | 3 | All |
| 8. Hot-Reload | 2 | All |
| 9. Fail-Closed | 3 | All |
| 10. Public Routes | 2 | All |
| **Total** | **45** | **45** |

### Sign-Off

| Role | Name | Date | Signature |
|:---|:---|:---|:---|
| Architecture Lead | | | |
| Platform Lead | | | |
| Security Lead | | | |
| QA Lead | | | |

---

## Appendix A: Automated Verification Script

```bash
#!/bin/bash
# scripts/verify-crbl-activation.sh
# Run this script to automatically check all activation criteria.
# All checks must pass with exit code 0.

set -euo pipefail

PASS=0
FAIL=0

check() {
  local name="$1"
  local cmd="$2"
  echo -n "  [$name] ... "
  if eval "$cmd" > /dev/null 2>&1; then
    echo "PASS"
    ((PASS++))
  else
    echo "FAIL"
    ((FAIL++))
  fi
}

echo "=== CRBL Activation Verification ==="
echo ""

echo "--- 1. SchemaRegistry ---"
check "1.1 OpenAPI specs load" "pnpm --filter @aht/api test:schema-validity --openapi"
check "1.2 Event schemas compile" "pnpm --filter @aht/api test:schema-validity --events"
check "1.3 Policy rules load" "pnpm --filter @aht/api test:schema-validity --policies"

echo ""
echo "--- 2. Contract Tests ---"
check "2.1 Contract tests pass" "pnpm --filter @aht/api test:contracts"

echo ""
echo "--- 3. Performance ---"
check "3.1 Performance budget" "pnpm --filter @aht/api bench:crbl -- --ci"

echo ""
echo "=== Results ==="
echo "Passed: $PASS"
echo "Failed: $FAIL"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "CRBL activation blocked. Fix failures above."
  exit 1
fi

echo ""
echo "All checks passed. CRBL is ready for activation."
exit 0
```

## Appendix B: Test Fixtures Reference

| Fixture | Path | Purpose |
|:---|:---|:---|
| Valid register request | `__tests__/fixtures/register-valid.json` | ContractGuard positive test |
| Invalid register request | `__tests__/fixtures/register-invalid.json` | ContractGuard negative test |
| Admin JWT | `__tests__/fixtures/tokens/admin.jwt` | PolicyGuard positive test |
| Customer JWT | `__tests__/fixtures/tokens/customer.jwt` | PolicyGuard negative/ownership test |
| Service order placed event | `__tests__/fixtures/events/order-placed-valid.json` | EventValidator positive test |
| Invalid event payload | `__tests__/fixtures/events/order-placed-invalid.json` | EventValidator negative test |
