# Analytics Domain Specification
## نطاق التحليلات والتقارير — AlharisTech Platform

**Domain ID:** `analytics`
**Version:** 0.1.0-DRAFT
**Status:** Draft
**Phase:** Phase 2
**Owner:** Tech Lead

---

## 1. Bounded Context

### Boundaries
The Analytics domain is responsible for:
- Aggregating and presenting business metrics across all domains
- Generating operational reports (sales, customers, employees, financial)
- Exporting reports in multiple formats (PDF, Excel, CSV)
- Defining and tracking Key Performance Indicators (KPIs)
- Providing customizable dashboards with widgets
- Scheduling automated report generation

### What Analytics does NOT manage
- Raw transactional data (→ reads from respective domains' read replicas)
- Real-time operational workflows (→ Service, Support, Commerce domains)
- Notifications about reports (→ delegates to Notification domain)
- Data warehouse / ETL infrastructure (→ Infrastructure layer, Phase 5)

### Relationships
```
Analytics ──► reads from ──► ALL other domains (read replicas only)
Analytics ──► publishes ReportGenerated ──► Notification (report ready)
Analytics ──► publishes KpiThresholdBreached ──► Notification (alert)
Identity ──► authenticates ──► Analytics
```

---

## 2. Aggregates

### 2.1 Dashboard Aggregate
**Root Entity:** Dashboard

| Property | Type | Constraints |
|:---|:---|:---|
| id | UUID v7 | PK |
| name | VARCHAR(255) | Required |
| description | TEXT | Optional |
| widgets | JSONB | Array of widget configs, NOT NULL |
| is_system | BOOLEAN | Default: false |
| created_by | UUID | FK → users.id, nullable for system dashboards |
| created_at | TIMESTAMPTZ | Auto |
| updated_at | TIMESTAMPTZ | Auto |

**Widget JSONB schema (per widget):**
```json
{
  "id": "uuid",
  "type": "metric_card | chart_bar | chart_line | chart_pie | table | number",
  "title": "string",
  "query": "string (SQL or query reference)",
  "query_params": {},
  "position": { "x": 0, "y": 0, "w": 4, "h": 3 },
  "refresh_interval": 60,
  "visualization_config": { "colors": [], "show_labels": true },
  "data_source": "replica"
}
```

**System Dashboards (seeded, is_system=true):**

| Dashboard Name | Widgets |
|:---|:---|
| Overview | Orders Today (metric_card), Revenue MTD (metric_card), Active Tickets (metric_card), New Customers (metric_card), Orders Trend (chart_line), Revenue by Service (chart_pie) |

### 2.2 Report Aggregate
**Root Entity:** Report

| Property | Type | Constraints |
|:---|:---|:---|
| id | UUID v7 | PK |
| name | VARCHAR(255) | Required |
| type | ENUM(sales, customers, orders, employees, financial) | Required |
| parameters | JSONB | Date range, filters, grouping, NOT NULL |
| status | ENUM(pending, processing, completed, failed) | Default: pending |
| format | ENUM(pdf, excel, csv) | Required |
| generated_by | UUID | FK → users.id, required |
| generated_at | TIMESTAMPTZ | Nullable, set on completion |
| s3_url | VARCHAR(2048) | Nullable, set on completion |
| s3_expires_at | TIMESTAMPTZ | Nullable, 30 days from generation |
| job_id | VARCHAR(255) | BullMQ job reference, nullable |
| error_message | TEXT | Nullable, set on failure |
| file_size_bytes | BIGINT | Nullable |
| created_at | TIMESTAMPTZ | Auto |
| updated_at | TIMESTAMPTZ | Auto |

**Report Type — Parameter Schemas:**

| Type | Required Parameters | Optional Parameters |
|:---|:---|:---|
| sales | date_range (start, end) | service_id, payment_status, group_by (day/week/month) |
| customers | date_range (start, end) | customer_type, status, source, group_by |
| orders | date_range (start, end) | status, assigned_to, service_id, priority |
| employees | date_range (start, end) | employee_id, department, metric (orders_processed, tickets_resolved, avg_rating) |
| financial | date_range (start, end) | payment_method, currency, invoice_status |

### 2.3 KPI Aggregate
**Root Entity:** Kpi

| Property | Type | Constraints |
|:---|:---|:---|
| id | UUID v7 | PK |
| name | VARCHAR(255) | Required, unique per domain |
| metric | VARCHAR(100) | Required, e.g., "total_revenue", "order_count", "avg_resolution_time" |
| description | TEXT | Optional |
| domain | VARCHAR(50) | Required, e.g., "sales", "support", "customers" |
| target_value | DECIMAL(15,2) | Required |
| current_value | DECIMAL(15,2) | Computed, re-evaluated hourly |
| unit | VARCHAR(20) | Required, e.g., "SAR", "count", "minutes", "percent" |
| period | ENUM(daily, weekly, monthly, quarterly, yearly) | Required |
| threshold_type | ENUM(above, below) | Required, alert if current_value crosses target in specified direction |
| is_active | BOOLEAN | Default: true |
| last_calculated_at | TIMESTAMPTZ | Nullable |
| created_by | UUID | FK → users.id |
| created_at | TIMESTAMPTZ | Auto |
| updated_at | TIMESTAMPTZ | Auto |

**Seeded KPIs:**

| Name | Metric | Domain | Period | Default Target |
|:---|:---|:---|:---|:---|
| Monthly Revenue | total_revenue | sales | monthly | 500000 |
| Order Completion Rate | order_completion_rate | orders | monthly | 90 |
| Average Resolution Time | avg_resolution_time_minutes | support | weekly | 240 |
| New Customers | new_customer_count | customers | monthly | 100 |
| Customer Satisfaction | avg_csat_score | support | monthly | 4.0 |
| Ticket SLA Compliance | sla_compliance_percent | support | weekly | 95 |

### RBAC Matrix

| Resource | Admin | Manager | Employee | Customer | Partner |
|:---|:---|:---|:---|:---|:---|
| analytics:dashboard:view | All | All | Overview only | — | Own reports |
| analytics:dashboard:create | Yes | Yes | — | — | — |
| analytics:dashboard:update | Yes | Own dashboards | — | — | — |
| analytics:dashboard:delete | Yes | Own dashboards | — | — | — |
| analytics:report:generate | Yes | Sales, Orders, Employees | — | — | Own data |
| analytics:report:view | Yes | All | Own department | — | Own reports |
| analytics:report:export | Yes | All | Own reports | — | Own reports |
| analytics:kpi:configure | Yes | Yes | — | — | — |
| analytics:kpi:view | Yes | Yes | Assigned domain | — | — |

---

## 3. Domain Events

| Event | Trigger | Payload | Consumers |
|:---|:---|:---|:---|
| `ReportGenerated` | Report generation job completes | `{ reportId, type, generatedBy, s3Url, format, timestamp }` | Notification (report ready email), Audit |
| `ReportGenerationFailed` | Report job fails | `{ reportId, type, generatedBy, error, timestamp }` | Notification (failure alert to admin) |
| `KpiThresholdBreached` | KPI calculation crosses threshold | `{ kpiId, name, domain, targetValue, currentValue, direction, timestamp }` | Notification (alert to managers/admins), Slack/email |
| `DashboardShared` | User shares custom dashboard | `{ dashboardId, sharedBy, sharedWith, permissions, timestamp }` | Notification (share notification) |
| `ExportCompleted` | Report export finishes | `{ reportId, format, s3Url, fileSize, timestamp }` | — |
| `ExportExpired` | Report S3 object expires (30d) | `{ reportId, s3Url, timestamp }` | — |
| `KpiRecalculated` | Hourly KPI refresh completes | `{ kpiId, oldValue, newValue, timestamp }` | — |

---

## 4. Use Cases

### UC-ANALYTICS-01: View Overview Dashboard
**Actor:** Admin, Manager, Employee
**Preconditions:** Authenticated user with `analytics:dashboard:view` permission
**Flow:**
1. User navigates to analytics overview page
2. System fetches the system dashboard named "Overview" (is_system=true)
3. System resolves each widget's query against the read replica
4. System applies user's role-based data scope (employee sees own metrics only)
5. System returns widget data keyed by widget ID
6. Response: 200 { dashboard, widgets: { [widgetId]: { data, refreshed_at } } }

**Exceptions:**
- No overview dashboard found → 404
- Read replica unavailable → fallback to primary DB with degraded performance warning
- Widget query timeout (>10s) → return cached data with `stale: true` flag

### UC-ANALYTICS-02: Filter Dashboard by Date Range
**Actor:** Admin, Manager
**Preconditions:** Dashboard loaded
**Flow:**
1. User selects date range (preset: today, this_week, this_month, this_quarter, this_year, or custom start/end)
2. System re-executes all widget queries with the date filter applied
3. System returns refreshed widget data
4. Response: 200 { widgets: { [widgetId]: { data, refreshed_at } } }

### UC-ANALYTICS-03: Generate Report
**Actor:** Admin, Manager
**Preconditions:** Authenticated, `analytics:report:generate` permission
**Flow:**
1. User selects report type (sales, customers, orders, employees, financial)
2. User configures parameters (date range, filters, grouping, format)
3. User submits generate request
4. System validates parameters
5. System creates Report record with status=pending
6. System enqueues report generation job to BullMQ
7. System returns 202 with report ID and job ID
8. (Async) BullMQ worker:
   a. Updates status to processing
   b. Queries read replica with parameterized query
   c. Formats output (PDF via Puppeteer/PDFKit, Excel via exceljs, CSV via streaming)
   d. Uploads file to S3 with 30-day lifecycle tag
   e. Updates status to completed, sets s3_url and generated_at
   f. Publishes `ReportGenerated` event
9. User receives notification when report is ready

**Exceptions:**
- Invalid parameters → 422
- Report generation fails → status=failed, error_message set, publish `ReportGenerationFailed`
- Read replica unavailable → 503, retry with exponential backoff

### UC-ANALYTICS-04: Download Generated Report
**Actor:** Admin, Manager
**Preconditions:** Report exists, status=completed, not expired
**Flow:**
1. User requests report download by report ID
2. System validates report exists and user has access
3. System checks S3 object still exists (not expired)
4. System generates presigned S3 URL (valid 15 minutes)
5. Response: 302 redirect to presigned URL, or 200 { downloadUrl } for API clients

**Exceptions:**
- Report not found → 404
- Report not completed → 400, include current status
- Report expired → 410 Gone (regenerate required)
- Unauthorized → 403

### UC-ANALYTICS-05: List Reports
**Actor:** Admin, Manager
**Preconditions:** Authenticated
**Flow:**
1. User requests list of reports (paginated, filterable by type, status, date)
2. System queries reports with filters, ordered by created_at DESC
3. Response: 200 { data: Report[], meta: { total, page, limit } }

### UC-ANALYTICS-06: Custom Dashboard CRUD (Phase 2)
**Actor:** Admin, Manager
**Preconditions:** Authenticated, `analytics:dashboard:create` permission
**Flow:**
1. Create: User defines dashboard name, description, and widgets array. System validates widget queries (must be read-only). System saves dashboard. Response: 201.
2. Update: User modifies dashboard (add/remove/reorder widgets). System validates ownership. System saves changes. Response: 200.
3. Delete: User deletes custom dashboard. System validates not system dashboard. Response: 204.
4. Share: User shares dashboard with another user/role. System publishes `DashboardShared` event. Response: 200.

**Exceptions:**
- Widget query validation fails (contains write operations) → 422
- Dashboard not found → 404
- Attempt to delete system dashboard → 403
- Duplicate dashboard name per user → 409

### UC-ANALYTICS-07: KPI Definition and Tracking
**Actor:** Admin, Manager
**Preconditions:** Authenticated, `analytics:kpi:configure` permission
**Flow:**
1. Create KPI: User defines name, metric, domain, target_value, unit, period, threshold_type. System validates metric is known. System creates KPI. Response: 201.
2. View KPI list: User requests KPI list filtered by domain. Response: 200 { data: Kpi[], current_values }.
3. View KPI detail: User requests KPI by ID. Response: 200 { kpi: { ...Kpi, history: [{ value, timestamp }] } } (last 12 data points).
4. (System — hourly cron): KPI recalculation job runs. For each active KPI, system computes current_value from read replica. If threshold breached, publishes `KpiThresholdBreached`. Updates kpi record.

**Exceptions:**
- Unknown metric → 422 with list of valid metrics
- Duplicate KPI name in same domain → 409

### UC-ANALYTICS-08: Scheduled Report Generation
**Actor:** Admin, Manager
**Preconditions:** Authenticated
**Flow:**
1. User configures report schedule (type, parameters, format, frequency: daily/weekly/monthly, recipients)
2. System stores schedule as a BullMQ repeatable job
3. At scheduled time, system auto-generates report (same flow as UC-ANALYTICS-03)
4. System distributes report to configured recipients via Notification domain
5. Response: 201 { schedule_id }

**Exceptions:**
- Invalid cron expression → 422
- Recipient email not valid → 422

---

## 5. API Specification

### Endpoints

| Method | Path | Auth | Role | Description |
|:---|:---|:---|:---|:---|
| GET | /api/v1/analytics/dashboards/overview | Required | Admin, Manager, Employee | Get overview dashboard with widget data |
| GET | /api/v1/analytics/dashboards | Required | Admin, Manager | List custom dashboards (paginated) |
| POST | /api/v1/analytics/dashboards | Required | Admin, Manager | Create custom dashboard |
| GET | /api/v1/analytics/dashboards/{id} | Required | Admin, Manager | Get dashboard by ID with widget data |
| PATCH | /api/v1/analytics/dashboards/{id} | Required | Admin, Manager | Update dashboard (ownership check) |
| DELETE | /api/v1/analytics/dashboards/{id} | Required | Admin, Manager | Delete dashboard (not system) |
| POST | /api/v1/analytics/dashboards/{id}/share | Required | Admin, Manager | Share dashboard with user/role |
| POST | /api/v1/analytics/reports | Required | Admin, Manager | Generate report (async) |
| GET | /api/v1/analytics/reports | Required | Admin, Manager | List reports (paginated, filterable) |
| GET | /api/v1/analytics/reports/{id} | Required | Admin, Manager | Get report details |
| GET | /api/v1/analytics/reports/{id}/download | Required | Admin, Manager | Download report file |
| POST | /api/v1/analytics/reports/schedule | Required | Admin, Manager | Schedule recurring report |
| DELETE | /api/v1/analytics/reports/schedule/{id} | Required | Admin, Manager | Cancel scheduled report |
| GET | /api/v1/analytics/kpis | Required | Admin, Manager | List KPIs (filter by domain) |
| GET | /api/v1/analytics/kpis/{id} | Required | Admin, Manager | Get KPI detail with history |
| POST | /api/v1/analytics/kpis | Required | Admin, Manager | Define new KPI |
| PATCH | /api/v1/analytics/kpis/{id} | Required | Admin, Manager | Update KPI target/threshold |
| DELETE | /api/v1/analytics/kpis/{id} | Required | Admin | Delete KPI |
| GET | /api/v1/analytics/metrics | Required | Admin, Manager | List available metric definitions |

### Request/Response Schemas

**POST /api/v1/analytics/reports — Request:**
```json
{
  "name": "Q2 2026 Sales Report",
  "type": "sales",
  "parameters": {
    "date_range": { "start": "2026-04-01", "end": "2026-06-30" },
    "group_by": "month",
    "payment_status": "paid"
  },
  "format": "pdf"
}
```

**POST /api/v1/analytics/reports — Response (202 Accepted):**
```json
{
  "data": {
    "id": "uuid",
    "name": "Q2 2026 Sales Report",
    "type": "sales",
    "status": "pending",
    "job_id": "bullmq-job-uuid",
    "estimated_completion_seconds": 30
  },
  "meta": {
    "timestamp": "2026-06-20T10:00:00.000Z"
  }
}
```

**GET /api/v1/analytics/dashboards/overview — Response:**
```json
{
  "data": {
    "dashboard": {
      "id": "uuid",
      "name": "Overview",
      "is_system": true
    },
    "widgets": {
      "orders_today": { "value": 42, "change_percent": 12.5, "trend": "up", "refreshed_at": "..." },
      "revenue_mtd": { "value": 156000, "currency": "SAR", "change_percent": -3.2, "trend": "down", "refreshed_at": "..." },
      "active_tickets": { "value": 18, "by_priority": { "urgent": 2, "high": 5, "normal": 11 }, "refreshed_at": "..." },
      "new_customers": { "value": 28, "change_percent": 8.0, "trend": "up", "refreshed_at": "..." },
      "orders_trend": { "labels": ["Week 1", "Week 2", "Week 3", "Week 4"], "datasets": [{ "label": "Orders", "data": [95, 110, 102, 130] }], "refreshed_at": "..." },
      "revenue_by_service": { "labels": ["Service A", "Service B", "Service C"], "datasets": [{ "data": [45000, 72000, 39000] }], "refreshed_at": "..." }
    }
  },
  "meta": {
    "date_range": { "from": "2026-06-01", "to": "2026-06-20" },
    "timestamp": "2026-06-20T10:00:00.000Z"
  }
}
```

**GET /api/v1/analytics/kpis — Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Monthly Revenue",
      "metric": "total_revenue",
      "domain": "sales",
      "target_value": 500000,
      "current_value": 456000,
      "unit": "SAR",
      "period": "monthly",
      "threshold_type": "below",
      "progress_percent": 91.2,
      "last_calculated_at": "2026-06-20T09:00:00.000Z"
    }
  ],
  "meta": {
    "total": 6,
    "page": 1,
    "limit": 10
  }
}
```

**Error Response Envelope:**
```json
{
  "error": {
    "code": "REPORT_GENERATION_FAILED",
    "message": "فشل إنشاء التقرير. يرجى المحاولة مرة أخرى",
    "message_en": "Report generation failed. Please try again",
    "statusCode": 500,
    "details": { "report_id": "uuid", "job_id": "bullmq-uuid" }
  },
  "meta": {
    "timestamp": "ISO8601",
    "requestId": "uuid"
  }
}
```

---

## 6. Business Rules

1. **RB-ANALYTICS-01:** All report and dashboard queries MUST read from PostgreSQL read replicas, not the primary write database. If replica is unavailable, fallback to primary with `X-Data-Source: primary` header and log a warning.
2. **RB-ANALYTICS-02:** Large reports (estimated >10,000 rows or >60s query time) MUST be generated asynchronously via BullMQ. Synchronous generation is only permitted for reports estimated to complete within 10 seconds.
3. **RB-ANALYTICS-03:** Generated report files stored in S3 automatically expire after 30 days via S3 lifecycle policy (`Expiration: 30 days` tag). Download requests for expired reports return 410 Gone.
4. **RB-ANALYTICS-04:** Dashboard widget data MUST NOT be refreshed more frequently than once per 60 seconds. Client polling or WebSocket push respects this minimum interval.
5. **RB-ANALYTICS-05:** KPI current_value is recalculated hourly via a scheduled BullMQ repeatable job. The recalculation reads from the read replica and updates the KPI record. No real-time KPI updates.
6. **RB-ANALYTICS-06:** Widget queries MUST be read-only. System parses and validates widget query strings before saving dashboards. Any query containing INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, or CREATE keywords is rejected.
7. **RB-ANALYTICS-07:** Reports generated by employees are scoped to their department/assigned data. Managers see all data within their domain. Admins see everything.
8. **RB-ANALYTICS-08:** Custom dashboards are owned by the creating user. Only the owner or an admin can modify or delete them. System dashboards (is_system=true) cannot be deleted.
9. **RB-ANALYTICS-09:** Scheduled reports execute at the configured frequency. If a scheduled report fails 3 consecutive times, the schedule is paused and an admin is notified.
10. **RB-ANALYTICS-10:** Report generation jobs have a maximum timeout of 10 minutes. Jobs exceeding this timeout are marked as failed.
11. **RB-ANALYTICS-011:** All report generation and export actions are audit-logged (who generated what, when, what parameters).
12. **RB-ANALYTICS-012:** KPI threshold breach notifications are rate-limited: max 1 notification per KPI per hour, even if breach persists.

---

## 7. Security

### Data Access
- **Read Replicas Only:** Analytics module connects to a separate database connection pool targeting the read replica endpoint. Write operations are rejected at the connection level.
- **Row-Level Data Scoping:** Query results are filtered by the user's role: Employees see only assigned/own data, managers see domain-wide, admins see all.
- **S3 Presigned URLs:** Report downloads use time-limited presigned URLs (15-minute expiry) instead of proxying large files through the API server.

### Input Validation
- **Widget Query Sanitization:** All user-submitted SQL/query strings are parsed and validated to be read-only before storage. Uses a SQL parser (node-sql-parser) to check for DML/DDL statements.
- **Report Parameters:** All date ranges and filter values are validated via Zod schemas. SQL injection prevention: parameters are parameterized, never concatenated.
- **Export Format Validation:** Only `pdf`, `excel`, `csv` are accepted. Unknown formats rejected.

### Rate Limiting
- Report generation: 10 reports/user/hour (prevents resource exhaustion)
- Dashboard refresh: 1 request/widget/60 seconds
- Report download: 30 downloads/user/hour
- KPI configuration: 20 requests/user/hour

### Authorization
- JWT-based authentication on all endpoints
- Granular RBAC via `analytics:{resource}:{action}` permissions
- Dashboard ownership checks on update/delete/share operations
- System dashboards are immutable by non-admins

---

## 8. Testing

### Test Scenarios

**Happy Path:**
1. Admin views overview dashboard → all 6 widgets return data from replica → 200 with correct metrics
2. Manager generates sales PDF report for Q2 → 202 accepted → job completes → notification sent → manager downloads report → 200 with file
3. Admin creates custom dashboard with 3 widgets → validates widget queries → saves → 201 → dashboard appears in list
4. Admin defines KPI "Monthly Revenue" → system calculates current_value hourly → threshold breached → notification sent
5. Manager schedules weekly financial report → cron fires → report auto-generated → distributed to recipients

**Edge Cases:**
6. Read replica is down → fallback to primary → response includes `X-Data-Source: primary` header → warning logged
7. Report generation job times out at 10 minutes → status=failed → error logged → user notified → can retry
8. Widget query contains INSERT statement → validation rejects → 422 with details → query not saved
9. Report download 31 days after generation → S3 object expired → 410 Gone → user must regenerate
10. Employee views overview → sees only their own orders/tickets metrics → scoped data
11. Dashboard share to another manager → recipient gets access → they can view but not edit (unless owner)
12. KPI threshold breached 5 times in one hour → only 1 notification sent (rate limited)

**Error Cases:**
13. Generate report with invalid date range (end before start) → 422
14. Download non-existent report → 404
15. Delete system dashboard → 403
16. Non-manager attempts to generate report → 403
17. Generate report with unsupported format (e.g., "docx") → 422
18. Create duplicate KPI name in same domain → 409
19. Update dashboard not owned by user → 403
20. Widget refresh interval set to 10 seconds → 422 (minimum is 60)

**Performance Cases:**
21. Dashboard with 10+ widgets → all queries execute in parallel → response < 2 seconds
22. Large report (50,000+ rows) → accepted for async processing → does not block request thread
23. 100 concurrent dashboard view requests → replica handles load → primary unaffected

