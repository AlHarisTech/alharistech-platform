# ContractPipe Specification

## Status: Design Specification (Sprint 0.5/1)

---

## 1. Overview

**Component:** `ContractPipe`
**Type:** NestJS Pipe (`PipeTransform`)
**Purpose:** Provides DTO validation using Zod schemas auto-generated from OpenAPI 3.1 specifications. Sits between ContractGuard (request body schema validation) and the controller, providing strongly-typed, parsed, and validated DTO objects. Generates human-readable bilingual (Arabic + English) error messages.

**Relationship to ContractGuard:** ContractGuard validates raw request data against JSON Schema (OpenAPI). ContractPipe provides Zod-based validation with type coercion and transformation. Both can coexist — ContractGuard for structural validation, ContractPipe for type-safe DTO transformation. In many cases, ContractPipe alone is sufficient for DTO validation because Zod schemas are more expressive than JSON Schema for coercion and transformation.

**Source of truth:** OpenAPI schemas → Zod schemas (generated via `openapi-zod` or custom generator). One Zod schema per request/response DTO.

---

## 2. Interface

### 2.1 NestJS Interface

Implements `PipeTransform` from `@nestjs/common`:

```
class ContractPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata): any
}
```

### 2.2 Registration

Applied via `@UsePipes(ContractPipe)` on controllers or globally via `APP_PIPE`:

```
// Global registration in main.ts
app.useGlobalPipes(new ContractPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
}));

// Per-controller or per-route
@UsePipes(new ContractPipe({ schema: CreateUserDtoSchema }))
@Post()
async create(@Body() dto: CreateUserDto) { ... }
```

### 2.3 Decorators

| Decorator | Purpose |
|:---|:---|
| `@ZodSchema(schema)` | Explicitly specify the Zod schema for this handler when auto-detection is insufficient |
| `@SkipContractPipe()` | Skip Zod validation for this handler (e.g., raw body passthrough for webhooks) |
| `@ValidateQuery()` | Mark specific query parameter DTO for Zod validation |
| `@ValidateParams()` | Mark specific path parameter DTO for Zod validation |

---

## 3. Behavior

### 3.1 Pipe Flow

```
Request (after ContractGuard passes)
  │
  ├─ 1. Argument Detection
  │     Check metadata.type: 'body' | 'query' | 'param' | 'custom'
  │     If @SkipContractPipe() → return value unchanged
  │     If metadata.metatype is primitive (String, Number) → return value unchanged
  │
  ├─ 2. Schema Resolution
  │     If @ZodSchema(schema) → use provided schema
  │     Otherwise:
  │       Extract DTO class from metadata.metatype
  │       Look up Zod schema from generated schema registry:
  │         registry.getSchema(metadata.metatype.name)
  │       Maps DTO class names to Zod schemas:
  │         CreateUserDto → CreateUserDtoSchema
  │         LoginRequestDto → LoginRequestDtoSchema
  │
  ├─ 3. Validation
  │     Run schema.parse(value) or schema.safeParse(value)
  │     Zod performs:
  │       - Type coercion (string → number, string → Date, string → boolean)
  │       - Required field validation
  │       - Format validation (email, uuid, date-time)
  │       - Enum validation
  │       - Min/max constraints
  │       - Pattern/regex validation
  │       - Custom refinements and transformations
  │
  ├─ 4. Result
  │     Valid:
  │       Return typed and coerced DTO object
  │       The returned value has the correct TypeScript type (z.infer<typeof schema>)
  │
  │     Invalid:
  │       Transform ZodError → standard error envelope
  │       Throw ContractValidationException (422)
  │       Each Zod issue → one field-level error detail
  │       Field paths preserved (nested: "address.street")
  │
  └─ Error:
       Schema not found → log warning, return value unchanged (fail-safe for pipes)
```

### 3.2 Schema Generation

Zod schemas are generated from OpenAPI at build time (or during `onModuleInit` in dev mode):

**Source:** `specs/contracts/openapi/{domain}-api.yaml` → `#/components/schemas/*`

**Generation tool:** `openapi-zod` library or custom script that:
1. Parses each OpenAPI YAML file
2. Iterates over `components.schemas`
3. Generates a Zod schema for each schema definition:

