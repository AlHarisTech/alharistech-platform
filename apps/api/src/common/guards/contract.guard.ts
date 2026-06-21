import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PATH_METADATA } from "@nestjs/common/constants";
import { FastifyRequest } from "fastify";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ValidationDetail {
  field: string;
  message: string;
  code?: string;
  received?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationDetail[];
}

interface JsonSchema {
  type?: string;
  required?: string[];
  properties?: Record<string, JsonSchema>;
  additionalProperties?: boolean;
  items?: JsonSchema;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  format?: string;
  enum?: unknown[];
  minItems?: number;
  maxItems?: number;
  default?: unknown;
  description?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Lightweight JSON Schema Validator (AJV replacement until dependency added)
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE_RE = /^\+[1-9]\d{1,14}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const URI_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/\S+$/;

function validateFormat(value: unknown, format: string): true | string {
  if (typeof value !== "string") return true;
  switch (format) {
    case "email":
      return EMAIL_RE.test(value) ? true : `must match format "email"`;
    case "uuid":
      return UUID_RE.test(value) ? true : 'must match format "uuid"';
    case "date-time":
      return DATE_TIME_RE.test(value) ? true : 'must match format "date-time"';
    case "date":
      return DATE_RE.test(value) ? true : 'must match format "date"';
    case "uri":
      return URI_RE.test(value) ? true : 'must match format "uri"';
    case "phone":
      return PHONE_RE.test(value) ? true : 'must match format "phone"';
    case "password":
      return true; // format-only marker, validated by pattern/minLength
    default:
      return true;
  }
}

class SimpleJsonValidator {
  private compiled: JsonSchema | null = null;
  private removeAdditional = true;

  compile(schema: JsonSchema, opts?: { removeAdditional?: boolean }): void {
    this.compiled = schema;
    if (opts?.removeAdditional !== undefined) {
      this.removeAdditional = opts.removeAdditional;
    }
  }

  validate(data: unknown): ValidationResult {
    const errors: ValidationDetail[] = [];
    this.validateNode(data, this.compiled ?? {}, "", errors, this.removeAdditional);
    return { valid: errors.length === 0, errors };
  }

  private validateNode(
    value: unknown,
    schema: JsonSchema,
    path: string,
    errors: ValidationDetail[],
    stripUnknown: boolean,
  ): void {
    if (!schema || Object.keys(schema).length === 0) return;

    if (schema.type === "object" || schema.properties) {
      if (value === null || value === undefined) {
        if (schema.type === "object") {
          errors.push({ field: path || "(root)", message: "must be object", code: "INVALID_TYPE" });
        }
        return;
      }
      if (typeof value !== "object" || Array.isArray(value)) {
        errors.push({
          field: path || "(root)",
          message: `must be object (received ${typeof value})`,
          code: "INVALID_TYPE",
        });
        return;
      }

      const obj = value as Record<string, unknown>;
      const allowedKeys = new Set(Object.keys(schema.properties ?? {}));

      // Required fields
      for (const req of schema.required ?? []) {
        if (!(req in obj) || obj[req] === undefined) {
          errors.push({
            field: path ? `${path}.${req}` : req,
            message: `"${req}" is required`,
            code: "REQUIRED",
          });
        }
      }

      // Known properties
      for (const [key, propSchema] of Object.entries(schema.properties ?? {})) {
        const childPath = path ? `${path}.${key}` : key;
        if (key in obj && obj[key] !== undefined) {
          this.validateNode(obj[key], propSchema as JsonSchema, childPath, errors, stripUnknown);
        }
      }

      // Unknown properties (strict mode)
      if (stripUnknown && schema.additionalProperties === false) {
        for (const key of Object.keys(obj)) {
          if (!allowedKeys.has(key)) {
            errors.push({
              field: path ? `${path}.${key}` : key,
              message: `Field "${key}" is not allowed`,
              code: "UNKNOWN_FIELD",
            });
          }
        }
      }
      return;
    }

    if (schema.type === "array") {
      if (!Array.isArray(value)) {
        errors.push({
          field: path || "(root)",
          message: `must be array (received ${typeof value})`,
          code: "INVALID_TYPE",
        });
        return;
      }
      if (schema.minItems !== undefined && value.length < schema.minItems) {
        errors.push({
          field: path || "(root)",
          message: `must have at least ${schema.minItems} items`,
          code: "ARRAY_TOO_SHORT",
        });
      }
      if (schema.maxItems !== undefined && value.length > schema.maxItems) {
        errors.push({
          field: path || "(root)",
          message: `must have at most ${schema.maxItems} items`,
          code: "ARRAY_TOO_LONG",
        });
      }
      if (schema.items) {
        for (let i = 0; i < value.length; i++) {
          this.validateNode(value[i], schema.items, `${path}[${i}]`, errors, stripUnknown);
        }
      }
      return;
    }

    // Scalar types
    this.validateScalar(value, schema, path, errors);
  }

