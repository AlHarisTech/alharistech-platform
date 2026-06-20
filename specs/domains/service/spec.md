# Service Domain Specification
## نطاق الخدمات والطلبات — AlharisTech Platform

**Domain ID:** `service`
**Version:** 0.1.0-DRAFT
**Status:** Draft
**Phase:** Phase 1
**Owner:** Tech Lead

---

## 1. Bounded Context

### Boundaries
The Service domain is responsible for:
- Service catalog management with bilingual content (FR-301)
- Service categorization and discovery
- Order submission with required documents (FR-302, FR-303)
- Order workflow and status tracking (FR-304, FR-305)
- Employee assignment to orders (FR-306)
- Order status change notifications (FR-307)
- Service rating after completion (FR-308)

### What Service does NOT manage
- Customer profile management (→ Customer domain)
- Payment processing and invoicing (→ Billing domain)
- Notification delivery (→ delegates to Notification domain for FR-307)
- Employee management (→ Identity domain)
- Support tickets (→ Support domain — separate from orders)

### Relationships
```
Service ──► references customers ──► Customer (read customer data)
Service ──► references employees ──► Identity (validate role, read user data)
Service ──► publishes OrderStatusChanged ──► Notification (FR-307)
Service ──► publishes OrderPlaced ──► Billing (create invoice), Customer (denorm counter)
Service ──► publishes ServiceRated ──► Analytics
Identity ──► authenticates ──► Service
Customer ──► reads order history ──► Service
```

---

## 2. Aggregates

### 2.1 Service Aggregate
**Root Entity:** Service

| Property | Type | Constraints |
|:---|:---|:---|
| id | UUID v7 | PK |
| category_id | UUID | FK → service_categories.id |
| name_ar | VARCHAR(255) | Required |
| name_en | VARCHAR(255) | Required |
| slug | VARCHAR(255) | Unique, URL-safe, generated from name_en |
| description_ar | TEXT | Required |
| description_en | TEXT | Required |
| short_description_ar | VARCHAR(500) | Optional |
| short_description_en | VARCHAR(500) | Optional |
| price | DECIMAL(12,2) | Required, >= 0 |
| currency | CHAR(3) | Default: 'SAR' |
| price_type | ENUM('fixed', 'variable', 'free', 'quote') | Default: 'fixed' |
| required_documents | JSONB | Array of `{ name_ar, name_en, type, required: bool, max_size_mb }` |
| estimated_duration_days | INTEGER | Nullable, business days |
| is_active | BOOLEAN | Default: true |
| is_featured | BOOLEAN | Default: false |
| sort_order | INTEGER | Default: 0 |
| icon_url | VARCHAR(500) | Optional |
| cover_image_url | VARCHAR(500) | Optional |
| metadata | JSONB | Arbitrary key-value, nullable |
| created_by | UUID | FK → identity.users.id |
| created_at | TIMESTAMP | Auto |
| updated_at | TIMESTAMP | Auto |

**Indexes:**
- `idx_services_slug` UNIQUE on `slug`
- `idx_services_category` on `category_id`
- `idx_services_active` on `is_active` WHERE `is_active = true`
- `idx_services_featured` on `is_featured` WHERE `is_featured = true`
- `idx_services_fulltext` GIN on `to_tsvector('arabic', name_ar || ' ' || description_ar)`
- `idx_services_name_en` on `name_en`

### 2.2 ServiceCategory Aggregate
**Root Entity:** ServiceCategory

| Property | Type | Constraints |
|:---|:---|:---|
| id | UUID v7 | PK |
| name_ar | VARCHAR(255) | Required |
| name_en | VARCHAR(255) | Required |
| slug | VARCHAR(255) | Unique, URL-safe |
| description_ar | TEXT | Optional |
| description_en | TEXT | Optional |
| parent_id | UUID | FK → service_categories.id (self-referential), nullable |
| icon_url | VARCHAR(500) | Optional |
| sort_order | INTEGER | Default: 0 |
| is_active | BOOLEAN | Default: true |
| created_at | TIMESTAMP | Auto |
| updated_at | TIMESTAMP | Auto |

