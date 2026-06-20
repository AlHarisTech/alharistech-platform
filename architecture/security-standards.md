# Security Standards — AlharisTech Platform

## Overview

This document defines the complete security standards for the AlharisTech platform. Security is a first-class concern, integrated into every layer of the architecture, every CI pipeline, and every code review. These standards align with OWASP Top 10 and industry best practices for SaaS platforms.

---

## Authentication

### JWT Access Token

| Property | Value |
|:---|:---|
| Algorithm | RS256 (asymmetric) or HS256 (symmetric, for single service) |
| Lifetime | 15 minutes |
| Payload | sub, email, role, permissions, iat, exp, iss, jti |
| Storage (web) | In-memory variable (not localStorage/sessionStorage) |
| Storage (mobile) | Secure storage (expo-secure-store, Keychain/Keystore) |
| Transmission | Authorization: Bearer header (never in URL) |

### Refresh Token

| Property | Value |
|:---|:---|
| Format | Opaque random string (256-bit entropy) |
| Lifetime (absolute) | 7 days |
| Lifetime (sliding) | Extended on each use, max 30 days total |
| Storage | httpOnly, Secure, SameSite=Strict cookie |
| Rotation | Mandatory — every use issues new token, invalidates old |
| Reuse detection | If a previously-used refresh token is presented, revoke ALL tokens for that user |

```typescript
// NestJS JWT configuration
// config/jwt.config.ts
export const jwtConfig = {
  access: {
    secret: process.env.JWT_ACCESS_SECRET,
    expiresIn: "15m",
    algorithm: "HS256",
  },
  refresh: {
    secret: process.env.JWT_REFRESH_SECRET,
    expiresIn: "7d",
    algorithm: "HS256",
  },
};
```

### Password Policy

| Rule | Requirement |
|:---|:---|
| Minimum length | 8 characters |
| Maximum length | 128 characters (bcrypt limit) |
| Complexity | At least 1 uppercase + 1 lowercase + 1 digit + 1 special character |
| Common passwords | Reject top 100,000 known passwords (Have I Been Pwned API) |
| History | Cannot reuse last 5 passwords |
| Expiry | 90 days (for admin/employee roles) |
| Rate limit | 5 login attempts per email per minute |

### Password Hashing

```typescript
// ✅ Use bcrypt with cost factor 12 (or argon2id)
import { hash, compare } from "bcryptjs";

const SALT_ROUNDS = 12;

async function hashPassword(password: string): Promise<string> {
  return hash(password, SALT_ROUNDS);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return compare(password, hash);
}

// Argon2id (preferred when available — more resistant to GPU attacks)
// import { hash, verify } from "argon2";
// const hash = await argon2.hash(password, { type: argon2id, memoryCost: 65536 });
```

### Multi-Factor Authentication (Future Phase)

```
TOTP-based MFA (Time-based One-Time Password)
  - Required for admin roles
  - Optional for employees
  - QR code enrollment via authenticator apps
  - Backup recovery codes (10, single-use)
```

---

## Authorization

### RBAC (Role-Based Access Control)

```typescript
// Roles (hierarchical):
enum UserRole {
  SUPER_ADMIN = "super_admin",     // Platform-wide
  ADMIN = "admin",                 // Admin dashboard
  EMPLOYEE = "employee",           // Operational staff
  CUSTOMER = "customer",           // End customer
  GUEST = "guest",                 // Unauthenticated
}

// Permissions (granular):
const permissions = {
  // Users
  "users:read": [SUPER_ADMIN, ADMIN],
  "users:create": [SUPER_ADMIN, ADMIN],
  "users:update": [SUPER_ADMIN, ADMIN],
  "users:delete": [SUPER_ADMIN],

  // Orders
  "orders:read": [SUPER_ADMIN, ADMIN, EMPLOYEE, CUSTOMER],
  "orders:create": [CUSTOMER],
  "orders:update": [SUPER_ADMIN, ADMIN, EMPLOYEE],
  "orders:cancel": [SUPER_ADMIN, ADMIN, CUSTOMER],

  // Reports
  "reports:view": [SUPER_ADMIN, ADMIN],
  "reports:export": [SUPER_ADMIN],
};
```

### NestJS Guard Implementation

```typescript
import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const PERMISSIONS_KEY = "permissions";
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

// Usage:
@Controller("users")
export class UsersController {
  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async findAll() { ... }

  @Delete(":id")
  @RequirePermission("users:delete")
  async remove(@Param("id") id: string) { ... }
}
```

### Data-Level Authorization

