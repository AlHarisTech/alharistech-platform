# Naming Conventions — AlharisTech Platform

## Overview

This document defines the complete naming conventions for every artifact in the AlharisTech platform. Consistent naming is mandatory — it eliminates cognitive overhead, enables automated refactoring, and ensures code is self-documenting.

---

## General Principles

1. **Clarity over brevity** — `getUserByEmail` not `getUsrByEml`
2. **Consistency across stack** — Same concept, same name everywhere
3. **Searchability** — Names must be grep-able (no magic strings)
4. **Pronounceability** — Names must be speakable in code reviews
5. **No abbreviations** — Except well-known ones (see Approved Abbreviations)
6. **No Hungarian notation** — No `strName`, `bIsActive`, `iCount`
7. **No type prefixes** — No `IUser`, `TData`, `EStatus`

---

## Files & Directories

### General Rules

| Category | Convention | Example |
|:---|:---|:---|
| Components (React) | `PascalCase.tsx` | `UserProfile.tsx`, `LoginForm.tsx` |
| Pages (Next.js) | `page.tsx` (Next.js convention) | `app/dashboard/page.tsx` |
| Layouts (Next.js) | `layout.tsx` (Next.js convention) | `app/dashboard/layout.tsx` |
| Loading states | `loading.tsx` (Next.js convention) | `app/dashboard/loading.tsx` |
| Error boundaries | `error.tsx` (Next.js convention) | `app/dashboard/error.tsx` |
| Hooks | `camelCase.ts`, use-prefix | `useAuth.ts`, `useDebounce.ts` |
| Utilities | `camelCase.ts` | `formatDate.ts`, `validateEmail.ts` |
| Configuration files | `kebab-case.ext` | `tailwind.config.ts`, `next.config.ts` |
| Test files | `*.test.ts` or `*.spec.ts` | `formatDate.test.ts` |
| Story files | `*.stories.tsx` | `Button.stories.tsx` |
| Type definition files | `camelCase.ts` | `user.ts`, `order.ts` |
| Barrel exports | `index.ts` | `packages/ui/src/index.ts` |
| Environment files | `.env.{environment}` | `.env.development`, `.env.production` |
| Docker files | `Dockerfile.{service}` | `Dockerfile.api`, `Dockerfile.web` |
| Docker Compose | `docker-compose.{env}.yml` | `docker-compose.dev.yml` |
| Migration files | `YYYYMMDDHHMMSS_description.sql` | `20260601143000_add_user_table.sql` |
| ADR files | `adr-NNN-slug.md` | `adr-001-nextjs-frontend.md` |
| Domain directories | `lowercase` | `identity/`, `commerce/` |

### Next.js App Router Convention

```
app/
├── (marketing)/                ← Route groups in (parentheses)
│   ├── page.tsx
│   └── layout.tsx
├── (dashboard)/
│   ├── dashboard/
│   │   └── page.tsx
│   └── layout.tsx
├── api/                        ← API routes
│   └── auth/
│       └── login/
│           └── route.ts
├── [locale]/                   ← Dynamic segments in [brackets]
│   └── page.tsx
└── [...catchAll]/              ← Catch-all in [...brackets]
    └── page.tsx
```

### NestJS Module Convention

```
src/modules/auth/
├── auth.module.ts
├── auth.controller.ts
├── auth.service.ts
├── auth.guard.ts
├── auth.strategy.ts
├── dto/
│   ├── login.dto.ts
│   └── register.dto.ts
├── entities/
│   └── user.entity.ts
└── tests/
    ├── auth.controller.spec.ts
    └── auth.service.spec.ts
```

---

## Variables

### Rules

| Rule | Good | Bad |
|:---|:---|:---|
| `camelCase` | `userEmail` | `user_email`, `UserEmail` |
| Boolean `is/has/can` prefix | `isActive`, `hasPermission`, `canEdit` | `active`, `permission`, `edit` |
| Array: plural noun | `users`, `orderItems` | `userList`, `arrOrders` |
| Map/Record: `XxxById` or `XxxMap` | `usersById`, `productMap` | `userLookup` |
| No single-letter except loops | `for (const item of items)` | `const u = getUser()` |
| Constants: `SCREAMING_SNAKE_CASE` | `MAX_RETRY_COUNT` | `maxRetryCount` |
| Enum members: `PascalCase` | `OrderStatus.Pending` | `OrderStatus.pending` |
| Private class fields: `camelCase` (no `_` prefix) | `#cacheKey` or `private cacheKey` | `_cacheKey` |