**Index:**
- `idx_categories_slug` UNIQUE on `slug`
- `idx_categories_parent` on `parent_id`

### 2.3 Order Aggregate
**Root Entity:** Order

| Property | Type | Constraints |
|:---|:---|:---|
| id | UUID v7 | PK |
| reference_number | VARCHAR(20) | Unique, auto-generated (e.g., "ORD-20260620-XXXX") |
| customer_id | UUID | FK → customer.customers.id |
| service_id | UUID | FK → services.id |
| status | ENUM('draft', 'pending', 'in_review', 'in_progress', 'completed', 'cancelled', 'rejected') | Default: 'pending' |
| total_amount | DECIMAL(12,2) | Denormalized from service.price at creation |
| currency | CHAR(3) | Default: 'SAR' |
| documents | JSONB | Array of `{ id, name, url, type, uploaded_at, verified, verified_by, verified_at }` |
| notes | TEXT | Customer notes, nullable |
| internal_notes | TEXT | Staff-only notes, nullable |
| assigned_to | UUID | FK → identity.users.id, nullable |
| assigned_at | TIMESTAMP | Nullable |
| status_history | JSONB | Array of `{ status, changed_by, changed_at, note }`, append-only |
| completed_at | TIMESTAMP | Nullable |
| cancelled_at | TIMESTAMP | Nullable |
| cancel_reason | VARCHAR(500) | Required if status='cancelled' |
| rating | SMALLINT | 1-5, nullable, only when status='completed' |
| rating_comment | TEXT | Nullable |
| rated_at | TIMESTAMP | Nullable |
| created_by | UUID | FK → identity.users.id (customer or staff) |
| created_at | TIMESTAMP | Auto |
| updated_at | TIMESTAMP | Auto |

**Indexes:**
- `idx_orders_reference` UNIQUE on `reference_number`
- `idx_orders_customer` on `customer_id`
- `idx_orders_service` on `service_id`
- `idx_orders_status` on `status`
- `idx_orders_assigned` on `assigned_to` WHERE `assigned_to IS NOT NULL`
- `idx_orders_created` on `created_at DESC`
- `idx_orders_status_assigned` on `(status, assigned_to)` (compound)

---

## 3. Domain Events

| Event | Trigger | Payload | Consumers |
|:---|:---|:---|:---|
| `OrderPlaced` | Order status set to 'pending' (submitted) | `{ orderId, customerId, serviceId, referenceNumber, totalAmount, timestamp }` | Billing (create invoice), Notification (order confirmation), Customer (increment total_orders), Analytics |
| `OrderStatusChanged` | Order status transitions (FR-307) | `{ orderId, oldStatus, newStatus, changedBy, note, timestamp }` | Notification (status update to customer — email/in-app), Analytics (workflow metrics) |
| `OrderAssigned` | Employee assigned to order (FR-306) | `{ orderId, employeeId, assignedBy, timestamp }` | Notification (notify assigned employee), Analytics (workload tracking) |
| `OrderCompleted` | Order status reaches 'completed' | `{ orderId, customerId, completedBy, completedAt, timestamp }` | Billing (finalize invoice), Customer (denorm last_order_at, total_spent), Notification (request rating) |
| `OrderCancelled` | Order status reaches 'cancelled' | `{ orderId, reason, cancelledBy, timestamp }` | Billing (void invoice), Notification (cancellation notice), Analytics |
| `OrderRejected` | Order status reaches 'rejected' | `{ orderId, reason, rejectedBy, timestamp }` | Notification (rejection notice with reason), Customer |
| `ServiceRated` | Customer rates completed order (FR-308) | `{ orderId, serviceId, customerId, rating, comment, timestamp }` | Analytics (service ratings aggregation), Service (update avg_rating — denorm) |
| `DocumentsUploaded` | Customer uploads documents to order (FR-303) | `{ orderId, documentCount, timestamp }` | — |
| `DocumentsVerified` | Employee verifies uploaded documents | `{ orderId, verifiedDocumentIds[], verifiedBy, timestamp }` | — |