```typescript
// Customers can only see their own orders
// This is enforced at the repository level, not just the controller
@Injectable()
export class OrdersRepository {
  async findByCustomer(userId: string, filters: OrderFilters): Promise<Order[]> {
    return prisma.order.findMany({
      where: {
        customerId: userId,  // Enforced at query level
        ...filters,
      },
    });
  }
}
```

---

## Input Validation

### Zod Schemas for All Inputs

```typescript
// packages/types/src/user.ts
import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128)
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[a-z]/, "Must contain at least one lowercase letter")
    .regex(/[0-9]/, "Must contain at least one digit")
    .regex(/[^A-Za-z0-9]/, "Must contain at least one special character"),
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim().optional(),
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/).optional(),
  role: z.enum(["admin", "employee", "customer"]).default("customer"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
```

### NestJS Validation Pipe

```typescript
// main.ts
app.useGlobalPipes(
  new ZodValidationPipe({
    whitelist: true,           // Strip unknown properties
    forbidNonWhitelisted: true, // Error on unknown properties
    transform: true,            // Coerce types
  }),
);
```

### Validation Rules

1. **Every external input must be validated** — query params, body, path params, headers
2. **Validate at the boundary** — controllers/pipes, not deep in services
3. **Fail fast** — reject invalid input immediately, don't process further
4. **Sanitize strings** — trim whitespace, normalize Unicode (NFC)
5. **Validate file uploads** — size, type, magic bytes
6. **Validate pagination params** — min/max limits enforced at parser level
7. **Never trust client-side validation** — always re-validate server-side

---

## SQL Injection Prevention

### Parameterized Queries (via ORM)

```typescript
// ✅ Safe: Prisma parameterizes all queries automatically
const user = await prisma.user.findFirst({
  where: { email: userInput },
});

// ✅ Safe: Raw queries with Prisma $queryRaw (parameterized)
const users = await prisma.$queryRaw<User[]>`
  SELECT * FROM users WHERE email = ${email}
`;

// ❌ NEVER: String concatenation/interpolation
const users = await prisma.$queryRawUnsafe(
  `SELECT * FROM users WHERE email = '${email}'`  // NEVER DO THIS
);
```

### Dynamic Sorting/Filtering Safety

```typescript
// ✅ Whitelist allowed sort columns
const ALLOWED_SORT_COLUMNS = ["id", "email", "firstName", "createdAt"];

function validateSort(sortBy: string): string {
  const column = sortBy.replace(/^-/, ""); // Remove - prefix
  if (!ALLOWED_SORT_COLUMNS.includes(column)) {
    throw new BadRequestException(`Invalid sort column: ${column}`);
  }
  return sortBy;
}
```

---

## XSS Prevention

### Output Encoding

```typescript
// ✅ React auto-escapes by default — NEVER use dangerouslySetInnerHTML
// ✅ Use textContent or innerText for DOM manipulation

// Framework-level protection:
// Next.js: JSX auto-escapes {userInput}
// React Native: Text components auto-escape
// NestJS: JSON responses can't execute JS (but don't reflect user input in HTML)
```

### Content Security Policy (CSP)

```typescript
// next.config.ts
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self';
  connect-src 'self' https://api.alharistech.com;
  frame-src 'none';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
`;

// Set via next.config headers or middleware
```

```typescript
// NestJS: Helmet middleware sets security headers
import helmet from "helmet";

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
}));
```

### If User-Generated HTML is Required

```typescript
// ✅ Sanitize with DOMPurify before rendering
import DOMPurify from "dompurify";

const clean = DOMPurify.sanitize(userHtml, {
  ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li"],
  ALLOWED_ATTR: ["href", "target", "rel"],
});
```

---

## CSRF Protection

### Cookie-Based Auth (Refresh Tokens)

```
Refresh token cookie:
  httpOnly: true        — Not accessible via JavaScript
  secure: true          — HTTPS only
  sameSite: "strict"    — Not sent on cross-site requests
  domain: ".alharistech.com"
  path: "/api/v1/auth"
```

### CSRF Token (If Needed)

For scenarios requiring CSRF tokens (non-SPA form submissions):

```typescript
// Server generates CSRF token, client includes it in X-CSRF-Token header
app.use(csrf({ cookie: true }));
```

---

## CORS Policy

```typescript
// Explicit allowlist — NO wildcard
app.enableCors({
  origin: [
    "https://alharistech.com",
    "https://admin.alharistech.com",
    "https://staging.alharistech.com",
    "http://localhost:3000",
    "http://localhost:3001",
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Request-Id",
    "X-Idempotency-Key",
  ],
  credentials: true,
  maxAge: 86400,
});
```

---

## Rate Limiting

### Configuration

```typescript
// NestJS @nestjs/throttler
@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: "default",
          ttl: 60000,         // 60 seconds
          limit: 60,          // 60 requests per minute per IP
        },
      ],
    }),
  ],
})
```

### Per-Endpoint Limits

```typescript
@Controller("auth")
export class AuthController {
  @Post("login")
  @Throttle({ default: { ttl: 60000, limit: 5 } })  // 5 attempts per minute
  async login() { ... }

