# Coding Standards — AlharisTech Platform

## Overview

This document defines the complete coding standards for the AlharisTech platform. These standards apply to all TypeScript code across all packages, apps, and domains. Compliance is enforced via ESLint, Prettier, TypeScript strict mode, and CI checks.

---

## TypeScript Strict Mode Rules

### Base Compiler Options

Every `tsconfig.json` in the project MUST extend `@alharistech/config/typescript/base.json`, which sets:

```json
{
  "compilerOptions": {
    "strict": true,                              // All strict checks enabled
    "noUncheckedIndexedAccess": true,            // Array/Record access includes undefined
    "noImplicitReturns": true,                   // All code paths must return
    "noFallthroughCasesInSwitch": true,          // No switch fallthrough
    "noUnusedLocals": true,                      // No unused variables
    "noUnusedParameters": true,                  // No unused function params
    "exactOptionalPropertyTypes": false,         // Allow undefined assign to optional
    "noImplicitOverride": true,                  // Explicit override keyword
    "useUnknownInCatchVariables": true,          // catch vars are unknown
    "isolatedModules": true,                     // Required for transpileModule
    "verbatimModuleSyntax": false,               // Import elision as needed
    "declaration": true,                         // Generate .d.ts
    "declarationMap": true,                      // Source maps for .d.ts
    "sourceMap": true,                           // Generate source maps
    "incremental": true,                         // Faster repeated builds
    "skipLibCheck": true,                        // Skip type checking of .d.ts
    "forceConsistentCasingInFileNames": true     // Case-sensitive imports
  }
}
```

### `any` Ban

```typescript
// ❌ FORBIDDEN — `any` is never allowed
function process(data: any): any { ... }
const result: any = apiCall();

// ✅ Always use `unknown` and narrow
function process(data: unknown): Result {
  if (typeof data === "string") { ... }
}

// ✅ For truly dynamic data, use `Record<string, unknown>`
function processPayload(payload: Record<string, unknown>) { ... }

// ✅ For generic fallback, use `unknown`
type SafeJson = Record<string, unknown> | unknown[] | string | number | boolean | null;
```

### `as` Assertions

```typescript
// ❌ Avoid — bypasses type safety
const user = data as User;

// ✅ Use type guards
function isUser(data: unknown): data is User { ... }
if (isUser(data)) { const user = data; }

// ✅ Use Zod parsing (preferred)
const user = userSchema.parse(data);

// ✅ `as` allowed ONLY in tests and when you have proven correctness with a comment
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const el = document.getElementById("root") as HTMLDivElement;
```

### Null vs Undefined

```typescript
// Use `undefined` for "not set" / "absent"
// Use `null` for "explicitly set to empty" (rare, mostly API interop)
// Default: prefer `undefined`

function getUser(id: string): User | undefined { ... }  // Not found

// In API responses, map null to undefined
const user: User | undefined = response.data.user ?? undefined;
```

### Enums — Prefer String Unions

```typescript
// ✅ PREFERRED: String union
type OrderStatus = "pending" | "in_progress" | "completed" | "cancelled";

// ⚠️ ACCEPTABLE: const assertion (for runtime access)
const ORDER_STATUSES = ["pending", "in_progress", "completed", "cancelled"] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

// ❌ AVOID: TypeScript enums (inconsistent emit, numeric enums leak)
enum OrderStatus { Pending, InProgress }  // ❌
```

### Type vs Interface

```typescript
// ✅ Use `interface` for object shapes (extendable)
interface User {
  id: string;
  email: string;
}

// ✅ Use `type` for unions, intersections, primitives
type ID = string;
type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };
type OrderStatus = "pending" | "completed";

// Rule: default to `interface`, use `type` when you need unions/primitives/utilities
```

---

## React Patterns

### Server Components vs Client Components (Next.js App Router)

