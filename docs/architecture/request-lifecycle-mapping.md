# Request Lifecycle Mapping — CRBL to NestJS

**Document ID:** `ARCH-REQ-LIFECYCLE-001`
**Version:** 1.0
**Date:** 2026-06-20
**Status:** Active
**Package:** `packages/contracts/` (CRBL implementation), `apps/api/` (NestJS runtime anchor)

---

## Purpose

This document maps each CRBL (Contract Runtime Bridge Layer) enforcement component to its precise binding point in the NestJS request lifecycle. It serves as the definitive reference for hook registration order, execution context, and pass-through/transform/reject semantics.

---

## NestJS Request Lifecycle (with Fastify Adapter)

The NestJS request lifecycle over Fastify follows this ordered sequence:

```
1. Fastify middleware (Helmet, CORS, request ID)
2. Guards          (CanActivate)
3. Interceptors    (pre-controller — NestInterceptor.intercept → CallHandler.handle)
4. Pipes           (PipeTransform)
5. Controller      (route handler executes)
6. Interceptors    (post-controller — response Observable)
7. Exception filters (ExceptionFilter)
```

---

## CRBL Component Mapping

### Overview Diagram

```
                         INCOMING REQUEST
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Fastify Middleware   │  (Helmet, CORS, RequestIdMiddleware)
                    │  Execution: 1         │
                    └──────────┬──────────┘
                               │
                    ╔══════════▼══════════════════════════════════════╗
                    ║               GUARDS (CanActivate)              ║
                    ║                                                 ║
                    ║  ┌─────────────────────────────────────────┐   ║
                    ║  │ 1. ContractGuard                        │   ║
                    ║  │    Priority: 10                         │   ║
                    ║  │    Context: ExecutionContext             │   ║
                    ║  │    Returns: true | throws 422           │   ║
                    ║  └─────────────────────────────────────────┘   ║
                    ║                                                 ║
                    ║  ┌─────────────────────────────────────────┐   ║
                    ║  │ 2. PolicyGuard                          │   ║
                    ║  │    Priority: 20                         │   ║
                    ║  │    Context: ExecutionContext + caller    │   ║
                    ║  │    Returns: true | throws 403           │   ║
                    ║  └─────────────────────────────────────────┘   ║
                    ╚══════════════════╤══════════════════════════════╝
                                       │
                    ╔══════════════════▼══════════════════════════════╗
                    ║          INTERCEPTORS (pre-controller)          ║
                    ║                                                 ║
                    ║  ┌─────────────────────────────────────────┐   ║
                    ║  │ 3. ContractInterceptor (pre)            │   ║
                    ║  │    Priority: 10                         │   ║
                    ║  │    Context: ExecutionContext + handler   │   ║
                    ║  │    Returns: Observable (pass-through)   │   ║
                    ║  └─────────────────────────────────────────┘   ║
                    ╚══════════════════╤══════════════════════════════╝
                                       │
                    ╔══════════════════▼══════════════════════════════╗
                    ║                 PIPES (PipeTransform)           ║
                    ║                                                 ║
                    ║  ┌─────────────────────────────────────────┐   ║
                    ║  │ 4. ContractPipe (ValidationPipe)        │   ║
                    ║  │    Priority: 10                         │   ║
                    ║  │    Context: argument metadata + value   │   ║
                    ║  │    Returns: transformed value | 422     │   ║
                    ║  └─────────────────────────────────────────┘   ║
                    ╚══════════════════╤══════════════════════════════╝
                                       │
                                       ▼
                    ┌─────────────────────────────────────────────┐
                    │           CONTROLLER (route handler)         │
                    │          Business logic execution             │
                    └──────────────────────┬──────────────────────┘
                                           │
                    ╔══════════════════════▼══════════════════════════╗
                    ║        INTERCEPTORS (post-controller)           ║
                    ║                                                 ║
                    ║  ┌─────────────────────────────────────────┐   ║
                    ║  │ 5. ContractInterceptor (post)           │   ║
                    ║  │    Priority: 10                         │   ║
                    ║  │    Context: response Observable          │   ║
                    ║  │    Returns: validated Observable | 500  │   ║
                    ║  └─────────────────────────────────────────┘   ║
                    ╚══════════════════╤══════════════════════════════╝
                                       │
                    ╔══════════════════▼══════════════════════════════╗
                    ║            EXCEPTION FILTERS                    ║
                    ║                                                 ║
                    ║  ┌─────────────────────────────────────────┐   ║
                    ║  │ 6. Standard Error Envelope              │   ║
                    ║  │    Catches: all unhandled exceptions    │   ║
                    ║  │    Maps to: ApiError envelope           │   ║
                    ║  └─────────────────────────────────────────┘   ║
                    ╚═════════════════════════════════════════════════╝
                                       │
                                       ▼
                                  RESPONSE
```

