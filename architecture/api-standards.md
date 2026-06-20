# API Standards — AlharisTech Platform

## Overview

This document defines the complete API standards for the AlharisTech platform. All APIs — REST and GraphQL — follow these standards to ensure consistency, predictability, and developer experience across all clients (web, admin, desktop, mobile, third-party).

---

## REST API Standards

### URL Structure

```
https://api.alharistech.com/api/v{version}/{resource}

Base URL Pattern:
  Production:  https://api.alharistech.com
  Staging:     https://api.staging.alharistech.com
  Development: http://localhost:4000

Version: /api/v1/
Resource: plural noun, kebab-case for multi-word
```

### URL Examples

```
GET    /api/v1/users                    # List users
POST   /api/v1/users                    # Create user
GET    /api/v1/users/{id}               # Get user
PUT    /api/v1/users/{id}               # Full update
PATCH  /api/v1/users/{id}               # Partial update
DELETE /api/v1/users/{id}               # Soft delete

GET    /api/v1/users/{id}/orders        # User's orders (sub-resource)
GET    /api/v1/orders/{id}/items        # Order items
POST   /api/v1/orders/{id}/cancel       # Action endpoint

GET    /api/v1/auth/me                  # Current authenticated user
POST   /api/v1/auth/login               # Login
POST   /api/v1/auth/refresh             # Refresh token
POST   /api/v1/auth/logout              # Logout
```

### HTTP Methods

| Method | Purpose | Idempotent | Safe | Request Body |
|:---|:---|:---:|:---:|:---:|
| `GET` | Retrieve resource(s) | Yes | Yes | No |
| `POST` | Create resource | No | No | Yes |
| `PUT` | Full replacement | Yes | No | Yes |
| `PATCH` | Partial update | No | No | Yes |
| `DELETE` | Remove resource (soft delete) | Yes | No | No |
| `HEAD` | Retrieve headers only | Yes | Yes | No |
| `OPTIONS` | CORS preflight | Yes | Yes | No |

**Rules:**
- `PUT` — client sends the ENTIRE resource representation. Missing fields are set to null/default.
- `PATCH` — client sends ONLY fields to update. Uses JSON Merge Patch (RFC 7396) or JSON Patch (RFC 6902).
- `DELETE` — always soft delete. Hard delete requires admin role and explicit `?hard=true` param.
- `POST` for non-CRUD actions: `/orders/123/cancel`, `/invoices/456/send`, `/tickets/789/assign`

---

## Response Envelope

Every API response follows a consistent envelope structure:

```typescript
// Success response
interface ApiResponse<T> {
  data: T;                           // The payload
  meta?: ApiMeta;                    // Pagination, timing, etc.
}

interface ApiMeta {
  timestamp: string;                 // ISO 8601
  requestId: string;                 // UUID for tracing
  pagination?: PaginationMeta;       // Only for list endpoints
  apiVersion: string;                // e.g., "1.0.0"
}

interface PaginationMeta {
  total: number;                     // Total records
  perPage: number;                   // Items per page
  currentPage?: number;              // For offset pagination
  nextCursor?: string;               // For cursor pagination
  previousCursor?: string;           // For cursor pagination
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
```

```typescript
// Error response
interface ApiErrorResponse {
  error: ApiError;
  meta: ApiMeta;
}

interface ApiError {
  code: string;                      // Machine-readable error code
  message: string;                   // Human-readable (English)
  messageAr?: string;                // Human-readable (Arabic)
  details?: ApiErrorDetail[];        // Validation errors, field-level
  documentation?: string;            // Link to error docs
}

interface ApiErrorDetail {
  field?: string;                    // Failing field name
  code: string;                      // Field-level error code
  message: string;                   // Field-level message
  received?: unknown;                // The invalid value
}
```

### Example Responses

**200 OK — List users:**

