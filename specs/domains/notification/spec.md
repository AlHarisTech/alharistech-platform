# Notification Domain Specification
## نطاق الإشعارات — AlharisTech Platform

**Domain ID:** `notification`
**Version:** 0.1.0-DRAFT
**Status:** Draft
**Phase:** Phase 1
**Owner:** Tech Lead

---

## 1. Bounded Context

### Boundaries
The Notification domain is responsible for:
- Transactional email delivery (welcome, password reset, order confirmation)
- Notification template management (multi-channel, bilingual)
- SMS notifications for critical updates
- Push notification delivery (Phase 2)
- In-app notification delivery
- User notification preferences (opt-in/opt-out per channel and type)
- Notification history/log with status tracking
- Retry logic for failed deliveries
- Rate limiting per user per channel

### What Notification does NOT manage
- User account operations (→ delegates to Identity domain)
- Email/SMS infrastructure (→ delegates to external providers: SendGrid/Twilio/etc.)
- Content of domain entities (receives data via events/API calls)
- Template variable resolution data sources (callers provide variables)

### Relationships
```
Notification ──► delivers to ──► Users (via Identity)
Notification ──► listens to ──► Identity events (UserRegistered, PasswordChanged)
Notification ──► listens to ──► Orders events (OrderConfirmed, OrderStatusChanged)
Notification ──► listens to ──► Tickets events (TicketAssigned, TicketUpdated)
Notification ──► listens to ──► Content events (PagePublished, BlogPostPublished)
```

---

## 2. Aggregates

### 2.1 NotificationTemplate Aggregate
**Root Entity:** NotificationTemplate

| Property | Type | Constraints |
|:---|:---|:---|
| id | UUID v7 | PK |
| code | VARCHAR(100) | Unique, e.g., "welcome", "password_reset", "order_confirmed" |
| name | VARCHAR(255) | Human-readable name |
| description | TEXT | Optional, template purpose |
| subject_template_ar | VARCHAR(500) | Required, Handlebars template |
| subject_template_en | VARCHAR(500) | Required, Handlebars template |
| body_template_ar | TEXT | Required, Handlebars template (HTML) |
| body_template_en | TEXT | Required, Handlebars template (HTML) |
| channel | ENUM('email','sms','push','in_app') | Required |
| variables | JSONB | Array of variable definitions |
| is_active | BOOLEAN | Default: true |
| created_by | UUID | FK → users.id, Not null |
| updated_by | UUID | FK → users.id, Nullable |
| created_at | TIMESTAMP | Auto |
| updated_at | TIMESTAMP | Auto |

**variables JSONB structure:**
```json
[
  {
    "name": "userName",
    "description": "اسم المستخدم",
    "required": true,
    "defaultValue": null,
    "type": "string"
  },
  {
    "name": "resetLink",
    "description": "رابط استعادة كلمة المرور",
    "required": true,
    "defaultValue": null,
    "type": "url"
  }
]
```

### 2.2 NotificationLog Aggregate
**Root Entity:** NotificationLog

| Property | Type | Constraints |
|:---|:---|:---|
| id | UUID v7 | PK |
| template_id | UUID | FK → notification_templates.id, Nullable (for ad-hoc sends) |
| user_id | UUID | FK → users.id, Nullable (for unauthenticated recipients) |
| channel | ENUM('email','sms','push','in_app') | Required |
| recipient | VARCHAR(255) | Email address or phone number |
| recipient_name | VARCHAR(255) | Optional, display name |
| subject | VARCHAR(500) | Rendered subject (email/in_app) |
| body | TEXT | Rendered body (HTML for email, plain for SMS) |
| status | ENUM('pending','sent','failed','retrying','permanently_failed') | Default: 'pending' |
| provider | VARCHAR(50) | e.g., "sendgrid", "twilio", "firebase" |
| provider_message_id | VARCHAR(255) | Nullable, external provider ID |
| error_message | TEXT | Nullable, failure reason |
| retry_count | INTEGER | Default: 0 |
| max_retries | INTEGER | Default: 3 |
| next_retry_at | TIMESTAMP | Nullable, calculated with exponential backoff |
| sent_at | TIMESTAMP | Nullable |
| created_at | TIMESTAMP | Auto |
| updated_at | TIMESTAMP | Auto |

### 2.3 UserPreference Aggregate
**Root Entity:** UserPreference