```tsx
// ✅ Default: EVERY component is a Server Component unless it needs interactivity
// No 'use client' directive = Server Component

// Server Component (default)
async function UserProfile({ userId }: { userId: string }) {
  const user = await fetch(`/api/v1/users/${userId}`).then(r => r.json());
  return <div>{user.firstName}</div>;
}

// Client Component (only when needed)
"use client";

function LoginForm() {
  const [email, setEmail] = useState("");
  return <form>...</form>;
}
```

### Client Component Rules

```tsx
"use client";

// ✅ Place 'use client' as the very first line
// ✅ Use named exports
export function UserMenu({ user }: UserMenuProps) {
  // ✅ State at the top
  const [isOpen, setIsOpen] = useState(false);

  // ✅ Derived state (no separate state)
  const isAuthenticated = user !== null;

  // ✅ Handlers as named functions
  function handleToggle() {
    setIsOpen(prev => !prev);
  }

  return (
    <div>
      <button onClick={handleToggle}>Menu</button>
      {isOpen && <MenuDropdown />}
    </div>
  );
}
```

### Component Props

```typescript
// ✅ Every component has a Props interface
interface UserCardProps {
  user: User;
  onSelect?: (user: User) => void;  // Optional callbacks
  className?: string;               // For className merging
  children?: React.ReactNode;       // Content
}

// ✅ Destructure props in function signature
export function UserCard({ user, onSelect, className, children }: UserCardProps) {
  // ✅ Use cn() utility for class merging
  return (
    <div className={cn("rounded-lg border p-4", className)}>
      <h3>{user.firstName}</h3>
      {children}
    </div>
  );
}
```

### State Management Pattern

```typescript
// ✅ Co-locate state as close as possible to where it's used
// ✅ Use useState for simple local state
// ✅ Use useReducer for complex state with multiple transitions
// ✅ Use TanStack Query for ALL server state (never useState for fetched data)

function OrderList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["orders"],
    queryFn: () => sdk.orders.list(),
  });

  if (isLoading) return <OrdersSkeleton />;
  if (error) return <ErrorDisplay error={error} />;
  return data.data.map(order => <OrderCard key={order.id} order={order} />);
}
```

### Hooks Rules

```typescript
// ✅ One hook per file, named `use{Purpose}`
// ✅ Explicit return type
// ✅ Clean up in useEffect
// ✅ Handle loading, error, and empty states in data-fetching hooks

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);  // Cleanup
  }, [value, delay]);

  return debouncedValue;
}
```

---

## NestJS Patterns

### Module Structure

```typescript
// ✅ Each module is self-contained
// ✅ Explicit imports array — no global modules
@Module({
  imports: [DatabaseModule, CacheModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService],  // Only export what other modules need
})
export class UsersModule {}
```

### Controllers

```typescript
// ✅ Thin controllers — delegate to services
// ✅ Use DTOs for validation
// ✅ Return DTOs, not entities
// ✅ Document with OpenAPI decorators

@Controller({ path: "users", version: "1" })
@ApiTags("Users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(":id")
  @ApiOperation({ summary: "Get user by ID" })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({ status: 404, description: "User not found" })
  async findOne(@Param("id", ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    const user = await this.usersService.findById(id);
    return UserResponseDto.fromEntity(user);
  }
}
```

### Services

```typescript
// ✅ Services contain business logic
// ✅ Never inject Request/Response objects into services
// ✅ Use Result type for operations that can fail

@Injectable()
export class UsersService {
  constructor(private readonly userRepo: UserRepository) {}

  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }
}
```

### Guards

```typescript
// ✅ Single responsibility per guard
// ✅ Return boolean, never throw

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  handleRequest(err: unknown, user: unknown): User {
    if (err || !user) {
      throw new UnauthorizedException("Invalid or expired token");
    }
    return user as User;
  }
}

// Usage: @UseGuards(JwtAuthGuard)
```

### Interceptors