---

## 1. ContractGuard

| Attribute | Value |
|:---|:---|
| **NestJS Hook** | `CanActivate` (Guard) |
| **Lifecycle Stage** | Guards — stage 1 |
| **Execution Order** | Priority 10 — runs BEFORE PolicyGuard |
| **Context Received** | `ExecutionContext` — provides `req` (FastifyRequest), `route` metadata, `handler` class |
| **Context Reads** | `req.method`, `req.url`, `req.body`, `req.query`, `req.params` |
| **Returns (Pass)** | `true` — request proceeds to next guard/interceptor |
| **Returns (Reject)** | Throws `ContractValidationException` with 422 status code |
| **Side Effects** | Validates `req.body`, `req.query`, `req.params` against OpenAPI schema for `{method} {path}`. Rejects unknown fields. Stores validated schema reference on `req` for downstream components. |
| **Skip Marking** | `@SkipContractValidation()` decorator sets metadata key `CRBL_SKIP_CONTRACT_VALIDATION` — ContractGuard reads this and passes through. Used for `/health`, webhook endpoints. |

### ContractGuard Execution Flow

```
canActivate(context: ExecutionContext): boolean | Promise<boolean> {
  1. Check metadata for CRBL_SKIP_CONTRACT_VALIDATION → if set, return true
  2. Extract { method, path } from request
  3. Look up OpenAPI operation in SchemaRegistry
  4. If not found (unknown endpoint) → return false (NestJS → 404)
  5. Load compiled AJV validator from SchemaRegistry cache
  6. Build validation payload: { body, query, params }
  7. Run AJV validator.validate(validationPayload)
  8. If fail → throw ContractValidationException with field-level details
  9. Attach validated schema to req.schemaContext
  10. Return true
}
```

---

## 2. PolicyGuard

| Attribute | Value |
|:---|:---|
| **NestJS Hook** | `CanActivate` (Guard) |
| **Lifecycle Stage** | Guards — stage 2 |
| **Execution Order** | Priority 20 — runs AFTER ContractGuard, BEFORE ContractInterceptor |
| **Context Received** | `ExecutionContext` + `Reflector` for `@RequirePolicy()` metadata |
| **Context Reads** | `req.user` (caller identity from JWT), `req.method`, `req.url`, route policy metadata |
| **Returns (Pass)** | `true` — request proceeds |
| **Returns (Reject)** | Throws `ForbiddenException` with 403 status code |
| **Side Effects** | Reads `@RequirePolicy()` decorator metadata from handler class. Evaluates RBAC policy against `caller.role + resource + action`. Resolves `$caller.*` context variables. |

### PolicyGuard Execution Flow

```
canActivate(context: ExecutionContext): boolean | Promise<boolean> {
  1. Check metadata for IS_PUBLIC_KEY → if set, return true
  2. Extract caller context from req.user (populated by AuthGuard)
  3. Read @RequirePolicy() metadata from handler (resource, action)
  4. If no policy declared → default deny (return false)
  5. Query SchemaRegistry.evaluatePolicy(caller, resource, action)
  6. If policy result is "allow" → return true
  7. If policy result is "deny" → throw ForbiddenException
}
```

---

## 3. ContractInterceptor (pre-controller)

| Attribute | Value |
|:---|:---|
| **NestJS Hook** | `NestInterceptor` (Interceptor) |
| **Lifecycle Stage** | Interceptors — pre-controller (before `CallHandler.handle()`) |
| **Execution Order** | Priority 10 |
| **Context Received** | `ExecutionContext` — provides request context, handler class, argument metadata |
| **Context Reads** | `req.schemaContext` (set by ContractGuard), route metadata |
| **Returns (Pass)** | Calls `next.handle()` — passes through to controller unchanged |
| **Returns (Reject)** | N/A in pre-controller phase (validation already done by ContractGuard) |
| **Side Effects** | Attaches response schema reference to the RxJS pipe for post-controller validation. Sets up the observable chain that will validate the response. |

### ContractInterceptor pre-controller Flow

```
intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
  1. Extract { method, path } from request
  2. Look up response OpenAPI operation in SchemaRegistry
  3. Store response schema reference for post-controller phase
  4. Return next.handle().pipe(
       // Post-controller validation happens here
       map(response => validateResponse(response, storedSchema))
     )
}
```