---

## 4. Use Cases

### UC-SVC-01: Browse Services (FR-301)
**Actor:** Any (public, authenticated)
**Preconditions:** None
**Flow:**
1. Actor requests `GET /api/v1/services` with optional filters: `?category=...&price_type=...&q=...&page=1&limit=20`
2. System queries active services (Drizzle select with WHERE `is_active = true`)
3. If `category` provided, filter by category slug (join service_categories)
4. If `q` provided, full-text search on name_ar + name_en + description_ar + description_en
5. System returns paginated results with category names
6. Response: 200 `{ data: [...services], meta: { page, limit, total, totalPages } }`

**Exceptions:**
- No services found → 200 with empty array

### UC-SVC-02: Get Service Detail (FR-301)
**Actor:** Any (public, authenticated)
**Preconditions:** Service exists and is active
**Flow:**
1. Actor requests `GET /api/v1/services/{id}` or `GET /api/v1/services/slug/{slug}`
2. System loads Service + ServiceCategory (Drizzle innerJoin)
3. System includes aggregated rating data (average rating, total ratings count)
4. Response: 200 `{ data: { ...service, category: {...}, avg_rating: 4.5, total_ratings: 28 } }`

**Exceptions:**
- Not found → 404
- Inactive service → 404 (unless actor is Admin/Manager, then return with flag)

### UC-SVC-03: Submit Order with Documents (FR-302, FR-303)
**Actor:** Customer
**Preconditions:** Authenticated as customer; service is active
**Flow:**
1. Customer requests `POST /api/v1/orders` with `{ serviceId, notes, documentUrls[] }`
2. System loads service to validate:
   - Service is active
   - Required documents are defined in `service.required_documents`
3. System validates that all `required: true` documents are provided
4. System generates `reference_number` (format: ORD-YYYYMMDD-XXXX)
5. System creates Order record (Drizzle insert):
   - `status = 'pending'`
   - `customer_id = authenticated user's linked customer ID`
   - `total_amount = service.price`
   - `documents = [{ id: uuid, name, url, type, uploaded_at, verified: false }]`
   - `status_history = [{ status: 'pending', changed_by: customerId, changed_at: now, note: null }]`
6. System publishes `OrderPlaced` event
7. Response: 201 `{ data: { id, referenceNumber, status, totalAmount, ... } }`

**Exceptions:**
- Service not found or inactive → 404
- Missing required documents → 422 `{ error: { code: "ORDER_MISSING_DOCUMENTS", message: "المستندات المطلوبة غير مكتملة", message_en: "Required documents are incomplete", details: { missingDocuments: ["هوية وطنية", "عقد ملكية"] } } }`
- Customer not found (no linked profile) → 422
- Invalid document URL format → 422

### UC-SVC-04: Track Order Status (FR-304)
**Actor:** Customer (own orders), Employee (assigned), Admin, Manager
**Preconditions:** Order exists
**Flow:**
1. Actor requests `GET /api/v1/orders/{id}`
2. System loads Order with related Service + ServiceCategory
3. System includes full `status_history` in response
4. If actor is customer, verify `order.customer_id` matches authenticated customer's ID
5. If actor is employee, verify `order.assigned_to` matches or employee has global read
6. Response: 200 `{ data: { ...order, service: {...}, statusHistory: [...], assignedEmployee: {...} } }`

**Exceptions:**
- Order not found → 404
- Customer accessing another's order → 403
- Employee accessing unassigned order (with restricted scope) → 403

### UC-SVC-05: List/Filter Orders
**Actor:** Admin (all), Manager (all), Employee (assigned), Customer (own)
**Preconditions:** Authenticated
**Flow:**
1. Actor requests `GET /api/v1/orders` with filters:
   - Customer: auto-scoped to own orders only
   - Employee: auto-scoped to `assigned_to = me` OR can see all pending (configurable)
   - `?status=...&service_id=...&customer_id=...&assigned_to=...&from=...&to=...&page=1&limit=20`