| Property | Type | Constraints |
|:---|:---|:---|
| id | UUID v7 | PK |
| user_id | UUID | FK → users.id, Not null |
| channel | ENUM('email','sms','push','in_app') | Required |
| notification_type | VARCHAR(100) | e.g., "order_update", "ticket_update", "marketing", "security" |
| is_enabled | BOOLEAN | Default: true |
| created_at | TIMESTAMP | Auto |
| updated_at | TIMESTAMP | Auto |

**Unique constraint:** (user_id, channel, notification_type)

---

## 3. Domain Events

| Event | Trigger | Payload | Consumers |
|:---|:---|:---|:---|
| `NotificationSent` | Notification successfully delivered via provider | `{ logId, templateCode, userId, channel, recipient, sentAt }` | Analytics (delivery metrics), Audit log |
| `NotificationFailed` | Notification delivery failed (temporary) | `{ logId, templateCode, userId, channel, recipient, errorMessage, retryCount, nextRetryAt }` | Monitoring (alert if persistent), Retry scheduler |
| `NotificationPermanentlyFailed` | Notification failed after all retries exhausted | `{ logId, templateCode, userId, channel, recipient, errorMessage, totalRetries }` | Monitoring (critical alert), Audit log |
| `UserOptedOut` | User disables notification preference | `{ userId, channel, notificationType, timestamp }` | Audit log |
| `UserOptedIn` | User enables notification preference | `{ userId, channel, notificationType, timestamp }` | Audit log |
| `NotificationRateLimited` | Notification blocked by rate limiter | `{ userId, channel, templateCode, recipient, reason }` | Monitoring (detect abuse patterns) |

---

## 4. Use Cases

### UC-NOTIF-01: Send Transactional Email
**Actor:** System (triggered by domain events or internal API call)
**Preconditions:** Template exists and is active, user has not opted out
**Flow:**
1. Caller invokes send endpoint with template_code, user_id, variables, channel=email
2. System looks up notification template by code
3. System checks user notification preferences (is_enabled for this channel + notification_type)
4. If opted out → skip, log with status='skipped', return
5. System applies rate limit check per user per channel (max 10/minute)
6. System renders subject and body using Handlebars with provided variables
7. System creates NotificationLog with status='pending'
8. System dispatches to email provider (SendGrid/Mailgun) via adapter
9. Provider accepts → update log: status='sent', sent_at=now, provider_message_id set
10. System publishes `NotificationSent` event
11. Response: 201 Created (or async 202 Accepted)

**Exceptions:**
- Template not found → 404 Not Found
- Template inactive → 400 Bad Request (code: NOTIF_TEMPLATE_INACTIVE)
- User opted out → 200 OK (skipped, not an error)
- Rate limited → 429 Too Many Requests (code: NOTIF_RATE_LIMITED)
- Provider failure → log with status='failed', retry_count=1, schedule retry with backoff; publish `NotificationFailed`

### UC-NOTIF-02: Send SMS Notification
**Actor:** System (for critical notifications only: order updates, ticket updates)
**Preconditions:** Template exists (channel=sms), user has phone number, user opted in for SMS
**Flow:**
1. Caller invokes send endpoint with template_code, user_id, variables, channel=sms
2. System looks up user, verifies phone number exists
3. System checks user preferences (SMS channel enabled for this notification_type)
4. System checks notification_type is critical (order_update, ticket_update, security) — SMS restricted to critical types
5. System renders body_template_ar or body_template_en based on user locale (from user profile)
6. System creates NotificationLog with channel='sms'
7. System dispatches to SMS provider (Twilio) via adapter
8. Provider accepts → log as 'sent'; else → log as 'failed' with retry
9. System publishes `NotificationSent` event
10. Response: 201 Created

**Exceptions:**
- User has no phone → 400 Bad Request (code: NOTIF_NO_PHONE)
- Non-critical notification type attempted via SMS → 400 Bad Request (code: NOTIF_SMS_CRITICAL_ONLY)
- Same retry logic as email

### UC-NOTIF-03: Retry Failed Notifications
**Actor:** System (scheduled job via BullMQ)
**Preconditions:** NotificationLog records with status='failed' and next_retry_at ≤ now
**Flow:**
1. BullMQ scheduled job runs every 1 minute (cron)
2. System queries NotificationLog where status='failed', retry_count < max_retries, next_retry_at ≤ now
3. For each failed log:
   - System increments retry_count
   - System sets status='retrying'
   - System re-attempts delivery via provider adapter
   - If success → set status='sent', sent_at=now, publish `NotificationSent`
   - If failure and retry_count < max_retries → set status='failed', calculate next_retry_at (exponential backoff: 1min, 5min, 15min), publish `NotificationFailed`
   - If failure and retry_count >= max_retries → set status='permanently_failed', publish `NotificationPermanentlyFailed`