### Special Cases

```typescript
// Destructuring aliases are allowed for clarity:
const { email: userEmail, name: userName } = user;

// Index variables in small loops:
for (let i = 0; i < items.length; i++) { ... }

// Error variable in catch:
try { ... } catch (error) { ... } // always 'error', never 'err' or 'e'
```

---

## Functions

### Rules

| Rule | Good | Bad |
|:---|:---|:---|
| `camelCase` | `getUser` | `GetUser`, `get_user` |
| Verb-first | `createOrder`, `deleteUser` | `orderCreate`, `userDelete` |
| Accessors: `get`/`set` prefix | `getFullName()` | `fullname()` |
| Predicates: `is`/`has`/`can`/`should` | `isValidEmail()` | `checkEmail()` |
| Transformations: `to` prefix | `toCamelCase()` | `camelCase()` |
| Factory functions: `create` prefix | `createLogger()` | `new Logger()` |
| Async functions: no suffix | `fetchUsers()` | `fetchUsersAsync()` |
| Event handlers: `handle` prefix | `handleSubmit()`, `handleClick()` | `onSubmit()`, `click()` |
| React hooks: `use` prefix | `useAuth()`, `useWindowSize()` | `authHook()`, `windowSize()` |
| React server actions: `action` prefix | `createUserAction()` | `serverCreateUser()` |

### Approved Verb List

| Category | Verbs |
|:---|:---|
| Read | `get`, `fetch`, `find`, `search`, `list`, `query` |
| Write | `create`, `update`, `delete`, `remove`, `insert`, `upsert` |
| Process | `process`, `execute`, `run`, `handle`, `apply` |
| Validate | `validate`, `assert`, `check`, `verify` |
| Transform | `map`, `filter`, `reduce`, `sort`, `group`, `format`, `convert`, `parse`, `serialize` |
| State | `register`, `login`, `logout`, `subscribe`, `initialize`, `dispose`, `reset` |

### Function Signature Order

```typescript
// Required params first, optional params with defaults last
function createUser(
  email: string,           // required
  password: string,        // required
  name: string,            // required
  role: Role = Role.USER,  // optional with default
  metadata?: UserMetadata, // optional
): Promise<User> { ... }
```

---

## Classes & Interfaces

### Rules

| Rule | Convention | Example |
|:---|:---|:---|
| Classes | `PascalCase` | `UserService`, `AuthController` |
| Interfaces | `PascalCase` | `UserRepository`, `PaymentGateway` |
| **NO I-prefix** | Forbidden | `IUserRepository` → ❌ |
| Abstract classes | `PascalCase`, `Abstract` prefix allowed | `AbstractRepository` |
| NestJS Controllers | `PascalCaseController` | `UsersController` |
| NestJS Services | `PascalCaseService` | `UsersService` |
| NestJS Modules | `PascalCaseModule` | `AuthModule` |
| NestJS Guards | `PascalCaseGuard` | `JwtAuthGuard` |
| NestJS Interceptors | `PascalCaseInterceptor` | `LoggingInterceptor` |
| NestJS Filters | `PascalCaseFilter` | `HttpExceptionFilter` |
| NestJS Pipes | `PascalCasePipe` | `ValidationPipe` |
| NestJS Decorators | `PascalCase` | `@CurrentUser()`, `@Public()` |
| DTOs | `PascalCaseDto` or `PascalCaseInput` | `CreateUserDto`, `LoginInput` |
| Entities | `PascalCase` | `User`, `Order` |
| Value Objects | `PascalCase` | `Email`, `Password`, `Money` |
| Repositories (interface) | `PascalCaseRepository` | `UserRepository` |
| Repositories (impl) | `PascalCaseRepositoryImpl` | `PrismaUserRepository` |
| Prisma models | `PascalCase` | `model User { ... }` |

---

## Types & TypeScript-Specific

### Rules

| Category | Convention | Example |
|:---|:---|:---|
| Type aliases | `PascalCase` | `type UserRole = "admin" \| "customer"` |
| Generics | Single uppercase letter, or `TPascalCase` for complex | `T`, `K`, `V`, `TData`, `TResponse` |
| Discriminated unions | `PascalCase` with `type` discriminant | `type Shape = Circle \| Square` |
| Type guards | `isPascalCase` prefix | `isUser()`, `isApiError()` |
| Zod schemas | `camelCaseSchema` | `userSchema`, `createOrderSchema` |
| Inferred Zod types | `PascalCase` from schema | `type CreateOrderInput = z.infer<typeof createOrderSchema>` |

