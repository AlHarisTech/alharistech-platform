# Customer Domain Specification
## نطاق إدارة العملاء — AlharisTech Platform

**Domain ID:** `customer`
**Version:** 0.1.0-DRAFT
**Status:** Draft
**Phase:** Phase 1
**Owner:** Tech Lead

---

## 1. Bounded Context

### Boundaries
The Customer domain is responsible for:
- Customer registration and profile management (FR-201)
- Customer classification, tagging, and segmentation (FR-202)
- Communication log tracking (FR-203)
- Customer search and filtering (FR-205)
- CSV/Excel import and export (FR-206)
- Duplicate customer detection and merging (FR-207)

### What Customer does NOT manage
- Authentication credentials (→ Identity domain)
- Order processing and workflow (→ Service domain)
- Bulk email delivery (→ delegates to Notification domain for FR-208)
- Invoice generation and payments (→ Billing domain)

### Relationships
```
Customer ──► subscribes to UserRegistered ──► Identity (auto-create profile)
Customer ──► references order history ──► Service (read-only view)
Customer ──► delegates bulk email ──► Notification (FR-208)
Identity ──► authenticates ──► Customer
```

---

## 2. Aggregates

### 2.1 Customer Aggregate
**Root Entity:** Customer

| Property | Type | Constraints |
|:---|:---|:---|
| id | UUID v7 | PK |
| user_id | UUID | FK → identity.users.id, nullable (walk-in customers) |
| type | ENUM('individual', 'company') | Default: 'individual' |
| email | VARCHAR(255) | Unique, valid email, nullable for walk-ins |
| phone | VARCHAR(20) | Optional, E.164 format |
| first_name_ar | VARCHAR(100) | Required |
| last_name_ar | VARCHAR(100) | Required |
| first_name_en | VARCHAR(100) | Optional |
| last_name_en | VARCHAR(100) | Optional |
| company_name_ar | VARCHAR(255) | Required when type='company' |
| company_name_en | VARCHAR(255) | Optional |
| tax_number | VARCHAR(50) | Required when type='company', unique |
| national_id | VARCHAR(50) | Optional, encrypted at rest (AES-256) |
| date_of_birth | DATE | Optional |
| address_city | VARCHAR(100) | Optional |
| address_district | VARCHAR(100) | Optional |
| address_street | VARCHAR(255) | Optional |
| address_postal_code | VARCHAR(20) | Optional |
| tags | JSONB | Array of strings, e.g., ["vip","متعثر"], indexed with GIN |
| source | ENUM('website', 'walk_in', 'phone', 'import', 'referral', 'other') | Default: 'website' |
| is_active | BOOLEAN | Default: true |
| deleted_at | TIMESTAMP | Soft delete, nullable |
| merged_into_id | UUID | FK → customers.id, nullable (if merged) |
| notes | TEXT | Internal notes, nullable |
| created_by | UUID | FK → identity.users.id |
| created_at | TIMESTAMP | Auto |
| updated_at | TIMESTAMP | Auto |

**Indexes:**
- `idx_customers_email` UNIQUE on `email` WHERE `deleted_at IS NULL`
- `idx_customers_phone` on `phone`
- `idx_customers_tax_number` UNIQUE on `tax_number` WHERE `deleted_at IS NULL AND type='company'`
- `idx_customers_tags` GIN on `tags`
- `idx_customers_fulltext` GIN on `to_tsvector('arabic', first_name_ar || ' ' || last_name_ar)`
- `idx_customers_type` on `type`
- `idx_customers_source` on `source`

### 2.2 CustomerProfile Aggregate
**Root Entity:** CustomerProfile (1:1 extension of Customer)