4. Response: job complete

**Retry Schedule (exponential backoff):**
| Attempt | Delay |
|:---|:---|
| 1st retry | 1 minute |
| 2nd retry | 5 minutes |
| 3rd retry | 15 minutes |

### UC-NOTIF-04: Manage Notification Templates (Admin)
**Actor:** Admin
**Preconditions:** Authenticated as admin
**Flow:**
1. Admin creates/updates notification template
2. System validates Handlebars template syntax (compile check)
3. System validates variables JSONB matches template usage
4. System saves template
5. Response: 200/201 accordingly

**Exceptions:**
- Invalid Handlebars syntax → 422 Unprocessable Entity (code: NOTIF_INVALID_TEMPLATE_SYNTAX)
- Template code already exists → 409 Conflict

### UC-NOTIF-05: View Notification History
**Actor:** Admin, Manager, User (own notifications)
**Preconditions:** Authenticated; users can only view their own logs
**Flow:**
1. Actor requests notification log with filters (user_id, channel, status, date range)
2. System applies RBAC: users see only own logs; admins/managers see all
3. System returns paginated results
4. Response: 200 OK

### UC-NOTIF-06: Manage User Notification Preferences
**Actor:** Authenticated user
**Preconditions:** Authenticated
**Flow (Get Preferences):**
1. User requests their notification preferences
2. System returns all UserPreference records for the user, grouped by channel
3. Response: 200 OK

**Flow (Update Preferences):**
1. User submits PATCH with preferences object
2. System validates notification_type values against known types
3. System upserts UserPreference records
4. System publishes `UserOptedOut` or `UserOptedIn` events as appropriate
5. Response: 200 OK

**PATCH Request Example:**
```json
{
  "preferences": [
    { "channel": "email", "notification_type": "order_update", "is_enabled": true },
    { "channel": "email", "notification_type": "marketing", "is_enabled": false },
    { "channel": "sms", "notification_type": "order_update", "is_enabled": true },
    { "channel": "push", "notification_type": "ticket_update", "is_enabled": false }
  ]
}
```

### UC-NOTIF-07: Send In-App Notification
**Actor:** System
**Preconditions:** User exists, template exists (channel=in_app)
**Flow:**
1. Caller sends in-app notification request
2. System checks user preferences for in_app channel
3. System renders notification from template
4. System creates NotificationLog with channel='in_app'
5. System stores notification for in-app delivery (database entry + real-time push via WebSocket/SSE)
6. System publishes `NotificationSent`
7. Response: 201 Created

### UC-NOTIF-08: Bulk Notification (Marketing — Phase 2)
**Actor:** Admin, Manager
**Preconditions:** Template exists (channel=email), user segment selected
**Flow:**
1. Admin selects target user segment or uploads recipient list
2. System validates template and renders preview with sample data
3. Admin confirms send
4. System enqueues individual send jobs for each recipient (batching via BullMQ)
5. Each job respects user preferences (skips opted-out users)
6. System tracks aggregate stats (sent, failed, skipped)
7. Response: 202 Accepted with batch_id

**Phase 1 Note:** Bulk notifications deferred to Phase 2; Phase 1 supports transactional only.

---

## 5. API Specification

### Endpoints

| Method | Path | Auth | Role | Description |
|:---|:---|:---|:---|:---|
| POST | /api/v1/notifications/templates | Required | Admin | Create notification template |
| GET | /api/v1/notifications/templates | Required | Admin, Manager | List templates (paginated, filterable) |
| GET | /api/v1/notifications/templates/{id} | Required | Admin, Manager | Get template by ID |
| PATCH | /api/v1/notifications/templates/{id} | Required | Admin | Update template |
| DELETE | /api/v1/notifications/templates/{id} | Required | Admin | Delete template (soft-delete) |
| POST | /api/v1/notifications/send | Required (internal) | System (service account) | Send notification (internal only) |
| GET | /api/v1/notifications/log | Required | Admin, Manager | List all notification logs |
| GET | /api/v1/notifications/log/{id} | Required | Admin, Manager | Get log entry by ID |
| GET | /api/v1/users/me/notifications/log | Required | Any | Get own notification log |
| GET | /api/v1/users/me/notifications/preferences | Required | Any | Get own notification preferences |
| PATCH | /api/v1/users/me/notifications/preferences | Required | Any | Update own notification preferences |
| POST | /api/v1/notifications/bulk | Required | Admin, Manager | Bulk notification send (Phase 2) |