```json
{
  "data": [
    {
      "id": "018f9a92-3c5f-7a8b-9c0d-1e2f3a4b5c6d",
      "email": "user@example.com",
      "firstName": "Muhammad",
      "lastName": "Ali",
      "role": "customer",
      "isActive": true,
      "createdAt": "2026-06-15T10:30:00Z",
      "updatedAt": "2026-06-15T10:30:00Z"
    }
  ],
  "meta": {
    "timestamp": "2026-06-20T14:00:00Z",
    "requestId": "018f9a92-3c5f-7a8b-9c0d-1e2f3a4b5c6e",
    "pagination": {
      "total": 150,
      "perPage": 20,
      "nextCursor": "eyJpZCI6IjAxOGY5YTkyLTNjNWYtN2E4Yi05YzBkLTFlMmYzYTRiNWM2ZCJ9",
      "hasNextPage": true,
      "hasPreviousPage": false
    },
    "apiVersion": "1.0.0"
  }
}
```

**400 Bad Request — Validation error:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "messageAr": "فشل التحقق من صحة الطلب",
    "details": [
      {
        "field": "email",
        "code": "INVALID_FORMAT",
        "message": "Must be a valid email address",
        "received": "not-an-email"
      },
      {
        "field": "password",
        "code": "TOO_SHORT",
        "message": "Password must be at least 8 characters",
        "received": "***"
      }
    ],
    "documentation": "https://docs.alharistech.com/api/errors#validation_error"
  },
  "meta": {
    "timestamp": "2026-06-20T14:00:00Z",
    "requestId": "018f9a92-3c5f-7a8b-9c0d-1e2f3a4b5c6f",
    "apiVersion": "1.0.0"
  }
}
```

**201 Created:**

```json
{
  "data": {
    "id": "018f9a93-4d6e-8b9c-1d2e-3f4a5b6c7d8e",
    "email": "newuser@example.com",
    "firstName": "Aisha",
    "role": "customer",
    "createdAt": "2026-06-20T14:00:00Z"
  },
  "meta": {
    "timestamp": "2026-06-20T14:00:00Z",
    "requestId": "018f9a93-4d6e-8b9c-1d2e-3f4a5b6c7d8e",
    "apiVersion": "1.0.0"
  }
}
```

---

## Pagination

### Cursor-Based (Preferred)

- Use for most list endpoints
- Cursor is a base64-encoded opaque string
- Clients pass `?cursor=<value>&limit=<number>`

```
GET /api/v1/users?cursor=eyJpZCI6IjAxOG...&limit=20

Response includes:
  meta.pagination.nextCursor    — cursor for next page (null if last page)
  meta.pagination.previousCursor — cursor for previous page (null if first page)
  meta.pagination.hasNextPage   — boolean
  meta.pagination.hasPreviousPage — boolean
```

### Offset-Based (Allowed for Small Collections)

- Use only when total count and arbitrary page jumps are needed
- Max `limit` is 100

```
GET /api/v1/users?page=1&limit=20

Response includes:
  meta.pagination.total        — total count
  meta.pagination.perPage      — items per page
  meta.pagination.currentPage  — current page number