| Property | Type | Constraints |
|:---|:---|:---|
| id | UUID v7 | PK |
| customer_id | UUID | FK → customers.id, UNIQUE |
| avatar_url | VARCHAR(500) | Optional |
| preferred_language | ENUM('ar', 'en') | Default: 'ar' |
| preferred_contact_method | ENUM('email', 'phone', 'both') | Default: 'email' |
| marketing_opt_in | BOOLEAN | Default: false |
| total_orders | INTEGER | Denormalized counter, default: 0 |
| total_spent | DECIMAL(12,2) | Denormalized counter, default: 0 |
| last_order_at | TIMESTAMP | Denormalized, nullable |
| custom_fields | JSONB | Key-value store for business-specific data |
| metadata | JSONB | Internal metadata (e.g., lead score, segment) |
| created_at | TIMESTAMP | Auto |
| updated_at | TIMESTAMP | Auto |

### 2.3 CommunicationLog Aggregate
**Root Entity:** CommunicationLog

| Property | Type | Constraints |
|:---|:---|:---|
| id | UUID v7 | PK |
| customer_id | UUID | FK → customers.id |
| channel | ENUM('email', 'phone', 'sms', 'in_person', 'chat', 'other') | Required |
| direction | ENUM('inbound', 'outbound') | Required |
| subject | VARCHAR(255) | Required |
| body | TEXT | Required |
| attachments | JSONB | Array of { name, url, type }, nullable |
| initiated_by | UUID | FK → identity.users.id |
| related_order_id | UUID | FK → service.orders.id, nullable |
| related_ticket_id | UUID | FK → support.tickets.id, nullable |
| created_at | TIMESTAMP | Auto |

**Index:**
- `idx_commlog_customer` on `customer_id`
- `idx_commlog_created` on `created_at DESC`

---

## 3. Domain Events

| Event | Trigger | Payload | Consumers |
|:---|:---|:---|:---|
| `CustomerCreated` | New customer record inserted | `{ customerId, email, type, source, createdBy, timestamp }` | Analytics (customer metrics), Notification (welcome — if email) |
| `CustomerUpdated` | Customer record modified | `{ customerId, changedFields[], updatedBy, timestamp }` | Analytics (profile updates), Identity (sync if linked user) |
| `CustomerMerged` | Two customers merged (FR-207) | `{ survivorId, absorbedId, mergedBy, timestamp }` | Service (reassign orders), Support (reassign tickets), Billing (reassign invoices) |
| `CommunicationLogged` | New communication record created (FR-203) | `{ logId, customerId, channel, direction, initiatedBy, timestamp }` | Analytics (communication metrics) |
| `CustomerTagged` | Tags modified on customer | `{ customerId, addedTags[], removedTags[], updatedBy, timestamp }` | Analytics (segment updates) |
| `CustomerImported` | Batch CSV import completed (FR-206) | `{ importId, totalRows, successCount, failedCount, initiatedBy, timestamp }` | Notification (import summary — async) |
| `CustomerExported` | CSV export initiated (FR-206) | `{ exportId, filterCriteria, totalExported, initiatedBy, timestamp }` | — (background job, download link emailed) |
| `CustomerSoftDeleted` | Customer soft-deleted | `{ customerId, deletedBy, timestamp }` | Identity (disable linked user), Service (cancel pending orders) |

---

## 4. Use Cases

### UC-CUST-01: Create Customer (FR-201)
**Actor:** Admin, Manager
**Preconditions:** Authenticated with customer:create permission
**Flow:**
1. Actor submits customer form (first_name_ar, last_name_ar, email, phone, type, ...)
2. System validates inputs via Zod schema
3. If type='company', system requires company_name_ar + tax_number + validates tax_number format
4. System checks email uniqueness (if provided)
5. System checks tax_number uniqueness (if company type)
6. System creates Customer record (Drizzle insert)
7. System creates associated CustomerProfile record (defaults)
8. System publishes `CustomerCreated` event
9. Response: 201 Created with `{ data: { id, ...customer } }`

**Exceptions:**
- Validation failure → 422 Unprocessable Entity
- Email already registered → 409 Conflict `{ error: { code: "CUSTOMER_EMAIL_EXISTS", message: "البريد الإلكتروني مسجل مسبقاً", message_en: "Email already registered" } }`
- Tax number already exists → 409 Conflict
- Missing company fields for type=company → 422

