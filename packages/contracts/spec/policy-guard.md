# PolicyGuard Specification

## Status: Design Specification (Sprint 0.5/1)

---

## 1. Overview

**Component:** `PolicyGuard`
**Type:** NestJS Guard (`CanActivate`)
**Purpose:** Evaluates RBAC (Role-Based Access Control) policies from the centralized access-control policy specification. Runs AFTER authentication (AuthGuard) and request validation (ContractGuard), but BEFORE the controller. Determines whether the authenticated user is authorized to perform the requested action on the target resource.

**Default deny:** If no policy matches, access is denied (priority 0 wildcard deny-all rule in `access-control.yaml`).

**Source of truth:** `specs/contracts/policy/access-control.yaml` — 162 policy rules covering all 9 domains, 5 roles, and 50+ resources.

---

## 2. Interface

### 2.1 NestJS Interface

Implements `CanActivate` from `@nestjs/common`:

```
class PolicyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean>
}
```

### 2.2 Registration

Applied globally via `APP_GUARD` provider. Uses:
- `@Public()` decorator to skip for unauthenticated endpoints
- `@RequirePermission(permission)` decorator for explicit permission checks
- `@RequireRole(role)` decorator for simple role checks
- `@SkipPolicyGuard()` decorator to bypass policy evaluation

### 2.3 Decorators

| Decorator | Purpose |
|:---|:---|
| `@Public()` | Skip PolicyGuard entirely (endpoint is public). Already used by AuthGuard — PolicyGuard must also respect it. |
| `@RequirePermission(permission: string)` | Enforce specific permission: `"users:create"`, `"orders:delete"` |
| `@RequireRole(...roles: UserRole[])` | Enforce specific role(s): `RequireRole(UserRole.ADMIN)` |
| `@SkipPolicyGuard()` | Bypass policy evaluation for this handler (e.g., internal service-to-service calls) |
| `@Resource(resourceType: string, ownerIdParam?: string)` | Declare the resource type and owner ID parameter for ownership checks |

---

## 3. Behavior

### 3.1 Policy Evaluation Flow

```
Request (authenticated, validated)
  │
  ├─ 0. Skip Check
  │     If @Public() or @SkipPolicyGuard() → return true
  │
  ├─ 1. Context Extraction
  │     Extract from JWT (request.user):
  │       $caller.id         → user.sub
  │       $caller.role       → user.role
  │       $caller.customerId → user.customerId (if customer role)
  │       $caller.ip         → request.ip
  │
  │     Extract from route:
  │       resource type      → from @Resource() decorator or route pattern
  │       action             → from HTTP method + route pattern
  │       resource owner id  → from route param (e.g., :id, :userId)
  │       $now               → new Date().toISOString()
  │
  ├─ 2. Route-to-Resource Mapping
  │     Map HTTP route to policy resource identifier:
  │       GET /api/v1/users → identity:users → read
  │       DELETE /api/v1/users/:id → identity:users → delete
  │       POST /api/v1/orders/:id/assign → service:order_assignment → create
  │     Pre-built mapping from service-catalog.yaml:
  │       {path, method} → {domain}:{resource} + action
  │
  ├─ 3. Policy Loading
  │     Load compiled policy rules from cache or PolicyEngine
  │     Policies are pre-parsed from access-control.yaml at startup
  │
  ├─ 4. Filter Matching Policies
  │     Match policies where:
  │       (user.role IN policy.roles) OR (policy.roles contains "*")
  │       AND (policy.resources contains resource OR "*")
  │       AND (policy.actions contains action OR "*")
  │     Result: set of candidate policies
  │
  ├─ 5. Priority Sort
  │     Sort matching policies by priority DESC (100 → 0)
  │
  ├─ 6. Sequential Evaluation
  │     For each candidate policy (highest priority first):
  │       If effect = "deny":
  │         → Deny immediately (explicit denials override everything below)
  │       If effect = "allow":
  │         Evaluate conditions:
  │           All conditions must pass (AND logic)
  │           Each condition evaluated against current context
  │         If all conditions pass:
  │           → Allow (return true)
  │         If any condition fails:
  │           → Continue to next lower-priority policy
  │
  ├─ 7. Fallback
  │     If no matching policy grants allow:
  │       → Default deny (priority 0 wildcard deny-all rule)
  │       → Return false / throw ForbiddenException
  │
  └─ Result: true (allow) or false / ForbiddenException (deny)
```