```

---

## Filtering, Sorting, Field Selection

### Filtering

```
GET /api/v1/orders?status=pending,in_progress             # Multiple values (OR)
GET /api/v1/orders?createdAt[gte]=2026-01-01               # Range: gte, lte, gt, lt
GET /api/v1/users?search=muhammad                          # Full-text search
GET /api/v1/orders?customerId=123&status=pending           # Multiple filters (AND)
GET /api/v1/users?role=admin&isActive=true                 # Combined
```

**Filter Operators (suffix):**

| Suffix | Meaning | Example |
|:---|:---|:---|
| `[eq]` | Equals (default) | `?status[eq]=active` |
| `[neq]` | Not equals | `?status[neq]=cancelled` |
| `[gt]` | Greater than | `?amount[gt]=100` |
| `[gte]` | Greater than or equal | `?amount[gte]=100` |
| `[lt]` | Less than | `?amount[lt]=1000` |
| `[lte]` | Less than or equal | `?amount[lte]=1000` |
| `[in]` | In array | `?status[in]=pending,in_progress` |
| `[nin]` | Not in array | `?status[nin]=cancelled` |
| `[contains]` | String contains | `?name[contains]=Ali` |
| `[startsWith]` | String prefix | `?name[startsWith]=Muh` |
| `[endsWith]` | String suffix | `?email[endsWith]=gmail.com` |

### Sorting

```
GET /api/v1/users?sortBy=createdAt         # Ascending (default)
GET /api/v1/users?sortBy=-createdAt        # Descending (prefix with -)
GET /api/v1/orders?sortBy=status,-createdAt # Multiple sort fields
```

### Field Selection (Sparse Fieldsets)

```
GET /api/v1/users?fields=id,email,firstName    # Only return specified fields
GET /api/v1/users?fields=id,email&include=orders # Include related resources
```

### Expanding/Including Related Resources

```
GET /api/v1/orders?include=items,customer       # Include order items and customer
GET /api/v1/orders?include=items.product        # Nested include
```

---

## HTTP Status Codes

| Code | Meaning | When to Use |
|:---|:---|:---|
| `200 OK` | Success | GET, PUT, PATCH success. POST that returns resource. |
| `201 Created` | Resource created | POST success. Include `Location` header with new resource URL. |
| `202 Accepted` | Async processing | Long-running operation accepted for background processing. |
| `204 No Content` | Success, no body | DELETE success. |
| `301 Moved Permanently` | Permanent redirect | Old URL permanently moved. |
| `302 Found` | Temporary redirect | Temporary redirect. |
| `304 Not Modified` | Cached version valid | ETag/If-None-Match returned. |
| `400 Bad Request` | Invalid input | Validation error, malformed JSON, missing required fields. |
| `401 Unauthorized` | Not authenticated | Missing or invalid JWT. |
| `403 Forbidden` | Not authorized | Authenticated but lacks permissions. |
| `404 Not Found` | Resource missing | ID doesn't exist or resource is soft-deleted. |
| `405 Method Not Allowed` | Wrong HTTP method | POST on a GET-only endpoint. |
| `409 Conflict` | State conflict | Duplicate email, version conflict, optimistic lock failure. |
| `410 Gone` | Resource permanently deleted | Hard-deleted resource (rare). |
| `413 Payload Too Large` | Request body too large | File upload exceeds limit. |
| `415 Unsupported Media Type` | Wrong Content-Type | Client sent XML when JSON expected. |
| `422 Unprocessable Entity` | Semantic error | Valid JSON but business rule violation. |
| `429 Too Many Requests` | Rate limited | Client exceeded rate limit. |
| `500 Internal Server Error` | Unexpected server error | Unhandled exception. Generic catch-all. |
| `502 Bad Gateway` | Upstream failure | Proxy received invalid response. |
| `503 Service Unavailable` | Maintenance/overload | Planned maintenance or overload. Include `Retry-After` header. |
| `504 Gateway Timeout` | Upstream timeout | Proxy request timed out. |

---

## Error Codes (Application-Level)

| Code | HTTP Status | Description |
|:---|:---|:---|
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `INVALID_CREDENTIALS` | 401 | Email/password mismatch |
| `TOKEN_EXPIRED` | 401 | JWT access token expired |
| `TOKEN_INVALID` | 401 | JWT is malformed or tampered |
| `REFRESH_TOKEN_EXPIRED` | 401 | Refresh token expired, re-login needed |
| `INSUFFICIENT_PERMISSIONS` | 403 | User lacks required role |
| `RESOURCE_NOT_FOUND` | 404 | Requested resource does not exist |
| `EMAIL_ALREADY_EXISTS` | 409 | Email already registered |
| `DUPLICATE_ENTRY` | 409 | Unique constraint violation |
| `ORDER_NOT_MODIFIABLE` | 422 | Order in terminal state, cannot modify |
| `PAYMENT_FAILED` | 422 | Payment gateway rejected |
| `FILE_TOO_LARGE` | 413 | Upload exceeds size limit |
| `UNSUPPORTED_FILE_TYPE` | 415 | File type not allowed |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `SERVICE_UNAVAILABLE` | 503 | Dependency service unavailable |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Rate Limiting

### Headers

Every response includes rate limit headers:

```
X-RateLimit-Limit: 100           # Max requests per window
X-RateLimit-Remaining: 87        # Remaining in current window
X-RateLimit-Reset: 1718899200    # Unix timestamp when window resets
X-RateLimit-Used: 13             # Requests used in window
Retry-After: 60                  # Seconds until retry (only when 429)
```

### Tiers

| Tier | Limit | Window | Scope |
|:---|:---|:---|:---|
| Default | 60 requests | 60 seconds | Per IP |
| Authenticated | 300 requests | 60 seconds | Per user |
| Admin | 600 requests | 60 seconds | Per user |
| API Key | As configured | 60 seconds | Per API key |

### Endpoint-Specific Limits

```
POST /api/v1/auth/login           -> 5 requests per minute per IP (brute force protection)
POST /api/v1/auth/refresh         -> 10 requests per minute per IP
POST /api/v1/auth/forgot-password -> 3 requests per hour per email
GET  /api/v1/search               -> 30 requests per minute per user
POST /api/v1/upload               -> 10 requests per minute per user
```

---

## Authentication

### JWT Access Token

```
Header: Authorization: Bearer <access_token>