```typescript
// ✅ Use for cross-cutting concerns: logging, timing, response wrapping
// ✅ Always call next.handle()

@Injectable()
export class ResponseTimeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = Date.now();
    return next.handle().pipe(
      tap(() => {
        const elapsed = Date.now() - start;
        const req = context.switchToHttp().getRequest();
        logger.info("Request completed", { path: req.path, elapsed });
      }),
    );
  }
}
```

### Pipes

```typescript
// ✅ Use for input validation and transformation
// ✅ Global ValidationPipe configured in main.ts

app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,           // Strip unknown properties
    forbidNonWhitelisted: true, // Reject unknown properties
    transform: true,            // Transform payload to DTO class
    transformOptions: { enableImplicitConversion: true },
  }),
);
```

### Dependency Injection

```typescript
// ✅ Constructor injection (always)
// ❌ Property injection (never)

@Injectable()
export class OrdersService {
  constructor(
    private readonly ordersRepo: OrderRepository,      // ✅
    private readonly paymentGateway: PaymentGateway,    // ✅
    private readonly eventEmitter: EventEmitter2,       // ✅
  ) {}
}
```

### Module Organization (API)

```
src/
├── main.ts                    # Bootstrap, global pipes, Swagger setup
├── app.module.ts              # Root module — imports all domain modules
├── common/                    # Cross-cutting
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts
│   ├── interceptors/
│   │   ├── response-time.interceptor.ts
│   │   ├── wrap-response.interceptor.ts
│   │   └── logging.interceptor.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   ├── pipes/
│   │   └── parse-uuid.pipe.ts
│   └── decorators/
│       ├── current-user.decorator.ts
│       └── public.decorator.ts
├── config/
│   ├── app.config.ts
│   ├── database.config.ts
│   ├── redis.config.ts
│   └── jwt.config.ts
└── modules/
    ├── auth/
    ├── users/
    ├── customers/
    ├── services/
    └── orders/
```

---

## Error Handling

### Result Type Pattern (Preferred for Domain/Service Layer)

```typescript
// packages/utils/src/result.ts

export type Result<T, E = AppError> =
  | { success: true; data: T }
  | { success: false; error: E };

export type AppError = {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
};

// Usage in services:
async findUserById(id: string): Promise<Result<User>> {
  const user = await this.userRepo.findById(id);
  if (!user) {
    return {
      success: false,
      error: { code: "USER_NOT_FOUND", message: "User not found", statusCode: 404 },
    };
  }
  return { success: true, data: user };
}
```

### Exception Pattern (Controller/Gateway Layer)

```typescript
// Controllers use NestJS exceptions for HTTP error responses
// Services return Result types — controllers map them to exceptions

@Get(":id")
async findOne(@Param("id") id: string): Promise<UserResponseDto> {
  const result = await this.usersService.findById(id);
  if (!result.success) {
    throw new HttpException(
      { code: result.error.code, message: result.error.message },
      result.error.statusCode,
    );
  }
  return UserResponseDto.fromEntity(result.data);
}
```

### Error Boundary (Frontend)

```tsx
// error.tsx (Next.js App Router)
"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div>
      <h2>Something went wrong</h2>
      <p>{error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

### Async/Await — No Raw Promises

```typescript
// ✅ Always use async/await
async function fetchData(): Promise<User> {
  const response = await fetch("/api/v1/users");
  const user = await response.json();
  return userSchema.parse(user);
}

// ❌ NEVER use raw .then()/.catch() chains
function fetchData(): Promise<User> {
  return fetch("/api/v1/users")
    .then(res => res.json())  // ❌
    .catch(err => { ... });
}

// ⚠️ Promise.all is acceptable for parallel operations
const [users, orders] = await Promise.all([
  fetchUsers(),
  fetchOrders(),
]);
```

### Error Propagation

```typescript
// ✅ Catch and re-throw with context
async function processOrder(orderId: string): Promise<void> {
  try {
    const order = await orderRepo.findById(orderId);
    await paymentGateway.charge(order);
  } catch (error) {
    logger.error("Order processing failed", { orderId, error });
    throw new InternalServerErrorException("Order processing failed", { cause: error });
  }
}

