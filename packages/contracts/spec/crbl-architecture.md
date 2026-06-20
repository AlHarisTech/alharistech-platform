# Contract Runtime Bridge Layer (CRBL) — Architecture Blueprint

**Version:** 1.0
**Date:** 2026-06-20
**Status:** Design Specification (Pre-Implementation)
**Owner:** Architecture Team
**Package:** `packages/contracts/`
**Stack:** NestJS 11, AJV 8, Zod 3, BullMQ, Redis 7

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Layer Position](#2-layer-position)
3. [Enforcement Pipeline](#3-enforcement-pipeline)
4. [Component Architecture](#4-component-architecture)
5. [Schema Generation Pipeline](#5-schema-generation-pipeline)
6. [Fail-Closed Behavior](#6-fail-closed-behavior)
7. [Performance Budget](#7-performance-budget)
8. [CI/CD Integration](#8-cicd-integration)
9. [Testing Strategy](#9-testing-strategy)
10. [Folder Structure](#10-folder-structure)
11. [Security Considerations](#11-security-considerations)
12. [Operational Concerns](#12-operational-concerns)

---

## 1. Purpose

The Contract Runtime Bridge Layer (CRBL) is the architectural component that bridges static contract artifacts — OpenAPI specifications, event schemas, and access-control policies — to live runtime enforcement within the NestJS API Gateway.

### 1.1 Core Mission

| Goal | Description |
|:---|:---|
| **Prevent Contract Drift** | Guarantee that every request, response, and event matches its declared contract. Drift is detected at request time, not discovered in production incidents. |
| **Fail-Closed Enforcement** | All CRBL validators default to rejection. Unknown fields, unregistered endpoints, invalid event payloads, and unauthorized access are denied by default. |
| **Single Source of Truth** | The contract files under `specs/contracts/` remain the authoritative specification. CRBL enforces them; it never relaxes or overrides them. |
| **Automate Compliance** | Contract tests, schema compilation, and policy completeness checks run automatically in CI/CD — no manual verification of contract adherence at code review time. |

### 1.2 Contract Inventory (as of v0.3.0)

| Contract Type | Count | Source File | Enforcement Component |
|:---|:---|:---|:---|
| OpenAPI Specifications | 9 | `specs/contracts/openapi/*.yaml` | ContractGuard, ContractInterceptor, ValidationPipe |
| Event Schemas | 94 | `specs/contracts/events/event-schemas.yaml` | EventValidator |
| Policy Rules | 162 | `specs/contracts/policy/access-control.yaml` | PolicyGuard |

### 1.3 Design Principles

1. **Contracts are the authority.** Implementation conforms to contracts, never the reverse.
2. **Compile-time + Runtime dual validation.** TypeScript types from generated schemas catch contract violations at build time. AJV-compiled validators catch them at runtime.
3. **Fail-closed everywhere.** Unknown endpoint → 404. Unknown field → 422. Extra response field → stripped. Invalid event → dead-letter queue.
4. **Performance as a feature.** Contract validation must add < 5ms p95 latency. Cached compiled schemas make this achievable.
5. **Observable enforcement.** Every validation pass/fail is logged with structured metadata for monitoring and debugging.

---

## 2. Layer Position

CRBL sits as a mandatory enforcement layer between the API Gateway ingress and the Domain Services. Every inbound request, outbound response, and emitted event transits through CRBL.

### 2.1 Architectural Placement

```
                              ┌──────────────────────┐
                              │   Nginx / CDN / WAF   │
                              └──────────┬───────────┘
                                         │ HTTPS (TLS 1.3)
                                         ▼
                              ┌──────────────────────┐
                              │   NestJS HTTP Server   │
                              │       (main.ts)       │
                              └──────────┬───────────┘
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              │                          │                          │
              ▼                          ▼                          ▼
   ┌──────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐
   │   Global Prefix   │    │   Request ID Middle  │    │   CORS Middleware    │
   │   /api/v1         │    │   Correlation ID     │    │   Helmet Headers     │
   └────────┬──────────┘    └──────────┬───────────┘    └──────────────────────┘
            │                          │
            └──────────┬───────────────┘
                       │
          ╔════════════▼═══════════════════════════════════════╗
          ║          CONTRACT RUNTIME BRIDGE LAYER              ║
          ║                                                    ║
          ║  1. AuthGuard        (JWT validation)              ║
          ║  2. PolicyGuard      (RBAC evaluation)             ║
          ║  3. ContractGuard    (OpenAPI request validation)  ║
          ║  4. ValidationPipe   (Zod DTO validation)          ║
          ║                      ▼                             ║
          ║              Domain Controller                     ║
          ║                      ▼                             ║
          ║  5. ContractIntercept. (OpenAPI response enforce)  ║
          ╚════════════════════════════════════════════════════╝
                       │
                       ▼
              ┌──────────────────────┐
              │   Domain Services    │
              │   (NestJS Modules)   │
              └──────────────────────┘
```

### 2.2 Request Flow Sequence

```
1. Request arrives at NestJS HTTP server
2. CORS/Helmet middleware applied globally
3. RequestIdMiddleware attaches correlation ID
4. AuthGuard extracts and validates JWT from Authorization header
5. PolicyGuard evaluates RBAC policy against caller role + requested resource/action
6. ContractGuard loads compiled AJV validator for {method} {path} from SchemaRegistry
7. ContractGuard validates request body, query params, path params against OpenAPI schema
8. ValidationPipe applies Zod schema validation for DTO transformation
9. Controller method executes (business logic)
10. ContractInterceptor validates response body against OpenAPI response schema
11. ContractInterceptor strips extra fields not declared in response contract
12. Response sent to client
```

### 2.3 Event Flow Sequence

```
1. Domain service emits domain event via EventEmitter2
2. EventValidator intercepts event emission before BullMQ enqueue
3. EventValidator loads compiled JSON Schema for event type from SchemaRegistry
4. Event validated against schema — pass: enqueue to BullMQ / fail: dead-letter queue
5. BullMQ worker picks up job, EventValidator middleware validates payload before handler
6. Handler processes event
```

---

## 3. Enforcement Pipeline

### 3.1 Request Pipeline

```
Request → AuthGuard → PolicyGuard → ContractGuard → ValidationPipe → Controller → ContractInterceptor → Response
```

| Stage | Component | Responsibility | HTTP Error on Failure |
|:---|:---|:---|:---|
| 1 | `AuthGuard` | Validate JWT signature, expiry, blacklist check. Extract caller identity. | `401 Unauthorized` |
| 2 | `PolicyGuard` | Evaluate RBAC policy from `access-control.yaml` against `caller.role + resource + action`. Resolve `$caller.*` and `$resource.*` context variables. | `403 Forbidden` |
| 3 | `ContractGuard` | Validate `req.body`, `req.query`, `req.params` against OpenAPI schema for `{method} {path}`. Reject unknown fields. | `422 Unprocessable Entity` |
| 4 | `ValidationPipe` | Transform and validate DTO via Zod schema (generated from OpenAPI). Provide field-level error details. | `422 Unprocessable Entity` |
| 5 | **Controller** | Business logic executes. Input already fully validated and authorized. | Domain-specific |
| 6 | `ContractInterceptor` | Validate `res.body` against OpenAPI response schema. Strip extra fields not in contract. Ensure required fields present. | `500 Internal Server Error` (response contract violation) |

### 3.2 Event Pipeline

```
Event Emission → EventValidator (pre-enqueue) → BullMQ Enqueue → EventValidator (worker middleware) → Handler
                                              ↙
                               Invalid Event → Dead-Letter Queue
```

| Stage | Component | Responsibility | Behavior on Failure |
|:---|:---|:---|:---|
| 1 | `EventValidator` (Producer) | Validate event payload against `event-schemas.yaml` before BullMQ `add()`. | Reject emission, throw `EventContractError`. |
| 2 | BullMQ | Persist job to Redis. At-least-once delivery. Retry with exponential backoff. | Standard BullMQ retry flow. |
| 3 | `EventValidator` (Consumer) | Validate event payload again at worker ingress before handler execution. | Move to dead-letter queue. Emit `EventContractViolation` metric. |
| 4 | **Handler** | Process event. Payload already schema-validated. | Domain-specific. |

---

## 4. Component Architecture

### 4.1 ContractGuard

**Type:** NestJS Guard (`CanActivate`)
**Package:** `@alharistech/contracts/guards`

Validates that the incoming HTTP request body, query parameters, and path parameters conform to the OpenAPI schema for the matching endpoint.

#### 4.1.1 Algorithm

```
function canActivate(context: ExecutionContext): boolean {
  1. Extract { method, path } from request
  2. Look up OpenAPI operation in SchemaRegistry for { method, path }
  3. If not found (unknown endpoint) → return false (NestJS resolves to 404)
  4. Load compiled AJV validator from SchemaRegistry cache (or compile + cache)
  5. If operation has security → skip body validation here (defer to ValidationPipe)
  6. Build validation payload: { body: req.body, query: req.query, params: req.params }
  7. Run AJV validator.validate(validationPayload)
  8. If validation fails → throw ContractValidationException with field-level errors
  9. Return true
}
```

#### 4.1.2 Configuration

```typescript
interface ContractGuardOptions {
  mode: "strict" | "warn";          // default: "strict"
  stripUnknown: boolean;            // default: true (remove unknown body fields)
  forbidUnknownQueryParams: boolean; // default: true
  maxValidationTimeMs: number;       // default: 5 (sla budget)
}
```

#### 4.1.3 Error Response Format

```json
{
  "error": {
    "code": "CONTRACT_VALIDATION_ERROR",
    "message": "فشل تطابق الطلب مع العقد",
    "message_en": "Request does not match the API contract",
    "statusCode": 422,
    "details": [
      {
        "location": "body",
        "field": "/email",
        "code": "FORMAT",
        "message": "must match format \"email\"",
        "received": "not-an-email"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-06-20T12:00:00Z",
    "requestId": "018f9a92-3c5f-7a8b-9c0d-1e2f3a4b5c6d"
  }
}
```

#### 4.1.4 Decorator Overrides

```typescript
// Skip contract validation for health check endpoints
@SkipContractValidation()
@Get("health")
healthCheck() { ... }

// Skip contract validation for body only (allow middleware-injected fields)
@SkipContractValidation({ on: "body" })
@Post("webhook/:provider")
webhookHandler(@Body() raw: unknown) { ... }
```

### 4.2 ContractInterceptor

**Type:** NestJS Interceptor (`NestInterceptor`)
**Package:** `@alharistech/contracts/interceptors`

Validates the HTTP response body against the OpenAPI response schema. Strips extra fields not declared in the contract and ensures all required fields are present.

#### 4.2.1 Algorithm

```
function intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
  1. Extract { method, path } from request
  2. Extract response status code (or default to 200 for the route)
  3. Look up OpenAPI response schema for { method, path, statusCode } in SchemaRegistry
  4. If not found AND mode is "strict" → throw (response contract missing)
  5. If not found AND mode is "warn" → pass through unvalidated
  6. Load compiled AJV response validator
  7. On response:
     a. Validate response.body against the schema
     b. If validation fails → log error, strip invalid data, return sanitized response
     c. If stripUnknown is true → remove fields not in schema
     d. Pass through validated/cleaned response
}
```

#### 4.2.2 Extra Field Stripping

```typescript
function stripExtraFields(response: unknown, schema: JSONSchema): unknown {
  // Deep recursive walk of response object
  // For each object key: if key not in schema.properties → remove
  // For arrays: apply stripping to each element
  // For nested objects: recurse with nested schema
  // Preserves: null, undefined, primitive values
}
```

#### 4.2.3 Response Contract Violation Handling

When a controller returns a response that violates the contract (e.g., missing a `required` field), the interceptor logs the violation as an error, adds a warning header `X-Contract-Violation: response`, and in `strict` mode returns a `500 Internal Server Error` with the contract violation details. In `warn` mode, the response is sent as-is with the warning header.

### 4.3 ValidationPipe

**Type:** NestJS Pipe (`PipeTransform`)
**Package:** `@alharistech/contracts/pipes`

Maps Zod schemas generated from OpenAPI requestBody schemas to NestJS validation pipes. Provides field-level error details matching the platform's standard error envelope.

#### 4.3.1 Zod Schema Generation

OpenAPI requestBody schemas are converted to equivalent Zod schemas at build time:

```
OpenAPI Schema → openapi-typescript types → Zod schemas → ValidationPipe
```

```typescript
// Generated from identity-api.yaml RegisterRequest schema
const RegisterRequestSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,128}$/),
  first_name_ar: z.string().min(1).max(100),
  last_name_ar: z.string().min(1).max(100),
  first_name_en: z.string().min(1).max(100).optional(),
  last_name_en: z.string().min(1).max(100).optional(),
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/).max(20).optional(),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
```

#### 4.3.2 Usage

```typescript
// Controller DTO class
export class RegisterUserDto {
  @ApiProperty({ /* mirrors OpenAPI schema */ })
  @Validate(RegisterRequestSchema)
  body: RegisterRequest;
}

// Controller method
@Post("auth/register")
async registerUser(
  @Body(new ContractValidationPipe(RegisterRequestSchema)) body: RegisterRequest,
): Promise<AuthResponse> { ... }
```

#### 4.3.3 Integration with Existing ValidationPipe

The CRBL ValidationPipe integrates with the global NestJS `ValidationPipe` (configured in `main.ts` per coding-standards.md), extending it to:
- Use Zod schemas as the validation source (not class-validator decorators)
- Format errors to match the `ErrorResponse` contract envelope (code, message, message_en, statusCode, details[])
- Support `whitelist: true` (strip unknown) and `forbidNonWhitelisted: true` (reject unknown) as configured globally

### 4.4 PolicyGuard

**Type:** NestJS Guard (`CanActivate`)
**Package:** `@alharistech/contracts/policies`

Evaluates RBAC policy rules from `specs/contracts/policy/access-control.yaml` at request time. Priority-based evaluation with context-aware variable resolution.

#### 4.4.1 Policy Evaluation Algorithm

```
function evaluatePolicy(caller: CallerContext, resource: string, action: string): PolicyResult {
  1. Load all policies from SchemaRegistry
  2. Collect matching policies where:
     a. (caller.role IN policy.roles) OR (policy.roles contains "*")
     b. policy.resource matches resourcePattern OR is "*"
     c. policy.action matches action OR is "*"
  3. Sort matches by priority (descending)
  4. For each matching policy in priority order:
     a. Evaluate conditions (resolving $caller.* and $resource.* variables)
     b. If all conditions pass AND effect is "deny" → return { allowed: false, reason: "explicit deny" }
     c. If all conditions pass AND effect is "allow" → return { allowed: true }
  5. If no matching allow policy → return { allowed: false, reason: "default deny (priority 0)" }
}
```

#### 4.4.2 Context Variable Resolution

```typescript
interface CallerContext {
  id: string;          // $caller.id → user UUID from JWT
  role: string;        // $caller.role → user role (admin, manager, employee, customer, partner)
  customerId?: string; // $caller.customerId → linked customer profile UUID
  ip: string;          // $caller.ip → request IP address
}

type ConditionValue = string | number | boolean | string[];

type Operator = "equals" | "in" | "contains" | "regex" | "greater_than" | "less_than";

interface PolicyCondition {
  field: string;
  operator: Operator;
  value: ConditionValue;
}

// Variable interpolation:
// "$caller.id" → caller.id
// "$caller.role" → caller.role
// "$caller.customerId" → caller.customerId
// "$resource.owner_id" → resolved from the resource being accessed
// "$now" → new Date().toISOString()
```

#### 4.4.3 Resource Mapping

The PolicyGuard resolves `{domain}:{resource}` identifiers to API paths using the mapping table in `access-control.yaml` (lines 1348-1408). Example:

| Policy Resource | API Path |
|:---|:---|
| `identity:users` | `/api/v1/users`, `/api/v1/users/{id}` |
| `identity:roles` | `/api/v1/users/{id}/role` |
| `service:service_orders` | `/api/v1/orders` |
| `customer:customer_import` | `/api/v1/customers/import` |

#### 4.4.4 Decorator Usage

```typescript
// Declare required policy resource + action on controller method
@RequirePolicy({ resource: "identity:users", action: "read" })
@Get("users/:id")
async getUserById(@Param("id") id: string) { ... }

// Multiple policies (user must satisfy ALL)
@RequirePolicies([
  { resource: "service:service_orders", action: "read" },
  { resource: "service:order_documents", action: "read" },
])
@Get("orders/:id/documents")
async getDocuments(@Param("id") id: string) { ... }
```

### 4.5 EventValidator

**Type:** BullMQ Worker Middleware + Producer Interceptor
**Package:** `@alharistech/contracts/events`

Validates event payloads against `specs/contracts/events/event-schemas.yaml` at two points: before enqueuing (producer side) and before handler execution (consumer side).

#### 4.5.1 Producer-Side Validation

```typescript
@Injectable()
export class EventValidationService {
  async validateAndEmit<T>(eventType: string, payload: T): Promise<Job<T>> {
    const validator = this.schemaRegistry.getEventValidator(eventType);
    if (!validator) {
      throw new EventContractError(`Unknown event type: ${eventType}`);
    }
    const result = validator(payload);
    if (!result.valid) {
      throw new EventContractError(eventType, result.errors);
    }
    return this.eventEmitter.emit(eventType, payload);
  }
}
```

#### 4.5.2 Consumer-Side Validation (BullMQ Worker Middleware)

```typescript
@Processor("bullmq:service.events")
export class ServiceEventConsumer extends WorkerHost {
  @Process("service.order.placed")
  async handleOrderPlaced(job: Job<ServiceOrderPlacedPayload>) {
    const result = this.eventValidator.validate("service.order.placed", job.data);
    if (!result.valid) {
      await job.moveToFailed(
        new EventContractError("service.order.placed", result.errors),
        "contract-violation"
      );
      return;
    }
    // Handler logic
  }
}

// Abstracted as a decorator:
@Process("service.order.placed")
@ValidateEvent("service.order.placed")
async handleOrderPlaced(job: Job<ServiceOrderPlacedPayload>) { ... }
```

#### 4.5.3 Dead-Letter Queue Strategy

| Queue | DLQ Name | Retention | Replay |
|:---|:---|:---|:---|
| `bullmq:identity.events` | `bullmq:identity.events.dlq` | 7 days | Manual inspection/replay via Bull Board |
| `bullmq:customer.events` | `bullmq:customer.events.dlq` | 7 days | Manual inspection/replay via Bull Board |
| `bullmq:service.events` | `bullmq:service.events.dlq` | 7 days | Manual inspection/replay via Bull Board |
| `bullmq:commerce.events` | `bullmq:commerce.events.dlq` | 7 days | Manual inspection/replay via Bull Board |
| `bullmq:support.events` | `bullmq:support.events.dlq` | 7 days | Manual inspection/replay via Bull Board |

Events moved to DLQ are logged with full payload and validation errors. Metric `event_contract_violations_total` is incremented with labels `{event_type, domain}` for Prometheus alerting.

### 4.6 SchemaRegistry

**Type:** NestJS Injectable Service (Singleton)
**Package:** `@alharistech/contracts/registry`

Central runtime registry that loads, compiles, caches, and serves all contract schemas.

#### 4.6.1 Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                      SchemaRegistry                            │
│                                                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────┐ │
│  │ OpenAPI Schemas  │  │  Event Schemas   │  │ Policy Rules  │ │
│  │ (9 specs)        │  │  (94 schemas)    │  │ (162 rules)   │ │
│  └────────┬────────┘  └────────┬────────┘  └──────┬────────┘ │
│           │                    │                   │          │
│  ┌────────▼────────┐  ┌────────▼────────┐  ┌───────▼───────┐ │
│  │ AJV Compiler    │  │ AJV Compiler    │  │ Rule Engine   │ │
│  │ (request/response│  │ (event payload)  │  │ (RBAC eval)  │ │
│  │  validators)    │  │                 │  │               │ │
│  └────────┬────────┘  └────────┬────────┘  └───────┬───────┘ │
│           │                    │                   │          │
│  ┌────────▼────────────────────▼───────────────────▼───────┐ │
│  │              Redis Cache Layer                           │ │
│  │  Key: contract:operation:{method}:{path}                │ │
│  │  Key: contract:event:{event_type}                       │ │
│  │  Key: contract:policy:{resource}:{action}               │ │
│  │  TTL: 1 hour (development) / infinite (production)     │ │
│  └─────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

#### 4.6.2 API

```typescript
@Injectable()
export class SchemaRegistry {
  // Load all schemas on application bootstrap
  async onApplicationBootstrap(): Promise<void>;

  // OpenAPI operation lookups
  getOperation(method: string, path: string): OpenApiOperation | undefined;
  getRequestValidator(method: string, path: string): AJV.ValidateFunction;
  getResponseValidator(method: string, path: string, statusCode: number): AJV.ValidateFunction;

  // Event schema lookups
  getEventSchema(eventType: string): JSONSchema | undefined;
  getEventValidator(eventType: string): AJV.ValidateFunction;

  // Policy lookups
  getPolicies(): PolicyRule[];
  evaluatePolicy(caller: CallerContext, resource: string, action: string): PolicyResult;

  // Development hot-reload
  enableHotReload(): void;     // Watch contract files for changes, recompile
  disableHotReload(): void;

  // Health check
  healthCheck(): { loaded: boolean; schemas: number; validators: number; policies: number; };
}
```

#### 4.6.3 Hot-Reload (Development)

```typescript
// In development mode, SchemaRegistry watches contract files via chokidar:
function enableHotReload(): void {
  const watcher = chokidar.watch("specs/contracts/**/*.yaml", { ignoreInitial: true });
  watcher.on("change", async (filePath) => {
    logger.info("Contract file changed, recompiling...", { filePath });
    await this.reloadFile(filePath);
    this.invalidateCache();
  });
}
```

#### 4.6.4 Redis Cache Strategy

| Cache Key Pattern | Value | TTL |
|:---|:---|:---|
| `contract:openapi:hash` | SHA-256 of combined OpenAPI YAML files | No expiry |
| `contract:validators:request:{method}:{path}` | Serialized AJV validate function | 24 hours (production) |
| `contract:validators:response:{method}:{path}:{statusCode}` | Serialized AJV validate function | 24 hours (production) |
| `contract:validators:event:{eventType}` | Serialized AJV validate function | 24 hours (production) |
| `contract:policies:hash` | SHA-256 of access-control.yaml + compiled rule set | No expiry |

Cache invalidation occurs on deployment (new contract hash). During development, hot-reload invalidates all cached validators.

---

## 5. Schema Generation Pipeline

### 5.1 Build-Time Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BUILD-TIME PIPELINE                           │
│                                                                     │
│  specs/contracts/openapi/*.yaml                                      │
│       │                                                             │
│       ├──► openapi-typescript ──► TypeScript types (.d.ts)          │
│       │         │                                                   │
│       │         └──► Used for compile-time type checking             │
│       │              (packages/contracts/src/generated/types/)      │
│       │                                                             │
│       ├──► openapi-to-json-schema ──► JSON Schema (Draft 2020-12)   │
│       │         │                                                   │
│       │         └──► AJV.compile() ──► Compiled validators           │
│       │              (packages/contracts/src/generated/validators/) │
│       │                                                             │
│       └──► openapi-zod ──► Zod schemas                              │
│                 │                                                   │
│                 └──► Used for ValidationPipe DTO validation          │
│                    (packages/contracts/src/generated/schemas/)      │
│                                                                     │
│  specs/contracts/events/event-schemas.yaml                          │
│       │                                                             │
│       └──► yaml→json schema ──► AJV.compile() ──► Event validators  │
│              (packages/contracts/src/generated/events/)             │
│                                                                     │
│  specs/contracts/policy/access-control.yaml                         │
│       │                                                             │
│       └──► yaml→PolicyRule[] ──► Compiled rule set                  │
│              (packages/contracts/src/generated/policies/)           │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 Generated Artifacts

| Artifact | Source | Target | Format |
|:---|:---|:---|:---|
| TypeScript Types | OpenAPI YAML | `packages/contracts/src/generated/types/{domain}.ts` | `.d.ts` |
| JSON Schema | OpenAPI YAML | `packages/contracts/src/generated/schemas/{domain}.json` | JSON Schema Draft 2020-12 |
| Compiled AJV Validators | JSON Schema | `packages/contracts/src/generated/validators/{domain}.ts` | TypeScript (AJV compiled) |
| Zod Schemas | OpenAPI YAML | `packages/contracts/src/generated/schemas/{domain}.zod.ts` | TypeScript (Zod) |
| Event Validators | `event-schemas.yaml` | `packages/contracts/src/generated/events/validators.ts` | TypeScript (AJV compiled) |
| Policy Rule Set | `access-control.yaml` | `packages/contracts/src/generated/policies/rule-set.ts` | TypeScript (PolicyRule[]) |

### 5.3 Generation Script

```bash
# packages/contracts/package.json
{
  "scripts": {
    "generate": "pnpm run generate:types && pnpm run generate:validators && pnpm run generate:events && pnpm run generate:policies",
    "generate:types": "openapi-typescript specs/contracts/openapi/*.yaml -o src/generated/types/",
    "generate:validators": "tsx scripts/generate-validators.ts",
    "generate:zod": "tsx scripts/generate-zod-schemas.ts",
    "generate:events": "tsx scripts/generate-event-validators.ts",
    "generate:policies": "tsx scripts/generate-policy-rules.ts",
    "verify": "tsx scripts/verify-contracts.ts"
  }
}
```

### 5.4 Verification Script

The `verify` script runs in CI and validates:

1. All OpenAPI specs parse without errors (yaml parse + openapi validation)
2. All JSON Schema conversions produce valid Draft 2020-12 schemas
3. All AJV compilations succeed (no schema errors)
4. All Zod schema generations produce valid Zod definitions
5. All event schemas parse and compile
6. All policy rules parse with valid operators and resource references
7. Generated files are up-to-date with sources (no uncommitted regen needed)

---

## 6. Fail-Closed Behavior

### 6.1 Default Deny Matrix

| Scenario | Behavior | HTTP Status | Log Level |
|:---|:---|:---|:---|
| Unknown endpoint (no OpenAPI operation found) | Return 404 | `404 Not Found` | INFO |
| Unknown field in request body | Return 422 with field detail | `422 Unprocessable Entity` | WARN |
| Unknown query parameter | Return 422 | `422 Unprocessable Entity` | WARN |
| Extra field in response (from controller) | Strip field before sending | N/A (response cleaned) | WARN |
| Missing required field in response | Return 500 (strict) or warn header | `500 Internal Server Error` | ERROR |
| Invalid event payload at producer | Throw EventContractError, reject emission | N/A (error to caller) | ERROR |
| Invalid event payload at consumer | Move to dead-letter queue | N/A (DLQ) | ERROR |
| No matching policy (unmapped resource) | Deny access | `403 Forbidden` | WARN |
| Policy condition with unresolvable variable | Deny access (fail-closed) | `403 Forbidden` | ERROR |
| SchemaRegistry not loaded (startup race) | Circuit open — reject all requests | `503 Service Unavailable` | ERROR |

### 6.2 Circuit Breaker

If the SchemaRegistry fails to load at application startup, CRBL enters a circuit-open state where all requests are rejected with `503 Service Unavailable`. This prevents serving traffic without contract enforcement — the system is safer dead than non-compliant.

```typescript
// In SchemaRegistry.onApplicationBootstrap():
async onApplicationBootstrap(): Promise<void> {
  try {
    await this.loadAllSchemas();
    this.ready = true;
    logger.info("SchemaRegistry loaded", this.healthCheck());
  } catch (error) {
    logger.fatal("SchemaRegistry failed to load — CRBL entering circuit-open state", { error });
    this.ready = false;
    // App continues running but all CRBL guards reject with 503
  }
}
```

All CRBL guards and interceptors check `schemaRegistry.isReady()` before performing validation. If not ready, they reject immediately.

### 6.3 Graceful Degradation

In `warn` mode (configurable via environment variable `CRBL_MODE=warn` for development), CRBL logs violations but does not block requests. This is useful for development and integration testing but must never be used in production.

```typescript
const CRBL_MODE = process.env.CRBL_MODE || "strict";
if (CRBL_MODE === "warn") {
  logger.warn("CRBL running in WARN mode — contract violations will not block requests");
}
```

---

## 7. Performance Budget

### 7.1 Latency Targets

| Component | Target (p95) | Measurement Method |
|:---|:---|:---|
| AuthGuard (JWT verify) | < 1ms | JWT signature verification is O(1) |
| PolicyGuard (RBAC evaluation) | < 1ms | Rule set is in-memory, priority-sorted lookup |
| ContractGuard (AJV body validate) | < 3ms | Compiled AJV, no re-compilation |
| ValidationPipe (Zod validate) | < 2ms | Zod parse after body already validated |
| ContractInterceptor (AJV response validate) | < 2ms | Response bodies typically smaller than requests |
| **Total CRBL overhead** | **< 5ms p95** | Sum of parallel stages minus overlap |
| EventValidator (pre-enqueue) | < 2ms | Compiled AJV, async validation |
| EventValidator (consumer middleware) | < 2ms | Re-validated for defense-in-depth |

### 7.2 Performance Strategy

1. **AJV Compiled Schemas.** AJV's `compile()` function generates optimized JavaScript validation functions. These are cached in Redis across process restarts and in memory per process. A compiled validator runs in microseconds, not milliseconds.

2. **Schema Caching.** Raw OpenAPI YAML is parsed once at startup. Compiled AJV validators are serialized and stored in Redis. On warm restarts, validators are deserialized from Redis instead of recompiled.

3. **Lazy Loading.** AJV validators for infrequently hit endpoints are compiled on first access and then cached. The SchemaRegistry uses an LRU cache with max 500 entries for the most frequently accessed validators.

4. **Parallel Validation.** AuthGuard and PolicyGuard execute before ContractGuard but do not involve schema compilation — they check in-memory data. The ContractGuard's AJV validation is the only component with measurable CPU cost.

5. **Zod as Second Pass.** The ValidationPipe's Zod validation runs only after ContractGuard's AJV validation has already passed. Most invalid inputs are caught by AJV. Zod is the defense-in-depth layer.

### 7.3 Monitoring

```typescript
// Prometheus metrics exposed by CRBL
const contractValidationDuration = new Histogram({
  name: "crbl_validation_duration_seconds",
  help: "Contract validation duration in seconds",
  labelNames: ["component", "method", "path"],
  buckets: [0.0001, 0.0005, 0.001, 0.002, 0.005, 0.01, 0.025, 0.05, 0.1],
});

const contractViolationsTotal = new Counter({
  name: "crbl_violations_total",
  help: "Total contract violations",
  labelNames: ["component", "method", "path", "reason"],
});
```

Alert threshold: `crbl_validation_duration_seconds{quantile="0.95"} > 0.005` triggers a warning. Continuous exceeding of the 5ms budget requires investigation.

---

## 8. CI/CD Integration

### 8.1 Contract Test Generation

Contract tests are automatically generated from OpenAPI specs. For each endpoint, the following test cases are derived:

```typescript
// Generated for POST /auth/register
describe("POST /api/v1/auth/register — Contract Tests", () => {
  it("should return 201 for valid registration request", async () => {
    // Uses the OpenAPI example payload from the spec
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send(validRegisterRequest)
      .expect(201);
    // Validate response matches AuthResponse schema
    validateResponse("AuthResponse", response.body);
  });

  it("should return 422 when required field 'email' is missing", async () => {
    const { email, ...invalid } = validRegisterRequest;
    await request(app)
      .post("/api/v1/auth/register")
      .send(invalid)
      .expect(422)
      .expect(res => {
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
        expect(res.body.error.details).toContainEqual(
          expect.objectContaining({ field: "email" })
        );
      });
  });

  it("should return 422 when password does not match pattern", async () => {
    await request(app)
      .post("/api/v1/auth/register")
      .send({ ...validRegisterRequest, password: "weak" })
      .expect(422);
  });

  it("should return 429 when rate limit exceeded", async () => {
    for (let i = 0; i < 4; i++) {
      await request(app).post("/api/v1/auth/register").send(validRegisterRequest);
    }
    await request(app).post("/api/v1/auth/register").send(validRegisterRequest).expect(429);
  });
});
```

### 8.2 CI Pipeline Steps

```yaml
# .github/workflows/contracts.yml
name: Contract Verification
on: [push, pull_request]

jobs:
  contract-checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4

      - name: Verify contract schema compilation
        run: pnpm --filter @alharistech/contracts run verify

      - name: Check generated files are up-to-date
        run: pnpm --filter @alharistech/contracts run generate && git diff --exit-code packages/contracts/src/generated/

      - name: Run contract tests
        run: pnpm --filter @alharistech/contracts run test:contracts

      - name: Validate policy rule completeness
        run: pnpm --filter @alharistech/contracts run verify:policies

      - name: Lint CRBL code
        run: pnpm run lint --filter @alharistech/contracts

      - name: Typecheck
        run: pnpm run typecheck --filter @alharistech/contracts
```

### 8.3 Policy Completeness Verification

The `verify:policies` script checks:
1. Every API endpoint defined in OpenAPI specs has at least one matching policy rule (except `security: []` public endpoints)
2. Every policy resource reference matches a declared resource in the access-control.yaml resource mapping
3. Every condition variable (`$caller.*`, `$resource.*`) is resolvable by the PolicyGuard
4. No duplicate policies (same roles + resource + action combination)
5. Default deny (priority 0) is present

---

## 9. Testing Strategy

### 9.1 Test Categories

| Category | Scope | Tools | Coverage Target |
|:---|:---|:---|:---|
| **Unit Tests** | Individual CRBL components (guards, interceptors, validators) | Vitest | ≥ 90% line coverage |
| **Integration Tests** | CRBL pipeline end-to-end (AuthGuard → PolicyGuard → ContractGuard → Controller → ContractInterceptor) | Vitest + Supertest | ≥ 80% branch coverage |
| **Contract Tests** | Auto-generated from OpenAPI specs (valid/invalid requests, error envelopes) | Vitest + Supertest | 100% of endpoints |
| **Event Contract Tests** | Event schema validation with valid/invalid payloads | Vitest + BullMQ test helpers | 100% of event types |
| **Policy Tests** | RBAC policy evaluation with all roles, resources, actions | Vitest | 100% of policy rules |
| **Performance Tests** | P95 latency under load | k6 / autocannon | < 5ms CRBL overhead |

### 9.2 Contract Test Auto-Generation

```typescript
// scripts/generate-contract-tests.ts
// Parses all OpenAPI specs and generates:
// 1. Valid request → expected 2xx
// 2. Required field missing → 422 with field detail
// 3. Invalid field format → 422 with format detail
// 4. Missing auth (if endpoint has security) → 401
// 5. Insufficient role → 403
// 6. Unknown field in request → 422 (forbidNonWhitelisted)

for (const [path, methods] of Object.entries(spec.paths)) {
  for (const [method, operation] of Object.entries(methods)) {
    generateHappyPathTest(method, path, operation);
    generateValidationTests(method, path, operation);
    if (operation.security) {
      generateAuthTest(method, path, operation);
      generateAuthorizationTest(method, path, operation);
    }
  }
}
```

### 9.3 Event Contract Test Pattern

```typescript
describe("Event Contracts", () => {
  describe("identity.user.registered", () => {
    const validPayload = {
      userId: "018f9a92-3c5f-7a8b-9c0d-1e2f3a4b5c6d",
      email: "test@example.com",
      role: "customer",
      timestamp: "2026-06-20T12:00:00Z",
    };

    it("should accept valid payload", () => {
      const result = eventValidator.validate("identity.user.registered", validPayload);
      expect(result.valid).toBe(true);
    });

    it("should reject payload missing required field userId", () => {
      const { userId, ...invalid } = validPayload;
      const result = eventValidator.validate("identity.user.registered", invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ keyword: "required", params: { missingProperty: "userId" } })
      );
    });

    it("should reject payload with invalid role enum", () => {
      const result = eventValidator.validate("identity.user.registered", {
        ...validPayload,
        role: "superadmin",
      });
      expect(result.valid).toBe(false);
    });
  });
});
```

### 9.4 Policy Test Pattern

```typescript
describe("PolicyGuard", () => {
  const adminContext: CallerContext = { id: "admin-1", role: "admin", ip: "127.0.0.1" };
  const managerContext: CallerContext = { id: "mgr-1", role: "manager", ip: "127.0.0.1" };
  const customerContext: CallerContext = {
    id: "cust-1",
    role: "customer",
    customerId: "cust-profile-1",
    ip: "127.0.0.1",
  };
  const anonymousContext: CallerContext = { id: "", role: "*", ip: "127.0.0.1" };

  it("should allow admin to read any user", () => {
    const result = policyGuard.evaluate(adminContext, "identity:users", "read");
    expect(result.allowed).toBe(true);
  });

  it("should deny customer reading another customer's data", () => {
    const result = policyGuard.evaluate(customerContext, "customer:customers", "read");
    expect(result.allowed).toBe(true); // condition check happens at runtime
  });

  it("should deny anonymous user reading users", () => {
    const result = policyGuard.evaluate(anonymousContext, "identity:users", "read");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("default deny (priority 0)");
  });
});
```

---

## 10. Folder Structure

```
packages/contracts/
├── package.json                          # @alharistech/contracts
├── tsconfig.json                         # Extends @alharistech/config/typescript/base.json
├── vitest.config.ts
├── spec/
│   └── crbl-architecture.md              # This document
├── scripts/
│   ├── generate-types.ts                 # openapi-typescript codegen
│   ├── generate-validators.ts            # OpenAPI → AJV compiled validators
│   ├── generate-zod-schemas.ts           # OpenAPI → Zod schemas
│   ├── generate-event-validators.ts      # event-schemas.yaml → AJV validators
│   ├── generate-policy-rules.ts          # access-control.yaml → PolicyRule[]
│   ├── generate-contract-tests.ts        # Auto-generate contract tests
│   ├── verify-contracts.ts               # CI verification script
│   └── verify-policies.ts                # Policy completeness check
├── src/
│   ├── index.ts                          # Barrel export
│   ├── guards/
│   │   ├── contract.guard.ts             # ContractGuard — request body/params/query validation
│   │   ├── contract.guard.spec.ts
│   │   └── skip-contract.decorator.ts    # @SkipContractValidation() decorator
│   ├── interceptors/
│   │   ├── contract.interceptor.ts       # ContractInterceptor — response validation
│   │   ├── contract.interceptor.spec.ts
│   │   └── response-stripper.ts          # Extra field removal logic
│   ├── pipes/
│   │   ├── contract-validation.pipe.ts   # ValidationPipe — Zod DTO validation
│   │   └── contract-validation.pipe.spec.ts
│   ├── policies/
│   │   ├── policy.guard.ts               # PolicyGuard — RBAC evaluation
│   │   ├── policy.guard.spec.ts
│   │   ├── require-policy.decorator.ts   # @RequirePolicy() decorator
│   │   ├── policy-evaluator.ts           # Priority-based evaluation engine
│   │   ├── context-resolver.ts           # $caller.*, $resource.* variable resolution
│   │   └── types.ts                      # PolicyRule, CallerContext, Condition, etc.
│   ├── events/
│   │   ├── event-validator.ts            # EventValidator — pre-enqueue + consumer middleware
│   │   ├── event-validator.spec.ts
│   │   ├── validate-event.decorator.ts   # @ValidateEvent() decorator
│   │   └── dead-letter.service.ts        # DLQ management
│   ├── registry/
│   │   ├── schema-registry.ts            # SchemaRegistry — central registry
│   │   ├── schema-registry.spec.ts
│   │   ├── openapi-loader.ts             # OpenAPI YAML → parsed spec
│   │   ├── event-schema-loader.ts        # event-schemas.yaml → parsed schemas
│   │   ├── policy-loader.ts             # access-control.yaml → parsed rules
│   │   └── cache.ts                     # Redis cache integration
│   ├── errors/
│   │   ├── contract-validation.error.ts  # ContractValidationException
│   │   ├── event-contract.error.ts       # EventContractError
│   │   └── schema-registry.error.ts      # SchemaRegistryError
│   ├── metrics/
│   │   └── crbl-metrics.ts              # Prometheus histograms and counters
│   └── generated/                        # ⚠️ AUTO-GENERATED — DO NOT EDIT
│       ├── types/                        # TypeScript types from OpenAPI
│       │   ├── identity.d.ts
│       │   ├── customer.d.ts
│       │   ├── service.d.ts
│       │   ├── commerce.d.ts
│       │   ├── support.d.ts
│       │   ├── content.d.ts
│       │   ├── notification.d.ts
│       │   ├── analytics.d.ts
│       │   └── ai.d.ts
│       ├── schemas/                      # Zod schemas from OpenAPI
│       │   ├── identity.zod.ts
│       │   ├── customer.zod.ts
│       │   └── ...
│       ├── validators/                   # AJV compiled validators
│       │   ├── identity.validators.ts
│       │   ├── customer.validators.ts
│       │   └── ...
│       ├── events/
│       │   └── validators.ts             # AJV compiled event validators
│       └── policies/
│           └── rule-set.ts               # Compiled policy rule set
└── __tests__/
    ├── contract-tests/                   # Auto-generated contract tests
    │   ├── identity.contract.test.ts
    │   ├── customer.contract.test.ts
    │   └── ...
    ├── event-tests/                      # Auto-generated event contract tests
    │   ├── identity.events.test.ts
    │   ├── customer.events.test.ts
    │   └── ...
    └── policy-tests/                     # Auto-generated policy tests
        ├── identity.policy.test.ts
        └── ...
```

---

## 11. Security Considerations

### 11.1 Input Validation Depth

CRBL provides defense-in-depth input validation:
1. **Layer 1:** ContractGuard validates against OpenAPI schema (structure, types, formats)
2. **Layer 2:** ValidationPipe validates against Zod schema (business rules, cross-field constraints)
3. **Layer 3:** Domain services apply business logic validation
4. **Layer 4:** Drizzle ORM parameterizes all queries (SQL injection prevention per security-standards.md)

### 11.2 Schema Injection Prevention

```typescript
// SchemaRegistry validates loaded schemas before compilation:
// - No external $ref (references must be within the same document or the components bundle)
// - Max schema depth: 10 (prevents recursive schema DoS)
// - Max schema properties: 200 (prevents schema bloat)
// - Reject schemas with eval() or Function() patterns in validation keywords
```

### 11.3 Error Message Sanitization

CRBL error responses must not leak internal implementation details:
- Validation errors reference schema field names, not database column names
- Stack traces are never included in API responses (handled by global exception filter per coding-standards.md)
- Internal AJV errors are mapped to user-friendly `ErrorResponse` envelopes before serialization

### 11.4 Rate Limiting Integration

CRBL components run before domain controllers but after NestJS throttler (rate limiter). This ensures:
- Rate limiting blocks abusive requests before CRBL expends CPU on contract validation
- Contract validation errors are not counted against the caller's rate limit (they are a separate metric)
- Rate limit responses use the standard `ErrorResponse` envelope with `429` status code

---

## 12. Operational Concerns

### 12.1 Startup Sequence

```
1. NestJS application bootstrap
2. ConfigModule loaded (env vars, Redis URL, DB URL)
3. SchemaRegistry.onApplicationBootstrap():
   a. Load all OpenAPI YAML files from specs/contracts/openapi/
   b. Load event-schemas.yaml from specs/contracts/events/
   c. Load access-control.yaml from specs/contracts/policy/
   d. Check Redis for cached validators
   e. Compile uncached validators
   f. Store compiled validators in Redis
   g. Set ready = true
4. Global guards, interceptors, pipes registered
5. HTTP server starts listening
```

### 12.2 Memory Footprint

| Artifact | Memory (Estimate) |
|:---|:---|
| Parsed OpenAPI specs (9 files) | ~2 MB |
| Compiled AJV validators (~200) | ~5 MB |
| Policy rule set (162 rules) | ~0.5 MB |
| LRU validator cache (500 entries) | ~10 MB |
| **Total CRBL memory** | **~20 MB** |

### 12.3 Logging

CRBL uses the platform logger (`@alharistech/logger`) with structured JSON format:

```json
{
  "level": "warn",
  "msg": "Contract violation — unknown field in request body",
  "context": "ContractGuard",
  "method": "POST",
  "path": "/api/v1/auth/register",
  "location": "body",
  "unknownFields": ["unexpectedField"],
  "requestId": "018f9a92-3c5f-7a8b-9c0d-1e2f3a4b5c6d",
  "timestamp": "2026-06-20T12:00:00Z"
}
```

Sensitive fields (password, token, secret) are redacted before logging per security-standards.md.

### 12.4 Health Check

```typescript
// Exposed at /api/v1/health/contracts
@Get("health/contracts")
async healthCheck(): Promise<CRBLHealthResponse> {
  return {
    status: this.schemaRegistry.isReady() ? "healthy" : "unhealthy",
    openApiSpecsLoaded: 9,
    eventSchemasLoaded: 94,
    policyRulesLoaded: 162,
    cachedValidators: await this.schemaRegistry.countCachedValidators(),
    mode: CRBL_MODE,
  };
}
```

### 12.5 Rollback Strategy

If a contract update introduces bugs:
1. CI/CD gate prevents deployment if `verify-contracts` fails
2. If a compiled validator causes false rejections in production:
   - Set `CRBL_MODE=warn` temporarily to log violations without blocking
   - Roll back the contract file via git revert
   - Re-deploy — SchemaRegistry loads new (old) contracts
   - Set `CRBL_MODE=strict`

### 12.6 Graceful Shutdown

```typescript
@Injectable()
export class SchemaRegistry implements OnApplicationShutdown {
  async onApplicationShutdown(signal?: string): Promise<void> {
    logger.info("SchemaRegistry shutting down", { signal });
    this.ready = false;
    // In-flight requests complete with existing cached validators
    // New requests rejected with 503
  }
}
```

---

## Appendix A: Contract File References

| Contract File | CRBL Component | Description |
|:---|:---|:---|
| `specs/contracts/openapi/identity-api.yaml` | ContractGuard, ContractInterceptor, ValidationPipe | 184 CRUD operations across 9 OpenAPI specs |
| `specs/contracts/events/event-schemas.yaml` | EventValidator | 94 domain events with JSON Schema definitions |
| `specs/contracts/policy/access-control.yaml` | PolicyGuard | 162 RBAC policy rules with priority-based evaluation |
| `specs/contracts/execution-boundaries.yaml` | (Reference) | Defines where CRBL runs (NestJS API Gateway layer) |

## Appendix B: Technology Rationale

| Technology | Purpose | Rationale |
|:---|:---|:---|
| AJV 8 | JSON Schema validation | Fastest JSON Schema validator for Node.js. Compiled mode achieves sub-ms validation for typical payloads. |
| Zod 3 | DTO validation | TypeScript-first schema validation with excellent type inference. Used as the second validation pass after AJV. |
| openapi-typescript | Type generation | Generates TypeScript types from OpenAPI specs — enables compile-time contract checking. |
| BullMQ | Event queue | Already adopted (ADR-009). CRBL uses BullMQ worker middleware for event validation. |
| Redis 7 | Validator cache | Already adopted (ADR-004). Caches compiled AJV validators for fast warm restarts. |

## Appendix C: Related Decisions

- [ADR-002: NestJS for Backend Services](../../docs/adr/adr-002-nestjs-backend.md) — NestJS guards, interceptors, and pipes are the CRBL extension points
- [ADR-004: Redis for Caching & Sessions](../../docs/adr/adr-004-redis.md) — Redis caches compiled AJV validators
- [ADR-009: BullMQ for Background Jobs](../../docs/adr/adr-009-bullmq.md) — BullMQ worker middleware for event validation
- [ADR-015: OpenAPI/Swagger Documentation](../../docs/adr/adr-015-openapi-swagger.md) — OpenAPI is the contract source of truth
- [ADR-017: Drizzle ORM](../../docs/adr/adr-017-orm-drizzle.md) — Database layer below CRBL; CRBL validates before data reaches ORM
- [ADR-021: Contract Runtime Bridge Layer](../../docs/adr/adr-021-contract-runtime-bridge.md) — This design is formalized in ADR-021