### Generic Naming

```typescript
// Simple generics: single letter
function identity<T>(value: T): T { ... }

// Key-value pairs
function mapObject<K extends string, V>(obj: Record<K, V>): ... { ... }

// Entity types (complex generics)
type Repository<TEntity extends BaseEntity> = { ... }

// Response type
type ApiResponse<TData> = { ... }

// Promise result
type AsyncResult<TData, TError = Error> = Promise<Result<TData, TError>>
```

---

## Database

### Rules

| Category | Convention | Example |
|:---|:---|:---|
| Tables | `snake_case`, plural | `users`, `order_items` |
| Columns | `snake_case` | `first_name`, `created_at` |
| Primary keys | `id` (UUID v7) | `id UUID PRIMARY KEY DEFAULT gen_uuid_v7()` |
| Foreign keys | `{referenced_table}_id` | `user_id`, `order_id` |
| Junction tables | `{table1}_{table2}` (alphabetical) | `order_products`, `user_roles` |
| Indexes | `idx_{table}_{column(s)}` | `idx_users_email`, `idx_orders_customer_status` |
| Unique constraints | `uq_{table}_{column(s)}` | `uq_users_email` |
| Foreign key constraints | `fk_{table}_{ref_table}` | `fk_orders_users` |
| Check constraints | `ck_{table}_{rule}` | `ck_orders_amount_positive` |
| Default values | `df_{table}_{column}` | `df_users_created_at` |
| ENUM types | `snake_case` | `order_status`, `user_role` |
| JSONB columns | `snake_case` | `metadata`, `documents` |
| Timestamps | `created_at`, `updated_at`, `deleted_at` | Always these exact names |
| Soft delete column | `deleted_at` (nullable TIMESTAMPTZ) | `deleted_at TIMESTAMPTZ` |

### Prisma Schema Conventions

```prisma
// Table names: PascalCase (Prisma maps to snake_case)
model User {
  id         String    @id @default(uuid()) @db.Uuid  // UUID v7 via extension
  email      String    @unique @db.VarChar(255)
  passwordHash String  @map("password_hash") @db.VarChar(255)
  firstName  String    @map("first_name") @db.VarChar(100)
  lastName   String?   @map("last_name") @db.VarChar(100)
  createdAt  DateTime  @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt  DateTime  @updatedAt @map("updated_at") @db.Timestamptz()
  deletedAt  DateTime? @map("deleted_at") @db.Timestamptz()

  // Relations explicitly named
  orders     Order[]
  
  @@map("users")                    // Table name in database
  @@index([email], name: "idx_users_email")
}
```

### Type Mapping (TypeScript ↔ Database)

| TypeScript Type | PostgreSQL Type | Prisma Type |
|:---|:---|:---|
| `string` | `VARCHAR(n)` / `TEXT` | `String` |
| `number` (integer) | `INTEGER` / `BIGINT` | `Int` / `BigInt` |
| `number` (decimal) | `DECIMAL(p,s)` | `Decimal` |
| `boolean` | `BOOLEAN` | `Boolean` |
| `Date` | `TIMESTAMPTZ` | `DateTime` |
| `Record<string, unknown>` | `JSONB` | `Json` |
| `string (UUID)` | `UUID` | `String @db.Uuid` |
| Enum (TypeScript) | `ENUM` (custom type) | `Enum` |
| `Buffer` | `BYTEA` | `Bytes` |

---

## API

### REST Conventions

| Category | Convention | Example |
|:---|:---|:---|
| Resources | Plural nouns | `/users`, `/orders`, `/products` |
| Nested resources | `/{parent}/{parentId}/{child}` | `/orders/123/items` |
| Versions | `/api/v{major}/` | `/api/v1/users` |
| Query params | `camelCase` | `?pageSize=10&sortBy=createdAt` |
| Request body | `camelCase` (JSON) | `{ "firstName": "Muhammad" }` |
| Response body | `camelCase` (JSON) | `{ "data": { "firstName": "Muhammad" } }` |
| Headers | `kebab-case` | `X-Request-Id`, `X-RateLimit-Remaining` |
| Webhook events | `snake_case` | `order.created`, `payment.completed` |

### GraphQL Conventions