// ❌ NEVER swallow errors silently
try { ... } catch (error) { }  // ❌ Silent catch

// ❌ NEVER log and continue unless explicitly handling
try { ... } catch (error) {
  logger.error("Failed", { error });
  // missing throw — ❌
}
```

---

## Import Ordering

```typescript
// 1. Node built-ins
import { readFile } from "node:fs/promises";
import path from "node:path";

// 2. External packages (alphabetical)
import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

// 3. Monorepo packages (alphabetical, with @alharistech prefix)
import { logger } from "@alharistech/logger";
import type { User } from "@alharistech/types";
import { formatDate } from "@alharistech/utils";

// 4. Internal imports (relative, NOT absolute)
import { CreateUserDto } from "./dto/create-user.dto";
import { UserAlreadyExistsError } from "./errors";

// 5. Types-only imports (separated with `import type`)
import type { Order } from "@alharistech/types";
import type { Request, Response } from "express";
```

### ESLint Rule

```js
// eslint.config.js
rules: {
  "import/order": ["error", {
    "newlines-between": "always",
    "groups": ["builtin", "external", "internal", "parent", "sibling", "index", "type"],
    "pathGroups": [{
      "pattern": "@alharistech/**",
      "group": "internal",
      "position": "before"
    }],
    "alphabetize": { "order": "asc", "caseInsensitive": true }
  }]
}
```

---

## Maximum Length Rules

| Rule | Limit | Enforcement |
|:---|:---|:---|
| Function length | 50 lines | ESLint `max-lines-per-function` |
| File length | 400 lines | ESLint `max-lines` |
| Line length | 100 characters | Prettier `printWidth: 100` |
| Parameter count | 4 parameters | ESLint `max-params` |
| Nesting depth | 3 levels | ESLint `max-depth` |
| Cyclomatic complexity | 10 | ESLint `complexity` |

```js
// eslint.config.js
rules: {
  "max-lines": ["error", { max: 400, skipBlankLines: true, skipComments: true }],
  "max-lines-per-function": ["error", { max: 50, skipBlankLines: true, skipComments: true }],
  "max-params": ["error", { max: 4 }],
  "max-depth": ["error", { max: 3 }],
  "complexity": ["error", { max: 10 }],
}
```

When a function exceeds 50 lines, extract helper functions or use a class/service. When a file exceeds 400 lines, split into multiple modules.

---

## Comments Policy

### JSDoc for Public APIs (REQUIRED)

```typescript
/**
 * Creates a new user in the system.
 *
 * @param input - User creation details
 * @returns The created user entity
 * @throws {UserAlreadyExistsError} If email is already registered
 * @throws {ValidationError} If input fails validation
 *
 * @example
 * ```ts
 * const user = await usersService.createUser({
 *   email: "user@example.com",
 *   password: "securePassword123",
 *   firstName: "Muhammad"
 * });
 * ```
 */
async createUser(input: CreateUserInput): Promise<User> { ... }
```

### Inline Comments (ONLY for Complex Logic)

```typescript
// ✅ Good — explains non-obvious behavior
// We need to invalidate the cache BEFORE the write to prevent
// stale reads during the transaction window
await cache.del(cacheKey);
await db.transaction(async (tx) => { ... });

// ❌ Bad — states the obvious
// Create a new user
const user = await db.user.create({ data: input });  // ❌ Obvious

// ❌ Bad — commented-out code
// const oldMethod = await someOldFunction();
// We might need this later
```

### Comment Rules

1. **Public API functions → JSDoc required**
2. **Complex algorithm → Brief explanation of approach**
3. **Hack/Workaround → Comment with `// HACK:` and link to issue**
4. **TODO → `// TODO(@username): description` with GitHub issue number**
5. **FIXME → `// FIXME: description` — must be resolved before merge**
6. **No commented-out code** — use git for history
7. **No diary comments** (`// 2024-06-20: John added this`)