| OpenAPI/JSON Schema | Zod Equivalent |
|:---|:---|
| `type: string` | `z.string()` |
| `type: string, format: email` | `z.string().email()` |
| `type: string, format: uuid` | `z.string().uuid()` |
| `type: string, format: date-time` | `z.string().datetime()` |
| `type: string, minLength, maxLength` | `z.string().min(n).max(m)` |
| `type: string, pattern` | `z.string().regex(/pattern/)` |
| `type: number` | `z.number()` |
| `type: integer` | `z.number().int()` |
| `type: integer, minimum, maximum` | `z.number().int().min(n).max(m)` |
| `type: boolean` | `z.boolean()` |
| `type: array, items` | `z.array(itemsSchema)` |
| `type: object, properties` | `z.object({...})` |
| `required` | Automatic from `z.object()` shape |
| `nullable: true` | `.nullable()` |
| `enum` | `z.enum([...])` |
| `allOf` | `.merge()` or `.and()` |
| `oneOf` | `z.discriminatedUnion()` or `z.union()` |
| `anyOf` | `z.union()` |
| `default` | `.default(value)` |
| `enum, nullable` (union type) | `z.enum([...]).nullable()` |
| `description` | `.describe("...")` |

**Output location:** `packages/contracts/src/generated/schemas/{domain}/{SchemaName}.ts`

### 3.3 Zod Validation Configuration

| Option | Value | Rationale |
|:---|:---|:---|
| `coerce` | `true` | Auto-coerce strings to numbers/booleans per schema |
| `strict` | `false` | Don't strip unknown keys at Zod level (ContractGuard handles this) |
| `errorMap` | Custom | Bilingual (ar/en) error messages |
| `abortEarly` | `false` | Return all validation errors, not just first |

### 3.4 Custom Error Messages (Bilingual)

Each Zod validation issue is mapped to Arabic + English messages:

| Zod Issue | Error Code | English Message | Arabic Message |
|:---|:---|:---|:---|
| `invalid_type` (expected string) | `INVALID_TYPE` | `"{field}" must be a string` | `"{field}" يجب أن يكون نصاً` |
| `invalid_type` (expected number) | `INVALID_TYPE` | `"{field}" must be a number` | `"{field}" يجب أن يكون رقماً` |
| `invalid_type` (expected boolean) | `INVALID_TYPE` | `"{field}" must be true or false` | `"{field}" يجب أن يكون صح أو خطأ` |
| `too_small` (string min) | `TOO_SHORT` | `"{field}" must be at least {minimum} characters` | `"{field}" يجب أن يكون {minimum} أحرف على الأقل` |
| `too_big` (string max) | `TOO_LONG` | `"{field}" must be at most {maximum} characters` | `"{field}" يجب أن يكون {maximum} حرفاً على الأكثر` |
| `too_small` (number min) | `BELOW_MINIMUM` | `"{field}" must be >= {minimum}` | `"{field}" يجب أن يكون >= {minimum}` |
| `too_big` (number max) | `ABOVE_MAXIMUM` | `"{field}" must be <= {maximum}` | `"{field}" يجب أن يكون <= {maximum}` |
| `invalid_string` (email) | `INVALID_EMAIL` | `"{field}" must be a valid email` | `"{field}" يجب أن يكون بريداً إلكترونياً صحيحاً` |
| `invalid_string` (uuid) | `INVALID_UUID` | `"{field}" must be a valid UUID` | `"{field}" يجب أن يكون معرفاً فريداً صحيحاً` |
| `invalid_string` (datetime) | `INVALID_DATETIME` | `"{field}" must be a valid ISO 8601 datetime` | `"{field}" يجب أن يكون تاريخاً ووقتاً صحيحاً` |
| `invalid_enum_value` | `INVALID_ENUM` | `"{field}" must be one of: {options}` | `"{field}" يجب أن يكون أحد القيم: {options}` |
| `unrecognized_keys` | `UNKNOWN_FIELD` | `Field "{field}" is not allowed` | `الحقل "{field}" غير مسموح به` |
| `custom` (regex) | `PATTERN_MISMATCH` | `"{field}" format is invalid` | `صيغة "{field}" غير صحيحة` |

Message catalog must support variable interpolation for `{field}`, `{minimum}`, `{maximum}`, `{options}`.

### 3.5 Type Coercion

Coercion is applied per-field based on the schema type:

| Schema Type | Coercion Rule | Example |
|:---|:---|:---|
| `number` / `integer` | Parse string → number | `"5"` → `5`, `"invalid"` → error |
| `boolean` | Parse `"true"/"false"/"1"/"0"` → boolean | `"true"` → `true` |
| `string (date-time)` | Parse ISO 8601 → Date | `"2026-06-20T12:00:00Z"` → Date |
| `string (uuid)` | Validate format only, stay string | UUID string stays string |
| `string (email)` | Trim + lowercase | `" User@Example.COM "` → `"user@example.com"` |
| `string (other)` | Trim whitespace | `"  hello  "` → `"hello"` |

Coercion is opt-in per schema: `z.coerce.string()`, `z.coerce.number()`, etc. The code generator adds `coerce` where appropriate based on the OpenAPI spec and `x-coerce: true` extension.

