# ContractGuard Specification

## Status: Design Specification (Sprint 0.5/1)

---

## 1. Overview

**Component:** `ContractGuard`
**Type:** NestJS Guard (`CanActivate`)
**Purpose:** Intercepts every HTTP request before controller execution. Validates request body, query parameters, and path parameters against the OpenAPI 3.1 contract for the matched route. Rejects invalid requests with standardized field-level errors before any business logic runs.

**Fail-closed:** If the contract or schema cannot be loaded, the request MUST be rejected (500) — never passed through unvalidated.

**Source of truth:** `specs/contracts/openapi/*.yaml` (9 domain API specs, 149 endpoints in `service-catalog.yaml`)

---

## 2. Interface

### 2.1 NestJS Interface

Implements `CanActivate` from `@nestjs/common`:

```
class ContractGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean>
}
```

### 2.2 Registration

Applied globally via `APP_GUARD` provider for all routes, or selectively via `@UseGuards(ContractGuard)` decorator with a `@SkipContractValidation()` decorator to opt-out specific endpoints (health check, metrics, swagger).

### 2.3 Decorators

| Decorator | Purpose |
|:---|:---|
| `@SkipContractValidation()` | Marks a route/handler as excluded from ContractGuard. Used on `/health`, `/metrics`, `/api/docs`. |
| `@StrictContract()` | Overrides global strict mode per-endpoint. Force strict/lenient at handler level. |
| `@ContractSchema(schemaName)` | Explicitly specifies the JSON Schema $ref name when route-to-schema resolution is ambiguous. |

---

## 3. Behavior

### 3.1 Request Flow

```
Incoming Request
  │
  ├─ 1. Route Resolution
  │     Extract: HTTP method, path pattern, matched controller/handler
  │     Skip if @SkipContractValidation() present
  │
  ├─ 2. Schema Source Resolution
  │     Determine OpenAPI source: local YAML, Redis cache, or remote URL
  │     Based on configuration (SCHEMA_SOURCE env var)
  │
  ├─ 3. Schema Lookup
  │     Load OpenAPI spec for the matched route's domain
  │     e.g., GET /api/v1/users → identity-api.yaml
  │     Find matching path + method → extract requestBody/parameters schemas
  │     Resolve $ref pointers within the spec
  │
  ├─ 4. Validator Compilation (Cached)
  │     Check cache: Redis key "contract:validator:{method}:{path}:{schemaRef}"
  │     Or in-memory LRU cache (fallback)
  │     Cache MISS → compile AJV validator from JSON Schema → store in cache
  │     Cache HIT  → reuse compiled validator
  │
  ├─ 5. Data Extraction
  │     request.body   → JSON body (for POST/PUT/PATCH)
  │     request.query  → query parameters (flattened)
  │     request.params → path parameters (route params)
  │     Merge into single validation object per OpenAPI spec
  │
  ├─ 6. Validation
  │     Run AJV validate(data)
  │     Strict mode: additionalProperties: false (reject unknown fields)
  │     Coerce mode: coerceTypes: true (string → number per schema)
  │
  ├─ 7. Result
  │     Valid   → return true (proceed to controller)
  │     Invalid → throw ContractValidationException (422)
  │
  └─ Error → throw InternalServerErrorException (500, fail-closed)
```

### 3.2 Schema Source Resolution

Priority order for loading OpenAPI specs:

| Priority | Source | Config Value | Use Case |
|:---|:---|:---|:---|
| 1 | Redis | `SCHEMA_SOURCE=redis` | Production — distributed, fast, backed by SchemaRegistry |
| 2 | Local YAML files | `SCHEMA_SOURCE=local` (default) | Development — reads from `specs/contracts/openapi/` |
| 3 | Remote URL | `SCHEMA_SOURCE=remote` + `SCHEMA_URL` | Staging — fetch from internal schema service |

In-memory LRU cache is always used as a hot cache, even when Redis is the primary source.

### 3.3 AJV Configuration

