# Support Domain Specification
## نطاق التذاكر والدعم الفني — AlharisTech Platform

**Domain ID:** `support`
**Version:** 0.1.0-DRAFT
**Status:** Draft
**Phase:** Phase 1
**Owner:** Tech Lead

---

## 1. Bounded Context

### Boundaries
The Support domain is responsible for:
- Ticket creation and lifecycle management
- Ticket categorization and priority assignment
- Ticket assignment to employees/teams
- Ticket messaging (customer ↔ staff communication)
- Internal notes (staff-only, not visible to customers)
- Knowledge base article management
- Knowledge article search and linking to tickets
- SLA tracking (response time, resolution time)
- Support performance reporting (Phase 2)

### What Support does NOT manage
- Live chat / real-time messaging (→ Phase 3; dedicated Chat domain)
- Customer profiles (→ Customer domain; Support references customer_id)
- User authentication/authorization (→ Identity domain)
- Notification delivery (→ delegates to Notification domain)
- File storage (→ delegates to Storage domain; only stores attachment references)
- AI-powered ticket suggestions (→ AI domain, Phase 3)

### Relationships
```
Support ──► references ──► Customer (customer_id)
Support ──► references ──► Identity (assigned_to → users.id)
Support ──► publishes TicketOpened ──► Notification (confirmation to customer, alert to staff)
Support ──► publishes TicketAssigned ──► Notification (employee notification)
Support ──► publishes TicketStatusChanged ──► Notification (status update to customer)
Support ──► publishes TicketMessageAdded ──► Notification (new message alert)
Support ──► publishes TicketClosed ──► Notification (resolution confirmation, satisfaction survey)
Support ──► publishes TicketRated ──► Analytics (support performance metrics)
Support ──► publishes ArticlePublished ──► Notification (if subscribed)
```

---

## 2. Aggregates

### 2.1 Ticket Aggregate
**Root Entity:** Ticket

| Property | Type | Constraints |
|:---|:---|:---|
| id | UUID v7 | PK |
| ticket_number | VARCHAR(20) | Unique, format: TKT-{YYYY}-{6-digit sequence} |
| title | VARCHAR(500) | Required, 5-500 chars |
| description | TEXT | Required, 10-10000 chars |
| status | ENUM(open, in_progress, waiting_customer, resolved, closed, reopened) | Default: open |
| priority | ENUM(low, medium, high, urgent) | Default: medium |
| category | ENUM(general, account, billing, service_order, commerce_order, technical, complaint, suggestion, other) | Required |
| sub_category | VARCHAR(100) | Nullable, admin-configurable |
| customer_id | UUID | FK → customers.id, required |
| assigned_to | UUID | FK → users.id, nullable |
| assigned_team | VARCHAR(100) | Nullable, for routing |
| source | ENUM(web, email, phone, chat, api) | Default: web |
| sla_response_deadline | TIMESTAMP | Computed on creation based on priority |
| sla_resolution_deadline | TIMESTAMP | Computed on creation based on priority |
| first_response_at | TIMESTAMP | Nullable, timestamp of first staff message |
| resolved_at | TIMESTAMP | Nullable |
| closed_at | TIMESTAMP | Nullable |
| reopened_at | TIMESTAMP | Nullable |
| reopened_count | INTEGER | Default: 0 |
| satisfaction_rating | SMALLINT | Nullable, 1-5, set after resolution |
| satisfaction_comment | TEXT | Nullable |
| linked_order_id | UUID | Nullable, FK → commerce_orders.id or service_orders.id |
| linked_article_ids | JSONB | Array of knowledge article IDs, default [] |
| tags | JSONB | Array of tag strings, default [] |
| internal_notes | TEXT | Nullable, staff-only summary |
| created_at | TIMESTAMP | Auto |
| updated_at | TIMESTAMP | Auto |

**Computed values:**
- `is_overdue_response` = first_response_at IS NULL AND NOW() > sla_response_deadline
- `is_overdue_resolution` = status NOT IN (resolved, closed) AND NOW() > sla_resolution_deadline