### UC-CUST-02: Search and Filter Customers (FR-205)
**Actor:** Admin, Manager, Employee
**Preconditions:** Authenticated with customer:read permission
**Flow:**
1. Actor sends query params: `?q=...&type=...&tags=...&source=...&city=...&is_active=...&page=1&limit=20&sort_by=created_at&order=desc`
2. System builds Drizzle query with dynamic WHERE clauses:
   - `q`: full-text search on name fields + email + phone (tsvector for Arabic + English)
   - `type`, `source`, `is_active`: exact match
   - `tags`: `@>` JSONB contains operator
   - `city`, `district`: ILIKE match
3. System returns paginated results with total count
4. System includes `profile.total_orders`, `profile.last_order_at` in response
5. Response: 200 `{ data: [...], meta: { page, limit, total, totalPages } }`

**Exceptions:**
- No results → 200 with empty data array and total=0

### UC-CUST-03: View Customer Profile with Order History (FR-204)
**Actor:** Admin, Manager, Employee; Customer (own profile only)
**Preconditions:** Authenticated with appropriate permission
**Flow:**
1. Actor requests `GET /api/v1/customers/{id}`
2. System loads Customer + CustomerProfile (Drizzle innerJoin)
3. If actor role is 'customer', system verifies `customer.user_id === actor.id`
4. System fetches order history from Service domain (via cross-domain query or API call)
5. System fetches recent communication logs (last 10)
6. Response: 200 `{ data: { ...customer, ...profile, orders: [...], recentCommunications: [...] } }`

**Exceptions:**
- Customer not found → 404
- Customer accessing another customer's profile → 403

### UC-CUST-04: Tag Customer (FR-202)
**Actor:** Admin, Manager
**Preconditions:** Customer exists, not deleted
**Flow:**
1. Actor sends `PATCH /api/v1/customers/{id}/tags` with `{ tags: ["vip","مستورد","قيد المتابعة"] }`
2. System validates tags array (max 20 tags, each max 50 chars)
3. System diffs old tags vs new tags
4. System updates customer.tags (JSONB column via Drizzle)
5. System publishes `CustomerTagged` event with added/removed diff
6. Response: 200 `{ data: { id, tags } }`

**Exceptions:**
- Customer not found → 404
- Too many tags (>20) → 422
- Invalid tag format → 422

### UC-CUST-05: Import Customers from CSV (FR-206)
**Actor:** Admin
**Preconditions:** Authenticated as admin; CSV file conforms to template
**Flow:**
1. Admin uploads CSV file (`multipart/form-data`) to `POST /api/v1/customers/import`
2. System validates CSV structure (required columns present)
3. System parses CSV rows (streaming for large files)
4. For each row: validates data → checks email/tax_number uniqueness → creates Customer
5. System tracks: `{ totalRows, successCount, failedRows: [{row, errors}] }`
6. System publishes `CustomerImported` event with summary
7. Response: 200 `{ data: { importId, totalRows, successCount, failedCount, failedRows } }`

**Exceptions:**
- Invalid CSV format → 422 with details
- Empty file → 422
- File too large (>10MB) → 413

### UC-CUST-06: Export Customers to CSV (FR-206)
**Actor:** Admin, Manager
**Preconditions:** Authenticated
**Flow:**
1. Actor requests `POST /api/v1/customers/export` with optional filter criteria in body
2. System applies same filter logic as UC-CUST-02
3. System streams results to CSV file (server-side)
4. System publishes `CustomerExported` event
5. System stores CSV temporarily and returns download URL (or emails link)
6. Response: 202 Accepted `{ data: { exportId, estimatedTotal, downloadUrl }, meta: { message: "جاري تجهيز ملف التصدير..." } }`

**Exceptions:**
- Filter matches zero results → 200 with download link for empty file