| Category | Convention | Example |
|:---|:---|:---|
| Types | `PascalCase` | `type User { ... }` |
| Fields | `camelCase` | `firstName: String!` |
| Queries | `camelCase`, verb-first | `user(id: ID!): User`, `searchUsers(query: String!): [User!]!` |
| Mutations | `camelCase`, verb-first | `createUser(input: CreateUserInput!): User!` |
| Input types | `PascalCaseInput` | `input CreateUserInput { ... }` |
| Enums | `PascalCase`, values `SCREAMING_SNAKE_CASE` | `enum OrderStatus { PENDING }` |
| Connections (Relay) | `PascalCaseConnection`, `PascalCaseEdge` | `UserConnection`, `UserEdge` |
| Subscriptions | `camelCase` | `userCreated: User!` |

---

## Branches

| Type | Convention | Example |
|:---|:---|:---|
| Feature | `feature/<kebab-case-slug>` | `feature/user-authentication` |
| Bug fix | `fix/<kebab-case-slug>` | `fix/login-redirect-loop` |
| Chore | `chore/<kebab-case-slug>` | `chore/upgrade-nextjs-15` |
| Documentation | `docs/<kebab-case-slug>` | `docs/api-rate-limiting` |
| Hotfix | `hotfix/<kebab-case-slug>` | `hotfix/payment-gateway-timeout` |
| Release | `release/<semver>` | `release/1.0.0` |

Branch names must be lowercase, use hyphens, and be descriptive. Maximum 50 characters.

---

## Commits (Conventional Commits)

```
<type>(<optional scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | When to Use |
|:---|:---|
| `feat` | A new feature (triggers MINOR version bump) |
| `fix` | A bug fix (triggers PATCH version bump) |
| `docs` | Documentation only changes |
| `style` | Code style (formatting, semicolons) — no logic change |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Code change that improves performance |
| `test` | Adding or modifying tests |
| `chore` | Maintenance tasks (deps, build, CI) |
| `ci` | CI/CD configuration changes |
| `build` | Build system or external dependencies |
| `revert` | Revert a previous commit |

### Scopes (Approved List)

| Scope | Covers |
|:---|:---|
| `web` | Public website app |
| `admin` | Admin dashboard app |
| `api` | API Gateway |
| `desktop` | Desktop app |
| `mobile` | Mobile app |
| `ui` | Shared UI package |
| `auth` | Auth package |
| `database` | Database package |
| `sdk` | SDK package |
| `config` | Config package |
| `logger` | Logger package |
| `types` | Types package |
| `utils` | Utils package |
| `identity` | Identity domain |
| `customer` | Customer domain |
| `commerce` | Commerce domain |
| `support` | Support domain |
| `content` | Content domain |
| `notification` | Notification domain |
| `analytics` | Analytics domain |
| `ai` | AI domain |
| `infra` | Infrastructure (Docker, k8s, Terraform) |
| `deps` | Dependencies |
| `security` | Security fixes/improvements |

### Breaking Changes

Append `!` after the type/scope or add `BREAKING CHANGE:` in the footer:

```
feat(api)!: remove deprecated v1 user endpoint
```
```
feat(api): remove deprecated v1 user endpoint

BREAKING CHANGE: The /api/v1/users endpoint is removed. Use /api/v2/users instead.
```

### Commit Examples

```
feat(auth): add JWT refresh token rotation
fix(commerce): prevent duplicate order submission on double click
docs(api): document all customer CRUD endpoints
chore(deps): upgrade prisma to 5.15.0
refactor(identity): extract password hashing to dedicated service
perf(web): reduce initial bundle by lazy-loading dashboard charts
test(domain-identity): add unit tests for password value object
ci: add bundle size check to PR workflow
security: patch CVE-2024-xxxx in express dependency
```

---

## Environment Variables

| Rule | Convention | Example |
|:---|:---|:---|
| Naming | `SCREAMING_SNAKE_CASE` | `DATABASE_URL` |
| Public (Next.js) | `NEXT_PUBLIC_` prefix | `NEXT_PUBLIC_API_URL` |
| Prefix per service | Optional for clarity | `DATABASE_URL`, `REDIS_URL` |

### Standard Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/alharistech"
DATABASE_URL_TEST="postgresql://user:pass@localhost:5432/alharistech_test"

# Redis
REDIS_URL="redis://localhost:6379"
REDIS_PASSWORD=""

# JWT
JWT_ACCESS_SECRET="..."
JWT_REFRESH_SECRET="..."
JWT_ACCESS_EXPIRY="15m"
JWT_REFRESH_EXPIRY="7d"

# Next.js Public
NEXT_PUBLIC_API_URL="http://localhost:4000"
NEXT_PUBLIC_APP_NAME="AlharisTech"
NEXT_PUBLIC_DEFAULT_LOCALE="ar"

# Storage (S3/MinIO)
S3_ENDPOINT="http://localhost:9000"
S3_ACCESS_KEY="..."
S3_SECRET_KEY="..."
S3_BUCKET="alharistech"
S3_REGION="us-east-1"

# Email
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="..."
SMTP_PASS="..."

# SMS
SMS_PROVIDER="twilio"
SMS_API_KEY="..."
SMS_SENDER_ID="AlharisTech"

# Payment
PAYMENT_GATEWAY="stripe"
PAYMENT_API_KEY="..."
PAYMENT_WEBHOOK_SECRET="..."

# Monitoring
SENTRY_DSN="..."
OPEN_TELEMETRY_ENDPOINT="..."
```