**Invariants:**
- assigned_to must reference a user with role employee, manager, or admin (not customer or partner)
- reopened tickets must have reopened_at within 7 days of closed_at; otherwise create new ticket
- satisfaction_rating can only be set after status reaches `resolved` and must be set by the ticket's customer
- linked_order_id must reference an existing order

### 2.2 TicketMessage Aggregate
**Root Entity:** TicketMessage

| Property | Type | Constraints |
|:---|:---|:---|
| id | UUID v7 | PK |
| ticket_id | UUID | FK → tickets.id, ON DELETE CASCADE |
| sender_id | UUID | FK → users.id (optional for system messages) |
| sender_type | ENUM(customer, employee, system) | Required |
| message | TEXT | Required, 1-20000 chars |
| is_internal | BOOLEAN | Default: false (only employee can create internal notes) |
| attachments | JSONB | Array of {file_name, file_url, file_size, mime_type}, default [] |
| created_at | TIMESTAMP | Auto |

**Invariants:**
- is_internal=true CANNOT be set when sender_type=customer
- At least one of message or attachments must be non-empty
- Attachments: max 5 per message, max 10MB each

### 2.3 KnowledgeArticle Aggregate
**Root Entity:** KnowledgeArticle

| Property | Type | Constraints |
|:---|:---|:---|
| id | UUID v7 | PK |
| title_ar | VARCHAR(500) | Required |
| title_en | VARCHAR(500) | Required |
| slug | VARCHAR(550) | Unique, auto-generated from title_en |
| content_ar | TEXT | Required |
| content_en | TEXT | Required |
| excerpt_ar | VARCHAR(500) | Nullable, auto-generated from content_ar |
| excerpt_en | VARCHAR(500) | Nullable, auto-generated from content_en |
| category | VARCHAR(100) | Required, admin-configurable |
| sub_category | VARCHAR(100) | Nullable |
| tags | JSONB | Array of tag strings, default [] |
| is_published | BOOLEAN | Default: false |
| is_featured | BOOLEAN | Default: false |
| view_count | INTEGER | Default: 0 |
| helpful_count | INTEGER | Default: 0 |
| not_helpful_count | INTEGER | Default: 0 |
| author_id | UUID | FK → users.id |
| last_reviewed_by | UUID | FK → users.id, nullable |
| last_reviewed_at | TIMESTAMP | Nullable |
| seo_meta | JSONB | Nullable, {title_ar, title_en, description_ar, description_en} |
| deleted_at | TIMESTAMP | Nullable, soft delete |
| created_at | TIMESTAMP | Auto |
| updated_at | TIMESTAMP | Auto |

**Invariants:**
- Only published articles appear in public search
- deleted_at prevents display; articles linked to resolved tickets retain reference
- title_ar and content_ar cannot be empty (Arabic-first platform)

**RBAC Matrix for Support:**

| Resource | Admin | Manager | Employee | Customer |
|:---|:---|:---|:---|:---|
| tickets (read) | Read all | Read all | Read all | Read (own) |
| tickets (create) | Create | Create | Create (on behalf) | Create (own) |
| tickets (update status) | All transitions | All transitions | All except reopen after 7d | — |
| tickets (assign) | Assign any | Assign any | — | — |
| tickets (delete) | Soft delete | — | — | — |
| ticket_messages (read) | Read all | Read all | Read all | Read (own tickets, non-internal) |
| ticket_messages (create) | Create | Create | Create (public + internal) | Create (public only) |
| ticket_messages (delete) | Delete | Delete (own) | Delete (own) | — |
| knowledge_articles (read) | Read all | Read all | Read all | Read (published only) |
| knowledge_articles (write) | CRUD | CRUD | Create, Update (own) | — |
| knowledge_articles (publish) | Publish/Unpublish | Publish/Unpublish | — | — |
| ticket_reports | Read all | Read all | Read (own stats) | — |
| sla_configuration | CRUD | Read | — | — |

---

## 3. Domain Events