  @Post("forgot-password")
  @Throttle({ default: { ttl: 3600000, limit: 3 } }) // 3 per hour
  async forgotPassword() { ... }
}
```

---

## Secrets Management

### Rules

1. **NEVER in code** — no hardcoded secrets, no commented-out secrets
2. **Environment variables only** — loaded at runtime from env vars
3. **`.env` files never committed** — in `.gitignore`, only `.env.example` committed
4. **Production secrets in vault** — HashiCorp Vault, AWS Secrets Manager, or platform secret manager
5. **Rotate regularly** — access keys every 90 days, JWK keys every 30 days
6. **Least privilege** — each service gets only the secrets it needs
7. **Audit access** — log who accessed what secret when

### .gitignore

```
.env
.env.local
.env.development
.env.production
.env.test
*.pem
*.key
*.p12
secrets/
```

### .env.example (Committed)

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/alharistech"

# JWT (generate your own: openssl rand -hex 64)
JWT_ACCESS_SECRET="your-access-secret-here"
JWT_REFRESH_SECRET="your-refresh-secret-here"

# Redis
REDIS_URL="redis://localhost:6379"

# S3 (MinIO for local dev)
S3_ENDPOINT="http://localhost:9000"
S3_ACCESS_KEY="minioadmin"
S3_SECRET_KEY="minioadmin"
S3_BUCKET="alharistech"

# Email (MailHog for local dev)
SMTP_HOST="localhost"
SMTP_PORT="1025"
SMTP_USER=""
SMTP_PASS=""
```

### CI Secret Handling

```
CI environment variables set in GitHub Secrets:
  DATABASE_URL
  JWT_ACCESS_SECRET
  JWT_REFRESH_SECRET
  etc.

Never echo secrets in CI logs.
Use GitHub's masked variable feature.
```

---

## Dependency Audit

### CI Check on Every PR

```yaml
# .github/workflows/ci.yml
security-audit:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - run: pnpm audit --audit-level=high
    - run: pnpm audit --audit-level=moderate --json > audit.json
    - name: Check for critical vulnerabilities
      run: |
        if grep -q '"severity":"critical"' audit.json; then
          echo "Critical vulnerabilities found!"
          exit 1
        fi
```

### Vulnerability Response SLA

| Severity | Response Time |
|:---|:---|
| Critical (CVSS 9.0+) | 4 hours |
| High (CVSS 7.0-8.9) | 24 hours |
| Medium (CVSS 4.0-6.9) | 1 week |
| Low (CVSS 0.1-3.9) | Next sprint |

### Automated Updates

```
Renovate bot configured to:
  - Open PRs for security updates immediately
  - Group non-major updates weekly
  - Auto-merge patch-level updates after CI passes
```

---

## Security Headers

### Required Headers

```typescript
// NestJS — via Helmet
app.use(helmet());

// Additional custom headers:
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "0");  // Deprecated, CSP handles this
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});
```

### HSTS (HTTP Strict Transport Security)

```typescript
// In production, set via reverse proxy (nginx/Cloudflare) or:
app.use(helmet.hsts({
  maxAge: 31536000,     // 1 year in seconds
  includeSubDomains: true,
  preload: true,
}));
```

---

## File Upload Security

### Validation

```typescript
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function validateFile(file: Express.Multer.File): void {
  // 1. Check size
  if (file.size > MAX_FILE_SIZE) {
    throw new BadRequestException("File too large");
  }

  // 2. Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new BadRequestException("File type not allowed");
  }

  // 3. Check magic bytes (verify actual content matches claimed type)
  const magicBytes = file.buffer.slice(0, 4).toString("hex");
  const magicBytesMap: Record<string, string[]> = {
    "ffd8ffe0": ["image/jpeg"],
    "89504e47": ["image/png"],
    "25504446": ["application/pdf"],
  };
  // ...validation logic
}
```

### Storage

- Upload to S3/MinIO with private ACL
- Generate signed URLs for access (expires in 1 hour)
- Never serve uploads directly from the API server
- Virus scanning via ClamAV (future phase: scan on upload)

---

## Audit Logging

### What to Log