2. System builds query with role-based scoping enforced in repository layer
3. System returns paginated results
4. Response: 200 `{ data: [...orders], meta: { page, limit, total, totalPages } }`

**Exceptions:**
- Customer/Employee attempting to access others' orders → 403 (handled by scoping)

### UC-SVC-06: Employee Processes Order — Update Status (FR-305)
**Actor:** Employee (assigned), Admin, Manager
**Preconditions:** Order exists; actor has permission for the target status transition
**Flow:**
1. Actor requests `PATCH /api/v1/orders/{id}/status` with `{ status: "in_review"|"in_progress"|"completed"|"rejected"|"cancelled", note?: "..." }`
2. System validates status transition is allowed (see workflow rules)
3. If `status = 'completed'`: system validates all required documents are verified
4. If `status = 'cancelled'`: system requires `cancel_reason`
5. System begins transaction:
   a. Updates `order.status`
   b. Appends to `status_history`: `{ status, changed_by, changed_at, note }`
   c. If completed: sets `completed_at = now()`
   d. If cancelled: sets `cancelled_at = now()`, `cancel_reason`
6. System publishes `OrderStatusChanged` event (→ Notification domain for FR-307)
7. If new status is 'completed': system publishes `OrderCompleted`
8. If new status is 'cancelled': system publishes `OrderCancelled`
9. Response: 200 `{ data: { id, status, statusHistory: [...] } }`

**Allowed Status Transitions:**
```
pending     → in_review, cancelled, rejected
in_review   → in_progress, cancelled, rejected
in_progress → completed, cancelled
completed   → (terminal — no further transitions)
cancelled   → pending (reopen only by Admin)
rejected    → pending (reopen only by Admin)
draft       → pending, cancelled
```

**Exceptions:**
- Invalid status transition → 422 `{ error: { code: "ORDER_INVALID_TRANSITION", message: "لا يمكن الانتقال من [oldStatus] إلى [newStatus]", message_en: "Cannot transition from [oldStatus] to [newStatus]" } }`
- Order not found → 404
- Unauthorized actor → 403
- Completing order with unverified documents → 422

### UC-SVC-07: Upload Documents to Order (FR-303)
**Actor:** Customer (own orders), Employee (assigned), Admin
**Preconditions:** Order exists, status not 'completed' or 'cancelled'
**Flow:**
1. Actor requests `POST /api/v1/orders/{id}/documents` (multipart or URL array)
2. System validates file types + sizes against `service.required_documents` constraints
3. System uploads files to storage (object storage / Supabase Storage)
4. System appends document entries to `order.documents` JSONB array
5. System publishes `DocumentsUploaded` event
6. Response: 200 `{ data: { documents: [...] } }`

**Exceptions:**
- Order in terminal status → 422
- File too large → 413
- Invalid file type → 422
- Storage failure → 500

### UC-SVC-08: Assign Order to Employee (FR-306)
**Actor:** Admin, Manager
**Preconditions:** Order exists; target user has role='employee'; order status is 'pending' or 'in_review'
**Flow:**
1. Actor requests `POST /api/v1/orders/{id}/assign` with `{ employeeId }`
2. System validates target user has role='employee' (check Identity domain)
3. System validates order status allows assignment
4. System updates `order.assigned_to = employeeId`, `assigned_at = now()`
5. System appends to `status_history`: `{ status, changed_by, changed_at, note: "Assigned to {employee name}" }`
6. If order is still 'pending', auto-transition to 'in_review'
7. System publishes `OrderAssigned` event (→ Notification notifies employee)
8. Response: 200 `{ data: { id, assignedTo: { id, name_ar, name_en }, assignedAt, status } }`

**Exceptions:**
- Target user not found or not employee → 422 `{ error: { code: "ORDER_INVALID_EMPLOYEE" } }`
- Order in terminal status → 422
- Already assigned to same employee → 200 no-op