### UC-CUST-07: Merge Duplicate Customers (FR-207)
**Actor:** Admin
**Preconditions:** Two customer records exist, both not merged into others
**Flow:**
1. Admin identifies survivor (keep) and absorbed (remove) customer IDs
2. Admin calls `POST /api/v1/customers/merge` with `{ survivorId, absorbedId }`
3. System validates both exist and are not already merged
4. System begins transaction:
   a. Sets absorbed.merged_into_id = survivor.id
   b. Sets absorbed.deleted_at = now() (soft delete)
   c. Reassigns absorbed's communication logs to survivor
   d. Denormalizes survivor.profile data (sum total_orders, total_spent, keep earliest created_at)
   e. Merges tags (union of both sets)
   f. Reassigns orders, tickets, invoices to survivor (via cross-domain events)
5. System commits transaction
6. System publishes `CustomerMerged` event
7. Response: 200 `{ data: { survivor: {...}, absorbed: { id, mergedInto: survivorId } } }`

**Exceptions:**
- Either customer not found → 404
- Already merged → 422 `{ error: { code: "CUSTOMER_ALREADY_MERGED" } }`
- Same ID for both → 422

### UC-CUST-08: Log Communication (FR-203)
**Actor:** Admin, Manager, Employee
**Preconditions:** Customer exists
**Flow:**
1. Actor submits `POST /api/v1/customers/{id}/communications` with `{ channel, direction, subject, body, relatedOrderId?, relatedTicketId? }`
2. System validates inputs
3. System creates CommunicationLog record
4. System publishes `CommunicationLogged` event
5. Response: 201 `{ data: { id, ...communicationLog } }`

**Exceptions:**
- Customer not found → 404
- Validation failure → 422

---

## 5. API Specification

### Endpoints

| Method | Path | Auth | Role | Description |
|:---|:---|:---|:---|:---|
| POST | /api/v1/customers | Required | Admin, Manager | Create customer (FR-201) |
| GET | /api/v1/customers | Required | Admin, Manager, Employee | List/search/filter customers (FR-205) |
| GET | /api/v1/customers/{id} | Required | Admin, Manager, Employee, Customer (own) | Get customer detail + order history (FR-204) |
| PATCH | /api/v1/customers/{id} | Required | Admin, Manager | Update customer profile |
| DELETE | /api/v1/customers/{id} | Required | Admin | Soft-delete customer |
| PATCH | /api/v1/customers/{id}/tags | Required | Admin, Manager | Update customer tags (FR-202) |
| GET | /api/v1/customers/{id}/orders | Required | Admin, Manager, Employee, Customer (own) | Get customer order history (FR-204) |
| GET | /api/v1/customers/{id}/communications | Required | Admin, Manager, Employee | Get communication log (FR-203) |
| POST | /api/v1/customers/{id}/communications | Required | Admin, Manager, Employee | Log communication (FR-203) |
| POST | /api/v1/customers/import | Required | Admin | Import CSV (FR-206) |
| POST | /api/v1/customers/export | Required | Admin, Manager | Export CSV (FR-206) |
| POST | /api/v1/customers/merge | Required | Admin | Merge duplicate customers (FR-207) |
| GET | /api/v1/customers/tags | Required | Admin, Manager, Employee | List all used tags |

### Request/Response Schemas

**POST /api/v1/customers — Request:**
```json
{
  "type": "individual | company",
  "email": "string (valid email, nullable for walk-in)",
  "phone": "string (E.164, optional)",
  "first_name_ar": "string (1-100, required)",
  "last_name_ar": "string (1-100, required)",
  "first_name_en": "string (1-100, optional)",
  "last_name_en": "string (1-100, optional)",
  "company_name_ar": "string (1-255, required if type=company)",
  "company_name_en": "string (1-255, optional)",
  "tax_number": "string (1-50, required if type=company)",
  "national_id": "string (optional, encrypted)",
  "date_of_birth": "date (YYYY-MM-DD, optional)",
  "address_city": "string (optional)",
  "address_district": "string (optional)",
  "address_street": "string (optional)",
  "address_postal_code": "string (optional)",
  "tags": ["string"],
  "source": "website | walk_in | phone | import | referral | other",
  "notes": "string (optional)",
  "preferred_language": "ar | en",
  "preferred_contact_method": "email | phone | both",
  "marketing_opt_in": "boolean"
}
```