| Option | Value | Rationale |
|:---|:---|:---|
| `allErrors` | `true` | Return all field errors, not just first |
| `coerceTypes` | `true` | Auto-coerce string "5" → number 5 per schema |
| `removeAdditional` | `false` | Never silently strip — reject or warn depending on mode |
| `useDefaults` | `true` | Apply schema `default` values for missing optional fields |
| `strict` | `true` (AJV strict mode) | Catch schema ambiguity at compilation time |
| `allowUnionTypes` | `true` | Support OpenAPI oneOf/anyOf |
| `$data` | `false` | Security: disable $data references |
| `formats` | Custom (see below) | Register format validators for email, uuid, date-time, uri, password |

**Custom Format Validators:**

| Format | Validator | Source |
|:---|:---|:---|
| `email` | RFC 5322 regex | ajv-formats |
| `uuid` | UUID v4/v7 regex | ajv-formats |
| `date-time` | ISO 8601 parsing | ajv-formats |
| `uri` | RFC 3986 | ajv-formats |
| `password` | No-op (format-only marker) | Custom |
| `date` | ISO 8601 date | ajv-formats |
| `phone` | E.164 regex `^\+[1-9]\d{1,14}$` | Custom |

### 3.4 Strict Mode vs Lenient Mode

| Mode | Unknown Fields | Effect |
|:---|:---|:---|
| `strict` (production default) | Reject with 422 + field-level error | `additionalProperties: false` |
| `lenient` (development) | Warn to logs, allow request | `additionalProperties: true`, log warning |

Controlled by environment variable `CONTRACT_STRICT_MODE=true|false` with per-endpoint override via `@StrictContract()`.

### 3.5 Parameter Validation

For endpoints with parameters (query/path), the guard validates all parameters against the OpenAPI `parameters` section:

| Parameter Location | Source | Example |
|:---|:---|:---|
| `path` | `request.params` | `/users/{id}` → `id: "018f9a92-..."`
| `query` | `request.query` | `?page=1&limit=20&role=admin` |
| `header` | `request.headers` | `X-Idempotency-Key` |

Parameter schemas are compiled separately from body schemas. Validation runs as a combined step: parameters + body → single validation result.

### 3.6 No-Body Requests (GET, DELETE, HEAD)

When the OpenAPI spec has no `requestBody` for the matched operation, the guard validates only query/path parameters and returns `true` for the body. No schema compilation needed for body.

---

## 4. Error Format

### 4.1 Standard Error Envelope

All validation errors use the project's standard error envelope defined in `identity-api.yaml` components/schemas/ErrorResponse:

```yaml
error:
  code: "VALIDATION_ERROR"          # Machine-readable
  message: "فشل التحقق من صحة الطلب"  # Arabic (Accept-Language aware)
  message_en: "Request validation failed"  # English fallback
  statusCode: 422
  details:                          # Field-level errors
    - field: "email"
      code: "INVALID_FORMAT"
      message: "Must be a valid email address"
      received: "not-an-email"
    - field: "password"
      code: "TOO_SHORT"
      message_ar: "كلمة المرور يجب أن تكون 8 أحرف على الأقل"
      message_en: "Password must be at least 8 characters"
      received: "***"
meta:
  timestamp: "2026-06-20T12:00:00Z"
  requestId: "018f9a92-3c5f-7a8b-9c0d-1e2f3a4b5c6d"
```

### 4.2 AJV Error Mapping

AJV errors are mapped to field-level details using this transformation:

| AJV Keyword | Error Code | Message Template (EN) |
|:---|:---|:---|
| `required` | `REQUIRED` | `"{field}" is required` |
| `type` | `INVALID_TYPE` | `"{field}" must be {expected} (received {received})` |
| `format` | `INVALID_FORMAT` | `"{field}" must match format: {format}` |
| `minimum` | `BELOW_MINIMUM` | `"{field}" must be >= {minimum}` |
| `maximum` | `ABOVE_MAXIMUM` | `"{field}" must be <= {maximum}` |
| `minLength` | `TOO_SHORT` | `"{field}" must be at least {minLength} characters` |
| `maxLength` | `TOO_LONG` | `"{field}" must be at most {maxLength} characters` |
| `pattern` | `PATTERN_MISMATCH` | `"{field}" does not match required pattern` |
| `enum` | `INVALID_ENUM` | `"{field}" must be one of: {allowedValues}` |
| `additionalProperties` | `UNKNOWN_FIELD` | `Field "{field}" is not allowed` |
| `minItems` | `ARRAY_TOO_SHORT` | `"{field}" must have at least {minItems} items` |
| `maxItems` | `ARRAY_TOO_LONG` | `"{field}" must have at most {maxItems} items` |