Token payload:
{
  "sub": "user-uuid",           // Subject (user ID)
  "email": "user@example.com",
  "role": "customer",
  "permissions": ["read:orders", "write:orders"],
  "iat": 1718899200,            // Issued at
  "exp": 1718900100,            // Expires (15 min)
  "iss": "alharistech-api",     // Issuer
  "jti": "unique-token-id"      // JWT ID (for revocation)
}
```

### Refresh Token

```
Sent as httpOnly, Secure, SameSite=Strict cookie.
Not accessible to JavaScript.
Rotation: every use invalidates old refresh token and issues new one.
Lifetime: 7 days (absolute), extended on each use (sliding, max 30 days).
```

---

## OpenAPI 3.1 Specification

Every REST endpoint MUST be documented via OpenAPI. NestJS's `@nestjs/swagger` decorators generate the spec automatically.

### OpenAPI Decorators (NestJS)

```typescript
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from "@nestjs/swagger";

@ApiTags("Users")
@Controller({ path: "users", version: "1" })
export class UsersController {
  @Get()
  @ApiOperation({
    summary: "List users",
    description: "Returns a paginated list of users. Supports filtering, sorting, and cursor pagination.",
  })
  @ApiQuery({ name: "cursor", required: false, description: "Pagination cursor" })
  @ApiQuery({ name: "limit", required: false, schema: { default: 20, maximum: 100 } })
  @ApiQuery({ name: "search", required: false, description: "Search by name or email" })
  @ApiQuery({ name: "role", required: false, enum: ["admin", "employee", "customer"] })
  @ApiResponse({ status: 200, description: "Paginated list of users", type: PaginatedUserResponse })
  @ApiResponse({ status: 401, description: "Not authenticated" })
  @ApiResponse({ status: 403, description: "Insufficient permissions" })
  @ApiBearerAuth()
  async findAll(@Query() query: ListUsersQueryDto): Promise<ApiResponse<User[]>> {
    return this.usersService.findAll(query);
  }
}
```

### OpenAPI Endpoints

```
GET /api/docs         — Swagger UI (development only)
GET /api/docs-json    — OpenAPI JSON spec
GET /api/docs-yaml    — OpenAPI YAML spec
```

### Required OpenAPI Elements per Endpoint

1. `summary` — One-line description (50 chars max)
2. `description` — Full description with usage notes
3. `tags` — Categorization (matches controller tag)
4. `parameters` — All query/path params documented
5. `requestBody` — Schema for POST/PUT/PATCH
6. `responses` — At minimum: 200, 400, 401, 403, 404, 500
7. `security` — `[{ bearerAuth: [] }]` for authenticated endpoints

---

## API Versioning Strategy

### URI Versioning

```
/api/v1/users    — Version 1
/api/v2/users    — Version 2 (breaking changes)
```

### Version Lifecycle

| Phase | Duration | Description |
|:---|:---|:---|
| Active | Latest | Full support, bug fixes, new features |
| Deprecated | 6 months | Still functional, `Sunset` header added |
| Sunset | 3 months | `Deprecation` header, limited support |
| Removed | After sunset | Returns 410 Gone |

### Deprecation Headers

```
Sunset: Sat, 31 Dec 2026 23:59:59 GMT
Deprecation: true
Link: </api/v2/users>; rel="successor-version"
```

### Backward Compatibility Rules

When creating a new API version:
1. New minor features -> add to current version, do not bump
2. Additive changes -> current version (new fields, new endpoints)
3. Field removal -> new version required
4. Type change -> new version required
5. Semantic change -> new version required
6. URL structure change -> new version required

---

## GraphQL Standards

### Endpoint

```
POST /graphql           — Single GraphQL endpoint
GET  /graphql           — GraphQL Playground (development only)
```

### Naming Conventions

```graphql
# Types: PascalCase
type User { ... }
type OrderItem { ... }