---

## 4. ContractPipe (ValidationPipe)

| Attribute | Value |
|:---|:---|
| **NestJS Hook** | `PipeTransform` (Pipe) |
| **Lifecycle Stage** | Pipes — after interceptors pre-phase, before controller |
| **Execution Order** | Priority 10 |
| **Context Received** | `value` (argument being transformed), `ArgumentMetadata` (metatype, type, data) |
| **Context Reads** | The raw argument value (typically `@Body()`, `@Query()`, `@Param()`) |
| **Returns (Pass)** | Transformed and validated value matching the Zod DTO schema |
| **Returns (Reject)** | Throws `ValidationException` with 422 status code and field-level error details |
| **Side Effects** | Transforms raw input into typed DTO. Uses Zod schemas generated from OpenAPI requestBody. Integrates with global `whitelist: true` and `forbidNonWhitelisted: true` settings. |

### ContractPipe Execution Flow

```
transform(value: unknown, metadata: ArgumentMetadata): unknown {
  1. Determine if this argument has an associated Zod schema (via decorator or metatype)
  2. If no schema → pass through unchanged
  3. Parse value with Zod schema
  4. If parse succeeds → return transformed value (type-safe DTO)
  5. If parse fails → format ZodError into ErrorResponse envelope, throw ValidationException
}
```

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "فشل تطابق المدخلات",
    "message_en": "Input validation failed",
    "statusCode": 422,
    "details": [
      {
        "field": "email",
        "code": "invalid_string",
        "message": "Invalid email format"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-06-20T12:00:00Z",
    "requestId": "018f9a92-3c5f-7a8b-9c0d-1e2f3a4b5c6d"
  }
}
```

---

## 5. ContractInterceptor (post-controller)

| Attribute | Value |
|:---|:---|
| **NestJS Hook** | `NestInterceptor` (Interceptor) — post-controller Observable pipe |
| **Lifecycle Stage** | Interceptors — post-controller (after controller returns) |
| **Execution Order** | Priority 10 |
| **Context Received** | `ExecutionContext` + response value emitted by controller |
| **Context Reads** | Response body, stored response schema (from pre-controller phase), response status code |
| **Returns (Pass)** | Validated (and potentially stripped) response body |
| **Returns (Reject)** | Returns 500 Internal Server Error if response violates contract in strict mode |
| **Side Effects** | Strips extra fields not declared in OpenAPI response schema. Adds `X-Contract-Violation: response` header in warn mode. Logs violations with structured metadata. |

### ContractInterceptor post-controller Flow

```
// Within the RxJS pipe from pre-controller phase:
map(response => {
  1. Determine actual status code (from response or default 200)
  2. Look up OpenAPI response schema for { method, path, statusCode }
  3. If no schema found AND mode is "strict" → throw (response contract missing)
  4. If no schema found AND mode is "warn" → add warning header, return as-is
  5. Validate response.body against response schema via AJV
  6. If validation fails:
     a. Log error with full context
     b. In strict mode: throw with 500 ← DEFAULT
     c. In warn mode: add X-Contract-Violation header, return as-is
  7. If stripUnknown: recursively remove fields not in schema
  8. Return validated/cleaned response
})
```

### Extra Field Stripping Algorithm

```
function stripExtraFields(response: unknown, schema: JSONSchema): unknown {
  // For objects: keep only keys present in schema.properties
  // For arrays: apply stripping to each element
  // For nested objects: recurse with nested schema
  // Preserve: null, undefined, primitive values
  // Remove: any top-level or nested key not declared in the schema
}
```

---

## 6. Standard Error Envelope (Exception Filter)

| Attribute | Value |
|:---|:---|
| **NestJS Hook** | `ExceptionFilter` (Global Exception Filter) |
| **Lifecycle Stage** | Exception Filters — catches ANY unhandled exception in the pipeline |
| **Execution Order** | Last — catches all unhandled exceptions not caught by earlier filters |
| **Context Received** | `exception: unknown`, `ArgumentsHost` (request/response context) |
| **Returns** | Always returns a response — never passes through |
| **Side Effects** | Maps every exception to the standard `ApiError` envelope. Ensures Arabic error messages. Sanitizes stack traces (never exposed in production). Adds `requestId` for correlation. |

### Error Envelope Mapping

| Exception Type | HTTP Status | Error Code Prefix |
|:---|:---|:---|
| `ContractValidationException` | 422 | `CONTRACT_VALIDATION_ERROR` |
| `ValidationException` (Zod) | 422 | `VALIDATION_ERROR` |
| `ForbiddenException` (policy) | 403 | `FORBIDDEN` |
| `UnauthorizedException` (auth) | 401 | `UNAUTHORIZED` |
| `NotFoundException` | 404 | `NOT_FOUND` |
| `ConflictException` | 409 | `CONFLICT` |
| `TooManyRequestsException` | 429 | `RATE_LIMIT_EXCEEDED` |
| `InternalServerErrorException` | 500 | `INTERNAL_ERROR` |
| Unhandled / unknown | 500 | `INTERNAL_ERROR` |

### Exception Filter Execution Flow

```
catch(exception: unknown, host: ArgumentsHost): void {
  1. Extract HTTP response object from host
  2. Determine exception type → map to HTTP status code + error code
  3. Build error message (Arabic primary, English fallback)
  4. Extract requestId from request context (set by RequestIdMiddleware)
  5. Construct ApiError envelope:
     {
       error: { code, message, message_en, statusCode, details },
       meta: { timestamp, requestId }
     }
  6. Send response with correct HTTP status
  7. Log exception with severity based on status code
}
```

---

## Execution Order Summary

| Order | Component | NestJS Hook | Priority | Pass-Through | Reject |
|:---:|:---|:---|:---:|:---|:---|
| 1 | Fastify Middleware | Middleware | N/A | Continue | N/A |
| 2 | ContractGuard | Guard (`CanActivate`) | 10 | `true` | `422` |
| 3 | PolicyGuard | Guard (`CanActivate`) | 20 | `true` | `403` |
| 4 | ContractInterceptor (pre) | Interceptor (`NestInterceptor`) | 10 | Observable chain | N/A |
| 5 | ContractPipe | Pipe (`PipeTransform`) | 10 | Transformed value | `422` |
| 6 | Controller | Route handler | N/A | Response body | Domain error |
| 7 | ContractInterceptor (post) | Interceptor (Observable pipe) | 10 | Validated response | `500` |
| 8 | Exception Filter | `ExceptionFilter` | Last | N/A | Error envelope |

---

## CRBL Component — NestJS Hook Binding Reference

### Guards (`CanActivate`) — Registered Globally in `app.module.ts`

```typescript
// apps/api/src/app.module.ts
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE, APP_FILTER } from "@nestjs/core";