Arabic messages (`message_ar`) must be provided for ALL error codes. Use the bilingual message catalog defined by the i18n module.

### 4.3 Sensitive Value Redaction

For fields marked with `format: password` or `x-sensitive: true` in OpenAPI, the `received` value in error details MUST be redacted to `"***"`.

---

## 5. Caching Strategy

### 5.1 Cache Layers

```
Request
  │
  ├─ Layer 1: In-Memory LRU (L1)
  │   Cache: Map<"method:path:schemaRef", CompiledValidator>
  │   Max size: 1000 entries
  │   Eviction: LRU
  │   TTL: Duration of process lifetime (invalidated on schema reload)
  │   Hit time: < 0.01ms
  │
  └─ Layer 2: Redis (L2, optional)
      Cache: Hash "contract:validators"
        Field: "{method}:{path}:{schemaRef}"
        Value: Serialized compiled validator (or schema JSON)
      TTL: 3600 seconds (1 hour)
      Hit time: < 1ms
      Used when SCHEMA_SOURCE=redis, in distributed/multi-pod deployments
```

### 5.2 Cache Key Format

```
contract:validator:{httpMethod}:{routePattern}:{schemaName}
```

Examples:
```
contract:validator:POST:/api/v1/auth/register:RegisterRequest
contract:validator:GET:/api/v1/users:null                  (no body)
contract:validator:PATCH:/api/v1/users/:id:UpdateProfileRequest
```

### 5.3 Cache Invalidation

- **Schema update:** SchemaRegistry publishes `schema:updated` event → guard flushes relevant cache keys
- **Redis TTL:** 1 hour — stale validators auto-expire
- **Process restart:** L1 cache cleared on restart
- **Manual:** Admin API `DELETE /api/system/cache/contracts` for force-reload

---

## 6. Performance Budget

| Metric | Target | Notes |
|:---|:---|:---|
| Guard overhead (p95, cached) | ≤ 5ms | Including route resolution, cache lookup, AJV execution |
| Guard overhead (p99, cached) | ≤ 10ms | |
| First-time AJV compilation | ≤ 50ms | Cold start, schema not yet compiled |
| In-memory cache lookup | < 0.01ms | Map.get() |
| Redis cache lookup | < 1ms | Redis GET |
| AJV validate (typical DTO) | < 0.5ms | Schema with 5-10 fields |
| AJV validate (complex DTO) | < 2ms | Schema with 20+ fields, nested objects, arrays |

**Monitoring:** Expose Prometheus metrics `contract_guard_duration_ms` histogram with labels `{status: hit|miss|error, operation: compile|validate}`.

---

## 7. Error Handling

### 7.1 Error Scenarios

| Scenario | HTTP Code | Error Code | Behavior |
|:---|:---|:---|:---|
| Schema not found for route | 500 | `SCHEMA_NOT_FOUND` | Fail-closed. Log error. Alert via monitoring. |
| Corrupted/unparseable schema | 500 | `SCHEMA_CORRUPTED` | Log error with file path. Alert P0. Reject all requests for that domain until fixed. |
| AJV compilation error | 500 | `VALIDATOR_COMPILE_ERROR` | Log compilation error details. Alert. |
| AJV validation error | 422 | `VALIDATION_ERROR` | Return field-level details. Log at INFO level. |
| Redis connection failure | (fallback to L1) | N/A | Log warning. Serve from in-memory cache. If L1 miss → 503. |
| Request body not JSON | 415 | `UNSUPPORTED_MEDIA_TYPE` | Check Content-Type header before validation. |
| Request body exceeds size limit | 413 | `PAYLOAD_TOO_LARGE` | Check Content-Length before parsing. Default: 1MB for JSON. |

### 7.2 Logging

| Log Level | Event |
|:---|:---|
| `error` | Schema corruption, AJV compilation failure, Redis connection failure when L1 also misses |
| `warn` | Unknown fields rejected in strict mode, Redis fallback to L1, schema version mismatch |
| `info` | Schema cache miss (compilation), schema reload event |
| `debug` | Cache hit, validation pass, compilation timing |