# Fields: camelCase
type User {
  id: ID!
  email: String!
  firstName: String!
  lastName: String
  isActive: Boolean!
  createdAt: DateTime!
}

# Queries: camelCase, verb-first
type Query {
  user(id: ID!): User
  users(first: Int, after: String, filter: UserFilter): UserConnection!
  searchUsers(query: String!, first: Int): UserConnection!
}

# Mutations: camelCase, verb-first
type Mutation {
  createUser(input: CreateUserInput!): CreateUserPayload!
  updateUser(id: ID!, input: UpdateUserInput!): UpdateUserPayload!
  deleteUser(id: ID!): DeleteUserPayload!
}

# Input types: PascalCase + "Input"
input CreateUserInput {
  email: String!
  password: String!
  firstName: String!
  lastName: String
  role: UserRole = CUSTOMER
}

# Enums: PascalCase type, SCREAMING_SNAKE_CASE values
enum UserRole {
  ADMIN
  EMPLOYEE
  CUSTOMER
}

# Payload types: PascalCase + "Payload"
type CreateUserPayload {
  user: User
  errors: [UserError!]
}

type UserError {
  field: String!
  message: String!
}
```

### GraphQL Pagination (Relay Cursor Connections)

```graphql
type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type UserEdge {
  node: User!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

# Query usage:
query ListUsers($first: Int = 20, $after: String) {
  users(first: $first, after: $after) {
    edges {
      node { id email firstName }
      cursor
    }
    pageInfo { hasNextPage endCursor }
    totalCount
  }
}
```

### GraphQL Error Handling

```json
{
  "errors": [
    {
      "message": "User not found",
      "extensions": {
        "code": "RESOURCE_NOT_FOUND",
        "statusCode": 404,
        "field": "id"
      }
    }
  ],
  "data": null
}
```

### GraphQL Operation Naming (REQUIRED)

```graphql
# REQUIRED: Operation name
query GetUserById($id: ID!) {
  user(id: $id) {
    id
    email
    firstName
  }
}

# FORBIDDEN: Anonymous operations in production
query {
  user(id: "123") { email }
}
```

### GraphQL Depth Limiting

Maximum query depth: **5 levels**
Maximum query complexity: **1000 points** (configurable per role)

```
Complexity calculation:
  Scalar field = 1 point
  Connection field (list) = count * child complexity
  Admin queries = 2x complexity budget
```

### GraphQL Directives

```graphql
directive @auth(requires: UserRole = CUSTOMER) on FIELD_DEFINITION
directive @deprecated(reason: String = "No longer supported") on FIELD_DEFINITION

type Query {
  allUsers: [User!]! @auth(requires: ADMIN)
  restrictedField: String @deprecated(reason: "Use 'publicField' instead")
}
```

---

## Webhooks

### Outgoing Webhook Format

```
POST {subscriber_url}
Headers:
  Content-Type: application/json
  X-AlharisTech-Signature: sha256=...  (HMAC-SHA256 of payload)
  X-AlharisTech-Event: order.created
  X-AlharisTech-Delivery: <uuid>

Body:
{
  "event": "order.created",
  "timestamp": "2026-06-20T14:00:00Z",
  "data": { ... },
  "apiVersion": "1.0.0"
}
```

### Event Naming

```
{resource}.{action}_{past_tense}

Examples:
  order.created
  order.status_updated
  payment.completed
  payment.failed
  user.registered
  ticket.assigned
  invoice.sent
```

### Retry Strategy

| Attempt | Delay |
|:---|:---|
| 1 | Immediate |
| 2 | 30 seconds |
| 3 | 5 minutes |
| 4 | 30 minutes |
| 5 | 2 hours |
| 6 | 12 hours |

After 6 failed attempts, webhook is disabled until re-enabled manually.

### Signature Verification

```typescript
// Signing (server)
import { createHmac } from "node:crypto";

function signPayload(payload: string, secret: string): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(payload);
  return `sha256=${hmac.digest("hex")}`;
}