### 3.2 Condition Evaluation

Policy conditions in `access-control.yaml` use the following operators:

| Operator | Description | Example |
|:---|:---|:---|
| `equals` | Exact match | `field: "id", operator: "equals", value: "$caller.id"` |
| `in` | Value in array | `field: "visibility", operator: "in", value: ["overview", "team"]` |
| `owns` | Ownership check: `$caller.id === $resource.owner_id` | Checks if caller is the resource owner |
| `has_role` | Check caller role | `field: "role", operator: "has_role", value: "admin"` |
| `contains` | Array contains value | Check if array field contains a specific element |
| `regex` | Regex match | `field: "email", operator: "regex", value: "@alharistech\\.com$"` |
| `greater_than` | Numeric > | `field: "amount", operator: "greater_than", value: 100` |
| `less_than` | Numeric < | `field: "amount", operator: "less_than", value: 1000` |

### 3.3 Variable Resolution

Policy conditions reference context variables prefixed with `$`:

| Variable | Source | Example Value |
|:---|:---|:---|
| `$caller.id` | JWT `sub` | `"018f9a92-3c5f-7a8b-9c0d-1e2f3a4b5c6d"` |
| `$caller.role` | JWT `role` | `"customer"` |
| `$caller.customerId` | JWT `customerId` | `"018f9a93-4d6e-8b9c-1d2e-3f4a5b6c7d8e"` (null for non-customer) |
| `$caller.ip` | `request.ip` | `"192.168.1.1"` |
| `$resource.owner_id` | Route param or DB lookup | Resolved from `:id` param for resource type |
| `$resource.type` | Route pattern mapping | `"identity:users"` |
| `$now` | `new Date()` | `"2026-06-20T12:00:00.000Z"` |

### 3.4 Ownership Check (`owns` operator)

The `owns` operator checks whether the caller owns the resource:

```
operator: "owns"
value: "$caller.id"        → checks $caller.id === $resource.owner_id
value: "$caller.customerId" → checks $caller.customerId === $resource.customer_id
```

Implementation:
1. Extract resource ID from route param (e.g., `/users/:id`)
2. If owner_id is not the same field as the route param, perform a database lookup:
   - `SELECT owner_id FROM {resource} WHERE id = :id`
   - Compare owner_id to $caller.id
3. Cache ownership lookups per request (avoid duplicate DB queries)

### 3.5 Route-to-Resource Mapping

Pre-built mapping derived from `service-catalog.yaml` and `access-control.yaml` resource mapping section:

```
const routeResourceMap = {
  "GET:/api/v1/users":             { resource: "identity:users",     action: "read" },
  "POST:/api/v1/users":            { resource: "identity:users",     action: "create" },
  "GET:/api/v1/users/:id":         { resource: "identity:users",     action: "read" },
  "PATCH:/api/v1/users/:id/role":  { resource: "identity:roles",     action: "update" },
  "POST:/api/v1/orders":           { resource: "service:service_orders", action: "create" },
  "GET:/api/v1/orders":            { resource: "service:service_orders", action: "read" },
  // ... all 149 endpoints
};
```

Generated at build time from `service-catalog.yaml`.

### 3.6 Priority-Based Evaluation Detail

The policy evaluation model follows the spec in `access-control.yaml`:

1. Collect all policies matching `(role IN roles OR roles contains "*") AND resource AND action`
2. Sort by priority descending
3. Evaluate in priority order:
   - If `effect: deny` → deny immediately (explicit deny at ANY priority wins)
   - If `effect: allow` AND all conditions pass → allow
   - If `effect: allow` AND any condition fails → continue to next policy
4. If no policy grants allow → fall to default deny (priority 0)

**Example with identity:users, read, customer role (customer reading their own data):**