---

## Kubernetes Resources

| Resource | Convention | Example |
|:---|:---|:---|
| Namespace | `lowercase` | `alharistech-staging` |
| Deployment | `{service}-deployment` | `api-deployment` |
| Service | `{service}-service` | `api-service` |
| ConfigMap | `{service}-config` | `api-config` |
| Secret | `{service}-secret` | `api-secret` |
| Ingress | `{service}-ingress` | `api-ingress` |
| HPA | `{service}-hpa` | `api-hpa` |
| PVC | `{service}-pvc` | `postgres-pvc` |
| Labels | `app: {service}`, `tier: {backend/frontend}` | `app: api, tier: backend` |

---

## Approved Abbreviations

Only these abbreviations are permitted in code:

| Abbreviation | Full Term | Usage |
|:---|:---|:---|
| `id` | identifier | Universal |
| `db` | database | `db` variable for database client |
| `api` | application programming interface | API-related code |
| `url` | uniform resource locator | `documentUrl` |
| `http` | hypertext transfer protocol | HTTP-related code |
| `jwt` | JSON web token | `jwtToken` (redundant → use `accessToken`) |
| `ui` | user interface | Package name only |
| `io` | input/output | `ioredis` package import |
| `dto` | data transfer object | `CreateUserDto` |
| `vo` | value object | `EmailVO` (prefer `Email`) |
| `p95`/`p99` | percentile 95/99 | Performance metrics |
| `sms` | short message service | Notification code |
| `cdn` | content delivery network | Infrastructure code |
| `cors` | cross-origin resource sharing | Security config |
| `csrf` | cross-site request forgery | Security code |
| `xss` | cross-site scripting | Security code |
| `sql` | structured query language | Database code |

**Forbidden abbreviations:** `usr` (user), `pwd` (password), `addr` (address), `msg` (message), `err` (error), `req` (request), `res` (response), `ctx` (context), `cfg` (config).

---

## Enforcement

### Automated Checks

```json
// biome.json — Enforce casing conventions
{
  "linter": {
    "rules": {
      "style": {
        "useCamelCase": "error",
        "useConst": "error",
        "noVar": "error"
      }
    }
  }
}
```

### ESLint Rules

```js
// eslint.config.js
rules: {
  // No abbreviations (custom rule or naming convention plugin)
  '@typescript-eslint/naming-convention': [
    'error',
    // Variables: camelCase
    { selector: 'variable', format: ['camelCase', 'UPPER_CASE'] },
    { selector: 'variable', types: ['boolean'], format: ['camelCase'], prefix: ['is', 'has', 'can', 'should'] },
    // Functions: camelCase
    { selector: 'function', format: ['camelCase'] },
    // Types/Interfaces: PascalCase, no I-prefix
    { selector: 'typeLike', format: ['PascalCase'] },
    { selector: 'interface', format: ['PascalCase'], custom: { regex: '^I[A-Z]', match: false } },
    // Enums: PascalCase
    { selector: 'enum', format: ['PascalCase'] },
    // Enum members: PascalCase
    { selector: 'enumMember', format: ['PascalCase'] },
    // Private class members: camelCase
    { selector: 'classProperty', modifiers: ['private'], format: ['camelCase'], leadingUnderscore: 'forbid' },
  ],
}
```

### CI Check

```bash
# In CI pipeline:
pnpm run lint          # ESLint catches naming violations
pnpm run format:check  # Prettier ensures consistent formatting
pnpm run typecheck     # TypeScript catches type naming issues
```
