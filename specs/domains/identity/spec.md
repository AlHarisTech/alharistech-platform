# Identity Domain Specification
## نطاق الهوية والمصادقة — AlharisTech Platform

**Domain ID:** `identity`
**Version:** 0.1.0-DRAFT
**Status:** Draft
**Phase:** Phase 1
**Owner:** Tech Lead

---

## 1. Bounded Context

### Boundaries
The Identity domain is responsible for:
- User registration and account management
- Authentication (login, logout, token management)
- Authorization (roles, permissions, RBAC)
- Session management
- Password management (reset, change)

### What Identity does NOT manage
- Customer profiles (→ Customer domain)
- Employee details (→ belongs to Identity user + Customer domain extension)
- Notification delivery (→ delegates to Notification domain)

### Relationships
```
Identity ──► authenticates ──► ALL other domains
Identity ──► publishes UserRegistered ──► Customer, Notification
Identity ──► publishes UserLoggedIn ──► Analytics
```

---

## 2. Aggregates

### 2.1 User Aggregate
**Root Entity:** User

| Property | Type | Constraints |
|:---|:---|:---|
| id | UUID v7 | PK |
| email | VARCHAR(255) | Unique, valid email |
| password_hash | VARCHAR(255) | bcrypt/argon2 |
| first_name_ar | VARCHAR(100) | Required |
| last_name_ar | VARCHAR(100) | Required |
| first_name_en | VARCHAR(100) | Optional |
| last_name_en | VARCHAR(100) | Optional |
| phone | VARCHAR(20) | Optional, E.164 format |
| role | ENUM(admin, manager, employee, customer, partner) | Required |
| is_active | BOOLEAN | Default: true |
| is_verified | BOOLEAN | Default: false |
| failed_login_attempts | INTEGER | Default: 0 |
| locked_until | TIMESTAMP | Nullable |
| last_login_at | TIMESTAMP | Nullable |
| created_at | TIMESTAMP | Auto |
| updated_at | TIMESTAMP | Auto |

### 2.2 Session Aggregate
**Root Entity:** RefreshToken

| Property | Type | Constraints |
|:---|:---|:---|
| id | UUID v7 | PK |
| user_id | UUID | FK → users.id |
| token_hash | VARCHAR(255) | Hashed refresh token |
| device_info | JSONB | User agent, IP |
| expires_at | TIMESTAMP | 7 days from creation |
| revoked_at | TIMESTAMP | Nullable |
| replaced_by | UUID | FK → refresh_tokens.id (rotation) |
| created_at | TIMESTAMP | Auto |

### 2.3 Permission Aggregate
**Root Entity:** Permission

| Property | Type | Constraints |
|:---|:---|:---|
| id | UUID v7 | PK |
| resource | VARCHAR(100) | e.g., "orders", "customers", "products" |
| action | VARCHAR(50) | e.g., "create", "read", "update", "delete" |
| description | VARCHAR(255) | Human-readable |

**Role-Permission mapping (RBAC Matrix):**

| Resource | Admin | Manager | Employee | Customer | Partner |
|:---|:---|:---|:---|:---|:---|
| users | CRUD | Read | Read (self) | Read (self) | Read (self) |
| roles | CRUD | Read | — | — | — |
| customers | CRUD | CRUD | Read | — | Read (assigned) |
| orders | CRUD | CRUD | CRUD (assigned) | Create, Read (own) | Read (assigned) |
| products | CRUD | CRUD | Read | Read | Read |
| tickets | CRUD | CRUD | CRUD (assigned) | Create, Read (own) | — |
| content | CRUD | CRUD | CRUD (assigned) | Read | — |
| analytics | Read | Read | — | — | Read (own) |

---

## 3. Domain Events

| Event | Trigger | Payload | Consumers |
|:---|:---|:---|:---|
| `UserRegistered` | New user signs up | `{ userId, email, role, timestamp }` | Customer (create profile), Notification (welcome email) |
| `UserVerified` | Email verified | `{ userId, timestamp }` | Customer (activate profile) |
| `UserLoggedIn` | Successful login | `{ userId, ip, device, timestamp }` | Analytics (login metrics) |
| `UserLoggedOut` | Logout | `{ userId, sessionId, timestamp }` | — |
| `PasswordChanged` | Password reset/change | `{ userId, timestamp }` | Notification (confirmation email), revoke other sessions |
| `RoleChanged` | Admin changes user role | `{ userId, oldRole, newRole, changedBy }` | Audit log |
| `AccountLocked` | Too many failed attempts | `{ userId, reason, timestamp }` | Notification (security alert) |
| `AccountDisabled` | Admin disables account | `{ userId, disabledBy, timestamp }` | Revoke all sessions |