```
Priority 100: admin/manager full access → doesn't match (customer role)
Priority 50:  employee/customer/partner read own user(id=caller.id) → MATCHES
  → Check condition: field=id, operator=equals, value=$caller.id
  → Route param :id matches caller's id → ALLOW
  → Return true
```

---

## 4. Error Format

### 4.1 Access Denied

When access is denied (no matching allow policy, or explicit deny):

```yaml
error:
  code: "INSUFFICIENT_PERMISSIONS"
  message: "ليس لديك صلاحية للوصول إلى هذا المورد"
  message_en: "You do not have permission to access this resource"
  statusCode: 403
  details:
    resource: "identity:users"
    action: "delete"
    requiredRoles: ["admin"]
    userRole: "customer"
meta:
  timestamp: "2026-06-20T12:00:00Z"
  requestId: "018f9a92-3c5f-7a8b-9c0d-1e2f3a4b5c6d"
```

**Security note:** Error details should NOT reveal which specific roles or permissions are required in production. The `requiredRoles` and detailed info are only included when `NODE_ENV=development` or when the caller has admin role. In production, return a generic "Insufficient permissions" message.

### 4.2 Authentication Required

When no JWT is present (PolicyGuard runs after AuthGuard, so this is caught by AuthGuard first):

```yaml
error:
  code: "UNAUTHORIZED"
  message: "يجب تسجيل الدخول أولاً"
  message_en: "Authentication required"
  statusCode: 401
```

---

## 5. Policy Compilation & Caching

### 5.1 Policy Compilation

At startup (or on policy reload), `access-control.yaml` is parsed and compiled into an optimized in-memory structure:

```
interface CompiledPolicy {
  id: string;                    // hash of policy definition
  effect: 'allow' | 'deny';
  roles: Set<string>;
  resources: Set<string>;        // supports wildcard "*"
  actions: Set<string>;          // supports wildcard "*"
  conditions: Condition[];       // parsed + compiled condition functions
  priority: number;              // 0-100
}

interface Condition {
  field: string;
  operator: 'equals' | 'in' | 'owns' | 'has_role' | 'contains' | 'regex' | 'greater_than' | 'less_than';
  value: any;                    // resolved (may contain $variables at eval time)
  evaluate(context: PolicyContext): boolean;  // compiled evaluation function
}
```

Compilation steps:
1. Parse YAML → policy objects
2. Normalize roles, resources, actions (lowercase, trim)
3. Compile conditions into evaluation functions
4. Pre-compute indexes for fast lookups:
   - Index by role → Set<CompiledPolicy>
   - Index by role+resource → Set<CompiledPolicy>
5. Sort all policies by priority

### 5.2 Caching

| Cache Layer | Storage | TTL | Key |
|:---|:---|:---|:---|
| Compiled policies | In-memory (process) | Until reload | N/A — global singleton |
| Role-to-policy index | In-memory | Until reload | N/A |
| Ownership DB lookups | Redis | 30 seconds | `policy:owns:{resourceType}:{resourceId}` |
| Policy evaluation result | Redis | 5 seconds | `policy:eval:{userId}:{resource}:{action}:{resourceId}` |

### 5.3 Policy Reloading

Policies can be reloaded without restart:
- **File watcher (dev):** Watch `access-control.yaml` for changes → recompile
- **Redis pub/sub (prod):** Subscribe to `schema:updated` channel, message `{type: "policy"}` → recompile
- **Admin API:** `POST /api/system/policies/reload` → recompile
- **Atomic swap:** Compile new policies → validate (all must parse) → atomically swap reference

---

## 6. Performance Budget

| Metric | Target | Notes |
|:---|:---|:---|
| Policy evaluation (no conditions) | < 0.1ms | Simple role+resource+action match |
| Policy evaluation (with conditions) | < 1ms | Includes variable resolution + condition checks |
| Policy evaluation (with DB ownership lookup) | < 5ms | Includes Redis/DB lookup for resource owner |
| Full evaluation (cache miss, worst case) | < 10ms | 162 policies, all conditions evaluated |
| Cache hit (repeated request) | < 0.5ms | Redis cache hit |
| Policy compilation (162 rules) | < 100ms | At startup or reload |