// Verification (client)
function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = signPayload(payload, secret);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
```

---

## Content Types

### Accepted Content Types (Request)

```
application/json          — JSON payload (standard)
multipart/form-data       — File uploads
application/x-www-form-urlencoded — Login forms (legacy)
```

### Content Types (Response)

```
application/json          — Standard JSON response
application/octet-stream  — File downloads
application/pdf           — PDF generation
text/csv                  — CSV exports
```

### Request Headers

```
Content-Type: application/json
Accept: application/json
Accept-Language: ar  |  en  |  ar,en;q=0.9
Authorization: Bearer <jwt>
X-Request-Id: <uuid>     — Client-supplied tracing ID (optional but recommended)
X-Idempotency-Key: <key> — For POST/PATCH idempotency (optional)
```

### Response Headers (Standard)

```
Content-Type: application/json
X-Request-Id: <uuid>
X-Response-Time: 45ms
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 299
X-RateLimit-Reset: 1718899800
Cache-Control: private, max-age=0
ETag: "abc123"
```

---

## Idempotency

For `POST` and `PATCH` endpoints, clients may send `X-Idempotency-Key`:

```
POST /api/v1/orders
X-Idempotency-Key: order_2026_06_20_1400_abc123

If the same key is used within 24 hours:
  - For successful requests: return the stored 201 response (same body)
  - For failed requests: retry with the original key

Keys expire after 24 hours.
```

---

## CORS Policy

```typescript
// NestJS main.ts configuration
app.enableCors({
  origin: [
    "https://alharistech.com",
    "https://admin.alharistech.com",
    "https://staging.alharistech.com",
    "http://localhost:3000",     // Development only
    "http://localhost:3001",     // Development only
    "tauri://localhost",         // Tauri desktop
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id", "X-Idempotency-Key"],
  exposedHeaders: ["X-Request-Id", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
  credentials: true,
  maxAge: 86400,  // 24 hours
});
```

---

## SDK Generation

The OpenAPI spec at `/api/docs-json` serves as the source of truth for generating the `@alharistech/sdk` package:

```bash
# Regenerate SDK from OpenAPI spec
pnpm run sdk:generate

# This script:
# 1. Fetches /api/docs-json from the API
# 2. Runs orval or openapi-typescript to generate typed client
# 3. Writes to packages/sdk/src/
```

The generated SDK provides:
- Fully typed request/response objects
- Automatic auth header injection
- Automatic token refresh on 401
- Request deduplication
- Pagination helpers (`sdk.users.listAll()` — auto-fetches all pages)

---

## Health Check

```
GET /api/health

200 OK:
{
  "status": "ok",
  "timestamp": "2026-06-20T14:00:00Z",
  "version": "1.0.0",
  "uptime": 1234567,
  "checks": {
    "database": "ok",
    "redis": "ok",
    "storage": "ok"
  }
}

503 Service Unavailable:
{
  "status": "degraded",
  "timestamp": "2026-06-20T14:00:00Z",
  "checks": {
    "database": "ok",
    "redis": "error",
    "storage": "ok"
  }
}
```

---

## Metrics Endpoint

```
GET /api/metrics  — Prometheus text format
Authentication: Bearer <admin_token>

# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/api/v1/users",status="200"} 1234
```