---

## 4. Error Format

### 4.1 Standard Error Envelope

Uses the same error format as ContractGuard (Section 4 of contract-guard.md):

```yaml
error:
  code: "VALIDATION_ERROR"
  message: "فشل التحقق من صحة الطلب"
  message_en: "Request validation failed"
  statusCode: 422
  details:
    - field: "first_name_ar"
      code: "TOO_SHORT"
      message_ar: "الاسم الأول يجب أن يكون حرفاً واحداً على الأقل"
      message_en: "First name must be at least 1 character"
      received: ""
    - field: "email"
      code: "INVALID_EMAIL"
      message_ar: "البريد الإلكتروني يجب أن يكون صحيحاً"
      message_en: "Email must be a valid email address"
      received: "not-an-email"
    - field: "role"
      code: "INVALID_ENUM"
      message_ar: "الدور يجب أن يكون أحد القيم: admin, manager, employee, customer, partner"
      message_en: "Role must be one of: admin, manager, employee, customer, partner"
      received: "superadmin"
meta:
  timestamp: "2026-06-20T12:00:00Z"
  requestId: "018f9a92-3c5f-7a8b-9c0d-1e2f3a4b5c6d"
```

### 4.2 Nested Field Paths

For nested objects, field paths use dot notation:

```
field: "address.city"
field: "items.0.productId"
field: "user.profile.phone"
```

### 4.3 Sensitive Field Redaction

Fields with `format: password` or `x-sensitive: true` have their `received` value replaced with `"***"` in error details.

---

## 5. Performance Budget

| Metric | Target | Notes |
|:---|:---|:---|
| Pipe overhead (typical DTO) | ≤ 2ms | 5-10 fields, no nesting |
| Pipe overhead (complex DTO) | ≤ 5ms | 20+ fields, nested objects |
| Zod parse (small) | < 1ms | Schema with 5 fields |
| Zod parse (medium) | < 2ms | Schema with 15 fields |
| Zod parse (large) | < 5ms | Schema with 50+ fields, deep nesting |
| Schema generation (build time) | < 2s | Generate all 149 endpoint schemas |

**Note:** ContractPipe is typically ~2x faster than ContractGuard for DTO validation because Zod's validation engine is optimized for TypeScript and avoids JSON Schema's pointer resolution overhead. For endpoints that use ContractPipe with Zod schemas, ContractGuard may be disabled via `@SkipContractValidation()`.

---

## 6. Configuration

### 6.1 Environment Variables

| Variable | Type | Default | Description |
|:---|:---|:---|
| `CONTRACT_PIPE_STRICT` | boolean | `true` | Reject unknown fields (true) or strip them (false) |
| `CONTRACT_PIPE_COERCE` | boolean | `true` | Enable type coercion |
| `CONTRACT_PIPE_LOCALE` | `ar` \| `en` \| `ar,en` | `ar` | Primary error message language |

### 6.2 Pipe Options

```
interface ContractPipeOptions {
  strict: boolean;                    // Default: true
  coerce: boolean;                    // Default: true
  whitelist: boolean;                 // Default: true — strip unknown props
  forbidNonWhitelisted: boolean;      // Default: true — error on unknown props
  transform: boolean;                 // Default: true — transform to DTO class instance
  locale: 'ar' | 'en';               // Default: from Accept-Language header
  schemaRegistry: ZodSchemaRegistry;  // Auto-resolved if not provided
}
```

---

## 7. Integration Points

| System | Direction | Purpose |
|:---|:---|:---|
| SchemaRegistry | Reads | Get Zod schema for DTO class |
| OpenAPI specs | Source | Generated Zod schemas derived from OpenAPI schemas |
| Logger | Writes | Log validation errors at INFO level |
| ExceptionFilter | Throw | ContractValidationException(422) |

### 7.1 Relation to ContractGuard

```
Request → ContractGuard (JSON Schema, structural validation, 5ms budget)
        → ContractPipe  (Zod schema, typed validation + coercion, 2ms budget)
        → Controller
```

ContractGuard and ContractPipe can coexist. ContractGuard validates all routes globally; ContractPipe is applied per-controller for DTO transformation. For performance-critical endpoints, use ContractPipe without ContractGuard.

---

## 8. Testing Strategy

### 8.1 Unit Tests