---

## 4. Use Cases

### UC-AUTH-01: User Registration
**Actor:** Visitor
**Preconditions:** Email not already registered
**Flow:**
1. Visitor submits registration form (email, password, first_name_ar, last_name_ar)
2. System validates inputs (Zod schema)
3. System checks email uniqueness
4. System hashes password (argon2id)
5. System creates User with role="customer", is_verified=false
6. System generates email verification token (JWT, 24h expiry)
7. System publishes `UserRegistered` event
8. System sends verification email
9. Response: 201 Created

**Exceptions:**
- Email already registered → 409 Conflict
- Validation failure → 422 Unprocessable Entity

### UC-AUTH-02: Email Verification
**Actor:** User (via email link)
**Preconditions:** User exists, not verified, token valid
**Flow:**
1. User clicks verification link (token in URL)
2. System validates JWT token
3. System sets is_verified=true
4. System publishes `UserVerified` event
5. Response: 200 OK (redirect to login)

### UC-AUTH-03: Login
**Actor:** User
**Preconditions:** User exists, is_active=true, not locked
**Flow:**
1. User submits credentials (email, password)
2. System finds user by email
3. System checks account not locked
4. System verifies password (argon2 verify)
5. On success:
   - Reset failed_login_attempts to 0
   - Set last_login_at = now
   - Generate access token (JWT, 15min, contains userId + role + permissions)
   - Generate refresh token (opaque, 7d, stored hashed)
   - Store refresh token with device info
   - Publish `UserLoggedIn`
   - Response: 200 { accessToken, refreshToken, expiresIn: 900 }
6. On failure:
   - Increment failed_login_attempts
   - If failed_login_attempts ≥ 5: lock account (30min), publish `AccountLocked`
   - Response: 401 Unauthorized

### UC-AUTH-04: Token Refresh
**Actor:** Authenticated client
**Preconditions:** Valid refresh token, not revoked
**Flow:**
1. Client sends refresh token
2. System hashes and looks up token
3. System validates: exists, not revoked, not expired
4. System revokes old refresh token (rotation)
5. System generates new access token + new refresh token
6. System stores new refresh token (linking to revoked one via replaced_by)
7. Response: 200 { accessToken, refreshToken }

**Security:** If a revoked token is reused → revoke ALL user's refresh tokens (token reuse detection)
5. System generates new access + refresh token pair