### UC-SVC-09: Rate Completed Service (FR-308)
**Actor:** Customer (own order only)
**Preconditions:** Order status is 'completed'; order not already rated
**Flow:**
1. Customer requests `POST /api/v1/orders/{id}/rate` with `{ rating: 1-5, comment?: "..." }`
2. System validates order belongs to customer
3. System validates order status is 'completed' and rating is null
4. System updates `order.rating`, `rating_comment`, `rated_at`
5. System publishes `ServiceRated` event
6. Response: 200 `{ data: { id, rating, ratedAt } }`

**Exceptions:**
- Order not completed → 422 `{ error: { code: "ORDER_NOT_COMPLETED" } }`
- Already rated → 409 `{ error: { code: "ORDER_ALREADY_RATED" } }`
- Rating out of range → 422

---

## 5. API Specification

### Endpoints

| Method | Path | Auth | Role | Description |
|:---|:---|:---|:---|:---|
| GET | /api/v1/services | Public | — | List active services (FR-301) |
| GET | /api/v1/services/{id} | Public | — | Get service detail (FR-301) |
| GET | /api/v1/services/slug/{slug} | Public | — | Get service by slug |
| GET | /api/v1/services/categories | Public | — | List service categories |
| POST | /api/v1/services | Required | Admin, Manager | Create service |
| PATCH | /api/v1/services/{id} | Required | Admin, Manager | Update service |
| DELETE | /api/v1/services/{id} | Required | Admin | Deactivate service |
| POST | /api/v1/orders | Required | Customer | Submit order (FR-302, FR-303) |
| GET | /api/v1/orders | Required | Admin, Manager, Employee, Customer | List orders (scoped) |
| GET | /api/v1/orders/{id} | Required | Admin, Manager, Employee (assigned), Customer (own) | Get order detail (FR-304) |
| PATCH | /api/v1/orders/{id}/status | Required | Admin, Manager, Employee (assigned) | Update order status (FR-305) |
| POST | /api/v1/orders/{id}/documents | Required | Customer (own), Employee (assigned), Admin | Upload documents (FR-303) |
| POST | /api/v1/orders/{id}/assign | Required | Admin, Manager | Assign order to employee (FR-306) |
| POST | /api/v1/orders/{id}/rate | Required | Customer (own) | Rate completed order (FR-308) |
| GET | /api/v1/orders/{id}/timeline | Required | Admin, Manager, Employee (assigned), Customer (own) | Get order status history |

### Request/Response Schemas

**GET /api/v1/services — Query Parameters:**
```
?category=legal-services
&price_type=fixed|variable|free|quote
&q=استشارة
&is_featured=true
&min_price=100
&max_price=5000
&page=1
&limit=20
&sort_by=sort_order|price|name_ar|created_at
&order=asc|desc
```

**GET /api/v1/services/{id} — Response:**
```json
{
  "data": {
    "id": "uuid",
    "category": {
      "id": "uuid",
      "name_ar": "خدمات قانونية",
      "name_en": "Legal Services",
      "slug": "legal-services"
    },
    "name_ar": "استشارة قانونية شاملة",
    "name_en": "Comprehensive Legal Consultation",
    "slug": "comprehensive-legal-consultation",
    "description_ar": "نقدم استشارة قانونية شاملة تشمل...",
    "description_en": "We provide comprehensive legal consultation including...",
    "short_description_ar": "استشارة قانونية متكاملة",
    "short_description_en": "Complete legal consultation",
    "price": 1500.00,
    "currency": "SAR",
    "price_type": "fixed",
    "required_documents": [
      {
        "name_ar": "هوية وطنية",
        "name_en": "National ID",
        "type": "pdf|jpg|png",
        "required": true,
        "max_size_mb": 5
      },
      {
        "name_ar": "عقد أو مستند القضية",
        "name_en": "Contract or Case Document",
        "type": "pdf|doc|docx",
        "required": true,
        "max_size_mb": 10
      }
    ],
    "estimated_duration_days": 5,
    "is_active": true,
    "is_featured": true,
    "avg_rating": 4.5,
    "total_ratings": 28,
    "created_at": "2026-01-01T00:00:00Z"
  },
  "meta": {
    "timestamp": "2026-06-20T12:00:00Z"
  }
}
```