### 7.3 Alerts

| Alert | Condition | Severity |
|:---|:---|:---|
| `ContractGuardSchemaLoadFailure` | Any route's schema fails to load for > 30s | P1 |
| `ContractGuardCompilationFailure` | AJV throws on compilation | P0 |
| `ContractGuardRedisDown` | Redis unavailable > 60s with L1 misses | P2 |
| `ContractGuardHighValidationRate` | Validation error rate > 5% of requests for 5 min | P2 |

---

## 8. Configuration

### 8.1 Environment Variables

| Variable | Type | Default | Description |
|:---|:---|:---|:---|
| `CONTRACT_SCHEMA_SOURCE` | `local` \| `redis` \| `remote` | `local` | Where to load OpenAPI specs from |
| `CONTRACT_SCHEMA_PATH` | string | `specs/contracts/openapi` | Local file path for YAML specs |
| `CONTRACT_REDIS_URL` | string | `redis://localhost:6379` | Redis connection for cache + schema storage |
| `CONTRACT_STRICT_MODE` | boolean | `true` | Reject unknown fields (true) or warn only (false) |
| `CONTRACT_COERCE_TYPES` | boolean | `true` | Enable AJV type coercion |
| `CONTRACT_LRU_SIZE` | integer | `1000` | Max entries in in-memory LRU cache |
| `CONTRACT_REDIS_TTL` | integer | `3600` | Redis cache TTL in seconds |
| `CONTRACT_MAX_BODY_SIZE` | bytes | `1048576` | Max JSON body size (1MB) |
| `CONTRACT_SKIP_ENDPOINTS` | string[] | `["/api/health","/api/metrics"]` | Endpoints excluded from validation |

### 8.2 Module Configuration

```
ContractGuardModule.forRoot(options: ContractGuardOptions)
ContractGuardModule.forRootAsync(options: ContractGuardAsyncOptions)
```

Where `ContractGuardOptions` includes all config from 8.1 plus:
- `ajvOptions: AjvOptions` — custom AJV instance configuration
- `customFormats: Record<string, FormatValidator>` — additional format validators
- `errorMapper: ErrorMapper` — custom AJV error → ApiErrorDetail mapping

---

## 9. Integration Points

| System | Direction | Purpose |
|:---|:---|:---|
| SchemaRegistry | Reads | Get OpenAPI schema for route. Called on cache miss. |
| Redis | Reads/Writes | Validation cache store. Schema source (when SCHEMA_SOURCE=redis). |
| Logger | Writes | Log validation results, errors, performance metrics. |
| Prometheus | Writes | Export `contract_guard_duration_ms` and `contract_guard_errors_total` metrics. |
| ExceptionFilter | Throw | ContractValidationException extends HttpException(422). |

### 9.1 Execution Order

ContractGuard MUST run AFTER authentication guards (JWT extraction) but BEFORE PolicyGuard (authorization). Execution order in NestJS guard chain:

```
1. AuthGuard        → Extract JWT, set request.user
2. ThrottlerGuard   → Rate limit check
3. ContractGuard    → Validate request body/params against OpenAPI  ← THIS COMPONENT
4. PolicyGuard      → RBAC authorization check
5. Controller       → Business logic
6. ContractInterceptor → Validate response body
```

---

## 10. Testing Strategy

### 10.1 Unit Tests

| Test | Description |
|:---|:---|
| `should pass valid request matching schema` | Provide valid body → canActivate returns true |
| `should reject missing required field` | Body missing required field → throws 422 with field detail |
| `should reject wrong type` | Field has wrong type → throws 422 with INVALID_TYPE |
| `should reject unknown field in strict mode` | Extra field → throws 422 with UNKNOWN_FIELD |
| `should allow unknown field in lenient mode` | Extra field → returns true, logs warning |
| `should coerce string to number when schema expects number` | Query param "5" for integer field → coerced to 5 |
| `should validate query parameters` | Validates page, limit, sort_by against schema |
| `should validate path parameters` | Validates UUID format on /users/:id |
| `should skip validation on @SkipContractValidation() endpoint` | Returns true without validation |
| `should return 500 when schema not found` | Unknown route → throws 500 |
| `should return 500 when schema is corrupted` | Unparseable YAML → throws 500 |
| `should use cached validator on second call` | Cache HIT → skips AJV compilation |
| `should fallback to L1 when Redis unavailable` | Redis down → uses in-memory cache |