| Test | Description |
|:---|:---|
| `should parse valid DTO and return typed object` | Valid CreateUserDto → typed object returned |
| `should reject missing required field` | Missing email → 422 with REQUIRED error |
| `should reject invalid email format` | Bad email → 422 with INVALID_EMAIL |
| `should coerce string "5" to number 5` | Query param string → coerced to number |
| `should coerce "true" to boolean true` | Query param string → coerced to boolean |
| `should reject value outside enum` | Invalid role → 422 with INVALID_ENUM |
| `should reject string below minLength` | Short name → 422 with TOO_SHORT |
| `should reject number below minimum` | Negative page → 422 with BELOW_MINIMUM |
| `should reject unknown field in strict mode` | Extra field → 422 with UNKNOWN_FIELD |
| `should return all errors (not just first)` | Multiple invalid fields → all reported |
| `should return bilingual error messages` | Error → message (ar) + message_en |
| `should pass through when schema not found` | Unknown DTO → return value unchanged |
| `should skip on @SkipContractPipe()` | Marked handler → return value unchanged |

### 8.2 Integration Tests

| Test | Description |
|:---|:---|
| `should validate all DTOs from identity-api.yaml` | RegisterRequest, LoginRequest, etc. |
| `should not exceed 2ms for typical DTO` | Benchmark with 10-field DTO |
| `should handle concurrent validation` | Multiple concurrent pipe instances |

### 8.3 Schema Generation Tests

| Test | Description |
|:---|:---|
| `should generate Zod schema for all OpenAPI schemas` | Every components/schemas/* in all 9 specs |
| `should handle allOf/oneOf/anyOf correctly` | Complex schema composition |
| `should preserve Arabic descriptions` | description fields in Arabic carried over |
| `generated schemas should compile without TypeScript errors` | TypeScript typecheck on generated code |

---

## 9. Dependencies

### 9.1 Runtime Dependencies

| Package | Version | Purpose |
|:---|:---|:---|
| `zod` | ^3.22+ | Schema definition and validation |
| `@nestjs/common` | ^10.x | Pipe lifecycle, decorators |
| `zod-i18n-map` | (optional) | Pre-built i18n error maps for Zod |

### 9.2 Dev/Build Dependencies

| Package | Version | Purpose |
|:---|:---|:---|
| `openapi-zod` | ^0.x | OpenAPI → Zod schema generation |
| `openapi-typescript` | ^7.x | OpenAPI → TypeScript type generation |

---

## 10. Implementation Notes

### 10.1 Schema Registry for Zod

The Zod schema registry is separate from the AJV validator cache. It maps TypeScript DTO class names to Zod schemas:

```
// packages/contracts/src/generated/schema-registry.ts
export const zodSchemaRegistry = new Map<string, ZodType<any>>([
  ["CreateUserDto", CreateUserDtoSchema],
  ["LoginRequestDto", LoginRequestDtoSchema],
  ["UpdateProfileDto", UpdateProfileDtoSchema],
  // ... all DTOs from all 9 domains
]);
```

The registry is generated at build time by scanning all Domain API YAML files.

### 10.2 Transform vs Validate

ContractPipe does more than validation — it transforms the input data into a typed DTO. This is the key difference from ContractGuard which only validates:

- ContractGuard: "Is this request structurally valid?" → pass/fail
- ContractPipe: "Give me a typed, coerced, validated DTO" → typed object

This makes ContractPipe ideal for use with class-validator alternatives and for TypeScript type narrowing in controllers.

### 10.3 Incremental Adoption

Teams can adopt ContractPipe incrementally:
1. Start with global ContractGuard for all endpoints (structural validation)
2. Add ContractPipe per-controller for type-safe DTOs
3. For endpoints with both, ContractGuard runs first (structural), then ContractPipe (typed)
4. Eventually, ContractPipe can replace ContractGuard for DTO-heavy endpoints

### 10.4 Combined Validation Strategy

| Endpoint Type | ContractGuard | ContractPipe | Notes |
|:---|:---|:---|:---|
| Public POST/PATCH with DTO | Enabled | Enabled | Full validation |
| Public GET with query params | Enabled | Enabled | Query param validation |
| Public GET without params | Disabled | Disabled | No input to validate |
| Internal webhook | Disabled | Enabled | Raw body → Zod DTO |
| File upload | Disabled | Disabled | Multer handles multipart |
| Admin-only endpoints | Enabled | Enabled | Full validation |

### 10.5 Security Considerations

- **Schema injection:** Generated Zod schemas are static code — no runtime schema parsing that could be exploited
- **Regex DoS:** Ensure Zod regex patterns use safe (non-catastrophic-backtracking) expressions
- **No schema introspection in errors:** Error messages describe what's wrong, not the full schema structure

### 10.6 Future Considerations

- **Runtime schema discovery:** Load Zod schemas from OpenAPI at runtime (instead of build-time generation) for dynamic endpoints
- **Schema-based test generation:** Generate test fixtures from Zod schemas for property-based testing
- **Client-side Zod reuse:** Share generated Zod schemas with the `@alharistech/sdk` package for client-side validation