  private validateScalar(
    value: unknown,
    schema: JsonSchema,
    path: string,
    errors: ValidationDetail[],
  ): void {
    const jsType = Array.isArray(value) ? "array" : typeof value;

    // Type check
    if (schema.type) {
      const expected = schema.type;
      const typeMap: Record<string, string> = {
        string: "string",
        number: "number",
        integer: "number",
        boolean: "boolean",
        array: "object",
        object: "object",
      };

      if (expected === "integer") {
        if (jsType !== "number" || !Number.isInteger(value)) {
          errors.push({
            field: path,
            message: `must be integer (received ${jsType})`,
            code: "INVALID_TYPE",
            received: this.redact(value, schema),
          });
          return;
        }
      } else if (expected === "null") {
        if (value !== null) {
          errors.push({ field: path, message: "must be null", code: "INVALID_TYPE" });
        }
        return;
      } else {
        const expectedJs = typeMap[expected] ?? expected;
        if (jsType !== expectedJs) {
          errors.push({
            field: path,
            message: `must be ${expected} (received ${jsType})`,
            code: "INVALID_TYPE",
            received: this.redact(value, schema),
          });
          return;
        }
      }
    }

    // String validations
    if (typeof value === "string") {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push({
          field: path,
          message: `must be at least ${schema.minLength} characters`,
          code: "TOO_SHORT",
        });
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        errors.push({
          field: path,
          message: `must be at most ${schema.maxLength} characters`,
          code: "TOO_LONG",
        });
      }
      if (schema.pattern) {
        try {
          const re = new RegExp(schema.pattern);
          if (!re.test(value)) {
            errors.push({
              field: path,
              message: "does not match required pattern",
              code: "PATTERN_MISMATCH",
            });
          }
        } catch {
          Logger.warn(`Invalid regex pattern in schema for field "${path}"`, "ContractGuard");
        }
      }
      if (schema.format) {
        const fmtResult = validateFormat(value, schema.format);
        if (fmtResult !== true) {
          errors.push({
            field: path,
            message: fmtResult,
            code: "INVALID_FORMAT",
            received: schema.format === "password" ? "***" : value,
          });
        }
      }
      if (schema.enum && !schema.enum.includes(value)) {
        errors.push({
          field: path,
          message: `must be one of: ${schema.enum.join(", ")}`,
          code: "INVALID_ENUM",
        });
      }
    }

    // Number validations
    if (typeof value === "number") {
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push({
          field: path,
          message: `must be >= ${schema.minimum}`,
          code: "BELOW_MINIMUM",
        });
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push({
          field: path,
          message: `must be <= ${schema.maximum}`,
          code: "ABOVE_MAXIMUM",
        });
      }
      if (schema.enum && !schema.enum.includes(value)) {
        errors.push({
          field: path,
          message: `must be one of: ${schema.enum.join(", ")}`,
          code: "INVALID_ENUM",
        });
      }
    }
  }

  private redact(value: unknown, schema: JsonSchema): string {
    if (schema.format === "password") return "***";
    if (typeof value === "string" && value.length > 50) return `${value.slice(0, 50)}...`;
    return String(value);
  }
}

// ---------------------------------------------------------------------------
// Embedded Schemas (identity domain — extended by SchemaRegistry when built)
// ---------------------------------------------------------------------------

interface RouteSchemaEntry {
  method: string;
  path: string;
  bodySchema: JsonSchema | null;
  querySchema: JsonSchema | null;
  paramsSchema: JsonSchema | null;
}

