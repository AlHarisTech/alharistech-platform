# ContractInterceptor Specification

## Status: Design Specification (Sprint 0.5/1)

---

## 1. Overview

**Component:** `ContractInterceptor`
**Type:** NestJS Interceptor (`NestInterceptor`)
**Purpose:** Intercepts every HTTP response AFTER controller execution. Validates the response body against the OpenAPI 3.1 response schema for the matched route. Strips or warns on extra fields not in the contract. Warns if required response fields are missing. Enforces the "what you see is what you get" contract on outbound data.

**Fail-safe (by default):** Response validation failures MUST NOT block the response in production lenient mode. The response is still sent to the client, but a warning is logged and an alert is raised.

**Source of truth:** `specs/contracts/openapi/*.yaml` — same OpenAPI specs used by ContractGuard.

---

## 2. Interface

### 2.1 NestJS Interface

Implements `NestInterceptor` from `@nestjs/common`:

```
class ContractInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any>
}
```

Uses RxJS `pipe` and `map` operator to transform/validate the response after the controller handler completes.

### 2.2 Registration

Applied globally via `APP_INTERCEPTOR` provider. Uses `@SkipContractIntercept()` decorator to opt-out specific endpoints.

### 2.3 Decorators

| Decorator | Purpose |
|:---|:---|
| `@SkipContractIntercept()` | Skip response validation for this handler. Used for file downloads, streams, webhooks. |
| `@ResponseSchema(schemaName)` | Explicitly specify the response schema $ref when auto-detection is ambiguous. |

---

## 3. Behavior

### 3.1 Response Flow

```
Controller returns data
  │
  ├─ 1. Skip Check
  │     If @SkipContractIntercept() → pass through unchanged
  │     If response is file download (StreamableFile) → pass through
  │     If response is streaming (Observable<Buffer>) → pass through
  │     If response is null/undefined (204 No Content) → pass through
  │
  ├─ 2. Schema Resolution
  │     Determine OpenAPI response schema for:
  │       - HTTP status code (200, 201, etc.)
  │       - Content type (application/json)
  │     Extract from cached OpenAPI spec
  │
  ├─ 3. Mode Determination
  │     NODE_ENV=production → strict (reject + 500)
  │     NODE_ENV=development → lenient (warn + pass through)
  │     Per-endpoint override via @ResponseMode('strict'|'lenient')
  │
  ├─ 4. Validation
  │     Compile AJV validator for response schema (cached, same strategy as ContractGuard)
  │     Validate response data against schema
  │
  ├─ 5. Field Processing
  │     Strip extra fields not in contract (lenient mode — remove silently, log warning)
  │     Warn if required fields are missing (strict mode — it's a developer error, log + alert)
  │     Re-validate after stripping (ensure all required fields present)
  │
  └─ 6. Output
       Valid + no extra   → return data as-is
       Valid + extra       → return stripped data (lenient) or return stripped + log (strict only warns)
       Missing required    → lenient: return data + warn. strict: 500.
       Invalid type        → lenient: return data + warn. strict: 500.
```

### 3.2 Response Schema Matching

Response schema selection uses both HTTP status AND content type:

1. Look up the route in the OpenAPI spec
2. Match the `responses` entry for the actual HTTP status code
3. For that status code, match the `content` entry for `application/json`
4. Extract the `schema` — this is the response contract

If the actual status code is not explicitly documented (e.g., controller returns 200 but only 201 is documented for that route), log a warning and skip validation.

### 3.3 Special Handling

| Response Type | Detect By | Behavior |
|:---|:---|:---|
| File downloads | `response instanceof StreamableFile` or Content-Type not application/json | Skip validation entirely |
| Streaming responses | `response instanceof Observable` and emits Buffers | Skip validation entirely |
| Paginated lists | Response contains `meta.pagination` | Validate items array against list schema, validate pagination meta separately |
| Error responses | HTTP status >= 400 | Validate against ErrorResponse schema from the OpenAPI spec |
| 204 No Content | status 204, empty body | Skip validation (no content to validate) |
| Binary/octet-stream | Content-Type: application/octet-stream | Skip validation |
| Redirects | status 301/302 | Skip validation |

### 3.4 Pagination Handling

When the response schema includes `allOf` with `PaginationMeta`, the interceptor:
1. Validates the `data` array items against the item schema
2. Validates the `meta.pagination` object against `PaginationMeta` schema
3. Validates the top-level `meta` object against `ResponseMeta` schema

### 3.5 Field Stripping Logic

In lenient mode, extra fields not defined in the contract are stripped. The stripping algorithm:

```
function stripExtraFields(data: any, schema: JSONSchema): any {
  if schema is object type:
    for each key in data:
      if key not in schema.properties:
        remove key, log warning with field path
      else:
        recursively strip data[key] against schema.properties[key]
  if schema is array type:
    for each item in data:
      stripExtraFields(item, schema.items)
  return data
}
```