```typescript
// ✅ Acceptable
// TODO(@ahmed): Add rate limiting for this endpoint — https://github.com/alharistech/platform/issues/42
// HACK: Bypass strict null check for Prisma's generated types — tracked in #128
// FIXME: This query is O(n^2), use hash join instead

// ❌ Forbidden
// Added by Ahmed on 2024-06-20
// This is a workaround for the bug
// const oldVersion = ...
```

---

## Testing Patterns

### AAA Pattern (Arrange, Act, Assert)

```typescript
describe("UsersService", () => {
  describe("createUser", () => {
    it("should create a user with valid input", async () => {
      // Arrange
      const input: CreateUserInput = {
        email: "test@example.com",
        password: "ValidPass123!",
        firstName: "Test",
      };

      // Act
      const result = await service.createUser(input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.email).toBe(input.email);
    });

    it("should reject duplicate email", async () => {
      // Arrange
      const input: CreateUserInput = { /* ... */ };
      await service.createUser(input);  // First creation

      // Act & Assert
      await expect(service.createUser(input)).rejects.toThrow(UserAlreadyExistsError);
    });
  });
});
```

### Test Naming

```typescript
// ✅ describe: the unit under test (class, function, component)
describe("UserRepository", () => { ... });
describe("useAuth hook", () => { ... });
describe("<LoginForm />", () => { ... });

// ✅ it: behavior description — "should [expected behavior] when [condition]"
it("should return user when valid ID is provided", () => { ... });
it("should return null when user does not exist", () => { ... });
it("should throw ValidationError when email is invalid", () => { ... });

// ❌ Bad test names
it("test create user", () => { ... });            // Vague
it("works correctly", () => { ... });              // Meaningless
it("should not fail", () => { ... });              // Negative framing
```

### Test File Location

```
src/
├── math.ts
└── __tests__/
    └── math.test.ts      # ✅ Co-located test

# OR

src/
├── math.ts
└── math.test.ts          # ✅ Same directory test
```

### Testing Dependencies

```typescript
// ✅ Use Vitest for all testing

// packages/utils/package.json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^1.6.0"
  }
}

// ✅ Mock external dependencies, never internals
vi.mock("@prisma/client");
vi.mock("ioredis");

// ❌ Never mock your own modules
vi.mock("@alharistech/utils");  // ❌
```

### Coverage Thresholds

```json
// vitest.config.ts
{
  "test": {
    "coverage": {
      "provider": "v8",
      "thresholds": {
        "lines": 80,
        "functions": 80,
        "branches": 70,
        "statements": 80
      },
      "exclude": [
        "**/index.ts",         // Barrel exports
        "**/*.d.ts",           // Type declarations
        "**/__tests__/**",     // Test files themselves
        "**/*.config.*",       // Config files
        "**/generated/**"      // Generated code
      ]
    }
  }
}
```

---

## Barrel Exports (index.ts)

```typescript
// ✅ Every directory with exported symbols MUST have index.ts
// packages/types/src/index.ts

export type { User, CreateUserInput, UpdateUserInput } from "./user";
export type { Customer, Company } from "./customer";
export type { Order, OrderItem, OrderStatus } from "./order";
export type { ApiResponse, ApiError, PaginatedResponse } from "./api";
export type { JwtPayload, RefreshToken, Session } from "./auth";
export type { ID, Timestamp, Address, SortDirection, Sortable } from "./common";
```

### Barrel Export Rules

1. **Use named exports only** — no `export default` in barrel files
2. **Export types explicitly** — list each export rather than `export * from`
3. **No side effects** — barrel files must be pure re-exports
4. **One level deep** — barrel files shouldn't re-export from other barrel files
5. **Organized by source** — group exports from the same module together

---

## General Coding Rules

### Early Returns