const EMBEDDED_SCHEMAS: RouteSchemaEntry[] = [
  // --- Auth ---
  {
    method: "POST",
    path: "/auth/register",
    bodySchema: {
      type: "object",
      required: ["email", "password", "first_name_ar", "last_name_ar"],
      additionalProperties: false,
      properties: {
        email: { type: "string", format: "email", maxLength: 255 },
        password: {
          type: "string",
          format: "password",
          minLength: 8,
          maxLength: 128,
        },
        first_name_ar: { type: "string", minLength: 1, maxLength: 100 },
        last_name_ar: { type: "string", minLength: 1, maxLength: 100 },
        first_name_en: { type: "string", minLength: 1, maxLength: 100 },
        last_name_en: { type: "string", minLength: 1, maxLength: 100 },
        phone: { type: "string", pattern: "^\\+[1-9]\\d{1,14}$", maxLength: 20 },
      },
    },
    querySchema: null,
    paramsSchema: null,
  },
  {
    method: "POST",
    path: "/auth/verify-email",
    bodySchema: {
      type: "object",
      required: ["token"],
      additionalProperties: false,
      properties: { token: { type: "string", minLength: 1 } },
    },
    querySchema: null,
    paramsSchema: null,
  },
  {
    method: "POST",
    path: "/auth/login",
    bodySchema: {
      type: "object",
      required: ["email", "password"],
      additionalProperties: false,
      properties: {
        email: { type: "string", format: "email", maxLength: 255 },
        password: { type: "string", format: "password", minLength: 1 },
      },
    },
    querySchema: null,
    paramsSchema: null,
  },
  {
    method: "POST",
    path: "/auth/refresh",
    bodySchema: {
      type: "object",
      required: ["refresh_token"],
      additionalProperties: false,
      properties: { refresh_token: { type: "string", minLength: 1 } },
    },
    querySchema: null,
    paramsSchema: null,
  },
  {
    method: "POST",
    path: "/auth/logout",
    bodySchema: {
      type: "object",
      additionalProperties: false,
      properties: { refresh_token: { type: "string" } },
    },
    querySchema: null,
    paramsSchema: null,
  },
  {
    method: "POST",
    path: "/auth/forgot-password",
    bodySchema: {
      type: "object",
      required: ["email"],
      additionalProperties: false,
      properties: { email: { type: "string", format: "email", maxLength: 255 } },
    },
    querySchema: null,
    paramsSchema: null,
  },
  {
    method: "POST",
    path: "/auth/reset-password",
    bodySchema: {
      type: "object",
      required: ["token", "new_password"],
      additionalProperties: false,
      properties: {
        token: { type: "string", minLength: 1 },
        new_password: { type: "string", format: "password", minLength: 8, maxLength: 128 },
      },
    },
    querySchema: null,
    paramsSchema: null,
  },
  // --- Users ---
  {
    method: "GET",
    path: "/users/me",
    bodySchema: null,
    querySchema: null,
    paramsSchema: null,
  },
  {
    method: "PATCH",
    path: "/users/me",
    bodySchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        first_name_ar: { type: "string", minLength: 1, maxLength: 100 },
        last_name_ar: { type: "string", minLength: 1, maxLength: 100 },
        first_name_en: { type: "string", minLength: 1, maxLength: 100 },
        last_name_en: { type: "string", minLength: 1, maxLength: 100 },
        phone: { type: "string", pattern: "^\\+[1-9]\\d{1,14}$", maxLength: 20 },
      },
    },
    querySchema: null,
    paramsSchema: null,
  },
  {
    method: "GET",
    path: "/users",
    bodySchema: null,
    querySchema: {
      type: "object",
      properties: {
        page: { type: "integer", minimum: 1, default: 1 },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        role: { type: "string" },
        search: { type: "string" },
      },
    },
    paramsSchema: null,
  },
  {
    method: "PATCH",
    path: "/users/:id/role",
    bodySchema: {
      type: "object",
      required: ["role"],
      additionalProperties: false,
      properties: {
        role: { type: "string", enum: ["admin", "manager", "employee", "customer", "partner"] },
      },
    },
    querySchema: null,
    paramsSchema: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "string", format: "uuid" } },
    },
  },
];

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface ValidatorCacheEntry {
  validator: SimpleJsonValidator;
  bodySchema: JsonSchema | null;
}

const validatorCache = new Map<string, ValidatorCacheEntry>();

function cacheKey(method: string, path: string): string {
  return `${method.toUpperCase()}:${path}`;
}

// ---------------------------------------------------------------------------
// ContractGuard
// ---------------------------------------------------------------------------