**Constraints:**
- Stripping is shallow-recursive (max depth = 10 levels — matches max AJV depth)
- Stripping is non-destructive to the original response object (clone before stripping)
- Stripping logs at `warn` level when NODE_ENV=development, `info` level otherwise

---

## 4. Modes

### 4.1 Strict Mode (`production`)

| Scenario | Action |
|:---|:---|
| Extra field in response | Strip it. Log warning with field path. **Do not** return 500 — extra fields are a hygiene issue, not a functional error. |
| Missing required field | Return 500 `CONTRACT_VIOLATION`. Log error. Alert P1. This is a critical developer bug — contract says field is required but controller didn't include it. |
| Wrong type on field | Return 500 `CONTRACT_VIOLATION`. Log error. Alert P1. |
| Schema not found | Log error. Pass response through (fail-safe for responses). |
| Corrupted schema | Log error. Pass response through. |

### 4.2 Lenient Mode (`development`)

| Scenario | Action |
|:---|:---|
| Extra field in response | Strip it. Log warning with field path and stack trace (dev-only). |
| Missing required field | Log warning. Return data as-is. |
| Wrong type on field | Log warning. Return data as-is. |
| Schema not found | Log debug. Pass response through. |

Mode is determined by:
1. `@ResponseMode('strict'|'lenient')` decorator on handler (highest priority)
2. `CONTRACT_RESPONSE_MODE` environment variable (default: `strict` for NODE_ENV=production, `lenient` otherwise)

---

## 5. Performance Budget

| Metric | Target | Notes |
|:---|:---|:---|
| Interceptor overhead (p95) | ≤ 2ms | For typical JSON response (< 50 fields) |
| Interceptor overhead (p99) | ≤ 5ms | |
| Schema compilation (first use) | ≤ 50ms | Cached; same cache pool as ContractGuard |
| Schema validation (cached) | < 0.5ms | AJV validate on response data |
| Field stripping | < 1ms | Recursive traversal of response object |
| Memory per request | < 1KB additional | Response object cloning for stripping |

**Monitoring:** Prometheus metric `contract_interceptor_duration_ms` histogram with labels `{status: hit|miss|warn|error, operation: validate|strip}`.

---

## 6. Error Handling

### 6.1 Error Scenarios

| Scenario | Strict Mode | Lenient Mode |
|:---|:---|:---|
| Response has extra fields | Strip + warn log | Strip + warn log |
| Response missing required field | 500 CONTRACT_VIOLATION + alert | Warn log + pass through |
| Response field has wrong type | 500 CONTRACT_VIOLATION + alert | Warn log + pass through |
| Schema not found for route | Warn log + pass through | Debug log + pass through |
| Schema corrupted | Error log + alert + pass through | Error log + pass through |
| AJV compilation error | Error log + pass through | Error log + pass through |

### 6.2 Contract Violation Error (Strict Mode)

When strict mode rejects a response:

```yaml
error:
  code: "CONTRACT_VIOLATION"
  message: "انتهاك العقد - الاستجابة لا تتطابق مع المواصفات"
  message_en: "Contract violation - response does not match specification"
  statusCode: 500
  details:
    - field: "data.user.email"
      code: "MISSING_REQUIRED"
      message: "Required field 'email' is missing from response"
    - field: "data.user.created_at"
      code: "WRONG_TYPE"
      message: "Expected 'string' but got 'number'"
      received: 1718899200
meta:
  timestamp: "2026-06-20T12:00:00Z"
  requestId: "..."
  route: "GET /api/v1/users/me"
  expectedSchema: "UserProfileResponse"
```

### 6.3 Logging

| Log Level | Event |
|:---|:---|
| `error` | Missing required field in strict mode, corrupted schema, AJV compilation failure |
| `warn` | Extra fields in response, missing required field in lenient mode, schema not found |
| `info` | Field stripped from response, validation pass with warnings |
| `debug` | Validation pass (no issues), schema cache hit |

---

## 7. Configuration

### 7.1 Environment Variables

| Variable | Type | Default | Description |
|:---|:---|:---|:---|
| `CONTRACT_RESPONSE_MODE` | `strict` \| `lenient` | `strict` (prod) / `lenient` (dev) | Default response validation mode |
| `CONTRACT_RESPONSE_STRIP_EXTRA` | boolean | `true` | Strip extra fields from response |
| `CONTRACT_RESPONSE_LOG_EXTRA` | boolean | `true` | Log warnings for extra fields |
| `CONTRACT_RESPONSE_MAX_FIELDS` | integer | `500` | Max fields in response before skipping validation (performance) |
| `CONTRACT_RESPONSE_MAX_DEPTH` | integer | `10` | Max nesting depth for field stripping |

### 7.2 Shared Configuration

The ContractInterceptor shares the following with ContractGuard:
- AJV instance and configuration
- Redis connection for L2 cache
- LRU cache (shared key space)
- Schema source configuration (SCHEMA_SOURCE, SCHEMA_PATH)