| Event | Trigger | Payload | Consumers |
|:---|:---|:---|:---|
| `TicketOpened` | Customer creates new ticket | `{ ticketId, ticketNumber, customerId, title, category, priority, source, slaResponseDeadline, slaResolutionDeadline, timestamp }` | Notification (confirmation to customer, new-ticket alert to team), Analytics |
| `TicketAssigned` | Ticket assigned to employee | `{ ticketId, ticketNumber, assignedTo, assignedBy, previousAssignee, timestamp }` | Notification (assignment alert to employee, update to customer) |
| `TicketMessageAdded` | Message posted on ticket | `{ ticketId, ticketNumber, messageId, senderId, senderType, isInternal, timestamp }` | Notification (if sender is customer → alert staff; if sender is employee AND not internal → alert customer) |
| `TicketInternalNoteAdded` | Staff adds internal note | `{ ticketId, ticketNumber, messageId, senderId, timestamp }` | — (internal only, no customer notification) |
| `TicketStatusChanged` | Ticket status transitions | `{ ticketId, ticketNumber, oldStatus, newStatus, changedBy, isAutomatic, timestamp }` | Notification (status update to customer), SLA tracking, Analytics |
| `TicketResolved` | Ticket transitions to resolved | `{ ticketId, ticketNumber, resolvedBy, firstResponseAt, resolutionTimeMinutes, timestamp }` | Notification (resolution confirmation, satisfaction survey link), Analytics |
| `TicketClosed` | Ticket transitions to closed | `{ ticketId, ticketNumber, closedBy, totalMessages, resolutionTimeMinutes, timestamp }` | Analytics (closure metrics) |
| `TicketReopened` | Closed ticket reopened within 7 days | `{ ticketId, ticketNumber, reopenedBy, originalClosedAt, timestamp }` | Notification (reopen alert to assigned employee) |
| `TicketRated` | Customer submits satisfaction rating | `{ ticketId, ticketNumber, rating, comment, customerId, timestamp }` | Analytics (CSAT metrics), Manager dashboard |
| `SLABreachWarning` | SLA deadline approaching (< 1 hour) | `{ ticketId, ticketNumber, slaType, deadline, timestamp }` | Notification (urgent alert to assigned employee and manager) |
| `SLABreachEscalation` | SLA deadline exceeded | `{ ticketId, ticketNumber, slaType, exceededByMinutes, assignedTo, timestamp }` | Notification (escalation to manager), Analytics |
| `ArticleCreated` | New knowledge article drafted | `{ articleId, title_en, authorId, category, timestamp }` | — |
| `ArticlePublished` | Article is_published set to true | `{ articleId, title_ar, title_en, category, tags[], publishedBy, timestamp }` | Search indexing, Notification (if subscribed to category) |
| `ArticleUpdated` | Published article modified | `{ articleId, title_en, updatedBy, changedFields[], timestamp }` | Search indexing |
| `ArticleArchived` | Article soft-deleted | `{ articleId, title_en, archivedBy, timestamp }` | Search indexing (remove from index) |
| `ArticleHelpfulRated` | User marks article helpful/not helpful | `{ articleId, isHelpful, timestamp }` | Analytics (content quality metrics) |

---

## 4. Use Cases

### UC-SUP-01: Customer Opens Ticket
**Actor:** Customer (authenticated)
**Preconditions:** Customer exists
**Flow:**
1. Customer submits ticket form (title, description, category, priority suggestion)
2. System validates inputs (Zod schema)
3. System generates ticket_number: TKT-{YYYY}-{6-digit sequence}
4. System calculates priority:
   - If customer suggests priority → use as initial value
   - Otherwise → auto-assign based on category rules:
     - technical, billing → high
     - complaint → urgent
     - general, account → medium
     - suggestion → low
5. System computes SLA deadlines based on priority:
   - urgent: response 1h, resolution 4h
   - high: response 4h, resolution 24h
   - medium: response 8h, resolution 72h
   - low: response 24h, resolution 168h
6. System creates ticket with status=open
7. System publishes `TicketOpened` event
8. Response: 201 { data: Ticket }

**Exceptions:**
- Validation failure → 422
- Customer not authenticated → 401
- Customer has > 10 open tickets → 422 { error: MAX_OPEN_TICKETS_EXCEEDED }