### 10.2 Integration Tests

| Test | Description |
|:---|:---|
| `should validate full request against identity-api.yaml` | POST /api/v1/auth/register with valid/invalid data |
| `should validate all 149 endpoints load correctly` | Smoke test: compile validators for all service-catalog endpoints |
| `should not exceed 5ms p95 overhead` | Benchmark: 10,000 requests, measure guard duration |
| `should handle concurrent requests correctly` | Concurrent requests → no race conditions in cache |

### 10.3 E2E Tests

| Test | Description |
|:---|:---|
| `register with weak password → 422` | Full HTTP request through NestJS pipeline |
| `register with valid data → 201` | Happy path end-to-end |

---

## 11. Dependencies

### 11.1 Runtime Dependencies

| Package | Version | Purpose |
|:---|:---|:---|
| `ajv` | ^8.12+ | JSON Schema compilation and validation |
| `ajv-formats` | ^2.1+ | Standard format validators (email, uuid, date-time) |
| `@nestjs/common` | ^10.x | Guard lifecycle, decorators |
| `@nestjs/core` | ^10.x | ExecutionContext, Reflector |
| `ioredis` | ^5.x | Redis client for L2 cache |
| `js-yaml` | ^4.x | YAML parsing for local schema files |
| `lru-cache` | ^10.x | In-memory LRU cache |

### 11.2 Dev Dependencies

| Package | Version | Purpose |
|:---|:---|:---|
| `@nestjs/testing` | ^10.x | Guard unit testing |
| `ioredis-mock` | ^8.x | Mock Redis for tests |

---

## 12. Implementation Notes

### 12.1 OpenAPI $ref Resolution

The guard must resolve JSON Schema `$ref` pointers within OpenAPI specs. For example, a path's request body references `#/components/schemas/RegisterRequest`, which may itself contain `$ref: "#/components/schemas/ResponseMeta"`. Full transitive resolution is required before passing to AJV.

Use a `$ref` resolver that:
1. Loads the complete OpenAPI document
2. Recursively resolves all `$ref` pointers
3. Produces a standalone JSON Schema object for AJV

### 12.2 Route-to-Schema Mapping

Route matching uses NestJS's `Reflector` to extract path and method from the `ExecutionContext`:

1. Get HTTP method: `request.method`
2. Get route path: `Reflector.get('path', context.getHandler())` or from `context.getHandler().name` → `PATH_METADATA`
3. Look up in service-catalog.yaml to determine domain
4. Load the corresponding `specs/contracts/openapi/{domain}-api.yaml`
5. Match path + method → extract schema references

### 12.3 Circular Reference Handling

Some OpenAPI schemas may contain circular `$ref` references (e.g., User → Order → User). AJV supports this with `$id` in each schema. The guard must:
- Assign unique `$id` to each resolved schema node
- Set AJV option `addUsedSchema: false` to avoid duplicate key errors

### 12.4 Memory Considerations

- Compiled AJV validators for 149 endpoints ≈ 5-10 MB memory
- L1 LRU cache of 1000 entries ≈ 2-5 MB
- Monitor memory usage via `process.memoryUsage()` in development

### 12.5 Security Considerations

- **No internal error details in responses:** 500 errors return generic message, not stack traces or schema paths
- **Input size limit:** Reject bodies > CONTRACT_MAX_BODY_SIZE before AJV parsing (prevents DoS)
- **AJV timeout:** Consider wrapping AJV compilation in a timeout (5s) to prevent hangs on malicious schemas
- **No schema introspection in errors:** Never expose the full JSON Schema in error responses

### 12.6 Future Considerations

- **Schema pre-compilation at startup:** Compile all 149 endpoint validators during `onModuleInit` to avoid cold-start latency
- **Schema differential updates:** Instead of full reload on schema change, apply patch updates
- **WebSocket validation:** Extend ContractGuard to validate WebSocket message payloads against schemas
- **gRPC validation:** Support protobuf schema validation alongside JSON Schema