**POST /api/v1/orders — Request:**
```json
{
  "service_id": "uuid (required)",
  "notes": "string (optional, customer notes)",
  "documents": [
    {
      "name": "National ID - front side",
      "url": "https://storage.example.com/uploads/doc-001.pdf",
      "type": "pdf"
    }
  ]
}
```

**POST /api/v1/orders — Response (201 Created):**
```json
{
  "data": {
    "id": "uuid",
    "reference_number": "ORD-20260620-A3F7",
    "customer_id": "uuid",
    "service": {
      "id": "uuid",
      "name_ar": "استشارة قانونية شاملة",
      "name_en": "Comprehensive Legal Consultation"
    },
    "status": "pending",
    "total_amount": 1500.00,
    "currency": "SAR",
    "documents": [
      {
        "id": "uuid",
        "name": "National ID - front side",
        "url": "https://storage.example.com/uploads/doc-001.pdf",
        "type": "pdf",
        "uploaded_at": "2026-06-20T12:00:00Z",
        "verified": false,
        "verified_by": null,
        "verified_at": null
      }
    ],
    "notes": null,
    "status_history": [
      {
        "status": "pending",
        "changed_by": "uuid",
        "changed_at": "2026-06-20T12:00:00Z",
        "note": null
      }
    ],
    "created_at": "2026-06-20T12:00:00Z"
  },
  "meta": {
    "timestamp": "2026-06-20T12:00:00Z",
    "requestId": "uuid"
  }
}
```

**GET /api/v1/orders — Query Parameters:**
```
?status=pending|in_review|in_progress|completed|cancelled|rejected
&service_id=uuid
&customer_id=uuid
&assigned_to=uuid
&reference_number=ORD-20260620-A3F7
&from=2026-06-01
&to=2026-06-30
&page=1
&limit=20
&sort_by=created_at|status|total_amount
&order=asc|desc
```

**GET /api/v1/orders/{id} — Response:**
```json
{
  "data": {
    "id": "uuid",
    "reference_number": "ORD-20260620-A3F7",
    "customer": {
      "id": "uuid",
      "first_name_ar": "أحمد",
      "last_name_ar": "العلي",
      "email": "ahmed@example.com"
    },
    "service": {
      "id": "uuid",
      "name_ar": "استشارة قانونية شاملة",
      "name_en": "Comprehensive Legal Consultation",
      "slug": "comprehensive-legal-consultation"
    },
    "status": "in_progress",
    "total_amount": 1500.00,
    "currency": "SAR",
    "documents": [ ... ],
    "notes": "عاجل - معاملة رقم 12345",
    "internal_notes": "تم التواصل مع العميل - يحتاج متابعة",
    "assigned_to": {
      "id": "uuid",
      "first_name_ar": "فاطمة",
      "last_name_ar": "الزهراني",
      "email": "fatima@alharistech.com"
    },
    "assigned_at": "2026-06-20T14:00:00Z",
    "status_history": [
      { "status": "pending", "changed_by": "...", "changed_at": "...", "note": null },
      { "status": "in_review", "changed_by": "...", "changed_at": "...", "note": "المستندات مكتملة" },
      { "status": "in_progress", "changed_by": "...", "changed_at": "...", "note": "تم التعيين لفاطمة" }
    ],
    "rating": null,
    "rating_comment": null,
    "created_at": "2026-06-20T12:00:00Z",
    "updated_at": "2026-06-20T14:30:00Z"
  },
  "meta": {
    "timestamp": "2026-06-20T14:30:00Z",
    "requestId": "uuid"
  }
}
```