**GET /api/v1/customers — Query Parameters:**
```
?q=نص البحث
&type=individual|company
&tags[]=vip&tags[]=مستورد
&source=website|walk_in|phone|import|referral|other
&city=الرياض
&is_active=true|false
&page=1
&limit=20
&sort_by=created_at|last_name_ar|total_orders
&order=asc|desc
```

**GET /api/v1/customers/{id} — Response:**
```json
{
  "data": {
    "id": "uuid",
    "type": "individual",
    "email": "ahmed@example.com",
    "phone": "+9665xxxxxxxx",
    "first_name_ar": "أحمد",
    "last_name_ar": "العلي",
    "first_name_en": "Ahmed",
    "last_name_en": "Al-Ali",
    "company_name_ar": null,
    "company_name_en": null,
    "tax_number": null,
    "tags": ["vip", "مستورد"],
    "source": "website",
    "is_active": true,
    "profile": {
      "avatar_url": null,
      "preferred_language": "ar",
      "preferred_contact_method": "email",
      "marketing_opt_in": false,
      "total_orders": 12,
      "total_spent": 45000.00,
      "last_order_at": "2026-06-15T10:30:00Z"
    },
    "recentCommunications": [
      {
        "id": "uuid",
        "channel": "email",
        "direction": "outbound",
        "subject": "تأكيد الطلب #1234",
        "created_at": "2026-06-14T08:00:00Z"
      }
    ],
    "created_at": "2025-01-15T09:00:00Z",
    "updated_at": "2026-06-18T14:22:00Z"
  },
  "meta": {
    "timestamp": "2026-06-20T12:00:00Z",
    "requestId": "uuid"
  }
}
```

**POST /api/v1/customers/merge — Request:**
```json
{
  "survivorId": "uuid (customer to keep)",
  "absorbedId": "uuid (customer to merge and discard)"
}
```

**GET /api/v1/customers/{id}/orders — Response (cross-domain):**
```json
{
  "data": [
    {
      "id": "uuid",
      "service": {
        "id": "uuid",
        "name_ar": "استشارة قانونية",
        "name_en": "Legal Consultation"
      },
      "status": "completed",
      "total_amount": "1500.00",
      "created_at": "2026-06-10T10:00:00Z"
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 12, "totalPages": 2 }
}
```

**Error Response Envelope:**
```json
{
  "error": {
    "code": "CUSTOMER_EMAIL_EXISTS",
    "message": "البريد الإلكتروني مسجل مسبقاً",
    "message_en": "Email already registered",
    "statusCode": 409,
    "details": { "email": "ahmed@example.com" }
  },
  "meta": {
    "timestamp": "2026-06-20T12:00:00Z",
    "requestId": "uuid"
  }
}
```

---

## 6. Business Rules

1. **RB-CUST-01:** Email must be unique across all non-deleted customers (FR-201)
2. **RB-CUST-02:** Company-type customers MUST provide company_name_ar and tax_number; tax_number must be unique across non-deleted company customers
3. **RB-CUST-03:** Soft delete only — `deleted_at` is set, rows are never physically removed by application code (FR-201)
4. **RB-CUST-04:** Merged customers are soft-deleted with `merged_into_id` set; their profile, orders, tickets, logs transfer to the survivor
5. **RB-CUST-05:** National ID (`national_id`) is encrypted at rest using AES-256 before insert, decrypted on read if user has explicit permission
6. **RB-CUST-06:** Customer tags are limited to 20 per customer; each tag max 50 characters; stored as JSONB with GIN index for containment queries
7. **RB-CUST-07:** CSV import: rows with validation errors are skipped and reported; successful rows are committed; no partial rollback of valid rows
8. **RB-CUST-08:** CSV export processes asynchronously for >1,000 rows; download link expires after 24 hours
9. **RB-CUST-09:** A customer linked to a user account (via `user_id`) cannot be hard-deleted while the user exists
10. **RB-CUST-10:** Customer accessing own profile: `customer.user_id` must match authenticated user's ID; otherwise 403
11. **RB-CUST-11:** `total_orders` and `total_spent` on CustomerProfile are denormalized counters updated reactively via domain events from the Service domain
12. **RB-CUST-12:** Walk-in customers (no email) are flagged with `source='walk_in'`; they cannot receive email communications
13. **RB-CUST-13:** Arabic full-text search uses PostgreSQL `tsvector` with `arabic` dictionary; English uses `english` dictionary; query combines both via `||` tsvector concatenation