---

## 8. Integration Points

| System | Direction | Purpose |
|:---|:---|:---|
| SchemaRegistry | Reads | Get OpenAPI response schema for route |
| ContractGuard Cache | Reads | Shared compiled validator cache (same key format) |
| Logger | Writes | Log validation results |
| Prometheus | Writes | Export `contract_interceptor_duration_ms` metrics |
| ExceptionFilter | Intercepted | In strict mode, throw ContractViolationException |

### 8.1 Execution Order

```
1. AuthGuard            → Extract JWT
2. ThrottlerGuard       → Rate limit
3. ContractGuard        → Validate request
4. PolicyGuard          → RBAC
5. Controller           → Business logic
6. ContractInterceptor  → Validate response  ← THIS COMPONENT
7. ExceptionFilter      → Error formatting (intercepts any thrown exceptions)
```

---

## 9. Testing Strategy

### 9.1 Unit Tests

| Test | Description |
|:---|:---|
| `should pass through valid response matching schema` | Controller returns valid data → data returned unchanged |
| `should strip extra field in lenient mode` | Controller returns extra field → field removed, warning logged |
| `should strip extra field in strict mode` | Same as lenient — stripping is always safe |
| `should warn on missing required field in lenient mode` | Missing `email` in User response → warning logged, data returned |
| `should return 500 on missing required field in strict mode` | Missing `email` → 500 CONTRACT_VIOLATION |
| `should skip validation for file download` | StreamableFile response → pass through |
| `should skip validation for 204 No Content` | Empty response → pass through |
| `should validate paginated response` | List response with pagination → validates items + pagination meta |
| `should validate error response` | 4xx/5xx → validates against ErrorResponse schema |
| `should use shared cache with ContractGuard` | Same schema key → cache hit from ContractGuard compilation |

### 9.2 Integration Tests

| Test | Description |
|:---|:---|
| `should not exceed 2ms overhead for typical response` | Benchmark: 10,000 responses of varying sizes |
| `should handle deeply nested response` | 8-level nested response → strip extra at all levels |
| `should handle large response without OOM` | Response with 500 fields → completes in < 5ms |

### 9.3 E2E Tests

| Test | Description |
|:---|:---|
| `GET /api/v1/users/me returns contract-compliant response` | Verify response matches UserProfileResponse schema |
| `Controller adds debug field → stripped in production` | Extra field from development logging removed |

---

## 10. Dependencies

### 10.1 Runtime Dependencies

| Package | Version | Purpose |
|:---|:---|:---|
| `@nestjs/common` | ^10.x | Interceptor lifecycle, decorators |
| `@nestjs/core` | ^10.x | CallHandler, ExecutionContext |
| `ajv` | ^8.12+ | JSON Schema validation |
| `rxjs` | ^7.x | Observable pipe/map operators |
| `lru-cache` | ^10.x | Shared in-memory cache |

### 10.2 Dev Dependencies

| Package | Version | Purpose |
|:---|:---|:---|
| `@nestjs/testing` | ^10.x | Interceptor unit testing |

---

## 11. Implementation Notes

### 11.1 Observable Transformation

The interceptor must use RxJS `map` to transform the response. This is critical — NestJS interceptors work with Observables, not direct values:

```
intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
  return next.handle().pipe(
    map(data => {
      // ... validate and transform data
      return validatedData;
    })
  );
}
```

### 11.2 Response Body Types

NestJS controllers can return various types that must be handled:

| Return Type | Detection | Handling |
|:---|:---|:---|
| `Promise<T>` | NestJS auto-resolves | Intercepted as T |
| `Observable<T>` | Check `instanceof Observable` | Map over each emission |
| `T` (plain object) | Default | Direct validation |
| `StreamableFile` | Check `data instanceof StreamableFile` | Skip |
| `undefined` | Check `data === undefined` | Skip (204 handler) |

### 11.3 Memory and GC Pressure

Each validated response requires object cloning for safe stripping. To minimize GC pressure:
- Use `structuredClone()` or JSON.parse(JSON.stringify()) for cloning
- Skip cloning when no extra fields are detected (fast path)
- For large responses (>100KB), skip validation with a debug log

### 11.4 Security Considerations

- **Never expose internal data via stripping logs:** Extra fields logged must not contain sensitive data (use the same sensitive field redaction as ContractGuard)
- **No schema details in 500 responses:** Error messages reference contract violation generically, not the schema structure
- **Timing consistency:** Validation time should not vary based on data content (prevents timing side-channels)

### 11.5 Future Considerations

- **Schema evolution tracking:** Log which endpoints consistently return extra/missing fields to guide API evolution
- **Response size budget:** Add per-endpoint response size limits to prevent accidental large payloads
- **Response compression awareness:** If response is gzip'd, decompress before validation or skip
- **Contract drift dashboard:** Admin panel showing which endpoints deviate from their contracts