**Monitoring:** Prometheus metric `policy_guard_duration_ms` histogram with labels `{effect: allow|deny, conditions: none|simple|ownership}`.

---

## 7. Error Handling

| Scenario | HTTP Code | Behavior |
|:---|:---|:---|
| No matching allow policy | 403 | Return standardized INSUFFICIENT_PERMISSIONS error |
| Explicit deny policy matched | 403 | Return standardized error (same format) |
| Condition evaluation error | 500 | Fail-closed: deny access + log error + alert |
| Policy file not found / unparseable | 500 | Fail-closed: deny all + log error + P0 alert |
| Variable resolution failure | 500 | Fail-closed: deny access + log error |
| DB ownership lookup failure | 500 | Fail-closed: deny access + log error |
| User has no role | 403 | Treat as unauthenticated/unauthorized |
| Redis cache failure | (skip cache) | Fall through to full evaluation |
| Context extraction failure (no JWT) | 401 | Delegate to AuthGuard |

---

## 8. Configuration

### 8.1 Environment Variables

| Variable | Type | Default | Description |
|:---|:---|:---|
| `POLICY_FILE_PATH` | string | `specs/contracts/policy/access-control.yaml` | Path to policy file |
| `POLICY_CACHE_ENABLED` | boolean | `true` | Enable Redis result caching |
| `POLICY_CACHE_TTL` | integer | `5` | Result cache TTL in seconds |
| `POLICY_OWNERSHIP_CACHE_TTL` | integer | `30` | Ownership lookup cache TTL in seconds |
| `POLICY_STRICT_MODE` | boolean | `true` | Reject requests when policy file is invalid |
| `POLICY_DEV_DETAILED_ERRORS` | boolean | `false` | Include detailed error info in 403 responses |

---

## 9. Integration Points

| System | Direction | Purpose |
|:---|:---|:---|
| AuthGuard | Upstream | Extracts JWT → sets request.user (PolicyGuard depends on this) |
| ContractGuard | Upstream | Validates request before policy evaluation |
| SchemaRegistry | Reads | Get compiled policies |
| Redis | Reads/Writes | Policy evaluation cache, ownership cache |
| Logger | Writes | Log access denied events at WARN level |
| Prometheus | Writes | Export `policy_guard_duration_ms` and `policy_guard_denials_total` |

### 9.1 Execution Order in Guard Chain

```
1. AuthGuard         → request.user populated
2. ThrottlerGuard    → rate limit
3. ContractGuard     → request body/params validated
4. PolicyGuard       → RBAC authorization  ← THIS COMPONENT
5. Controller        → business logic
```

---

## 10. Testing Strategy

### 10.1 Unit Tests

| Test | Description |
|:---|:---|
| `should allow admin to read any user` | Admin role + identity:users read → ALLOW |
| `should allow customer to read own user` | Customer + identity:users read + owns condition(id=caller.id) → ALLOW |
| `should deny customer reading other user` | Customer + identity:users read + owns condition(id≠caller.id) → DENY |
| `should deny unauthenticated access` | No JWT → DENY |
| `should deny employee deleting user` | Employee + identity:users delete → DENY (not in any allow policy) |
| `should allow public * role for public endpoints` | roles=["*"] + public resource → ALLOW |
| `should respect explicit deny over lower priority allow` | deny at priority 50 + allow at priority 40 → DENY |
| `should allow higher priority allow over lower priority deny` | allow at priority 60 + deny at priority 40 → ALLOW |
| `should evaluate multiple conditions (AND logic)` | 2 conditions → both must pass |
| `should resolve $caller.id variable` | Condition value "$caller.id" → substituted with actual user ID |
| `should use cached result on subsequent same request` | Second identical request → cache hit |
| `should re-compile policies on file change` | Modify access-control.yaml → new policies loaded |

### 10.2 Integration Tests