```typescript
// ✅ Use early returns to reduce nesting
function processOrder(order: Order): Result<ProcessedOrder> {
  if (!order.isPaid) {
    return { success: false, error: { code: "ORDER_NOT_PAID", message: "...", statusCode: 400 } };
  }
  if (!order.items.length) {
    return { success: false, error: { code: "ORDER_EMPTY", message: "...", statusCode: 400 } };
  }
  // Main logic here (not nested)
  return { success: true, data: processedOrder };
}

// ❌ Deep nesting
function processOrder(order: Order): Result<ProcessedOrder> {
  if (order.isPaid) {
    if (order.items.length) {
      // Logic buried 3 levels deep
    } else {
      return { ... };
    }
  } else {
    return { ... };
  }
}
```

### Immutability

```typescript
// ✅ Prefer const — never reassign
const user = await fetchUser(id);

// ✅ Spread for object updates (never mutate)
const updatedUser = { ...user, firstName: "New Name" };

// ✅ Array methods that return new arrays
const activeUsers = users.filter(u => u.isActive);
const userIds = users.map(u => u.id);

// ❌ Never mutate
user.firstName = "New Name";           // ❌ Mutation
users.push(newUser);                   // ❌ Mutation
users.sort((a, b) => a.name > b.name); // ❌ Mutates in place (use toSorted)
```

### String Interpolation

```typescript
// ✅ Template literals
const message = `User ${user.firstName} has ${orderCount} orders`;

// ❌ String concatenation
const message = "User " + user.firstName + " has " + orderCount + " orders";
```

### Optional Chaining and Nullish Coalescing

```typescript
// ✅ Optional chaining for nested access
const city = user?.address?.city;

// ✅ Nullish coalescing for defaults (only on null/undefined)
const name = user.firstName ?? "Unknown";

// ❌ Logical OR for defaults (catches empty string, 0, false too)
const name = user.firstName || "Unknown";  // ❌ "" becomes "Unknown"

// ✅ Combined
const displayName = user?.profile?.displayName ?? user?.firstName ?? "User";
```

### Array and Object Destructuring

```typescript
// ✅ Destructure for clarity
const { id, email, firstName } = user;
const [firstItem, ...rest] = items;

// ✅ Rename when needed
const { firstName: givenName } = user;

// ✅ Default values
const { role = "customer" } = user;
```

### No Magic Numbers/Strings

```typescript
// ❌ Magic numbers
if (user.loginAttempts >= 5) { ... }
setTimeout(runJob, 86400000);

// ✅ Named constants
const MAX_LOGIN_ATTEMPTS = 5;
const ONE_DAY_MS = 86_400_000;

if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) { ... }
setTimeout(runJob, ONE_DAY_MS);
```

### Prefer `for...of` over Traditional For Loops

```typescript
// ✅ for...of (clean, works with async)
for (const item of items) {
  await processItem(item);
}

// ❌ Traditional for (only when index is needed)
for (let i = 0; i < items.length; i++) { ... }  // Only when index matters

// ❌ forEach with async (bug-prone)
items.forEach(async (item) => { await processItem(item); });  // ❌ Doesn't await
```

### No Classes Without Methods

```typescript
// ❌ Class used as data bag
class UserDto {
  id: string;
  email: string;
}

// ✅ Interface or type for data
interface UserDto {
  id: string;
  email: string;
}

// ✅ Class with behavior
class Money {
  constructor(private amount: number, private currency: string) {}
  add(other: Money): Money { ... }
  format(locale: string): string { ... }
}
```

---

## Tooling Configuration

### ESLint (via `@alharistech/config/eslint/base`)

```js
// Root ESLint config inherits from shared config
module.exports = {
  root: true,
  extends: ["@alharistech/config/eslint/base"],
  rules: {
    // Project-specific overrides (rare)
  },
};
```

### Prettier (`.prettierrc`)

```json
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": false,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### EditorConfig (`.editorconfig`)

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false
```

---

## CI Enforcement

```bash
# Quality gates in CI
pnpm run format:check   # Prettier format check
pnpm run lint           # ESLint
pnpm run typecheck      # TypeScript strict check
pnpm run test           # Unit + Integration tests
pnpm run build          # Full production build
```