@Injectable()
export class ContractGuard implements CanActivate {
  private readonly logger = new Logger(ContractGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const method = request.method.toUpperCase();
    const routePath = this.resolveRoutePath(context, request);
    const startTime = performance.now();

    try {
      // 1. Look up schema
      const schemaEntry = this.lookupSchema(method, routePath);
      if (!schemaEntry) {
        this.logger.warn(`No contract schema for ${method} ${routePath} — denying (fail-closed)`);
        throw new HttpException(
          {
            error: {
              code: "SCHEMA_NOT_FOUND",
              message: "لم يتم العثور على مخطط التحقق لهذا المسار",
              message_en: "Validation schema not found for this route",
              statusCode: HttpStatus.NOT_FOUND,
            },
            meta: this.buildMeta(request),
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // 2. Merge data
      const merged = this.mergeRequestData(request);

      // 3. Get or compile validator
      const key = cacheKey(method, routePath);
      let cached = validatorCache.get(key);
      if (!cached) {
        cached = this.compileValidator(schemaEntry);
        validatorCache.set(key, cached);
      }

      // 4. Validate
      const result = cached.validator.validate(merged);
      const elapsed = performance.now() - startTime;

      if (!result.valid) {
        this.logger.warn(
          `Validation failed for ${method} ${routePath} (${result.errors.length} errors, ${elapsed.toFixed(2)}ms)`,
        );
        throw new HttpException(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "بيانات الطلب غير صالحة",
              message_en: "Invalid request data",
              statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
              details: result.errors,
            },
            meta: this.buildMeta(request),
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      this.logger.debug(
        `Validation passed for ${method} ${routePath} (${elapsed.toFixed(2)}ms)`,
      );

      // 5. Attach validated data (strip unknowns if strict)
      (request as any).validatedBody = (merged as any).body;

      return true;
    } catch (err: unknown) {
      const elapsed = performance.now() - startTime;
      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.error(
        `Unexpected error during validation for ${method} ${routePath} (${elapsed.toFixed(2)}ms)`,
        err instanceof Error ? err.stack : String(err),
      );
      throw new HttpException(
        {
          error: {
            code: "VALIDATOR_COMPILE_ERROR",
            message: "حدث خطأ داخلي أثناء التحقق من صحة الطلب",
            message_en: "Internal validation error",
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          },
          meta: this.buildMeta(request),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private resolveRoutePath(context: ExecutionContext, request: FastifyRequest): string {
    const nestPath = this.reflector.get<string>(PATH_METADATA, context.getHandler());
    if (nestPath) {
      return nestPath.startsWith("/") ? nestPath : `/${nestPath}`;
    }
    // Fallback: extract from Fastify route options
    const routeOpts = (request as any).routeOptions;
    if (routeOpts?.url) return routeOpts.url;
    // Last resort: raw URL path
    return new URL(request.url, "http://localhost").pathname;
  }

  private lookupSchema(method: string, routePath: string): RouteSchemaEntry | null {
    // Normalize path: remove /api/v1 prefix from routePath if present, then match
    const normalized = this.normalizePath(routePath);
    return (
      EMBEDDED_SCHEMAS.find(
        (e) => e.method.toUpperCase() === method.toUpperCase() && e.path === normalized,
      ) ?? null
    );
  }

  private normalizePath(routePath: string): string {
    let p = routePath;
    if (!p.startsWith("/")) p = `/${p}`;
    // Fastify may pass template paths like /api/v1/users/:id
    // Embedded schemas use :id notation; ensure match
    return p;
  }

  private mergeRequestData(request: FastifyRequest): Record<string, unknown> {
    const body = (request as any).body ?? {};
    const query = (request as any).query ?? {};
    const params = (request as any).params ?? {};

    // Coerce query string values (all come as strings from fastify)
    const coercedQuery: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(query as Record<string, unknown>)) {
      coercedQuery[k] = this.coerceValue(v);
    }

    return { ...(typeof body === "object" ? body : {}), ...coercedQuery, ...params };
  }

  private coerceValue(value: unknown): unknown {
    if (typeof value !== "string") return value;
    // Integer coercion
    if (/^-?\d+$/.test(value)) {
      const n = Number(value);
      if (Number.isSafeInteger(n)) return n;
    }
    // Float coercion
    if (/^-?\d+\.\d+$/.test(value)) {
      const n = Number(value);
      if (!Number.isNaN(n)) return n;
    }
    // Boolean coercion
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  }

  private compileValidator(entry: RouteSchemaEntry): ValidatorCacheEntry {
    const combinedSchema: JsonSchema = { type: "object", properties: {} };
    const schemas: { key: string; schema: JsonSchema | null }[] = [
      { key: "body", schema: entry.bodySchema },
      { key: "query", schema: entry.querySchema },
      { key: "params", schema: entry.paramsSchema },
    ];

    for (const { schema } of schemas) {
      if (schema?.properties) {
        combinedSchema.properties = {
          ...combinedSchema.properties,
          ...(schema.properties as Record<string, JsonSchema>),
        };
      }
    }

    const validator = new SimpleJsonValidator();
    validator.compile(combinedSchema, { removeAdditional: true });

    return { validator, bodySchema: entry.bodySchema };
  }

  private buildMeta(request: FastifyRequest): Record<string, unknown> {
    return {
      timestamp: new Date().toISOString(),
      requestId: (request as any).id ?? this.generateRequestId(),
    };
  }

  private generateRequestId(): string {
    // crypto.randomUUID available in Node 19+
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
}