**PATCH /api/v1/orders/{id}/status — Request:**
```json
{
  "status": "in_progress",
  "note": "تم التحقق من المستندات وبدء المعالجة"
}
```

**POST /api/v1/orders/{id}/assign — Request:**
```json
{
  "employee_id": "uuid"
}
```

**POST /api/v1/orders/{id}/rate — Request:**
```json
{
  "rating": 5,
  "comment": "خدمة ممتازة وسريعة"
}
```

**Error Response Envelope:**
```json
{
  "error": {
    "code": "ORDER_INVALID_TRANSITION",
    "message": "لا يمكن الانتقال من in_progress إلى pending",
    "message_en": "Cannot transition from in_progress to pending",
    "statusCode": 422,
    "details": {
      "currentStatus": "in_progress",
      "requestedStatus": "pending",
      "allowedTransitions": ["completed", "cancelled"]
    }
  },
  "meta": {
    "timestamp": "2026-06-20T12:00:00Z",
    "requestId": "uuid"
  }
}
```

---

## 6. Business Rules

### Order Workflow Rules
1. **RB-SVC-01:** Order status transitions MUST follow the allowed state machine (FR-305); any invalid transition returns 422 with allowed transitions in response
2. **RB-SVC-02:** An order requires ALL `required: true` documents to be uploaded before it can transition from `pending` to `in_review` (FR-303)
3. **RB-SVC-03:** Order cannot reach `completed` status unless all documents are verified (`verified: true`)
4. **RB-SVC-04:** `cancelled` orders require `cancel_reason`; `rejected` orders require a note in the status history explaining the rejection reason
5. **RB-SVC-05:** Only Admin can reopen `cancelled` or `rejected` orders back to `pending`

### Assignment Rules
6. **RB-SVC-06:** Only users with role='employee' (verified from Identity domain) can be assigned to orders (FR-306)
7. **RB-SVC-07:** An order can only be assigned when status is `pending` or `in_review`
8. **RB-SVC-08:** Reassigning an order: `assigned_to` and `assigned_at` are updated; previous assignment is recorded in `status_history`
9. **RB-SVC-09:** Employee can only view and act on their assigned orders unless they have Manager or Admin role

### Rating Rules
10. **RB-SVC-10:** Rating is only allowed after order reaches `completed` status and is not already rated (FR-308)
11. **RB-SVC-11:** Rating value must be integer 1-5
12. **RB-SVC-12:** Rating cannot be changed or removed once submitted

### Service Catalog Rules
13. **RB-SVC-13:** `name_ar` and `name_en` are both required for all services (bilingual)
14. **RB-SVC-14:** `required_documents` is stored as JSONB; each entry defines name (ar/en), accepted file types, required flag, and max file size
15. **RB-SVC-15:** Deleting a service sets `is_active = false` (soft-deletion); active orders referencing the service continue to function
16. **RB-SVC-16:** Service `price` can be 0 for free services (`price_type='free'`); `price_type='quote'` indicates price determined after review

### Order Data Rules
17. **RB-SVC-17:** `reference_number` format: `ORD-YYYYMMDD-XXXX` where XXXX is a random alphanumeric (4 chars, uppercase); must be unique
18. **RB-SVC-18:** `total_amount` is denormalized from `service.price` at order creation; it does NOT update if service price changes later
19. **RB-SVC-19:** `status_history` is an append-only JSONB array; no entries are ever removed or modified
20. **RB-SVC-20:** `documents` JSONB array supports incremental uploads; new documents are appended without overwriting existing ones

---

## 7. Security

### Authentication & Authorization (RBAC Matrix — Service Domain)

| Resource | Admin | Manager | Employee | Customer | Partner |
|:---|:---|:---|:---|:---|:---|
| services | CRUD | CRUD | Read | Read | Read |
| service categories | CRUD | CRUD | Read | Read | Read |
| orders (all) | CRUD | CRUD | Read (assigned), Update status (assigned) | Create, Read (own) | — |
| assign orders | Create | Create | — | — | — |
| verify documents | Update | Update | Update (assigned) | — | — |
| rate orders | — | — | — | Create (own, completed) | — |