### Request/Response Schemas

**POST /api/v1/notifications/templates — Request:**
```json
{
  "code": "string (unique, snake_case, e.g. 'order_confirmed')",
  "name": "string (1-255, required)",
  "description": "string (optional)",
  "subject_template_ar": "string (Handlebars, required)",
  "subject_template_en": "string (Handlebars, required)",
  "body_template_ar": "string (Handlebars HTML, required)",
  "body_template_en": "string (Handlebars HTML, required)",
  "channel": "email|sms|push|in_app",
  "variables": [
    {
      "name": "userName",
      "description": "اسم المستخدم",
      "required": true,
      "defaultValue": null,
      "type": "string"
    }
  ]
}
```

**POST /api/v1/notifications/send — Request (Internal):**
```json
{
  "template_code": "string (required, reference to template.code)",
  "user_id": "uuid (required)",
  "channel": "email|sms|push|in_app (optional, defaults to template channel)",
  "variables": {
    "userName": "أحمد",
    "orderId": "uuid",
    "orderStatus": "جاهز للتسليم"
  },
  "metadata": {
    "source": "string (e.g., 'order_service', 'ticket_service')",
    "source_id": "uuid (related entity ID)"
  }
}
```

**POST /api/v1/notifications/send — Response:**
```json
{
  "data": {
    "log_id": "uuid",
    "status": "sent|failed|skipped",
    "recipient": "user@example.com",
    "channel": "email"
  },
  "meta": {
    "timestamp": "ISO8601",
    "requestId": "uuid"
  }
}
```