### UC-SUP-02: Employee Reviews and Responds
**Actor:** Employee, Manager, Admin
**Preconditions:** Authenticated, ticket exists
**Flow:**
1. Actor views ticket detail with messages
2. Actor optionally changes status (e.g., open → in_progress)
3. Actor writes response message (is_internal = false)
4. System creates TicketMessage with sender_id, sender_type=employee, is_internal=false
5. If status changed → update ticket.status, create status history, publish `TicketStatusChanged`
6. If this is first staff message → set ticket.first_response_at = NOW()
7. System publishes `TicketMessageAdded` event
8. Response: 201 { data: TicketMessage }

**Exceptions:**
- Ticket not found → 404
- Invalid status transition → 422

### UC-SUP-03: Add Internal Note
**Actor:** Employee, Manager, Admin
**Preconditions:** Authenticated, ticket exists
**Flow:**
1. Actor writes internal note (is_internal = true)
2. System creates TicketMessage with sender_type=employee, is_internal=true
3. System publishes `TicketInternalNoteAdded` event
4. Note is NOT visible to customer in API responses
5. Response: 201 { data: TicketMessage }

### UC-SUP-04: Assign Ticket to Employee
**Actor:** Manager, Admin
**Preconditions:** Authenticated, ticket exists, target user is employee/manager/admin
**Flow:**
1. Actor assigns ticket to user_id
2. System validates target user exists and has appropriate role
3. System updates ticket.assigned_to
4. System may auto-update status to in_progress if currently open
5. System publishes `TicketAssigned` event
6. Response: 200 { data: Ticket }

**Exceptions:**
- Target user not found → 404
- Target user not employee/manager/admin → 422

### UC-SUP-05: Ticket Status Workflow
**Actor:** Employee, Manager, Admin (system for auto-transitions)
**Preconditions:** Ticket exists, valid transition
**Flow:**
1. Actor changes ticket status
2. System validates transition is allowed:
   - open → in_progress ✓
   - open → resolved ✓ (quick resolution)
   - open → closed ✗ (must go through resolved)
   - in_progress → waiting_customer ✓
   - in_progress → resolved ✓
   - waiting_customer → in_progress ✓ (customer responds)
   - waiting_customer → resolved ✓
   - resolved → closed ✓ (manual or auto after 72h)
   - resolved → reopened ✓ (within 7 days)
   - closed → reopened ✓ (within 7 days only)
   - Any status → closed (admin only, force close)
3. System records status change in status history
4. System publishes `TicketStatusChanged` event
5. If status == resolved → set resolved_at, publish `TicketResolved`
6. If status == closed → set closed_at, publish `TicketClosed`
7. If status == reopened → increment reopened_count, set reopened_at, publish `TicketReopened`
8. Response: 200 { data: Ticket }

**Exceptions:**
- Invalid transition → 422 { error: INVALID_STATUS_TRANSITION, current: "X", attempted: "Y" }
- Reopen after 7 days of closure → 422 { error: REOPEN_WINDOW_EXPIRED, create_new_ticket: true }

### UC-SUP-06: Customer Views and Responds to Ticket
**Actor:** Customer (ticket owner)
**Preconditions:** Authenticated, ticket belongs to customer
**Flow:**
1. Customer views ticket (returns all non-internal messages)
2. Customer posts reply message
3. System creates TicketMessage with sender_type=customer, is_internal=false
4. If ticket status is waiting_customer → auto-transition to in_progress
5. System publishes `TicketMessageAdded` event
6. Response: 201 { data: TicketMessage }

### UC-SUP-07: Customer Rates Ticket
**Actor:** Customer (ticket owner)
**Preconditions:** Ticket status is resolved or closed
**Flow:**
1. Customer submits rating (1-5) and optional comment
2. System validates ticket belongs to customer
3. System sets satisfaction_rating and satisfaction_comment
4. System publishes `TicketRated` event
5. Response: 200

**Exceptions:**
- Ticket not resolved → 422 { error: TICKET_NOT_RESOLVED }
- Already rated → 422 { error: ALREADY_RATED }