| Test | Description |
|:---|:---|
| `should evaluate all 162 policies without errors` | Compile and validate all policies |
| `should load policy file from YAML` | Parse access-control.yaml correctly |
| `should map all 184 routes to policy resources` | Route-to-resource mapping covers all endpoints |
| `should not exceed 1ms for typical evaluation` | Benchmark with realistic policies |

### 10.3 E2E Tests

| Test | Description |
|:---|:---|
| `admin GET /api/v1/users → 200` | Admin accesses user list |
| `customer GET /api/v1/users → 403` | Customer denied from user list |
| `customer GET /api/v1/users/me → 200` | Customer accesses own profile |
| `customer DELETE /api/v1/users/:id → 403` | Customer denied from deleting users |
| `unauthenticated GET /api/v1/services → 200` | Public endpoint, wildcard role |

---

## 11. Dependencies

### 11.1 Runtime Dependencies

| Package | Version | Purpose |
|:---|:---|:---|
| `@nestjs/common` | ^10.x | Guard lifecycle, decorators |
| `@nestjs/core` | ^10.x | ExecutionContext, Reflector |
| `js-yaml` | ^4.x | YAML policy file parsing |
| `ioredis` | ^5.x | Redis client for caching |

### 11.2 Dev Dependencies

| Package | Version | Purpose |
|:---|:---|:---|
| `@nestjs/testing` | ^10.x | Guard unit testing |

---

## 12. Implementation Notes

### 12.1 Policy Indexing for Fast Lookup

The 162 policies should be indexed for O(1) lookup by role:

```
// After compilation:
const policiesByRole: Map<string, CompiledPolicy[]> = new Map();
const wildcardPolicies: CompiledPolicy[] = [];  // policies with roles=["*"]

// Lookup:
function findCandidatePolicies(role: string): CompiledPolicy[] {
  const rolePolicies = policiesByRole.get(role) || [];
  return [...rolePolicies, ...wildcardPolicies];
}
```

### 12.2 Condition Function Compilation

Conditions are compiled into functions for fast execution:

```
function compileCondition(cond: RawCondition): (ctx: PolicyContext) => boolean {
  switch (cond.operator) {
    case 'equals':
      if (cond.value.startsWith('$')) {
        const varPath = cond.value.slice(1).split('.');
        return (ctx) => resolveVar(ctx, varPath) === ctx.resource[cond.field];
      }
      return (ctx) => ctx.resource[cond.field] === cond.value;
    case 'owns':
      // ownership: check $caller.{property} === resource.owner_{property}
      const varPath = cond.value.slice(1).split('.');
      return (ctx) => resolveVar(ctx, varPath) === ctx.resource.owner_id;
    // ... other operators
  }
}
```

### 12.3 Variable Resolution

```
function resolveVar(ctx: PolicyContext, path: string[]): any {
  let value: any = ctx;
  for (const key of path) {
    value = value?.[key];
  }
  return value;
}
```

### 12.4 Audit Logging

Every access denial MUST be logged with:
- `actor.id`, `actor.role`, `actor.ip`
- `resource.type`, `resource.id`
- `action`
- `matchedPolicies` (which policies were evaluated)
- `denyReason` (no match, explicit deny, condition failed)

Access grants are logged at DEBUG level. Access denials are logged at WARN level.

### 12.5 Security Considerations

- **Timing attack prevention:** Policy evaluation time should not reveal whether a resource exists (e.g., ownership check should take the same time whether or not the resource is found)
- **No information leakage in 403:** Don't reveal which specific permission is missing in production responses
- **Policy file integrity:** Validate YAML at load time, reject corrupted files, keep previous valid version
- **Race condition on reload:** Use atomic swap (load new → validate → atomically replace reference)

### 12.6 Future Considerations

- **ABAC extensions:** Support attribute-based conditions (time-of-day, IP range, device type)
- **Delegated administration:** Allow managers to create custom policies for their team (scoped to their domain)
- **Policy simulation:** `POST /api/system/policies/simulate` — test "what would happen if user X tried action Y"
- **Policy version history:** Track policy changes with audit trail
- **Policy testing framework:** Unit-test-like framework for policy rules