**GET /api/v1/notifications/log — Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "template_code": "order_confirmed",
      "user_id": "uuid",
      "channel": "email",
      "recipient": "user@example.com",
      "subject": "تم تأكيد طلبك #1234",
      "status": "sent",
      "error_message": null,
      "retry_count": 0,
      "sent_at": "ISO8601",
      "created_at": "ISO8601"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "per_page": 20,
    "timestamp": "ISO8601"
  }
}
```

**GET /api/v1/users/me/notifications/preferences — Response:**
```json
{
  "data": {
    "email": [
      { "notification_type": "order_update", "is_enabled": true },
      { "notification_type": "ticket_update", "is_enabled": true },
      { "notification_type": "marketing", "is_enabled": false },
      { "notification_type": "security", "is_enabled": true }
    ],
    "sms": [
      { "notification_type": "order_update", "is_enabled": true },
      { "notification_type": "ticket_update", "is_enabled": true }
    ],
    "push": [
      { "notification_type": "ticket_update", "is_enabled": false }
    ],
    "in_app": [
      { "notification_type": "order_update", "is_enabled": true },
      { "notification_type": "ticket_update", "is_enabled": true }
    ]
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
    "code": "NOTIF_TEMPLATE_INACTIVE",
    "message": "قالب الإشعار غير مفعل",
    "message_en": "Notification template is not active",
    "statusCode": 400,
    "details": {
      "template_code": "welcome",
      "template_id": "uuid"
    }
  },
  "meta": {
    "timestamp": "ISO8601",
    "requestId": "uuid"
  }
}
```

---

## 6. Business Rules

1. **RB-NOTIF-01:** Notifications respect user preferences; never send to a channel/type combination where is_enabled=false
2. **RB-NOTIF-02:** Rate limit per user per channel: email 10/minute, SMS 5/hour, push 20/minute, in_app 30/minute
3. **RB-NOTIF-03:** Failed notifications retry up to 3 times with exponential backoff: 1min, 5min, 15min
4. **RB-NOTIF-04:** SMS channel reserved for critical notifications only (order_update, ticket_update, security types); non-critical types rejected with NOTIF_SMS_CRITICAL_ONLY
5. **RB-NOTIF-05:** Notification templates use Handlebars syntax; compile-check on save; render error on send logs and fails gracefully
6. **RB-NOTIF-06:** Template code must be unique and immutable after creation (to maintain log traceability)
7. **RB-NOTIF-07:** Template deletion is soft-delete (deactivate); existing logs retain template_code for traceability
8. **RB-NOTIF-08:** Internal send endpoint (/api/v1/notifications/send) requires service account authentication; not exposed to end users
9. **RB-NOTIF-09:** All templates support bilingual rendering (ar/en); locale derived from user profile or request override
10. **RB-NOTIF-10:** NotificationLog retained for minimum 90 days; archived after (Phase 2 consideration)
11. **RB-NOTIF-11:** In-app notifications stored in database with read/unread status (out of scope for this domain — handled by frontend polling/WebSocket)
12. **RB-NOTIF-12:** Bulk notifications (marketing) deferred to Phase 2; Phase 1 covers transactional only

---

## 7. Security

### RBAC Matrix — Notification Domain

| Resource | Admin | Manager | Employee | Customer | Partner | System (Service Account) |
|:---|:---|:---|:---|:---|:---|:---|
| templates | CRUD | Read | — | — | — | Read |
| send (internal) | — | — | — | — | — | Execute |
| log (all) | Read | Read | — | — | — | — |
| log (own) | — | — | — | Read | Read | — |
| preferences | — | — | — | Read, Update (own) | Read, Update (own) | — |
| bulk | CRUD (Phase 2) | Execute (Phase 2) | — | — | — | — |

### Authentication & Authorization
- Internal send endpoint authenticated via service account JWT (machine-to-machine)
- Template management restricted to Admin/Manager roles
- User preferences endpoint scoped to authenticated user (own data only)
- Log endpoint: users see only their own logs; admins/managers see all

### Rate Limiting
- Send endpoint: 100/minute per service account
- Template CRUD: 30/minute per admin
- Preferences PATCH: 10/minute per user

### Provider Security
- API keys for SendGrid, Twilio, Firebase stored in secrets manager (Vault/Doppler)
- Provider adapters implement circuit breaker pattern (after 5 consecutive failures, pause 1 minute)
- Outbound traffic restricted to whitelisted provider IPs

### Data Privacy
- NotificationLog contains user email/phone; masked in non-admin responses (e.g., `u***@example.com`)
- Log purging after retention period (90 days) via scheduled job
- No notification content logged if marked sensitive (e.g., password reset link bodies truncated in logs)

---

## 8. Testing

### Test Scenarios

**Happy Path:**
1. System sends welcome email on user registration → template rendered → email delivered → status=sent
2. User updates preferences to disable marketing emails → subsequent marketing send → skipped (opted out)
3. SMS notification for order status update → user has phone + SMS enabled → SMS sent via Twilio
4. Notification fails on first attempt → retries at 1min, 5min → succeeds on 2nd retry → status=sent
5. Admin creates new template → validates Handlebars syntax → saves → template available for send
6. User views own notification history → sees only their logs, paginated

**Edge Cases:**
7. Send notification with template_code not found → 404 Not Found
8. Send SMS for non-critical notification_type → 400 NOTIF_SMS_CRITICAL_ONLY
9. Send notification to user without phone (SMS) → 400 NOTIF_NO_PHONE
10. Notification fails 3 consecutive retries → status=permanently_failed, alert triggered
11. Rate limit exceeded for user email → 429 NOTIF_RATE_LIMITED, notification queued
12. Template update changes variables but existing send jobs use old variable set → graceful handling (default values applied)
13. User has no preferences record for a channel → default: is_enabled=true (opt-in by default for transactional)
14. Bilingual template: user locale ar → subject_template_ar rendered; locale en → subject_template_en rendered

**Error Cases:**
15. POST to /api/v1/notifications/send without service account auth → 401 Unauthorized
16. Customer tries to list all notification logs → 403 Forbidden
17. Admin creates template with invalid Handlebars syntax → 422 NOTIF_INVALID_TEMPLATE_SYNTAX
18. Provider API down → circuit breaker opens → notification fails fast → status=failed → retry scheduled
19. PATCH preference with invalid notification_type → 422 Validation Error
20. Template variable mismatch (required variable not provided) → 422 NOTIF_MISSING_VARIABLES

**Security Cases:**
21. Internal endpoint accessed from external IP → 403 (IP whitelist check)
22. Template injection attack (e.g., `{{constructor}}`) → sanitized/blocked by Handlebars security config
23. Rate limiter bypass attempt via multiple user_ids → aggregate rate limiting per IP
24. Notification log endpoint: user A cannot see user B logs → 403
25. Provider API keys not exposed in error messages or logs