@Module({
  providers: [
    { provide: APP_GUARD, useClass: ContractGuard },    // Priority 10
    { provide: APP_GUARD, useClass: PolicyGuard },      // Priority 20
    { provide: APP_INTERCEPTOR, useClass: ContractInterceptor },  // Priority 10
    { provide: APP_PIPE, useClass: ContractPipe },       // Priority 10
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
```

### Decorator-Declared (Route-Level) Overrides

```typescript
// Skip contract validation for health/readiness endpoints
@SkipContractValidation()
@Get("health")
healthCheck() { ... }

// Declare policy requirement for protected routes
@RequirePolicy({ resource: "identity:users", action: "read" })
@Get("users/:id")
getUser() { ... }

// Mark public routes (skip auth + policy)
@Public()
@Post("auth/login")
login() { ... }
```

---

## Context Availability by Stage

| Context Property | Source | Available At |
|:---|:---|:---|
| `req.id` (correlation ID) | RequestIdMiddleware | All stages |
| `req.method` | HTTP request | All stages |
| `req.url` / `req.path` | HTTP request | All stages |
| `req.body` | HTTP request body | Guards, Pipes, Controller |
| `req.query` | HTTP query params | Guards, Pipes, Controller |
| `req.params` | URL path params | Guards, Pipes, Controller |
| `req.user` (JWT identity) | AuthGuard | PolicyGuard, Controller |
| `req.schemaContext` | ContractGuard | ContractInterceptor, ContractPipe |
| Policy metadata | `@RequirePolicy()` decorator | PolicyGuard |
| Zod schema | `@Body(ContractPipe)` metadata | ContractPipe |

---

## References

- [CRBL Architecture Blueprint](../../packages/contracts/spec/crbl-architecture.md) — full CRBL component design
- [apps/api README](../../apps/api/README.md) — runtime anchor bootstrap
- [ADR-002: NestJS Backend](../../docs/adr/adr-002-nestjs-backend.md)
- [ADR-021: Contract Runtime Bridge Layer](../../docs/adr/adr-021-contract-runtime-bridge.md)
- [Coding Standards — Middleware/Guards/Pipes](../../docs/standards/coding-standards.md)