---

## 7. Security

### Authentication & Authorization (RBAC Matrix — Customer Domain)

| Resource | Admin | Manager | Employee | Customer | Partner |
|:---|:---|:---|:---|:---|:---|
| customers | CRUD | CRUD | Read | Read (own only) | — |
| customer profiles | CRUD | Read, Update | Read | Read (own only) | — |
| communication logs | CRUD | CRUD | Create, Read | — | — |
| tags (create/delete) | CRUD | CRUD | — | — | — |
| import | Create | — | — | — | — |
| export | Create | Create | — | — | — |
| merge | Create | — | — | — | — |

### Data Protection
- **National ID:** AES-256-GCM encryption at application layer; encryption key stored in secrets manager (not in DB)
- **PII fields:** `email`, `phone`, `address_*`, `date_of_birth` considered PII — access logged in audit trail
- **Soft Delete:** `deleted_at` filter applied globally via Drizzle WHERE clause extension or repository base; no accidental exposure of deleted records

### Rate Limiting
- Customer listing/search: 60 requests/minute per authenticated user
- CSV import: 5 requests/hour per admin
- CSV export: 10 requests/hour per user
- Customer create: 20 requests/minute per user

### Input Validation
- All inputs validated server-side via Zod schemas (mirrors Drizzle schema constraints)
- Email format: regex per RFC 5322
- Phone format: E.164 regex `/^\+[1-9]\d{1,14}$/`
- Tax number: format validated per locale pattern
- Tags: strip HTML/script, trim whitespace

---

## 8. Testing

### Test Scenarios

**Happy Path:**
1. Admin creates individual customer → 201 with profile auto-created
2. Admin creates company customer with tax_number → 201
3. Manager searches by name (Arabic) with `?q=أحمد` → returns matching customers
4. Manager filters by tags `?tags[]=vip` → returns only customers with vip tag
5. Admin uploads valid CSV → all rows imported → 200 with success count
6. Employee logs phone communication for customer → 201
7. Admin merges two customers → survivor has combined tags, absorbed soft-deleted
8. Customer fetches own profile → 200 with own data only

**Edge Cases:**
9. Walk-in customer created without email → 201, email null
10. Search with no results → 200 with empty array and total=0
11. CSV import with mixed valid/invalid rows → partial import, failed rows reported
12. Customer with max tags (20) → adding one more → 422
13. Merge customers where one already has merged_into_id set → 422
14. Export filtered to 0 results → 200 with empty CSV
15. Customer with type=individual but company_name provided → allowed (progressive profiling)
16. Pagination boundary: page beyond total → 200 with empty array

**Error Cases:**
17. Create customer with existing email → 409 Conflict
18. Create company without tax_number → 422
19. Create company with duplicate tax_number → 409
20. Fetch deleted customer → 404 (filtered by deleted_at)
21. Employee attempts to create customer → 403 Forbidden
22. Customer fetches another customer's profile → 403
23. Upload non-CSV file for import → 422 with format error
24. Invalid CSV structure (missing required columns) → 422

**Security Cases:**
25. Customer queries `/api/v1/customers` list → 403 (no global read permission)
26. Unauthenticated access to any endpoint → 401
27. National ID encrypted in DB; raw DB access shows ciphertext only
28. Soft-deleted customer not returned in any list/search queries
29. SQL injection attempt via `?q=` parameter → parameterized query, no effect

(End of file)