### UC-SUP-08: Search Knowledge Base
**Actor:** Visitor / Customer / Employee
**Preconditions:** None (public), authenticated (internal)
**Flow:**
1. Actor searches with optional filters: query, category, tags[]
2. System performs full-text search across title_ar, title_en, content_ar, content_en
3. For public users: only returns articles where is_published=true AND deleted_at IS NULL
4. For employees: returns all non-deleted articles
5. System increments view_count for each returned article
6. System supports pagination: page, limit (default 20)
7. Response: 200 { data: Article[], meta: { total, page, limit } }

### UC-SUP-09: Manage Knowledge Articles (Admin/Employee)
**Actor:** Admin, Manager (full CRUD), Employee (own articles)
**Preconditions:** Authenticated
**Flow (Create):**
1. Actor submits article (title_ar, title_en, content_ar, content_en, category, tags)
2. System validates inputs
3. System generates slug from title_en
4. System creates article with author_id = current user, is_published=false
5. System publishes `ArticleCreated` event
6. Response: 201

**Flow (Publish):**
1. Actor sets is_published=true
2. System validates all required fields are complete
3. System publishes `ArticlePublished` event
4. Response: 200

**Flow (Update):**
1. Actor modifies article
2. System updates, sets last_reviewed_by, last_reviewed_at
3. If published → publish `ArticleUpdated`
4. Response: 200

**Flow (Delete):**
1. Actor soft-deletes article (sets deleted_at)
2. System publishes `ArticleArchived`
3. Response: 200

### UC-SUP-10: Link Article to Ticket
**Actor:** Employee, Manager, Admin
**Preconditions:** Ticket exists, article exists and published
**Flow:**
1. Actor links article ID to ticket
2. System appends article_id to ticket.linked_article_ids (unique)
3. System adds automatic system message: "تم ربط مقالة: {article_title_ar}"
4. Response: 200

### UC-SUP-11: View Support Performance (Phase 2)
**Actor:** Manager, Admin
**Preconditions:** Authenticated
**Flow:**
1. Actor requests reports: tickets by status, SLA compliance %, avg response time, avg resolution time, CSAT average, employee workload
2. System computes metrics from tickets and ticket_messages
3. System returns aggregated data with optional date range filter
4. Response: 200 { data: ReportMetrics }

---

## 5. API Specification

### Endpoints

| Method | Path | Auth | Role | Description |
|:---|:---|:---|:---|:---|
| POST | /api/v1/tickets | Required | Customer, Employee | Create ticket |
| GET | /api/v1/tickets | Required | Customer, Employee, Admin | List tickets (filterable, own for customer) |
| GET | /api/v1/tickets/{id} | Required | Customer (own), Employee, Admin | Get ticket by ID with messages |
| PATCH | /api/v1/tickets/{id}/status | Required | Employee, Admin | Update ticket status |
| PATCH | /api/v1/tickets/{id}/assign | Required | Manager, Admin | Assign ticket to employee |
| PATCH | /api/v1/tickets/{id}/priority | Required | Employee, Admin | Update ticket priority |
| DELETE | /api/v1/tickets/{id} | Required | Admin | Soft-delete ticket |
| POST | /api/v1/tickets/{id}/messages | Required | Customer (own), Employee, Admin | Add message to ticket |
| GET | /api/v1/tickets/{id}/messages | Required | Customer (own), Employee, Admin | List messages for ticket |
| PATCH | /api/v1/tickets/{id}/messages/{messageId} | Required | Employee, Admin | Edit own message (within 15 min) |
| DELETE | /api/v1/tickets/{id}/messages/{messageId} | Required | Admin, Manager | Delete message |
| POST | /api/v1/tickets/{id}/rate | Required | Customer (own) | Submit satisfaction rating |
| POST | /api/v1/tickets/{id}/link-article | Required | Employee, Admin | Link knowledge article to ticket |
| GET | /api/v1/knowledge/articles | Public | — | Search/list published articles |
| GET | /api/v1/knowledge/articles/{id} | Public | — | Get article by ID |
| POST | /api/v1/knowledge/articles | Required | Employee, Admin | Create article |
| PATCH | /api/v1/knowledge/articles/{id} | Required | Employee (own), Admin | Update article |
| DELETE | /api/v1/knowledge/articles/{id} | Required | Admin | Soft-delete article |
| POST | /api/v1/knowledge/articles/{id}/publish | Required | Admin, Manager | Publish article |
| POST | /api/v1/knowledge/articles/{id}/unpublish | Required | Admin, Manager | Unpublish article |
| POST | /api/v1/knowledge/articles/{id}/feedback | Public | — | Mark article helpful/not helpful |
| GET | /api/v1/support/reports | Required | Manager, Admin | Support performance reports |

