# Implementation Master Plan — AlharisTech Platform

> **Supersedes:** `tasks/master-plan.md`
> **Status:** Active
> **Last Updated:** 2026-06-20
> **Owner:** Engineering Team

---

## Table of Contents

1. [Multi-Year Roadmap (2026–2029)](#1-multi-year-roadmap-20262029)
2. [Program Increments (PIs)](#2-program-increments-pis)
3. [Release Plan](#3-release-plan)
4. [Epic Breakdown — Phase 1](#4-epic-breakdown--phase-1)
5. [Feature Breakdown](#5-feature-breakdown)
6. [User Stories — EPIC-1 (Auth)](#6-user-stories--epic-1-auth)
7. [Sprint Plan — Phase 1](#7-sprint-plan--phase-1)
8. [Dependency Graph](#8-dependency-graph)
9. [Build Order](#9-build-order)
10. [Validation Gates](#10-validation-gates)

---

## 1. Multi-Year Roadmap (2026–2029)

### Overview

The AlharisTech Platform is built over **5 phases** spanning approximately **2.5–3 years**, with a preceding Sprint 0 foundation phase. Each phase delivers a self-contained, deployable increment of business value.

### Timeline

```
2026 ──────────────────────────────────────────────────────────────────────── 2029
 │                                                                              │
 │ ████████████████████████████████████████████████████████████████████████████ │
 │                                                                              │
 │  Phase 0 (2–4w)  │                                                          │
 │  Jun–Jul 2026    │                                                          │
 │                  │                                                          │
 │  Phase 1 (12w)               │                                               │
 │  Jul–Oct 2026                │                                               │
 │                              │                                               │
 │  Phase 2 (20w)                              │                                │
 │  Nov 2026 – Apr 2027                        │                                │
 │                                             │                                │
 │  Phase 3 (20w)                                             │                 │
 │  May–Oct 2027                                              │                 │
 │                                                            │                 │
 │  Phase 4 (28w)                                                            │  │
 │  Nov 2027 – Jun 2028                                                      │  │
 │                                                                            │  │
 │  Phase 5 (40w)                                                               │
 │  Jul 2028 – Jul 2029                                                         │
```

### Phase Summary

| # | Phase | Duration | Start | End | Strategic Goal |
|:---|:---|:---|:---|:---|:---|
| **0** | Foundation | 2–4 weeks | Jun 2026 | Jul 2026 | Docs, architecture, governance, dev environment |
| **1** | Digital Presence | 12 weeks | Jul 2026 | Oct 2026 | Public website, auth, CMS, service catalog & orders |
| **2** | Internal Management | 20 weeks | Nov 2026 | Apr 2027 | Admin dashboard, CRM, invoicing, ticketing, KB |
| **3** | E-Commerce | 20 weeks | May 2027 | Oct 2027 | Product catalog, cart, checkout, payments |
| **4** | Desktop & Mobile Apps | 28 weeks | Nov 2027 | Jun 2028 | React Native (Android/iOS), Electron/Tauri desktop |
| **5** | Advanced Platform & AI | 40 weeks | Jul 2028 | Jul 2029 | SaaS multi-tenancy, marketplace, AI/RAG, automation |

### Major Milestones

| Milestone | Date | Phase | Criteria |
|:---|:---|:---|:---|
| **M0** — Docs Complete | Jul 2026 | 0 | All Sprint 0 docs reviewed & approved |
| **M1** — Dev Environment Ready | Jul 2026 | 0→1 | Monorepo builds, CI/CD green, Docker stack running |
| **M2** — Public Site Live (v0.1.0) | Oct 2026 | 1 | Website, auth, CMS, service orders deployed to production |
| **M3** — Internal Ops Live (v0.2.0) | Apr 2027 | 2 | Dashboard, CRM, invoicing, ticketing deployed |
| **M4** — Store Live (v0.3.0) | Oct 2027 | 3 | E-commerce platform deployed |
| **M5** — Apps Released (v1.0.0) | Jun 2028 | 4 | Android + iOS apps published, desktop app released |
| **M6** — AI Platform Live (v2.0.0) | Jul 2029 | 5 | Multi-tenant SaaS, marketplace, AI features deployed |

### Phase Dependencies

```
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5
  │            │           │           │           │           │
  │            │           │           │           │           │
  └── Docs     └── Auth    └── CRM     └── Store   └── Mobile  └── AI/ML
      Arch         CMS        Tickets     Payments      Desktop     SaaS
      Gov          Orders      Invoices    Inventory     Offline     Market
      Env                      Reports     Shipping      Push        Auto
```

- Phase 1 **blocks** Phase 2 (auth, CMS, and orders are prerequisites for internal tools).
- Phase 2 **blocks** Phase 3 (CRM and invoicing underpin e-commerce).
- Phase 3 **blocks** Phase 4 (store and payments must exist before mobile apps).
- Phase 4 **blocks** Phase 5 (apps must be published before multi-tenant and AI).
- Phases are **serial at the platform level** but internal epics within each phase have parallel work opportunities.

---

## 2. Program Increments (PIs)

### PI-0: Foundation (Sprint 0)

| Field | Value |
|:---|:---|
| **Duration** | 4 weeks (Jun 8 – Jul 3, 2026) |
| **PI Objectives** | Establish documentation baseline, architectural decisions, governance framework, and development environment |
| **Key Results** | KR0.1: All Phase 0 documents reviewed and approved (vision, PRD, SRD, ADRs, C4, architecture, governance, roadmap)<br>KR0.2: Monorepo initialized with Turborepo + pnpm<br>KR0.3: Docker Compose stack running (PostgreSQL, Redis)<br>KR0.4: NestJS + Next.js scaffold projects building<br>KR0.5: CI/CD pipeline (GitHub Actions) green on main<br>KR0.6: Linting, formatting, and TypeScript strict mode enforced |
| **Teams** | 1 Lead Architect + 1 Senior Engineer |
| **Staffing** | Architecture & DevOps focus; no dedicated frontend/backend yet |

### PI-1: Digital Presence

| Field | Value |
|:---|:---|
| **Duration** | 12 weeks (Jul 6 – Sep 25, 2026) |
| **PI Objectives** | Launch the official company website with authentication, content management, and online service ordering |
| **Key Results** | KR1.1: Registration and login with JWT + RBAC live<br>KR1.2: Public website (Home, About, Contact, Services) deployed<br>KR1.3: CMS enables admins to manage pages, blog, media, SEO<br>KR1.4: Customers can browse services, submit orders, upload documents, and track status<br>KR1.5: Lighthouse score ≥ 90, p95 API latency < 200ms<br>KR1.6: Test coverage ≥ 80% (unit), ≥ 70% (integration) |
| **Teams** | 3 Engineers (1 Backend/NestJS, 1 Frontend/Next.js, 1 Full-Stack) + 1 QA |
| **Staffing** | Backend lead, Frontend lead, Full-stack engineer, QA engineer |

### PI-2: Internal Management

| Field | Value |
|:---|:---|
| **Duration** | 20 weeks (Oct 26, 2026 – Mar 20, 2027) |
| **PI Objectives** | Build internal operations suite: admin dashboard, CRM, invoicing, ticketing, knowledge base, and reports |
| **Key Results** | KR2.1: Admin dashboard with overview widgets and KPIs<br>KR2.2: CRM with customer profiles, tags, communication history, search, and import/export<br>KR2.3: Invoice generation (manual + auto), payment gateway integration, PDF receipts<br>KR2.4: Ticket system with workflow, assignment, and notifications<br>KR2.5: Notification system (email + in-app) with customizable templates<br>KR2.6: Knowledge base with articles, categories, and search<br>KR2.7: Reports module (sales, customers, employee performance) with PDF/Excel export |
| **Teams** | 4 Engineers (2 Backend, 1 Frontend, 1 Full-Stack) + 1 QA |
| **Staffing** | 2 Backend engineers, 1 Frontend lead, 1 Full-stack, 1 QA |

### PI-3: E-Commerce

| Field | Value |
|:---|:---|
| **Duration** | 20 weeks (Mar 23 – Aug 7, 2027) |
| **PI Objectives** | Launch a full-featured online store integrated with Phase 2 systems |
| **Key Results** | KR3.1: Product catalog with categories, filtering, and detail pages<br>KR3.2: Shopping cart and checkout flow<br>KR3.3: Payment gateway integration (at least 1 provider)<br>KR3.4: Inventory and shipping management<br>KR3.5: Coupons and discount engine<br>KR3.6: Store reports dashboard |
| **Teams** | 4 Engineers (2 Backend, 1 Frontend, 1 Full-Stack) + 1 QA |
| **Staffing** | Same core team, potentially +1 e-commerce specialist |

### PI-4: Desktop & Mobile Apps

| Field | Value |
|:---|:---|
| **Duration** | 28 weeks (Aug 10, 2027 – Feb 20, 2028) |
| **PI Objectives** | Deliver native mobile (Android + iOS) and desktop applications |
| **Key Results** | KR4.1: React Native app for customers (browse, order, track, profile)<br>KR4.2: React Native app for employees (ticket management, order processing)<br>KR4.3: Electron/Tauri desktop app (admin dashboard, reports)<br>KR4.4: Push notifications integrated<br>KR4.5: Offline mode for key workflows |
| **Teams** | 5 Engineers (1 RN/iOS, 1 RN/Android, 1 Desktop, 1 Backend, 1 Full-Stack) + 1 QA |
| **Staffing** | Add 2 mobile specialists, 1 desktop specialist |

### PI-5: Advanced Platform & AI

| Field | Value |
|:---|:---|
| **Duration** | 40 weeks (Feb 23, 2028 – Dec 20, 2028, with buffer into Jul 2029) |
| **PI Objectives** | Transform into multi-tenant SaaS with marketplace and AI-powered features |
| **Key Results** | KR5.1: Multi-tenant architecture (tenant isolation, billing, onboarding)<br>KR5.2: Marketplace where third parties can list services<br>KR5.3: AI foundation (vector store, embedding pipeline, LLM integration)<br>KR5.4: AI Assistant (chatbot for customer support)<br>KR5.5: RAG-based knowledge retrieval<br>KR5.6: Automation platform (workflow builder, triggers, actions)<br>KR5.7: Advanced analytics with custom dashboards |
| **Teams** | 6–7 Engineers + 1 ML/AI specialist + 1 QA |
| **Staffing** | Expand team with ML engineer, platform engineer, DevOps specialist |

---

## 3. Release Plan

### Release v0.1.0 — Digital Presence (Phase 1)

| Field | Value |
|:---|:---|
| **Version** | `0.1.0` |
| **Release Date** | Oct 5, 2026 |
| **Phase** | 1 |
| **Summary** | First public release: company website with auth, CMS, and service ordering |

#### Features Included

| Feature ID | Feature Name | FRs Covered |
|:---|:---|:---|
| F-101 | User Registration & Login | FR-101, FR-102, FR-103 |
| F-102 | JWT Authentication & RBAC | FR-105, FR-106, FR-109 |
| F-103 | User Profile Management | FR-104 |
| F-201 | Public Website (Home, About, Contact) | — (marketing pages) |
| F-202 | Responsive Design & RTL | NFR-503, NFR-505 |
| F-301 | Page Management (CMS) | FR-401, FR-402 |
| F-302 | Media Library | FR-403 |
| F-303 | Blog System | FR-404 |
| F-304 | Menu & SEO Management | FR-405, FR-406 |
| F-401 | Service Catalog | FR-301 |
| F-402 | Order Submission & Document Upload | FR-302, FR-303 |
| F-403 | Order Tracking | FR-304, FR-307 |
| F-404 | Order Workflow | FR-305, FR-306 |
| F-501 | CI/CD Pipeline | NFR-605 |
| F-502 | Monorepo Structure | — |
| F-503 | API Documentation (OpenAPI) | NFR-602 |

#### Success Criteria

- [ ] SC-001: Visitors can browse the website on desktop and mobile (responsive + RTL)
- [ ] SC-002: New users can register, verify email (optional), and log in
- [ ] SC-003: Admins can create/edit/delete pages and blog posts via CMS
- [ ] SC-004: Customers can browse services, submit an order with documents, and track status
- [ ] SC-005: Employees can view assigned orders and update status
- [ ] SC-006: API responses return OpenAPI-compliant documentation at `/api/docs`
- [ ] SC-007: Lighthouse score ≥ 90 (Performance, Accessibility, Best Practices, SEO)
- [ ] SC-008: p95 API response time < 200ms for all endpoints
- [ ] SC-009: Unit test coverage ≥ 80%, integration coverage ≥ 70%
- [ ] SC-010: CI/CD pipeline passes on every PR and deploys to staging automatically

#### Rollback Plan

1. **Database**: Run Prisma/Drizzle reverse migration to previous stable schema version.
2. **API**: Roll back API deployment to previous container image tag.
3. **Frontend**: Revert Vercel deployment to previous production deployment.
4. **Post-rollback**: Validate core flows (login, service browsing, page rendering) pass smoke tests.
5. **RPO/RTO**: Targeting RPO < 1 hour, RTO < 4 hours (aligns with NFR-202, NFR-203).

---

### Release v0.2.0 — Internal Management (Phase 2)

| Field | Value |
|:---|:---|
| **Version** | `0.2.0` |
| **Release Date** | Apr 26, 2027 |
| **Phase** | 2 |
| **Summary** | Admin dashboard, CRM, invoicing, ticketing, notifications, knowledge base, reports |

#### Features Included

| Feature ID | Feature Name | FRs Covered |
|:---|:---|:---|
| F-201 | Admin Dashboard | FR-901 |
| F-202 | CRM System | FR-201 through FR-205 |
| F-203 | Invoicing System | FR-501 through FR-506 |
| F-204 | Ticketing System | FR-601 through FR-606 |
| F-205 | Notification System | FR-801, FR-802, FR-803 |
| F-206 | Knowledge Base | — (supporting FR-606) |
| F-207 | Reports & Analytics | FR-902 through FR-905 |

#### Success Criteria

- [ ] Admins see overview dashboard with live KPIs
- [ ] Customer profiles include full history (orders, tickets, communications)
- [ ] Invoices can be generated manually and automatically from orders
- [ ] Tickets flow through defined workflow (Open → In Progress → Closed)
- [ ] Email notifications sent on order/ticket status changes
- [ ] Reports exportable to PDF and Excel

#### Rollback Plan

Same procedure as v0.1.0, with additional validation on invoicing and ticketing workflows.

---

### Release v0.3.0 — E-Commerce (Phase 3)

| Field | Value |
|:---|:---|
| **Version** | `0.3.0` |
| **Release Date** | Oct 25, 2027 |
| **Phase** | 3 |
| **Summary** | Full online store: products, cart, checkout, payments, inventory |

#### Features Included

| Feature ID | Feature Name | FRs Covered |
|:---|:---|:---|
| F-301 | Product Catalog & Details | FR-701, FR-702, FR-706 |
| F-302 | Shopping Cart | FR-703 |
| F-303 | Checkout Flow | FR-704 |
| F-304 | Payment Integration | FR-503 |
| F-305 | Order Tracking (Store) | FR-705 |
| F-306 | Inventory Management | FR-707 |
| F-307 | Shipping Management | FR-708 |
| F-308 | Coupons & Discounts | FR-709 |

#### Success Criteria

- [ ] Customers can browse products, add to cart, and complete checkout
- [ ] At least one payment gateway integrated and processing real transactions
- [ ] Inventory auto-decrements on purchase
- [ ] Shipping status tracked per order
- [ ] Coupon codes apply correct discounts at checkout

#### Rollback Plan

Additional safeguards: freeze payment gateway processing before rollback; reconcile any in-flight transactions manually.

---

### Release v1.0.0 — Desktop & Mobile (Phase 4)

| Field | Value |
|:---|:---|
| **Version** | `1.0.0` (first production-grade release) |
| **Release Date** | Jun 28, 2028 |
| **Phase** | 4 |
| **Summary** | Cross-platform apps for Android, iOS, and desktop |

#### Features Included

| Feature ID | Feature Name | FRs Covered |
|:---|:---|:---|
| F-401 | Customer Mobile App | (mirrors web customer flows) |
| F-402 | Employee Mobile App | (mirrors web employee flows) |
| F-403 | Desktop App (Admin) | (admin dashboard + reports) |
| F-404 | Push Notifications | FR-805 |
| F-405 | Offline Mode | — |

#### Success Criteria

- [ ] Android app published on Google Play Store
- [ ] iOS app published on Apple App Store
- [ ] Desktop app installable on Windows, macOS, Linux
- [ ] Push notifications delivered within 5 seconds
- [ ] Offline mode caches recent orders/tickets and syncs on reconnect

#### Rollback Plan

Apps: push new build to app stores (standard update cycle). API: same container rollback. Notifications: pause push notification service.

---

### Release v2.0.0 — Advanced Platform & AI (Phase 5)

| Field | Value |
|:---|:---|
| **Version** | `2.0.0` |
| **Release Date** | Jul 31, 2029 |
| **Phase** | 5 |
| **Summary** | Multi-tenant SaaS, marketplace, AI assistant, automation |

#### Features Included

| Feature ID | Feature Name | FRs Covered |
|:---|:---|:---|
| F-501 | Multi-Tenant Architecture | NFR-405 |
| F-502 | Marketplace | — |
| F-503 | AI Assistant (Chatbot) | — |
| F-504 | RAG Knowledge Retrieval | — |
| F-505 | Automation Platform | — |
| F-506 | Advanced Analytics | FR-906 |

#### Success Criteria

- [ ] Tenants can onboard self-service with isolated data
- [ ] Third-party vendors can list services in marketplace
- [ ] AI assistant answers customer queries using knowledge base (RAG)
- [ ] Automation workflows execute on defined triggers
- [ ] Custom KPI dashboards per tenant

#### Rollback Plan

Tenant isolation must be validated after rollback; run tenant data integrity checks. AI/vector stores: re-index from source if needed.

---

## 4. Epic Breakdown — Phase 1

### EPIC-1: Authentication System

| Field | Value |
|:---|:---|
| **Epic ID** | EPIC-1 |
| **Name** | Authentication & Identity System |
| **Description** | Implement user registration, login, password recovery, JWT token management, RBAC with granular permissions, session management, and profile management. This is the foundational subsystem upon which all access-controlled features depend. |
| **FR Mappings** | FR-101 (Registration), FR-102 (Login with JWT), FR-103 (Password Reset), FR-104 (Profile Management), FR-105 (RBAC), FR-106 (Granular Permissions), FR-107 (MFA — deferred), FR-108 (Social Login — deferred), FR-109 (Session Management) |
| **Story Point Estimate** | 34 SP |
| **Priority** | P0 — BLOCKER for all other epics |
| **Dependencies** | EPIC-5 (Infrastructure & DevOps) must deliver monorepo, database, Docker, and CI/CD before auth implementation can begin. |
| **Assigned Sprint** | Sprint 1.2 |

### EPIC-2: Public Website

| Field | Value |
|:---|:---|
| **Epic ID** | EPIC-2 |
| **Name** | Public-Facing Website |
| **Description** | Build the company's public website including home page, about page, contact page, service listing pages, responsive design with RTL support, SEO optimization, and a shared layout system (Header/Footer). |
| **FR Mappings** | FR-301 (Service Display — listing portion), FR-302 (Service Details — display portion) |
| **Story Point Estimate** | 28 SP |
| **Priority** | P0 |
| **Dependencies** | EPIC-5 (Infrastructure) for frontend scaffold, EPIC-3 (CMS) for dynamic content population. The website can render with static/placeholder content before CMS is complete; CMS integration comes in Sprint 1.4. |
| **Assigned Sprint** | Sprint 1.3 |

### EPIC-3: Content Management

| Field | Value |
|:---|:---|
| **Epic ID** | EPIC-3 |
| **Name** | Content Management System (CMS) |
| **Description** | Provide an admin interface for managing website content: page CRUD, rich text editor, media library (upload/categorize/delete), blog management (articles, categories, tags), menu management, SEO metadata editing, content scheduling, and version history. |
| **FR Mappings** | FR-401 (Page Management), FR-402 (Rich Text Editor), FR-403 (Media Management), FR-404 (Blog Management), FR-405 (Menu Management), FR-406 (SEO Metadata), FR-407 (Content Scheduling — deferred), FR-408 (Version History — deferred) |
| **Story Point Estimate** | 32 SP |
| **Priority** | P0 |
| **Dependencies** | EPIC-1 (Auth) for admin role protection, EPIC-5 (Infrastructure) for S3/MinIO media storage. Integrates with EPIC-2 (Public Website) for dynamic page rendering. |
| **Assigned Sprint** | Sprint 1.4 |

### EPIC-4: Service Catalog & Orders

| Field | Value |
|:---|:---|
| **Epic ID** | EPIC-4 |
| **Name** | Service Catalog & Order Management |
| **Description** | Create the service catalog backend and frontend, order submission flow with document upload, order status tracking, order assignment workflow for employees, and email notifications for status changes. |
| **FR Mappings** | FR-301 (Service Catalog Display), FR-302 (Order Submission Form), FR-303 (Document Upload), FR-304 (Order Status Tracking), FR-305 (Order Workflow), FR-306 (Employee Assignment), FR-307 (Status Change Notifications), FR-308 (Service Rating — deferred) |
| **Story Point Estimate** | 48 SP |
| **Priority** | P0 |
| **Dependencies** | EPIC-1 (Auth) for customer/employee role protection, EPIC-5 (Infrastructure) for file storage (S3/MinIO) and email (BullMQ), EPIC-2 (Public Website) for service display pages. |
| **Assigned Sprint** | Sprint 1.5 |

### EPIC-5: Infrastructure & DevOps

| Field | Value |
|:---|:---|
| **Epic ID** | EPIC-5 |
| **Name** | Infrastructure, DevOps & Platform Foundation |
| **Description** | Set up the monorepo with Turborepo + pnpm, NestJS API scaffold, Next.js App Router scaffold, PostgreSQL + Redis Docker services, Prisma/Drizzle ORM with migrations, shared packages (@aht/types, @aht/ui, @aht/config), CI/CD pipeline (GitHub Actions), linting/formatting (ESLint, Prettier), TypeScript strict mode, and deployment to staging environment. |
| **FR Mappings** | NFR-601 (Test Coverage), NFR-602 (OpenAPI Docs), NFR-604 (Coding Standards), NFR-605 (CI/CD Pipeline), NFR-301 (TLS), NFR-303 (OWASP), NFR-401 (Scalability), NFR-404 (Horizontal Scaling) |
| **Story Point Estimate** | 26 SP |
| **Priority** | P0 — BLOCKER for all other epics |
| **Dependencies** | None. This is the foundation. |
| **Assigned Sprint** | Sprint 0.5 (setup) + Sprint 1.1 (hardening) |

---

## 5. Feature Breakdown

### 5.1 EPIC-1: Authentication System — Features

---

#### F-AUTH-001: User Registration

| Field | Value |
|:---|:---|
| **Feature ID** | F-AUTH-001 |
| **Name** | User Registration |
| **User Story** | As a **visitor**, I want to **register an account** with my email, password, and basic information so that I can access the platform's services. |
| **FRs** | FR-101 |
| **Acceptance Criteria** | AC-001: Registration form accepts email, password (min 8 chars, 1 uppercase, 1 number, 1 special), full name, phone.<br>AC-002: Password is hashed with bcrypt/argon2 before storage.<br>AC-003: Duplicate email returns 409 Conflict with user-friendly message.<br>AC-004: Successful registration returns 201 with user DTO (no password).<br>AC-005: Optional email verification token is generated (feature flag).<br>AC-006: All fields are validated server-side (class-validator/Zod). |
| **Technical Notes** | Endpoint: `POST /api/auth/register`. Use NestJS `@Body()` DTO validation. Hash via `bcrypt` (12 rounds) or `argon2id`. Store `email_verified_at` nullable. Use `class-validator` or `zod` for input validation. |
| **Dependencies** | EPIC-5 (database, NestJS scaffold, shared types package) |
| **Story Points** | 5 SP |

---

#### F-AUTH-002: Email/Password Login

| Field | Value |
|:---|:---|
| **Feature ID** | F-AUTH-002 |
| **Name** | Email/Password Login |
| **User Story** | As a **registered user**, I want to **log in with my email and password** so that I can access my account and personalized features. |
| **FRs** | FR-102 |
| **Acceptance Criteria** | AC-001: Login form accepts email + password.<br>AC-002: Valid credentials return JWT access token (15 min expiry) and refresh token (7 day expiry, HTTP-only cookie).<br>AC-003: Invalid credentials return 401 with generic message (no user enumeration).<br>AC-004: Rate limiting: max 5 failed attempts per IP per minute (NFR-305).<br>AC-005: Failed login attempts are logged for audit (NFR-304). |
| **Technical Notes** | Endpoint: `POST /api/auth/login`. Use `@nestjs/jwt` for token generation. Store refresh tokens in Redis with TTL. Implement `ThrottlerModule` for rate limiting. Audit log via BullMQ background job. |
| **Dependencies** | F-AUTH-001 (users must exist), EPIC-5 (Redis for rate limiting + refresh tokens) |
| **Story Points** | 5 SP |

---

#### F-AUTH-003: Token Refresh

| Field | Value |
|:---|:---|
| **Feature ID** | F-AUTH-003 |
| **Name** | JWT Token Refresh |
| **User Story** | As a **logged-in user**, I want my session to **stay active without re-entering credentials** so that I don't lose my work. |
| **FRs** | FR-102, FR-109 |
| **Acceptance Criteria** | AC-001: `POST /api/auth/refresh` accepts refresh token (cookie) and returns new access + refresh token pair.<br>AC-002: Old refresh token is invalidated after use (rotation).<br>AC-003: Expired/invalid refresh token returns 401.<br>AC-004: Access token blacklist is checked on every authenticated request (optional via Redis). |
| **Technical Notes** | Implement refresh token rotation: each refresh request issues a new refresh token and invalidates the old one. Store family of tokens in Redis. Frontend uses axios interceptor to auto-refresh on 401. |
| **Dependencies** | F-AUTH-002 |
| **Story Points** | 3 SP |

---

#### F-AUTH-004: Password Reset

| Field | Value |
|:---|:---|
| **Feature ID** | F-AUTH-004 |
| **Name** | Password Recovery |
| **User Story** | As a **user who forgot my password**, I want to **reset it via email** so that I can regain access to my account. |
| **FRs** | FR-103 |
| **Acceptance Criteria** | AC-001: `POST /api/auth/forgot-password` accepts email, always returns 200 (no user enumeration).<br>AC-002: If email exists, a reset token is generated (JWT, 15 min expiry) and emailed.<br>AC-003: `POST /api/auth/reset-password` accepts token + new password, validates token, updates password.<br>AC-004: After reset, all existing refresh tokens are invalidated.<br>AC-005: Reset token is single-use. |
| **Technical Notes** | Store reset token hash in database (not the raw token). Email via BullMQ + Nodemailer/Mailgun. Token is a signed JWT with userId and purpose='reset'. |
| **Dependencies** | F-AUTH-001, EPIC-5 (email provider, BullMQ) |
| **Story Points** | 3 SP |

---

#### F-AUTH-005: Role-Based Access Control

| Field | Value |
|:---|:---|
| **Feature ID** | F-AUTH-005 |
| **Name** | RBAC Implementation |
| **User Story** | As an **admin**, I want to **assign roles to users** (Admin, Employee, Customer) so that access to features is properly controlled. |
| **FRs** | FR-105, FR-106 |
| **Acceptance Criteria** | AC-001: Three default roles exist: `admin`, `employee`, `customer`.<br>AC-002: NestJS `@Roles()` decorator protects routes.<br>AC-003: Admin-only endpoints return 403 for non-admins.<br>AC-004: Granular permissions support CRUD actions per resource (e.g., `orders:read`, `orders:write`).<br>AC-005: Roles and permissions are stored in database.<br>AC-006: Admin can assign/revoke roles via API. |
| **Technical Notes** | Use `@nestjs/passport` + custom `RolesGuard`. Define `Permission` enum. Seed default roles and admin user in migration. Implement `CaslAbilityFactory` for attribute-based access if granularity needed. |
| **Dependencies** | F-AUTH-002 (JWT must exist), users table |
| **Story Points** | 8 SP |

---

#### F-AUTH-006: User Profile Management

| Field | Value |
|:---|:---|
| **Feature ID** | F-AUTH-006 |
| **Name** | User Profile Management |
| **User Story** | As a **user**, I want to **view and update my profile** (name, phone, avatar) so that my account information stays current. |
| **FRs** | FR-104 |
| **Acceptance Criteria** | AC-001: `GET /api/users/me` returns current user profile DTO.<br>AC-002: `PATCH /api/users/me` allows updating name, phone, avatar.<br>AC-003: Email change requires current password confirmation.<br>AC-004: Avatar upload supports images up to 2MB (jpg, png, webp).<br>AC-005: Profile page in frontend with form validation. |
| **Technical Notes** | Avatar stored in S3/MinIO, URL saved in users table. Use NestJS `FileInterceptor` for upload. Frontend uses `react-hook-form` + `zod` validation. |
| **Dependencies** | F-AUTH-001, F-AUTH-005, EPIC-5 (file storage) |
| **Story Points** | 5 SP |

---

#### F-AUTH-007: Session Management

| Field | Value |
|:---|:---|
| **Feature ID** | F-AUTH-007 |
| **Name** | Session & Device Management |
| **User Story** | As a **user**, I want to **view my active sessions** and **log out from specific devices** so that I can control access to my account. |
| **FRs** | FR-109 |
| **Acceptance Criteria** | AC-001: `GET /api/auth/sessions` lists all active refresh tokens with device info (IP, User-Agent, created_at).<br>AC-002: `DELETE /api/auth/sessions/:id` invalidates a specific session.<br>AC-003: `POST /api/auth/logout` invalidates the current session token.<br>AC-004: `POST /api/auth/logout-all` invalidates all sessions except current. |
| **Technical Notes** | Store session metadata alongside refresh token in Redis. Each refresh token has a unique `sessionId` (UUID). |
| **Dependencies** | F-AUTH-003 |
| **Story Points** | 5 SP |

---

### 5.2 EPIC-2: Public Website — Features

---

#### F-WEB-001: Shared Layout System

| Feature ID | F-WEB-001 |
|:---|:---|
| **Name** | Shared Layout (Header, Footer, Navigation) |
| **User Story** | As a **visitor**, I want a **consistent header and footer** across all pages so that I can easily navigate the website. |
| **FRs** | NFR-503, NFR-505 |
| **Acceptance Criteria** | AC-001: Header includes logo, navigation links, and CTA button.<br>AC-002: Header is sticky on scroll.<br>AC-003: Footer includes contact info, quick links, social media icons.<br>AC-004: Mobile: hamburger menu with slide-out navigation.<br>AC-005: Full RTL support (Arabic layout mirrors correctly).<br>AC-006: Layout uses Next.js `layout.tsx` at app root. |
| **Technical Notes** | Implement as shared `@aht/ui` components: `<SiteHeader />`, `<SiteFooter />`, `<MobileNav />`. Use TailwindCSS `rtl:` modifiers. Next.js App Router root layout wraps all pages. |
| **Dependencies** | EPIC-5 (TailwindCSS, shadcn/ui, Next.js scaffold) |
| **Story Points** | 5 SP |

---

#### F-WEB-002: Home Page

| Feature ID | F-WEB-002 |
|:---|:---|
| **Name** | Home Page |
| **User Story** | As a **visitor**, I want to **see what AlharisTech offers** on the home page so that I can decide whether to explore further. |
| **FRs** | — (marketing) |
| **Acceptance Criteria** | AC-001: Hero section with headline, subtext, and CTA button.<br>AC-002: Services overview section (3-4 featured services).<br>AC-003: Key features/benefits section with icons.<br>AC-004: Testimonials section (static initially, dynamic later).<br>AC-005: Statistics counter (clients served, projects completed).<br>AC-006: Final CTA section driving to service catalog or contact.<br>AC-007: Page loads in < 2.5s LCP (NFR-102). |
| **Technical Notes** | Use Next.js App Router server component where possible. Sections as separate components in `apps/web/src/components/home/`. Images optimized with `next/image`. |
| **Dependencies** | F-WEB-001 (layout) |
| **Story Points** | 8 SP |

---

#### F-WEB-003: About & Contact Pages

| Feature ID | F-WEB-003 |
|:---|:---|
| **Name** | About Us & Contact Pages |
| **User Story** | As a **visitor**, I want to **learn about the company** and **get in touch** so that I can establish a relationship. |
| **FRs** | — (marketing) |
| **Acceptance Criteria** | AC-001: About page: company story, mission, vision, values, team section.<br>AC-002: Contact page: contact form (name, email, subject, message).<br>AC-003: Contact form validates inputs client and server side.<br>AC-004: Form submission sends email to admin via BullMQ.<br>AC-005: Google Maps embed for office location (optional). |
| **Technical Notes** | Contact form endpoint: `POST /api/contact`. Rate limit to 3 submissions per IP per hour. Email to configured admin address. |
| **Dependencies** | F-WEB-001, EPIC-5 (email provider) |
| **Story Points** | 5 SP |

---

#### F-WEB-004: Services Display Pages

| Feature ID | F-WEB-004 |
|:---|:---|
| **Name** | Service Listing & Detail Pages |
| **User Story** | As a **visitor**, I want to **browse available services and see their details** so that I can decide which service to order. |
| **FRs** | FR-301 |
| **Acceptance Criteria** | AC-001: Services list page with category filtering.<br>AC-002: Each service card shows icon, title, short description, price range.<br>AC-003: Service detail page shows full description, requirements, documents needed, pricing.<br>AC-004: CTA button links to order form (requires auth).<br>AC-005: SEO metadata per service page (title, description, OG tags). |
| **Technical Notes** | Fetch services from `GET /api/services` (public endpoint). Detail: `GET /api/services/:slug`. Use Next.js `generateStaticParams` for SSG of service pages if CMS-managed. |
| **Dependencies** | EPIC-4 (services API), EPIC-3 (CMS for dynamic content), F-WEB-001 |
| **Story Points** | 5 SP |

---

### 5.3 EPIC-3: Content Management — Features

---

#### F-CMS-001: Page CRUD

| Feature ID | F-CMS-001 |
|:---|:---|
| **Name** | Page Management |
| **User Story** | As an **admin**, I want to **create, edit, and delete pages** so that I can manage the website's content dynamically. |
| **FRs** | FR-401 |
| **Acceptance Criteria** | AC-001: `POST /api/cms/pages` creates a page (title, slug, content, status).<br>AC-002: `GET /api/cms/pages` lists all pages with pagination.<br>AC-003: `PATCH /api/cms/pages/:id` updates page fields.<br>AC-004: `DELETE /api/cms/pages/:id` soft-deletes a page.<br>AC-005: Slug uniqueness enforced per language.<br>AC-006: Status: draft/published/archived. Only published pages render on site. |
| **Technical Notes** | Pages table: id, title, slug, content (JSON from rich editor), status (enum), language, author_id, published_at, created_at, updated_at, deleted_at. Admin UI for page list. |
| **Dependencies** | EPIC-1 (admin auth), EPIC-5 (database) |
| **Story Points** | 5 SP |

---

#### F-CMS-002: Rich Text Editor

| Feature ID | F-CMS-002 |
|:---|:---|
| **Name** | Rich Text Editor Integration |
| **User Story** | As an **admin**, I want a **WYSIWYG rich text editor** so that I can format page and blog content without writing HTML. |
| **FRs** | FR-402 |
| **Acceptance Criteria** | AC-001: Editor supports: bold, italic, underline, headings (H1-H4), lists (ordered/unordered), links, images, blockquotes, code blocks.<br>AC-002: Editor outputs structured JSON (TipTap format) or safe HTML.<br>AC-003: Image insertion opens media library picker.<br>AC-004: RTL text direction toggle.<br>AC-005: Content is sanitized server-side before storage (no XSS). |
| **Technical Notes** | Use TipTap (ProseMirror-based) for rich editing. Configure extensions: StarterKit, Image, Link, TextAlign, Placeholder. Store output as TipTap JSON in `content` column. Render with TipTap's `generateHTML()` or a custom renderer. Sanitize with `DOMPurify` on server. |
| **Dependencies** | F-CMS-001 (pages table), F-CMS-003 (media library) |
| **Story Points** | 8 SP |

---

#### F-CMS-003: Media Library

| Feature ID | F-CMS-003 |
|:---|:---|
| **Name** | Media Management |
| **User Story** | As an **admin**, I want to **upload, browse, and manage images and files** so that I can use them in pages and blog posts. |
| **FRs** | FR-403 |
| **Acceptance Criteria** | AC-001: `POST /api/cms/media/upload` uploads file, returns URL + metadata.<br>AC-002: `GET /api/cms/media` lists files with thumbnail preview, name, size, type, date.<br>AC-003: `DELETE /api/cms/media/:id` removes file from storage and database.<br>AC-004: Supported formats: jpg, png, webp, svg, pdf, docx (max 10MB).<br>AC-005: Images auto-generate thumbnails (via sharp).<br>AC-006: Media can be filtered by type (image/document) and sorted by date/name. |
| **Technical Notes** | Store files in S3/MinIO. Database table `media`: id, filename, original_name, mime_type, size_bytes, url, thumbnail_url, uploaded_by, created_at. Use `multer` with S3 adapter. Generate thumbnails via `sharp` in a BullMQ job. |
| **Dependencies** | EPIC-5 (S3/MinIO, BullMQ) |
| **Story Points** | 8 SP |

---

#### F-CMS-004: Blog System

| Feature ID | F-CMS-004 |
|:---|:---|
| **Name** | Blog Management |
| **User Story** | As an **admin**, I want to **create and manage blog articles with categories and tags** so that we can publish content for SEO and customer education. |
| **FRs** | FR-404 |
| **Acceptance Criteria** | AC-001: `POST /api/cms/posts` creates a blog post (title, slug, excerpt, content, featured_image, category, tags, status, author).<br>AC-002: `GET /api/cms/posts` lists posts with filtering by category, tag, status, date range.<br>AC-003: Categories: CRUD management (name, slug, description).<br>AC-004: Tags: free-form, auto-suggest from existing.<br>AC-005: Public blog page: `/blog` lists published posts with pagination.<br>AC-006: Public post detail: `/blog/[slug]` shows full article.<br>AC-007: Related posts shown on detail page (same category/tags). |
| **Technical Notes** | Tables: `posts`, `categories`, `tags`, `post_tags`. Blog uses same TipTap editor as pages. Public blog pages use Next.js ISR with `revalidate`. |
| **Dependencies** | F-CMS-001, F-CMS-002, F-CMS-003 |
| **Story Points** | 8 SP |

---

#### F-CMS-005: Menu & SEO Management

| Feature ID | F-CMS-005 |
|:---|:---|
| **Name** | Menu & SEO Management |
| **User Story** | As an **admin**, I want to **manage navigation menus and edit SEO metadata** for all pages so that the site is well-structured and search-engine optimized. |
| **FRs** | FR-405, FR-406 |
| **Acceptance Criteria** | AC-001: Menu builder: add/remove/reorder menu items, set label + URL, nested submenus.<br>AC-002: Multiple menus supported (header, footer, sidebar).<br>AC-003: SEO fields per page/post: meta title, meta description, OG title, OG description, OG image, canonical URL, noindex toggle.<br>AC-004: SEO fields rendered in `<head>` via Next.js `generateMetadata()`.<br>AC-005: Auto-generate sitemap.xml and robots.txt. |
| **Technical Notes** | Menus table: id, name, location (enum: header/footer/sidebar), items (JSON). SEO stored as JSON on pages/posts tables. Next.js reads SEO from API or directly from DB for SSG/ISR pages. |
| **Dependencies** | F-CMS-001, F-CMS-004 |
| **Story Points** | 5 SP |

---

### 5.4 EPIC-4: Service Catalog & Orders — Features

---

#### F-ORD-001: Service Catalog API

| Feature ID | F-ORD-001 |
|:---|:---|
| **Name** | Service Catalog Backend |
| **User Story** | As an **admin**, I want to **manage the service catalog** so that customers can see available services and their details. |
| **FRs** | FR-301 |
| **Acceptance Criteria** | AC-001: `POST /api/services` creates a service (name, slug, description, category, price, required_documents, estimated_duration, is_active).<br>AC-002: `GET /api/services` returns active services with filtering by category.<br>AC-003: `GET /api/services/:slug` returns full service details.<br>AC-004: Public endpoints: listing + detail. Admin-only: CRUD.<br>AC-005: Services can be reordered via `sort_order` field. |
| **Technical Notes** | Services table: id, name, slug, description (TipTap JSON), category, base_price, required_documents (JSON array), estimated_duration_days, icon, is_active, sort_order, created_at, updated_at. |
| **Dependencies** | EPIC-1 (auth), EPIC-5 |
| **Story Points** | 5 SP |

---

#### F-ORD-002: Order Submission

| Feature ID | F-ORD-002 |
|:---|:---|
| **Name** | Order Submission with Document Upload |
| **User Story** | As a **customer**, I want to **submit a service order with required documents** so that I can start the service process. |
| **FRs** | FR-302, FR-303 |
| **Acceptance Criteria** | AC-001: Order form: select service, fill required fields, upload documents, add notes.<br>AC-002: `POST /api/orders` creates order with status `pending`.<br>AC-003: Required documents list is derived from the selected service definition.<br>AC-004: Each document upload is validated (type, size) and stored in S3/MinIO.<br>AC-005: Order receives auto-generated reference number (e.g., `ORD-2026-00001`).<br>AC-006: Customer receives confirmation email after submission. |
| **Technical Notes** | Orders table: id, reference_number, customer_id, service_id, status (enum), form_data (JSON), notes, submitted_at. Order documents table: id, order_id, document_type, file_url, uploaded_at. Use transactional insert for order + documents. Email via BullMQ. |
| **Dependencies** | F-ORD-001, EPIC-1, F-CMS-003 (S3 upload), EPIC-5 (email, BullMQ) |
| **Story Points** | 8 SP |

---

#### F-ORD-003: Order Tracking

| Feature ID | F-ORD-003 |
|:---|:---|
| **Name** | Order Status Tracking |
| **User Story** | As a **customer**, I want to **track my order status** so that I know the progress of my service request. |
| **FRs** | FR-304 |
| **Acceptance Criteria** | AC-001: `GET /api/orders` returns customer's orders with status, date, and service name.<br>AC-002: `GET /api/orders/:id` shows full order details, status timeline, uploaded documents.<br>AC-003: Status timeline shows each status change with timestamp and employee name.<br>AC-004: Customer receives email notification on each status change. |
| **Technical Notes** | Order status history table: id, order_id, from_status, to_status, changed_by, note, created_at. "My Orders" page in customer dashboard section. |
| **Dependencies** | F-ORD-002, F-AUTH-002 |
| **Story Points** | 5 SP |

---

#### F-ORD-004: Order Workflow & Assignment

| Feature ID | F-ORD-004 |
|:---|:---|
| **Name** | Order Workflow & Employee Assignment |
| **User Story** | As an **employee/admin**, I want to **process orders through a defined workflow and assign them to employees** so that work is distributed efficiently. |
| **FRs** | FR-305, FR-306, FR-307 |
| **Acceptance Criteria** | AC-001: Order statuses: `pending` → `under_review` → `in_progress` → `completed` → `delivered` (or `rejected`/`cancelled`).<br>AC-002: Admin/manager can assign orders to employees.<br>AC-003: Employee can update status with a note.<br>AC-004: Status transitions are validated (e.g., cannot skip `in_progress` to `delivered`).<br>AC-005: Employee sees list of assigned orders with priority flags.<br>AC-006: Notification sent to customer on status change (FR-307). |
| **Technical Notes** | Implement as a state machine (`xstate` or custom enum-based transition map). Employees have a `assigned_orders` relation. Admin dashboard: order queue view with drag-and-drop assignment (optional first pass). |
| **Dependencies** | F-ORD-002, F-ORD-003, F-AUTH-005 (RBAC) |
| **Story Points** | 13 SP |

---

### 5.5 EPIC-5: Infrastructure & DevOps — Features

---

#### F-INF-001: Monorepo Setup

| Feature ID | F-INF-001 |
|:---|:---|
| **Name** | Monorepo Initialization |
| **User Story** | As a **developer**, I want a **well-structured monorepo** so that all projects share code and build efficiently. |
| **FRs** | NFR-604, NFR-605 |
| **Acceptance Criteria** | AC-001: Root `package.json` with Turborepo + pnpm workspaces.<br>AC-002: `apps/web` (Next.js 14+), `apps/api` (NestJS), `packages/ui`, `packages/types`, `packages/config`, `packages/database`.<br>AC-003: `turbo.json` configured with build, dev, lint, test, typecheck pipelines.<br>AC-004: `pnpm install` installs all dependencies.<br>AC-005: `pnpm dev` starts all apps in parallel (Turborepo dev mode).<br>AC-006: Shared ESLint + Prettier config in `packages/config`. |
| **Technical Notes** | Turborepo v2.x with `"globalDependencies"` for env files. pnpm v9.x with `pnpm-workspace.yaml`. Each package/app has its own `tsconfig.json` extending a root `tsconfig.base.json`. |
| **Dependencies** | None |
| **Story Points** | 5 SP |

---

#### F-INF-002: NestJS API Scaffold

| Feature ID | F-INF-002 |
|:---|:---|
| **Name** | NestJS Backend Scaffold |
| **User Story** | As a **developer**, I want a **NestJS API scaffold** with health check, OpenAPI docs, and module structure so that I can start building features. |
| **FRs** | NFR-602 |
| **Acceptance Criteria** | AC-001: NestJS app created in `apps/api`.<br>AC-002: `GET /api/health` returns `{ status: "ok", timestamp }`.<br>AC-003: Swagger UI available at `/api/docs` (auto-generated from decorators).<br>AC-004: Global validation pipe (`class-validator`) enabled.<br>AC-005: Global exception filter for consistent error responses.<br>AC-006: CORS configured for frontend origin.<br>AC-007: Helmet middleware for security headers.<br>AC-008: Logger (Pino or built-in) with request ID tracking. |
| **Technical Notes** | NestJS v10+. Use `@nestjs/swagger` for OpenAPI. Configure `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`. Error response format: `{ statusCode, message, error, timestamp, path }`. |
| **Dependencies** | F-INF-001 |
| **Story Points** | 3 SP |

---

#### F-INF-003: Next.js Frontend Scaffold

| Feature ID | F-INF-003 |
|:---|:---|
| **Name** | Next.js Frontend Scaffold |
| **User Story** | As a **developer**, I want a **Next.js frontend scaffold** with TailwindCSS, shadcn/ui, and RTL support so that I can build pages efficiently. |
| **FRs** | NFR-503, NFR-505 |
| **Acceptance Criteria** | AC-001: Next.js 14+ App Router set up in `apps/web`.<br>AC-002: TailwindCSS v3+ with `tailwind.config.ts` including RTL plugin.<br>AC-003: shadcn/ui components initialized with `components.json`.<br>AC-004: Font setup: Arabic (e.g., Tajawal/Cairo) + Latin (Inter).<br>AC-005: Dark/light theme toggle (next-themes).<br>AC-006: `@/` path alias configured.<br>AC-007: Root layout with HTML `dir` and `lang` attributes driven by locale. |
| **Technical Notes** | Next.js 14+ (App Router). TailwindCSS v3.4+. shadcn/ui latest. Setup `tailwindcss-rtl` plugin or use logical properties. Fonts via `next/font/google`. |
| **Dependencies** | F-INF-001 |
| **Story Points** | 3 SP |

---

#### F-INF-004: Database & ORM

| Feature ID | F-INF-004 |
|:---|:---|
| **Name** | Database Setup with Prisma ORM |
| **User Story** | As a **developer**, I want a **PostgreSQL database with Prisma ORM and migration system** so that data persistence is reliable and version-controlled. |
| **FRs** | — (infrastructure) |
| **Acceptance Criteria** | AC-001: PostgreSQL 16 running in Docker Compose.<br>AC-002: Prisma schema in `packages/database/prisma/schema.prisma`.<br>AC-003: Initial migration creates first tables.<br>AC-004: `prisma generate` and `prisma migrate` scripts work.<br>AC-005: Database connection string from environment variable (never committed).<br>AC-006: Seed script for development data. |
| **Technical Notes** | Prisma ORM. Docker Compose: `postgres:16-alpine` with persistent volume. `DATABASE_URL` in `.env`. Shared `@aht/database` package exports PrismaClient singleton. |
| **Dependencies** | F-INF-001 |
| **Story Points** | 3 SP |

---

#### F-INF-005: Docker Environment

| Feature ID | F-INF-005 |
|:---|:---|
| **Name** | Docker Compose Development Environment |
| **User Story** | As a **developer**, I want a **one-command local environment** so that I can start developing immediately with all services running. |
| **FRs** | — (infrastructure) |
| **Acceptance Criteria** | AC-001: `docker-compose.yml` defines PostgreSQL, Redis, MinIO, Mailhog services.<br>AC-002: `docker compose up -d` starts all services.<br>AC-003: Health checks on all containers.<br>AC-004: Persistent volumes for PostgreSQL and MinIO data.<br>AC-005: Port mappings: PostgreSQL (5432), Redis (6379), MinIO (9000/9001), Mailhog (1025/8025). |
| **Technical Notes** | Use named volumes. Add `depends_on` with `condition: service_healthy`. MinIO for local S3-compatible storage. Mailhog for email capture in dev. |
| **Dependencies** | F-INF-001 |
| **Story Points** | 3 SP |

---

#### F-INF-006: CI/CD Pipeline

| Feature ID | F-INF-006 |
|:---|:---|
| **Name** | CI/CD Pipeline (GitHub Actions) |
| **User Story** | As a **developer**, I want **automated linting, testing, and deployment** on every pull request so that quality is enforced and releases are reliable. |
| **FRs** | NFR-605 |
| **Acceptance Criteria** | AC-001: On PR: lint, typecheck, unit tests, integration tests, build.<br>AC-002: On merge to `develop`: deploy to staging environment.<br>AC-003: On merge to `main`: deploy to production (with manual approval gate).<br>AC-004: Turborepo caching between CI runs.<br>AC-005: Failed pipeline blocks PR merge.<br>AC-006: Slack/Discord notification on deploy success/failure. |
| **Technical Notes** | GitHub Actions workflow files: `ci.yml` (PR checks), `deploy-staging.yml`, `deploy-production.yml`. Use Turborepo `--cache-dir` with GitHub Actions cache. Staging: Vercel preview + Railway/Render. Production: Vercel + Railway/Render. |
| **Dependencies** | F-INF-001 through F-INF-005 |
| **Story Points** | 8 SP |

---

## 6. User Stories — EPIC-1 (Auth)

### US-AUTH-001: Visitor Registration

| Field | Value |
|:---|:---|
| **Story ID** | US-AUTH-001 |
| **Epic** | EPIC-1 |
| **Feature** | F-AUTH-001 |
| **Story** | As a **visitor**, I want to **register an account** with my email, password, full name, and phone number so that I can access personalized services. |
| **Story Points** | 5 |
| **Priority** | P0 |

#### Acceptance Criteria

1. Registration form displays fields: Full Name, Email, Password, Confirm Password, Phone (optional).
2. Password must be ≥ 8 characters with at least 1 uppercase, 1 lowercase, 1 number, and 1 special character.
3. All fields validated client-side (react-hook-form + zod) and server-side (class-validator DTO).
4. Duplicate email returns HTTP 409 with Arabic/English message "هذا البريد الإلكتروني مسجل مسبقاً".
5. Successful registration returns HTTP 201 with user object (id, name, email, created_at) — no password.
6. Password is hashed with bcrypt (12 salt rounds) before storage.
7. Success toast notification displayed, user redirected to login page.

#### Technical Tasks

| # | Task | Tech | Estimate |
|:---|:---|:---|:---|
| T1 | Define `users` table in Prisma schema (id, name, email, password_hash, phone, avatar_url, role, email_verified_at, created_at, updated_at) | Prisma | 0.5d |
| T2 | Generate and run Prisma migration | Prisma | 0.25d |
| T3 | Create `RegisterDto` with class-validator decorators | NestJS | 0.25d |
| T4 | Implement `POST /api/auth/register` endpoint in AuthController | NestJS | 1d |
| T5 | Implement `AuthService.register()` — validate, hash, insert, return DTO | NestJS | 1d |
| T6 | Build registration page UI at `/auth/register` (form, validation, error/success states) | Next.js + shadcn/ui | 1d |
| T7 | Wire frontend form to API using fetch/axios | Next.js | 0.5d |
| T8 | Write unit tests for AuthService.register | Jest | 0.5d |
| T9 | Write E2E test: happy path registration flow | Playwright | 0.5d |

---

### US-AUTH-002: Email/Password Login

| Field | Value |
|:---|:---|
| **Story ID** | US-AUTH-002 |
| **Epic** | EPIC-1 |
| **Feature** | F-AUTH-002 |
| **Story** | As a **registered user**, I want to **log in with my email and password** so that I can access my account and personalized features. |
| **Story Points** | 5 |
| **Priority** | P0 |

#### Acceptance Criteria

1. Login form displays Email and Password fields with "Forgot Password?" link.
2. Valid credentials return JWT access token (15 min TTL) in response body + refresh token (7 day TTL) in HTTP-only secure cookie.
3. Invalid credentials return HTTP 401 with generic message "البريد الإلكتروني أو كلمة المرور غير صحيحة".
4. After 5 consecutive failed attempts from same IP, rate limiting activates for 15 minutes (HTTP 429).
5. Failed login attempts logged with IP, User-Agent, timestamp (NFR-304).
6. Successful login redirects based on role: admin → /admin, employee → /employee, customer → /dashboard.
7. Access token is stored in memory (not localStorage) with auto-refresh via axios interceptor.

#### Technical Tasks

| # | Task | Tech | Estimate |
|:---|:---|:---|:---|
| T1 | Create `LoginDto` with class-validator | NestJS | 0.25d |
| T2 | Implement `POST /api/auth/login` endpoint | NestJS | 0.5d |
| T3 | Implement `AuthService.login()` — validate credentials, generate JWT + refresh token | NestJS | 1d |
| T4 | Configure `@nestjs/jwt` with RS256, 15min expiry | NestJS | 0.25d |
| T5 | Configure `@nestjs/throttler` for rate limiting | NestJS | 0.25d |
| T6 | Store refresh token in Redis with TTL + session metadata | NestJS + Redis | 0.5d |
| T7 | Implement audit log for login attempts (BullMQ background job) | NestJS + BullMQ | 0.5d |
| T8 | Build login page UI at `/auth/login` | Next.js + shadcn/ui | 1d |
| T9 | Implement auth context (React Context + useReducer) for token storage and user state | Next.js | 1d |
| T10 | Implement axios interceptor: auto-attach token, refresh on 401 | Next.js | 1d |
| T11 | Write unit tests for AuthService.login | Jest | 0.5d |
| T12 | Write E2E test: login + redirect flow | Playwright | 0.5d |

---

### US-AUTH-003: Password Reset

| Field | Value |
|:---|:---|
| **Story ID** | US-AUTH-003 |
| **Epic** | EPIC-1 |
| **Feature** | F-AUTH-004 |
| **Story** | As a **user who forgot my password**, I want to **reset it via email** so that I can regain access to my account. |
| **Story Points** | 3 |
| **Priority** | P0 |

#### Acceptance Criteria

1. "Forgot Password" page accepts email and always shows success message (no user enumeration).
2. If email exists in system, a password reset email is sent with a unique link containing a JWT token (15 min expiry).
3. Reset link leads to `/auth/reset-password?token=xxx` page with New Password + Confirm Password fields.
4. Token is validated server-side; expired or used token shows error.
5. On successful reset, all existing refresh tokens for that user are invalidated.
6. User is redirected to login page with success message.

#### Technical Tasks

| # | Task | Tech | Estimate |
|:---|:---|:---|:---|
| T1 | Implement `POST /api/auth/forgot-password` — find user, generate reset token JWT, queue email | NestJS | 1d |
| T2 | Implement `POST /api/auth/reset-password` — validate token, hash new password, update user, invalidate sessions | NestJS | 0.5d |
| T3 | Create email template for password reset (HTML + text) with Handlebars/MJML | NestJS | 0.5d |
| T4 | Build forgot-password page UI | Next.js | 0.5d |
| T5 | Build reset-password page UI | Next.js | 0.5d |
| T6 | Write unit tests | Jest | 0.25d |

---

### US-AUTH-004: Admin Role Management

| Field | Value |
|:---|:---|
| **Story ID** | US-AUTH-004 |
| **Epic** | EPIC-1 |
| **Feature** | F-AUTH-005 |
| **Story** | As an **admin**, I want to **manage user roles and permissions** so that users have appropriate access to platform features. |
| **Story Points** | 8 |
| **Priority** | P0 |

#### Acceptance Criteria

1. Admin User Management page at `/admin/users` lists all users with search, filter by role.
2. Admin can change a user's role via dropdown (admin, employee, customer).
3. Admin can assign/revoke granular permissions (e.g., `orders:read`, `cms:write`).
4. Role/permission changes take effect immediately (next API request).
5. Audit log records who changed what role for which user.
6. Non-admin users accessing `/admin/*` are redirected to 403 page.

#### Technical Tasks

| # | Task | Tech | Estimate |
|:---|:---|:---|:---|
| T1 | Define roles + permissions in Prisma schema (Role, Permission, RolePermission junction tables) | Prisma | 1d |
| T2 | Implement `RolesGuard` and `PermissionsGuard` in NestJS | NestJS | 1d |
| T3 | Implement `GET /api/admin/users`, `PATCH /api/admin/users/:id/role` endpoints | NestJS | 1d |
| T4 | Seed default roles and admin user in migration | Prisma | 0.5d |
| T5 | Build Admin Users page UI (table, search, role dropdown, permissions panel) | Next.js | 2d |
| T6 | Write unit tests for guards and endpoints | Jest | 1d |
| T7 | Write E2E test: admin changes user role, user tries accessing restricted page | Playwright | 0.5d |

---

### US-AUTH-005: User Profile Update

| Field | Value |
|:---|:---|
| **Story ID** | US-AUTH-005 |
| **Epic** | EPIC-1 |
| **Feature** | F-AUTH-006 |
| **Story** | As a **user**, I want to **update my profile information** (name, phone, avatar, password) so that my account details stay current and secure. |
| **Story Points** | 5 |
| **Priority** | P1 |

#### Acceptance Criteria

1. Profile page at `/profile` displays current name, email, phone, avatar.
2. User can edit name and phone inline; save triggers `PATCH /api/users/me`.
3. Avatar upload: drag-and-drop or click-to-upload, crop tool (optional), max 2MB (jpg/png/webp).
4. Email change requires current password verification.
5. Password change: current password + new password + confirm new password.
6. Success toast on save, error messages on validation failure.
7. Updated name reflected in header immediately after save.

#### Technical Tasks

| # | Task | Tech | Estimate |
|:---|:---|:---|:---|
| T1 | Implement `GET /api/users/me` returning full user profile DTO | NestJS | 0.5d |
| T2 | Implement `PATCH /api/users/me` for name, phone updates | NestJS | 0.5d |
| T3 | Implement `POST /api/users/me/avatar` with file upload (S3) | NestJS | 1d |
| T4 | Implement `POST /api/users/me/change-password` | NestJS | 0.5d |
| T5 | Build profile page UI with tabs (Info, Avatar, Password) | Next.js | 1.5d |
| T6 | Avatar upload component with preview | Next.js | 0.5d |
| T7 | Write unit + E2E tests | Jest + Playwright | 0.5d |

---

## 7. Sprint Plan — Phase 1

### Sprint 1.1: Technical Foundation

| Field | Value |
|:---|:---|
| **Duration** | 2 weeks (Jul 6 – Jul 17, 2026) |
| **Sprint Goal** | Establish the monorepo, backend scaffold, frontend scaffold, database, Docker environment, shared packages, and CI/CD pipeline. All services run locally with `docker compose up` and `pnpm dev`. |
| **Capacity** | 26 SP (3 engineers × 2 weeks) |

#### Stories

| ID | Title | SP | Owner | Dependencies |
|:---|:---|:---|:---|:---|
| INF-001 | Monorepo Initialization with Turborepo | 5 | Full-Stack | None |
| INF-004 | Database Setup with Prisma ORM | 3 | Backend | INF-001 |
| INF-005 | Docker Compose Development Environment | 3 | Backend | INF-001 |
| INF-002 | NestJS API Scaffold (health check, Swagger, pipes) | 3 | Backend | INF-001, INF-004 |
| INF-003 | Next.js Frontend Scaffold (Tailwind, shadcn/ui, RTL, fonts) | 3 | Frontend | INF-001 |
| INF-006 | CI/CD Pipeline (GitHub Actions) | 8 | Full-Stack | INF-001—005 |

#### Notes

- Sprint 1.1 subsumes Sprint 0.5 from the previous plan.
- All three engineers contribute to INF-001 together on Day 1-2, then split.
- INF-006 (CI/CD) runs in parallel throughout the sprint, finalized last.
- Exit criteria: All `pnpm` scripts (dev, build, lint, test, typecheck) pass across all workspaces.

---

### Sprint 1.2: Authentication System

| Field | Value |
|:---|:---|
| **Duration** | 1 week (Jul 20 – Jul 24, 2026) |
| **Sprint Goal** | Implement complete authentication: registration, login, JWT token management, password reset, RBAC with three roles, session management, and profile management. |
| **Capacity** | 34 SP (3 engineers × 1 week; auth is high-priority and all hands) |

#### Stories

| ID | Title | SP | Owner | Dependencies |
|:---|:---|:---|:---|:---|
| AUTH-001 | User Registration (API + UI) | 5 | Backend + Frontend | INF-004 (users table) |
| AUTH-002 | Email/Password Login (JWT + Refresh) | 5 | Backend + Frontend | AUTH-001 |
| AUTH-003 | Token Refresh (rotation + Redis) | 3 | Backend | AUTH-002 |
| AUTH-004 | Password Reset (email flow) | 3 | Backend + Frontend | AUTH-001, INF-005 (email) |
| AUTH-005 | RBAC (roles, guards, admin UI) | 8 | Backend + Frontend | AUTH-002 |
| AUTH-006 | User Profile Management | 5 | Frontend + Backend | AUTH-001, AUTH-005 |
| AUTH-007 | Session & Device Management | 5 | Backend + Frontend | AUTH-003 |

#### Notes

- Sprint 1.2 is the most critical sprint — all other epics depend on auth.
- Backend engineer owns AUTH-001 through AUTH-005 API; Frontend owns UI for all stories.
- Full-stack engineer bridges gaps and handles AUTH-006, AUTH-007.
- All stories must pass review before Sprint 1.3 begins.

---

### Sprint 1.3: Public Website

| Field | Value |
|:---|:---|
| **Duration** | 2 weeks (Jul 27 – Aug 7, 2026) |
| **Sprint Goal** | Build the public-facing website: shared layout (Header/Footer), home page, about page, contact page, and service listing/detail pages. All fully responsive with RTL support and SEO metadata. |
| **Capacity** | 28 SP (3 engineers × 2 weeks; frontend-heavy sprint) |

#### Stories

| ID | Title | SP | Owner | Dependencies |
|:---|:---|:---|:---|:---|
| WEB-001 | Shared Layout System | 5 | Frontend | INF-003 |
| WEB-002 | Home Page (Hero, Services, Features, Stats, CTA) | 8 | Frontend | WEB-001 |
| WEB-003 | About Us & Contact Pages | 5 | Frontend + Backend | WEB-001, INF-005 |
| WEB-004 | Services Display Pages (Listing + Detail) | 5 | Frontend | WEB-001, ORD-001 (API) |
| — | SEO Framework (metadata, sitemap, robots) | 3 | Frontend | WEB-002, WEB-004 |
| — | Responsive QA & RTL Validation | 2 | Frontend + QA | All WEB stories |

#### Notes

- Frontend lead owns WEB-001, WEB-002, SEO framework.
- Full-stack engineer owns WEB-003 (contact form API + UI).
- Backend engineer supports by building `GET /api/services` stub for WEB-004.
- CMS integration for dynamic content comes in Sprint 1.4; pages use static/placeholder content in Sprint 1.3.

---

### Sprint 1.4: Content Management System

| Field | Value |
|:---|:---|
| **Duration** | 2 weeks (Aug 10 – Aug 21, 2026) |
| **Sprint Goal** | Build the admin CMS: page CRUD, rich text editor (TipTap), media library with S3 upload, blog system (articles, categories, tags), menu builder, and SEO metadata management. |
| **Capacity** | 32 SP (3 engineers × 2 weeks) |

#### Stories

| ID | Title | SP | Owner | Dependencies |
|:---|:---|:---|:---|:---|
| CMS-001 | Page CRUD (API + Admin UI) | 5 | Backend + Frontend | AUTH-005, INF-004 |
| CMS-003 | Media Library (upload, browse, delete, thumbnails) | 8 | Backend + Frontend | AUTH-005, INF-005 |
| CMS-002 | Rich Text Editor (TipTap integration) | 8 | Frontend + Backend | CMS-001, CMS-003 |
| CMS-004 | Blog System (posts, categories, tags) | 8 | Full-Stack | CMS-001, CMS-002, CMS-003 |
| CMS-005 | Menu & SEO Management | 5 | Frontend + Backend | CMS-001, CMS-004 |

#### Notes

- Backend engineer owns API for CMS-001, CMS-003, CMS-005.
- Frontend engineer owns TipTap integration (CMS-002) and all admin UI.
- Full-stack engineer owns blog system end-to-end (CMS-004).
- After this sprint, integrate CMS content into public website (replace static content from Sprint 1.3).

---

### Sprint 1.5: Service Catalog & Orders

| Field | Value |
|:---|:---|
| **Duration** | 3 weeks (Aug 24 – Sep 11, 2026) |
| **Sprint Goal** | Build the service catalog (admin management + public display), order submission with document upload, order tracking for customers, and order workflow with employee assignment. Email notifications for all status changes. |
| **Capacity** | 48 SP (3 engineers × 3 weeks) |

#### Stories

| ID | Title | SP | Owner | Dependencies |
|:---|:---|:---|:---|:---|
| ORD-001 | Service Catalog API (CRUD + public endpoints) | 5 | Backend | AUTH-005, INF-004 |
| ORD-002 | Order Submission with Document Upload | 8 | Backend + Frontend | ORD-001, CMS-003 |
| ORD-003 | Order Tracking (customer view) | 5 | Frontend + Backend | ORD-002 |
| ORD-004 | Order Workflow & Assignment | 13 | Backend + Frontend | ORD-002, AUTH-005 |
| — | Customer Dashboard (My Orders page) | 5 | Frontend | ORD-003 |
| — | Employee Dashboard (Assigned Orders queue) | 5 | Frontend | ORD-004 |
| — | Email Notifications (order confirmation, status change) | 5 | Backend | ORD-002, ORD-004, INF-005 |

#### Notes

- This is the longest sprint in Phase 1 due to complexity of order workflow.
- ORD-004 is the largest story (13 SP) — consider splitting if scope allows.
- Parallel work: Backend on ORD-001/ORD-004 while Frontend builds ORD-003 UI + dashboards.
- Email templates should be designed in Sprint 1.4 (design review).

---

### Sprint 1.6: Testing, Polish & Launch

| Field | Value |
|:---|:---|
| **Duration** | 2 weeks (Sep 14 – Sep 25, 2026) |
| **Sprint Goal** | Achieve test coverage targets, optimize performance, conduct security audit, review Arabic content, deploy to staging, and launch v0.1.0 to production. |
| **Capacity** | 24 SP (3 engineers × 2 weeks) |

#### Stories

| ID | Title | SP | Owner | Dependencies |
|:---|:---|:---|:---|:---|
| — | Unit Test Coverage (target ≥ 80%) | 5 | Backend + Frontend | All Phase 1 stories |
| — | Integration Tests (target ≥ 70%) | 3 | Backend | All API stories |
| — | E2E Tests (core flows: register, login, order, track) | 5 | QA + Full-Stack | All Phase 1 stories |
| — | Performance Optimization (Lighthouse ≥ 90) | 3 | Frontend | All WEB stories |
| — | Security Audit (OWASP Top 10, dependency scan, SAST) | 3 | Full-Stack | All Phase 1 stories |
| — | Arabic Content Review & RTL QA | 2 | Frontend + Reviewer | All frontend stories |
| — | Staging Deployment & Smoke Tests | 2 | Full-Stack | All above |
| — | Production Launch v0.1.0 | 1 | Full-Stack | Staging sign-off |

#### Notes

- Testing should NOT start only in this sprint — unit tests are written alongside each story in Sprint 1.1–1.5.
- This sprint focuses on filling coverage gaps, integration tests, and E2E.
- Launch gate requires all validation gates (Section 10) to pass.
- Buffer week (Sep 28 – Oct 2) for post-launch hotfixes.

---

## 8. Dependency Graph

### 8.1 Phase 1 Dependency Map

```
                        ┌─────────────────────────────────────┐
                        │         EPIC-5: Infrastructure       │
                        │  (Monorepo, DB, Docker, CI/CD)       │
                        └──────────────┬──────────────────────┘
                                       │ BLOCKS all below
                                       ▼
              ┌────────────────────────────────────────────────┐
              │            EPIC-1: Authentication              │
              │        (Register, Login, JWT, RBAC)            │
              └────────┬───────────────────┬──────────────────┘
                       │                   │
                       ▼                   ▼
    ┌──────────────────────────┐   ┌──────────────────────────┐
    │ EPIC-2: Public Website   │   │ EPIC-3: CMS              │
    │ (Pages, Layout, SEO)     │◄──│ (Pages CRUD, Media, Blog)│
    └────────────┬─────────────┘   └────────────┬─────────────┘
                 │                              │
                 │   ┌──────────────────────────┘
                 │   │
                 ▼   ▼
    ┌──────────────────────────────────────────┐
    │    EPIC-4: Service Catalog & Orders      │
    │  (Services API, Orders, Workflow, Track) │
    └──────────────────────────────────────────┘
```

### 8.2 Critical Path Through Phase 1

```
INF-001 (Monorepo)
  → INF-004 (Database)
    → AUTH-001 (Register)
      → AUTH-002 (Login)
        → AUTH-005 (RBAC)
          → CMS-001 (Page CRUD)
            → CMS-002 (Rich Text Editor)
              → CMS-004 (Blog)
                → CMS-005 (Menu/SEO)
                  → ORD-002 (Order Submission)
                    → ORD-004 (Order Workflow)
                      → Sprint 1.6 (Testing & Launch)

Critical Path Duration: ~11 weeks
(INF-001 through ORD-004 + Testing)
```

### 8.3 Parallel Work Opportunities

```
Week 1-2:  INF-001 ── INF-004 ── INF-002 (Backend) || INF-003 (Frontend) || INF-006 (CI/CD)
Week 3:    AUTH-001/002 (Backend) || AUTH-001/002 UI (Frontend) || AUTH-005 guard prep
Week 4-5:  WEB-001/002 (Frontend) || AUTH-005 admin API (Backend) || CMS-001 API prep
Week 6-7:  CMS-001/003/002 (Backend + Frontend) || WEB-003/004 (Frontend + Backend)
Week 8-10: ORD-001/002/004 API (Backend) || ORD-002/003/004 UI (Frontend)
Week 11-12: Testing (All engineers) || Performance || Security Audit
```

---

## 9. Build Order

### Phase 1, Sprint 1.1 — Exact Execution Sequence

This is the **exact order** in which tasks must be executed. Each step is justified by its dependency relationship.

#### Week 1 (Days 1–5)

| Step | Task | Owner | Duration | Justification |
|:---|:---|:---|:---|:---|
| **1** | Initialize Git repository with `.gitignore`, root `package.json`, `pnpm-workspace.yaml` | Full-Stack | 0.5d | Must exist before any code is written |
| **2** | Install Turborepo, configure `turbo.json` with pipeline definitions (build, dev, lint, test, typecheck) | Full-Stack | 0.5d | Orchestration layer needed before apps |
| **3** | Create `packages/config` with shared ESLint, Prettier, TypeScript base config | Full-Stack | 0.5d | Linting must be in place before code is written |
| **4** | Create `packages/types` with shared TypeScript interfaces | Full-Stack | 0.5d | Shared types needed by all packages |
| **5** | Create `docker-compose.yml` with PostgreSQL 16, Redis 7, MinIO, Mailhog | Full-Stack | 0.5d | Infrastructure must run before apps connect |
| **6** | Verify `docker compose up -d` starts all services healthy | Full-Stack | 0.25d | Validate infrastructure |
| **7** | Scaffold `apps/api` (NestJS) with `nest new` or manual setup | Backend | 1d | API scaffold must exist before database integration |
| **8** | Scaffold `apps/web` (Next.js 14+ App Router) with TailwindCSS | Frontend | 1d | Frontend scaffold must exist before pages |
| **9** | Create `packages/ui` with shadcn/ui init | Frontend | 0.5d | Shared components needed by web |
| **10** | Configure `packages/database` with Prisma schema (empty initial schema) | Backend | 0.5d | Prisma must be set up before first migration |

#### Week 2 (Days 6–10)

| Step | Task | Owner | Duration | Justification |
|:---|:---|:---|:---|:---|
| **11** | Run `prisma db push` to validate database connection from NestJS | Backend | 0.25d | Verify DB connectivity |
| **12** | Implement `GET /api/health` endpoint returning DB + Redis status | Backend | 0.5d | Health check is the first API endpoint |
| **13** | Configure Swagger (`@nestjs/swagger`) to auto-generate OpenAPI docs at `/api/docs` | Backend | 0.5d | API docs needed from Day 1 |
| **14** | Configure global `ValidationPipe`, exception filter, CORS, Helmet in NestJS | Backend | 1d | Security and validation foundation |
| **15** | Set up Tailwind RTL plugin, Arabic font (Cairo/Tajawal), `dir="rtl"` logic in root layout | Frontend | 1d | RTL is a first-class requirement (NFR-505) |
| **16** | Install and configure shadcn/ui components (Button, Input, Card, etc.) | Frontend | 0.5d | UI primitives must exist before any page |
| **17** | Create GitHub Actions workflow: `ci.yml` (lint, typecheck, test, build on PR) | Full-Stack | 1.5d | CI must gate all future PRs |
| **18** | Create GitHub Actions workflows: `deploy-staging.yml`, `deploy-production.yml` (skeleton with placeholders) | Full-Stack | 1d | Deploy pipelines needed for Sprint 1.6 |
| **19** | Configure Turborepo remote caching with GitHub Actions cache | Full-Stack | 0.5d | Speeds up all future CI runs |
| **20** | Verify full pipeline: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass | All | 0.5d | Sprint 1.1 exit gate |

### Why This Order

1. **Infrastructure before application**: Docker services must run before any app attempts to connect to PostgreSQL or Redis. A failing `docker compose up` blocks everything.

2. **Shared config before app code**: ESLint, Prettier, and TypeScript configs must exist before any source file is written — otherwise code will not conform to standards and must be retroactively fixed.

3. **Database + ORM before API**: The NestJS API cannot implement any endpoint that persists data without Prisma and a running PostgreSQL instance.

4. **Health check before real endpoints**: The health endpoint validates the entire stack (API → DB → Redis) and becomes the first thing CI tests.

5. **Swagger before implementation**: Generating OpenAPI docs from Day 1 ensures all future endpoints are documented as they're built, not as an afterthought.

6. **UI primitives before pages**: shadcn/ui components (Button, Input, Card) are the building blocks for every page. Building pages without them leads to inconsistency.

7. **RTL before any page**: Arabic/RTL is non-negotiable (NFR-505). Setting up RTL early prevents massive CSS refactoring later.

8. **CI/CD before feature work**: CI must block PRs from Sprint 1.2 onward. Without CI, quality gates are manual and unreliable.

---

## 10. Validation Gates

### Per-Sprint Gates

Each sprint must pass ALL gates before being considered complete. The sprint demo/review meeting uses these as the Go/No-Go checklist.

---

#### Sprint 1.1 — Technical Foundation

**Automated Checks:**

| Check | Tool | Threshold | Pass? |
|:---|:---|:---|:---|
| Lint | ESLint | 0 errors, 0 warnings | ☐ |
| Format | Prettier | All files formatted | ☐ |
| TypeScript | `tsc --noEmit` | 0 errors (strict mode) | ☐ |
| API Health | `curl /api/health` | HTTP 200, `{ status: "ok" }` | ☐ |
| Swagger Docs | Browser | `/api/docs` loads with schema | ☐ |
| Frontend Build | `next build` | Builds without errors | ☐ |
| API Build | `nest build` | Builds without errors | ☐ |
| Docker Services | `docker compose ps` | All healthy | ☐ |
| CI Pipeline | GitHub Actions | Green on `develop` branch | ☐ |

**Manual Checks:**

| Check | Reviewer | Criteria |
|:---|:---|:---|
| Code Review | Lead Architect | Monorepo structure follows ADR-012, folder conventions correct |
| RTL Smoke Test | Frontend Lead | Root layout renders with `dir="rtl"`, Arabic font loaded |
| Security Review | Lead Architect | No secrets committed, `.env.example` exists, `.gitignore` covers `.env` |
| Dev Onboarding | New Engineer | Can run `docker compose up && pnpm dev` and see API + Web on first try |

**Go/No-Go Criteria:**

| Criterion | Status |
|:---|:---|
| All automated checks pass | ☐ |
| All manual checks pass | ☐ |
| `pnpm dev` starts all services from scratch on a clean machine | ☐ |
| Sprint backlog fully completed (all stories Done) | ☐ |

---

#### Sprint 1.2 — Authentication

**Automated Checks:**

| Check | Tool | Threshold | Pass? |
|:---|:---|:---|:---|
| Lint + Format + TypeScript | ESLint + Prettier + tsc | 0 errors/warnings | ☐ |
| Unit Tests | Jest/Vitest | ≥ 80% on auth module | ☐ |
| Auth E2E | Playwright | Register + Login + Redirect flows pass | ☐ |
| API Build | `nest build` | No errors | ☐ |
| Frontend Build | `next build` | No errors | ☐ |
| CI Pipeline | GitHub Actions | Green | ☐ |

**Manual Checks:**

| Check | Reviewer | Criteria |
|:---|:---|:---|
| Code Review | Peer (2 reviewers) | All auth code reviewed |
| Security Review | Lead Architect | Password hashing verified, JWT config secure, rate limiting active, no secrets |
| UX Review (Register/Login) | Frontend Lead | Forms accessible, error messages clear (Arabic), keyboard navigable |
| UX Review (Admin Users) | Product Owner | Admin can change roles, UI is intuitive |
| Penetration Test (basic) | QA | SQL injection, XSS, brute force, session fixation — all mitigated |

**Go/No-Go Criteria:**

| Criterion | Status |
|:---|:---|
| All 8 Sprint 1.2 stories completed | ☐ |
| `POST /api/auth/register` → `POST /api/auth/login` → `GET /api/users/me` flow works end-to-end | ☐ |
| RBAC: admin accesses admin routes, customer gets 403 on admin routes | ☐ |
| Rate limiting: 6 rapid login attempts from same IP returns 429 | ☐ |
| Password reset flow: forgot → email → reset → login with new password works | ☐ |
| No plaintext secrets or keys in codebase | ☐ |

---

#### Sprint 1.3 — Public Website

**Automated Checks:**

| Check | Tool | Threshold | Pass? |
|:---|:---|:---|:---|
| Lint + Format + TypeScript | ESLint + Prettier + tsc | 0 errors | ☐ |
| Unit Tests | Jest/Vitest | ≥ 80% on web components | ☐ |
| Lighthouse (Home Page) | Lighthouse CI | Performance ≥ 90, Accessibility ≥ 90, Best Practices ≥ 90, SEO ≥ 90 | ☐ |
| Lighthouse (Mobile) | Lighthouse CI | Performance ≥ 80 (mobile) | ☐ |
| Visual Regression | Playwright/Chromatic | No unexpected changes | ☐ |
| Responsive Checks | Playwright | 320px, 768px, 1024px, 1440px — no layout breakage | ☐ |
| CI Pipeline | GitHub Actions | Green | ☐ |

**Manual Checks:**

| Check | Reviewer | Criteria |
|:---|:---|:---|
| RTL Review | Arabic-speaking reviewer | All pages render correctly in RTL, no LTR-only assumptions |
| Content Review | Product Owner | All Arabic copy correct, no typos, consistent tone |
| UX Review (All Pages) | Frontend Lead | Navigation clear, CTAs prominent, contact form works |
| Cross-Browser | QA | Chrome, Firefox, Safari, Edge (last 2 versions) — no visual issues |
| SEO Review | Marketing/SEO | Meta tags correct, OG images render, sitemap accessible |

**Go/No-Go Criteria:**

| Criterion | Status |
|:---|:---|
| Home, About, Contact, Services pages all render correctly | ☐ |
| Responsive design verified on real mobile device (not just emulator) | ☐ |
| RTL verified on real device | ☐ |
| Contact form sends email to admin | ☐ |
| Lighthouse scores meet thresholds | ☐ |

---

#### Sprint 1.4 — Content Management

**Automated Checks:**

| Check | Tool | Threshold | Pass? |
|:---|:---|:---|:---|
| Lint + Format + TypeScript | Standard | 0 errors | ☐ |
| Unit Tests | Jest | ≥ 80% on CMS module | ☐ |
| Integration Tests | Jest + Supertest | All CMS API endpoints tested | ☐ |
| Build | Turborepo | All packages build | ☐ |
| CI Pipeline | GitHub Actions | Green | ☐ |

**Manual Checks:**

| Check | Reviewer | Criteria |
|:---|:---|:---|
| CMS UX Review | Product Owner | Admin can create page, edit with TipTap, insert image, publish |
| Media Library Review | Frontend Lead | Upload works, thumbnails generated, delete removes from S3 |
| Blog Review | Content Team | Can create post with categories/tags, publish, view on public blog |
| Menu Builder Review | Frontend Lead | Menu changes reflect on public site header/footer |
| SEO Review | Product Owner | Per-page meta fields render in `<head>` |
| Security Review | Lead Architect | File upload restrictions enforced, XSS sanitization tested |

**Go/No-Go Criteria:**

| Criterion | Status |
|:---|:---|
| Admin can create a page, publish it, and see it live on the website | ☐ |
| TipTap editor handles Arabic text, RTL direction, and image insertion | ☐ |
| Uploaded media survives server restart (persisted to S3/MinIO) | ☐ |
| Public blog renders posts with pagination | ☐ |
| No raw HTML injection possible via rich text editor | ☐ |

---

#### Sprint 1.5 — Service Catalog & Orders

**Automated Checks:**

| Check | Tool | Threshold | Pass? |
|:---|:---|:---|:---|
| Lint + Format + TypeScript | Standard | 0 errors | ☐ |
| Unit Tests | Jest | ≥ 80% on orders module | ☐ |
| Integration Tests | Jest + Supertest | Full order lifecycle tested | ☐ |
| E2E Tests | Playwright | Complete order flow: browse → submit → track | ☐ |
| Build | Turborepo | All packages build | ☐ |
| CI Pipeline | GitHub Actions | Green | ☐ |

**Manual Checks:**

| Check | Reviewer | Criteria |
|:---|:---|:---|
| Order Flow UX | Product Owner | Customer can browse services, select one, fill form, upload docs, submit |
| Document Upload Review | Backend Lead | File type/size validation, stored in S3, accessible via URL |
| Order Tracking Review | Product Owner | Customer sees status timeline, receives email on change |
| Workflow Review | Product Owner | Employee can view assigned orders, change status with note |
| Email Review | Product Owner | Confirmation + status change emails received, correctly formatted (Arabic) |
| RBAC Review | Lead Architect | Customer cannot access employee order queue, employee cannot access admin CMS |

**Go/No-Go Criteria:**

| Criterion | Status |
|:---|:---|
| Customer orders a service with documents and receives confirmation email | ☐ |
| Employee assigns order to self, updates status to "in_progress", customer notified | ☐ |
| State machine rejects invalid transitions (e.g., pending → delivered) | ☐ |
| Order reference number is unique and sequential per year | ☐ |
| File uploads fail gracefully on size/type mismatch | ☐ |

---

#### Sprint 1.6 — Testing & Launch

**Automated Checks:**

| Check | Tool | Threshold | Pass? |
|:---|:---|:---|:---|
| Unit Test Coverage | Jest + Istanbul | ≥ 80% overall | ☐ |
| Integration Test Coverage | Jest + Supertest | ≥ 70% overall | ☐ |
| E2E Tests (Core Flows) | Playwright | All passing | ☐ |
| Lighthouse | Lighthouse CI | ≥ 90 all categories | ☐ |
| Dependency Audit | `pnpm audit` / Dependabot | 0 critical/high | ☐ |
| SAST | CodeQL | 0 critical/high | ☐ |
| Performance Test | k6 | p95 < 200ms, 500 req/s sustained | ☐ |
| CI Pipeline | GitHub Actions | Green on all branches | ☐ |

**Manual Checks:**

| Check | Reviewer | Criteria |
|:---|:---|:---|
| Full Regression Test | QA | All Sprint 1.1–1.5 stories retested |
| Security Audit | Lead Architect / External | OWASP Top 10 checked, penetration test passed |
| Arabic Content Review | Native Arabic speaker | All user-facing text reviewed |
| Accessibility Audit | Frontend Lead | WCAG 2.1 AA (keyboard nav, screen reader, contrast) |
| Staging Smoke Test | Product Owner | All critical flows pass on staging environment |
| Launch Readiness Review | All stakeholders | Go/No-Go decision |

**Go/No-Go Criteria for v0.1.0 Launch:**

| Criterion | Status |
|:---|:---|
| All automated gates pass | ☐ |
| All manual review gates pass | ☐ |
| Staging environment matches production configuration | ☐ |
| Rollback plan documented and tested (dry-run) | ☐ |
| SSL certificates configured for production domain | ☐ |
| Database backups configured and verified | ☐ |
| Monitoring/alerting configured (Uptime, error tracking) | ☐ |
| Launch checklist signed by Lead Architect + Product Owner | ☐ |

---

## Appendix A: Story Point Reference

| Scale | Meaning | Typical Story |
|:---|:---|:---|
| 1 SP | Trivial (~2 hours) | Add a single field to a DTO |
| 2 SP | Small (~4 hours) | Implement a simple GET endpoint |
| 3 SP | Medium (~1 day) | Password reset flow (API + UI) |
| 5 SP | Large (~2 days) | Registration flow (API + UI + tests) |
| 8 SP | Very Large (~3–4 days) | RBAC with guards + admin UI + tests |
| 13 SP | Epic-sized (~5+ days) | Order workflow state machine + UI + notifications |

## Appendix B: Team Roles

| Role | Responsibilities |
|:---|:---|
| **Lead Architect** | Architecture decisions, ADRs, code review, security, CI/CD strategy |
| **Backend Engineer** | NestJS API, database, Prisma, Redis, BullMQ, auth, services/orders API |
| **Frontend Engineer** | Next.js, TailwindCSS, shadcn/ui, TipTap, pages, CMS UI, public website |
| **Full-Stack Engineer** | Bridges back and front, owns end-to-end features, CI/CD, Docker, DevOps |
| **QA Engineer** | Test plans, E2E tests (Playwright), manual testing, performance testing |

## Appendix C: Risk Register

| Risk ID | Description | Probability | Impact | Mitigation |
|:---|:---|:---|:---|:---|
| R-001 | TipTap complex customization exceeds Sprint 1.4 capacity | Medium | High | Fallback: use a simpler editor (Quill) for v0.1.0, upgrade to TipTap in v0.2.0 |
| R-002 | Payment gateway integration (Phase 2/3) delayed by provider onboarding | Medium | High | Start provider application process during Phase 1 |
| R-003 | Team size 3 engineers is insufficient for parallel work in Sprint 1.5 | Medium | Medium | Scope negotiation: defer FR-308 (ratings) and FR-407/408 (scheduling/versioning) |
| R-004 | Arabic RTL introduces unexpected layout bugs in complex components | High | Low | Dedicated RTL QA in every sprint; use TailwindCSS `rtl:` variants |
| R-005 | CI/CD caching misses slow down PR feedback loop | Medium | Low | Test Turborepo remote caching on GitHub Actions during Sprint 1.1 |
| R-006 | Third-party service downtime (Vercel, Railway/Render) blocks deployment | Low | High | Document manual deploy procedure as fallback; multi-cloud readiness in Phase 5 |

## Appendix D: Glossary

| Term | Definition |
|:---|:---|
| **ADR** | Architecture Decision Record — documents a significant architectural choice |
| **BullMQ** | Queue system built on Redis for background job processing |
| **C4** | Context, Container, Component, Code — hierarchical diagramming approach |
| **CQRS** | Command Query Responsibility Segregation — separate read/write models |
| **DDD** | Domain-Driven Design — organizing code around business domains |
| **FR** | Functional Requirement — what the system must do |
| **ISR** | Incremental Static Regeneration — Next.js feature for updating static pages |
| **NFR** | Non-Functional Requirement — how the system must be (performance, security, etc.) |
| **P0–P3** | Priority levels: P0 = critical/must-have, P1 = important, P2 = nice-to-have, P3 = future |
| **PI** | Program Increment — a planning interval (typically 8–12 weeks) |
| **RBAC** | Role-Based Access Control — permissions assigned via roles |
| **RPO/RTO** | Recovery Point Objective / Recovery Time Objective |
| **SAST** | Static Application Security Testing |
| **SP** | Story Points — relative effort estimation unit |
| **SSG/SSR** | Static Site Generation / Server-Side Rendering |

---

*This document supersedes `tasks/master-plan.md` and serves as the single source of truth for the AlharisTech implementation roadmap. All team members should reference this plan for sprint planning, dependency resolution, and progress tracking.*