### UC-AUTH-05: Password Reset
**Actor:** User (forgot password)
**Flow:**
1. User submits email
2. System finds user by email (don't reveal if not found)
3. System generates reset token (JWT, 1h expiry)
4. System sends reset email with link
5. User clicks link, submits new password
6. System validates new password
7. System updates password_hash
8. System publishes `PasswordChanged`
9. System revokes all refresh tokens
10. Response: 200 OK

### UC-AUTH-06: Role Management (Admin)
**Actor:** Admin
**Preconditions:** Authenticated as admin
**Flow:**
1. Admin requests role change for user
2. System validates admin has permission
3. System updates user role
4. System publishes `RoleChanged`
5. System revokes user's active sessions (force re-login with new role)
6. Response: 200 OK

---

## 5. API Specification

### Endpoints

| Method | Path | Auth | Role | Description |
|:---|:---|:---|:---|:---|
| POST | /api/v1/auth/register | Public | — | Register new user |
| POST | /api/v1/auth/verify-email | Public | — | Verify email token |
| POST | /api/v1/auth/login | Public | — | Login |
| POST | /api/v1/auth/refresh | Public | — | Refresh tokens |
| POST | /api/v1/auth/logout | Required | Any | Logout (revoke refresh token) |
| POST | /api/v1/auth/forgot-password | Public | — | Request password reset |
| POST | /api/v1/auth/reset-password | Public | — | Reset password with token |
| GET | /api/v1/users/me | Required | Any | Get current user profile |
| PATCH | /api/v1/users/me | Required | Any | Update own profile |
| GET | /api/v1/users | Required | Admin, Manager | List users (paginated) |
| GET | /api/v1/users/{id} | Required | Admin, Manager | Get user by ID |
| PATCH | /api/v1/users/{id}/role | Required | Admin | Change user role |
| POST | /api/v1/users/{id}/disable | Required | Admin | Disable account |
| POST | /api/v1/users/{id}/enable | Required | Admin | Enable account |

### Request/Response Schemas

**POST /api/v1/auth/register — Request:**
```json
{
  "email": "string (valid email)",
  "password": "string (min 8, 1 upper, 1 lower, 1 digit, 1 special)",
  "first_name_ar": "string (1-100)",
  "last_name_ar": "string (1-100)",
  "first_name_en": "string (optional, 1-100)",
  "last_name_en": "string (optional, 1-100)",
  "phone": "string (optional, E.164)"
}
```

**POST /api/v1/auth/login — Response:**
```json
{
  "data": {
    "accessToken": "string (JWT)",
    "refreshToken": "string (opaque)",
    "expiresIn": 900,
    "user": {
      "id": "uuid",
      "email": "string",
      "first_name_ar": "string",
      "last_name_ar": "string",
      "role": "string"
    }
  },
  "meta": {
    "timestamp": "ISO8601"
  }
}
```

**Error Response Envelope:**
```json
{
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "البريد الإلكتروني أو كلمة المرور غير صحيحة",
    "message_en": "Invalid email or password",
    "statusCode": 401,
    "details": {}
  },
  "meta": {
    "timestamp": "ISO8601",
    "requestId": "uuid"
  }
}
```

---

## 6. Business Rules

1. **RB-IDENTITY-01:** Email must be unique across all users (active and disabled)
2. **RB-IDENTITY-02:** Password minimum 8 characters; must contain uppercase, lowercase, digit, and special character
3. **RB-IDENTITY-03:** Account locks for 30 minutes after 5 consecutive failed login attempts
4. **RB-IDENTITY-04:** Password reset tokens expire after 1 hour
5. **RB-IDENTITY-05:** Email verification tokens expire after 24 hours
6. **RB-IDENTITY-06:** Access tokens expire after 15 minutes; refresh tokens after 7 days
7. **RB-IDENTITY-07:** Refresh token rotation: each refresh revokes the previous token
8. **RB-IDENTITY-08:** Token reuse detection: if revoked token is reused, revoke ALL user tokens
9. **RB-IDENTITY-09:** Role change revokes all active sessions (force re-login)
10. **RB-IDENTITY-010:** Admin role cannot be self-assigned; requires existing Admin
11. **RB-IDENTITY-011:** Password change revokes all refresh tokens except current session
12. **RB-IDENTITY-012:** Disabled accounts cannot login; their tokens are invalidated

---

## 7. Security

### Authentication
- **JWT Access Tokens:** RS256, 15-minute expiry, contains userId + role + permissions array
- **Refresh Tokens:** Opaque (crypto.randomUUID), stored as SHA-256 hash, 7-day expiry
- **Rate Limiting:** Login: 5 attempts/minute/IP; Registration: 3/hour/IP

### Password Policy
- Algorithm: argon2id (memory: 65536 KiB, iterations: 3, parallelism: 4)
- Min length: 8, Max length: 128
- Must contain: uppercase, lowercase, digit, special character
- Password history: last 5 passwords cannot be reused

### Session Security
- Max concurrent sessions per user: 10
- Inactive session timeout: 30 minutes (configurable)
- Device tracking: IP, User-Agent stored with refresh token

---

## 8. Testing

### Test Scenarios

**Happy Path:**
1. User registers → verifies email → logs in → accesses protected resource
2. Admin creates user → user logs in → admin changes role → user forced to re-login
3. Token expires → refresh with valid token → get new pair

**Edge Cases:**
4. Registration with existing email → 409
5. Login with unverified email → still allowed (verification is optional for login)
6. Refresh with revoked token → 401 + all tokens revoked (reuse detection)
7. Concurrent login from 2 devices → both sessions valid
8. Login attempt #5 → account locked → attempt #6 during lock → 423 Locked
9. Lock expires → login succeeds → failed_attempts reset to 0

**Error Cases:**
10. Login with wrong password → 401 + failed_attempts incremented
11. Access protected route without token → 401
12. Access admin route as customer → 403
13. Register with weak password → 422 with validation details
14. Reset password with expired token → 401

**Security Cases:**
15. Brute force: 5 attempts → lock → further attempts blocked → alert
16. Token reuse: revoked token reused → all sessions revoked → security alert