### Request/Response Schemas

**POST /api/v1/tickets — Request:**
```json
{
  "title": "string (5-500)",
  "description": "string (10-10000)",
  "category": "general | account | billing | service_order | commerce_order | technical | complaint | suggestion | other",
  "sub_category": "string | null",
  "priority": "low | medium | high | urgent (optional, auto-assigned if omitted)",
  "linked_order_id": "uuid | null",
  "source": "web | email | phone | chat | api (default: web)",
  "tags": ["string"]
}
```

**POST /api/v1/tickets — Response:**
```json
{
  "data": {
    "id": "uuid",
    "ticket_number": "TKT-2026-000143",
    "title": "string",
    "description": "string",
    "status": "open",
    "priority": "medium",
    "category": "technical",
    "customer_id": "uuid",
    "assigned_to": null,
    "sla_response_deadline": "ISO8601",
    "sla_resolution_deadline": "ISO8601",
    "created_at": "ISO8601"
  },
  "meta": {
    "timestamp": "ISO8601"
  }
}
```

**GET /api/v1/tickets — Query Parameters:**
```
?status=open|in_progress|waiting_customer|resolved|closed|reopened
&priority=low|medium|high|urgent
&category=string
&assigned_to=uuid
&customer_id=uuid
&search=string (search title and description)
&tags[]=string
&is_overdue=boolean
&sort=created_asc|created_desc|updated_asc|updated_desc|priority_asc|priority_desc
&page=1
&limit=20
```

**GET /api/v1/tickets/{id} — Response (Customer View):**
```json
{
  "data": {
    "id": "uuid",
    "ticket_number": "TKT-2026-000143",
    "title": "string",
    "description": "string",
    "status": "in_progress",
    "priority": "medium",
    "category": "technical",
    "customer_id": "uuid",
    "assigned_to": {
      "id": "uuid",
      "first_name_ar": "string",
      "last_name_ar": "string"
    },
    "sla_response_deadline": "ISO8601",
    "sla_resolution_deadline": "ISO8601",
    "first_response_at": "ISO8601",
    "satisfaction_rating": null,
    "messages": [
      {
        "id": "uuid",
        "sender_type": "customer",
        "message": "string",
        "is_internal": false,
        "attachments": [],
        "created_at": "ISO8601"
      },
      {
        "id": "uuid",
        "sender_type": "employee",
        "message": "string",
        "is_internal": false,
        "attachments": [{"file_name": "screenshot.png", "file_url": "url", "file_size": 123456, "mime_type": "image/png"}],
        "created_at": "ISO8601"
      }
    ],
    "linked_article_ids": ["uuid"],
    "created_at": "ISO8601",
    "updated_at": "ISO8601"
  }
}
```

**Note:** Customer view excludes `is_internal=true` messages and `internal_notes` field. Employee/Admin view includes all.

**POST /api/v1/tickets/{id}/messages — Request:**
```json
{
  "message": "string (1-20000)",
  "is_internal": false,
  "attachments": [
    {
      "file_name": "string",
      "file_url": "string",
      "file_size": 123456,
      "mime_type": "image/png"
    }
  ]
}
```

**GET /api/v1/knowledge/articles — Query Parameters:**
```
?search=string (full-text across title and content)
&category=string
&sub_category=string
&tags[]=string
&sort=newest|oldest|most_viewed|most_helpful
&page=1
&limit=20
&locale=ar|en
```

**POST /api/v1/knowledge/articles — Request:**
```json
{
  "title_ar": "string (1-500)",
  "title_en": "string (1-500)",
  "content_ar": "string (1-50000)",
  "content_en": "string (1-50000)",
  "excerpt_ar": "string | null",
  "excerpt_en": "string | null",
  "category": "string",
  "sub_category": "string | null",
  "tags": ["string"],
  "is_featured": false,
  "seo_meta": {
    "title_ar": "string",
    "title_en": "string",
    "description_ar": "string",
    "description_en": "string"
  }
}
```