### Scoping Rules
- **Customer:** All order queries auto-scoped to `WHERE customer_id = <current_customer_id>`
- **Employee (restricted):** Order list auto-scoped to `WHERE assigned_to = <current_user_id>`
- **Employee (full):** If granted `orders:read:all` permission, can view all orders regardless of assignment
- **System-level:** `deleted_at IS NULL` filter applied to all queries globally

### Data Protection
- **document URLs:** Signed URLs with expiry (1 hour for GET, 24 hours for upload); direct storage access not exposed
- **internal_notes:** Only returned to Admin, Manager, and assigned Employee roles; stripped from Customer responses
- **status_history:** Full history visible to Admin/Manager; Customer receives only status + changed_at (no internal notes or changed_by details)
- **File upload:** Max total upload size per request: 50MB; individual file limits defined per document type in `required_documents`

### Rate Limiting
- Service listing: 120 requests/minute (public)
- Order creation: 10 requests/minute per customer
- Status updates: 60 requests/minute per employee
- Document uploads: 20 requests/minute per user
- Assignment: 30 requests/minute per admin/manager

### Input Validation
- All inputs validated via Zod schemas
- File types validated by MIME type AND magic bytes (not just extension)
- `notes` and `internal_notes`: max 5000 characters, sanitized for HTML injection
- Document URLs validated as valid HTTPS URLs to allowed storage domains

---

## 8. Testing

### Test Scenarios

**Happy Path:**
1. Customer browses services → filters by category → views service detail → submits order with documents → 201
2. Admin assigns order to employee → order auto-transitions to 'in_review' → employee sees order in their list
3. Employee reviews documents → verifies them → transitions order to 'in_progress' → processes → completes order → 200
4. Customer receives completion notification → rates service 5 stars → 200
5. Manager creates new service with Arabic/English content → 201 → service appears in public listing
6. Customer uploads additional document to pending order → document appended to documents array

**Edge Cases:**
7. Order with `price_type=free` → total_amount = 0 → order proceeds through workflow without billing
8. Order with `price_type=quote` → total_amount = 0 initially → Manager updates amount after review
9. Reassign order from one employee to another → both changes recorded in status_history
10. Customer submits order with exactly the minimum required documents → 201
11. Customer submits more documents than required → 201 (extra documents accepted)
12. Service with no category (null category_id) → still listed in "uncategorized" bucket
13. Pagination: last page with fewer items than limit → correct metadata
14. Employee views unassigned pending orders (if granted global read) → visible
15. Admin reopens a cancelled order to pending → customer can resubmit documents

**Error Cases:**
16. Submit order with missing required document → 422 with missing documents list
17. Transition from 'in_progress' directly to 'pending' → 422 invalid transition
18. Complete order with unverified documents → 422
19. Customer rates order that is still 'in_progress' → 422 ORDER_NOT_COMPLETED
20. Rate already-rated order → 409 ORDER_ALREADY_RATED
21. Assign order to user with role='customer' → 422 ORDER_INVALID_EMPLOYEE
22. Assign order to non-existent user → 422
23. Employee attempts to update unassigned order status → 403
24. Customer accesses another customer's order detail → 403
25. Upload document exceeding max size → 413
26. Upload document with disallowed file type → 422
27. Rate with value 0 or 6 → 422 validation error
28. Cancel order without providing cancel_reason → 422

**Security Cases:**
29. Unauthenticated user cannot create order (POST /api/v1/orders) → 401
30. Customer query parameter `?customer_id=<other>` ignored when actor is customer → auto-scoped to own ID
31. Employee without `orders:read:all` permission cannot list all orders → only assigned orders returned
32. `internal_notes` field not present in response when customer fetches own order
33. SQL injection via `?q=` on service search → parameterized query, no effect
34. Malicious document URL pointing to external domain → rejected by URL domain allowlist

(End of file)