```typescript
interface AuditLog {
  timestamp: string;        // ISO 8601
  actor: {
    id: string;             // User ID
    email: string;          // User email
    role: string;           // User role
    ip: string;             // Source IP
  };
  action: string;           // "user.created", "order.cancelled"
  resource: {
    type: string;           // "user", "order", "payment"
    id: string;             // Resource ID
  };
  changes?: {
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
  requestId: string;
}
```

### Events to Log

| Event | Level | Retention |
|:---|:---|:---|
| Login success/failure | INFO/WARN | 90 days |
| Password change | INFO | Permanent |
| Role change | WARN | Permanent |
| Permission change | WARN | Permanent |
| User create/delete | INFO | Permanent |
| Sensitive data access | INFO | 90 days |
| API key create/revoke | INFO | Permanent |
| Payment events | INFO | 7 years (compliance) |
| Configuration change | WARN | Permanent |

### Audit Log Storage

- Audit logs stored in a separate database table
- Write to append-only table (no UPDATE/DELETE)
- Regular archival to cold storage (S3 Glacier)
- Immutable storage for compliance-critical events

---

## Encryption

### Data at Rest

| Data | Method |
|:---|:---|
| Passwords | bcrypt (cost 12) / argon2id |
| Refresh tokens | SHA-256 hashed before storage |
| PII (optional) | AES-256-GCM, per-row encryption keys |
| Database files | PostgreSQL TDE or disk-level encryption |
| Backups | AES-256 encrypted |
| File storage (S3) | Server-side encryption (AES-256) |

### Data in Transit

| Path | Method |
|:---|:---|
| Client to API | TLS 1.3 |
| API to Database | TLS 1.3 (SSL mode: require) |
| API to Redis | TLS (stunnel or Redis TLS) |
| API to S3 | TLS 1.3 |
| Service-to-service | mTLS (future) |

### Sensitive Data Masking in Logs

```typescript
// logger transport that masks sensitive fields
const SENSITIVE_FIELDS = [
  "password", "passwordHash", "token", "secret",
  "creditCard", "ssn", "idNumber",
];

function maskSensitive(obj: Record<string, unknown>): Record<string, unknown> {
  const masked = { ...obj };
  for (const key of Object.keys(masked)) {
    if (SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f))) {
      masked[key] = "***REDACTED***";
    }
  }
  return masked;
}
```

---

## Security Testing

### SAST (Static Application Security Testing)

```yaml
# .github/workflows/security.yml
codeql-analysis:
  runs-on: ubuntu-latest
  steps:
    - uses: github/codeql-action/init@v3
      with:
        languages: javascript, typescript
    - uses: github/codeql-action/analyze@v3
```

### DAST (Dynamic Application Security Testing)

```
OWASP ZAP — periodic scans on staging environment
  - Spider crawl
  - Active scan for OWASP Top 10
  - API endpoint fuzzing
```

### Dependency Scanning

```
GitHub Dependabot + npm audit
  - Runs on every push
  - Alerts for known CVEs
  - Auto-creates PRs for fixable vulnerabilities
```

### Secret Scanning

```
GitHub Secret Scanning + pre-commit hooks
  - git-secrets or detect-secrets pre-commit hook
  - GitHub push protection for known secret patterns
  - CI step: trufflehog scan of full history weekly
```

### Penetration Testing

| Frequency | Scope |
|:---|:---|
| Before v1.0 launch | Full penetration test |
| Every 6 months | External pentest |
| After major changes | Targeted pentest on changed areas |
| Continuous | Bug bounty program (future) |

---

## Incident Response

### Severity Levels

| Level | Definition | Response Time |
|:---|:---|:---|
| P0 | Data breach, system down, unauthorized admin access | 15 minutes |
| P1 | Auth bypass, payment failure, data loss risk | 1 hour |
| P2 | Rate limit bypass, XSS, CSRF | 4 hours |
| P3 | Information disclosure (low sensitivity) | 24 hours |
| P4 | Security misconfiguration | Next sprint |

### Response Steps

1. **Contain** — Isolate affected systems
2. **Assess** — Determine scope and severity
3. **Notify** — Alert security team and affected stakeholders
4. **Fix** — Deploy fix
5. **Recover** — Restore normal operations
6. **Post-mortem** — Document root cause and prevention

---

## Security Checklist (Per Sprint)

- [ ] Dependency audit clean (no critical/high CVEs)
- [ ] Secrets scan clean (no leaks in code)
- [ ] SAST scan clean (CodeQL no new alerts)
- [ ] All new endpoints have rate limiting
- [ ] All new endpoints have authentication (unless explicitly public)
- [ ] Input validation on all new endpoints
- [ ] Security headers verified on responses
- [ ] CORS configuration reviewed
- [ ] Audit log entries for all new sensitive operations
- [ ] No secrets committed in the sprint