**Error Response Envelope:**
```json
{
  "error": {
    "code": "SUPPORT_INVALID_STATUS_TRANSITION",
    "message": "لا يمكن تغيير حالة التذكرة من 'مغلقة' إلى 'قيد المعالجة'",
    "message_en": "Cannot transition ticket status from 'closed' to 'in_progress'",
    "statusCode": 422,
    "details": {
      "current_status": "closed",
      "attempted_status": "in_progress",
      "allowed_transitions": ["reopened"]
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

### Ticket Rules
1. **RB-SUP-001:** Ticket number format: TKT-{YYYY}-{6-digit zero-padded sequence}, resetting annually
2. **RB-SUP-002:** Priority auto-assignment based on category when not explicitly specified:
   - complaint, billing → urgent (response 1h, resolution 4h)
   - technical → high (response 4h, resolution 24h)
   - account, service_order, commerce_order → medium (response 8h, resolution 72h)
   - general, suggestion, other → low (response 24h, resolution 168h)
3. **RB-SUP-003:** Customer limited to maximum 10 open tickets (status: open, in_progress, waiting_customer)
4. **RB-SUP-004:** Ticket status state machine:
   ```
   open → in_progress
   open → resolved (quick resolution)
   in_progress → waiting_customer
   in_progress → resolved
   waiting_customer → in_progress (auto on customer reply)
   waiting_customer → resolved
   resolved → closed (auto after 72h inactivity)
   resolved → reopened (within 7 days)
   closed → reopened (within 7 days only)
   Any → closed (admin force-close only, with reason required)
   ```
5. **RB-SUP-005:** Closed tickets can be reopened within 7 calendar days of closed_at; after that, create new ticket referencing old ticket
6. **RB-SUP-006:** Tickets auto-close from `resolved` to `closed` after 72 hours of inactivity (no customer response, no status change)
7. **RB-SUP-007:** `waiting_customer` status auto-transitions to `in_progress` when customer posts a message
8. **RB-SUP-008:** Satisfaction rating can only be submitted by the ticket's customer and only after status reaches `resolved`

### Message Rules
9. **RB-SUP-009:** `is_internal=true` messages are only visible to Employee, Manager, Admin roles — never to customers
10. **RB-SUP-010:** Messages can be edited by the author within 15 minutes of creation (timestamp tracked)
11. **RB-SUP-011:** System-generated messages (status changes, assignments) have sender_type=system
12. **RB-SUP-012:** Maximum 5 attachments per message, each max 10MB

### SLA Rules
13. **RB-SUP-013:** SLA response time = time from ticket_created to first staff (non-system, non-internal) message
14. **RB-SUP-014:** SLA resolution time = time from ticket_created to status=resolved
15. **RB-SUP-015:** SLA warning published 1 hour before deadline; SLA breach event on deadline exceeded
16. **RB-SUP-016:** Business hours for SLA calculation: Sunday–Thursday 8:00–18:00 (GMT+3). Phase 2: non-business hours paused

### Knowledge Base Rules
17. **RB-SUP-017:** Only published articles (is_published=true, deleted_at IS NULL) appear in public search
18. **RB-SUP-018:** Article slug is unique and auto-generated from title_en
19. **RB-SUP-019:** Article helpful/not_helpful feedback is anonymous and rate-limited: 1 vote per IP per article per 24h
20. **RB-SUP-020:** Articles linked to tickets cannot be hard-deleted; soft delete preserves reference for linked tickets
21. **RB-SUP-021:** Articles not reviewed in 180 days flagged for review

---

## 7. Security

### Access Control
- All endpoints require JWT authentication (except public knowledge base search)
- Customer-scoped resource access: customers can only view/modify their own tickets
- Internal notes (is_internal=true) are stripped from response when sender_type is customer or response is for customer
- Employee messages can only be modified by the original author (with time limit) or Admin/Manager
- Force-close tickets requires Admin role with mandatory reason

### Input Validation
- title: 5-500 chars, stripped of HTML
- description: 10-10000 chars, stripped of <script> tags, allowed markdown subset
- message: 1-20000 chars, stripped of <script> tags
- category: must be valid enum value
- attachments: URL must point to allowed S3 bucket, validated MIME type whitelist (image/*, application/pdf, text/*, application/msword, application/vnd.openxmlformats-officedocument.*)
- All content_fields sanitized for XSS: <script>, <iframe>, onclick, onload stripped

### Rate Limiting
- Ticket creation: 5 requests/minute per customer
- Message posting: 20 requests/minute per user
- Knowledge article search: 60 requests/minute (public)
- Knowledge article CRUD: 30 requests/minute per user

### Data Protection
- Ticket descriptions and messages may contain customer PII — encrypted at rest via application-level encryption
- Attachment files stored in S3 with presigned URLs (expiry: 1 hour for GET)
- Closed tickets archived after 365 days (moved to cold storage, still accessible via API with longer response time)
- Ticket soft-delete: Admin only; data retained for audit for 2 years post-deletion

### SLA Integrity
- SLA deadlines are computed server-side on ticket creation; client-submitted values are ignored
- SLA calculations use server clock (not client timestamps)
- SLA breach escalations are generated by a scheduled job (cron every 15 min), not client-triggered

---

## 8. Testing

### Test Scenarios

**Happy Path:**
1. Customer creates ticket → system assigns priority based on category → SLA deadlines set → confirmation notification sent
2. Manager assigns ticket to employee → employee receives notification
3. Employee responds to ticket → first_response_at recorded, SLA response met
4. Employee changes status to in_progress → waiting_customer → customer replies → auto-transitions to in_progress
5. Employee resolves ticket → satisfaction survey link sent to customer → customer rates 4/5
6. Ticket auto-closes after 72h of resolved status
7. Customer searches knowledge base → finds relevant article → marks helpful
8. Admin creates knowledge article → publishes → appears in public search

**Edge Cases:**
9. Customer at max open tickets (10) → attempt to create 11th → 422
10. Ticket closed 3 days ago → customer reopens → succeeds, reopened_count incremented
11. Ticket closed 8 days ago → customer attempts reopen → 422, prompted to create new ticket
12. Employee posts internal note → customer views ticket → internal note not visible
13. Customer posts reply on waiting_customer ticket → auto-transitions to in_progress
14. Ticket with urgent priority approaching SLA deadline → SLA warning event published at T-1h
15. Ticket SLA deadline exceeded → breach escalation event → manager notified
16. Article author edits own article → allowed; different employee edits → 403
17. Multiple concurrent messages on same ticket → all persisted, order by created_at
18. Ticket assigned → employee reassigned → old and new employees both notified

**Error Cases:**
19. Create ticket without title → 422 validation error
20. Customer attempts to view another customer's ticket → 403 (or 404 for security)
21. Customer attempts to set is_internal=true → 422 (or field silently ignored)
22. Invalid status transition (closed → in_progress) → 422
23. Customer rates unresolved ticket → 422
24. Customer rates already-rated ticket → 422
25. Publish article with empty title_ar → 422
26. Employee deletes another employee's ticket → 403 (only Admin can delete tickets)
27. Edit message after 15-minute window → 422 { error: EDIT_WINDOW_EXPIRED }

**Security Cases:**
28. Customer injects <script> in ticket description → sanitized, stored as text
29. Customer tries to access internal_note via GraphQL field → field null/omitted for customer role
30. Customer modifies ticket ID in URL to access another's ticket → 403
31. Unauthenticated user creates ticket → 401
32. Attacker uploads .exe as attachment → MIME type validation rejects
33. Brute force ticket creation → rate limited after 5/min → 429
34. Employee attempts force-close without reason → 422 validation error

**SLA Scenarios:**
35. Ticket created Friday 16:00 → SLA starts Sunday 08:00 (business hours mode, Phase 2)
36. SLA response breach but resolution met → partial SLA compliance recorded
37. Auto-close cron job runs → only resolved tickets with 72h+ inactivity closed
