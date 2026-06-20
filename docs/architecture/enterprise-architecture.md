# AlharisTech Platform — Enterprise Architecture Document

**Version:** 1.0
**Date:** 2026-06-20
**Status:** Accepted
**Owner:** Architecture Team

---

## Table of Contents

1. [Business Architecture](#1-business-architecture)
2. [Domain Architecture](#2-domain-architecture)
3. [Application Architecture](#3-application-architecture)
4. [Data Architecture](#4-data-architecture)
5. [Infrastructure Architecture](#5-infrastructure-architecture)
6. [Security Architecture](#6-security-architecture)
7. [AI Architecture](#7-ai-architecture)

---

## 1. Business Architecture

### 1.1 Vision and Mission

**Vision** (from [docs/vision/README.md](../vision/README.md)):
> AlharisTech Platform shall become an integrated digital system that manages all enterprise operations, expandable into a multi-tenant SaaS platform, a full e-commerce store, and an institutional AI system.

**Mission:**
Empower AlharisTech Foundation to:
- Manage all operations digitally from a single place
- Expand services electronically without technical barriers
- Connect customers, employees, and partners across multiple channels
- Automate processes using artificial intelligence
- Compete digitally via a scalable platform

### 1.2 Strategic Objectives

| ID | Objective | Success Metric | Phase |
|:---|:---|:---|:---|
| O1 | Establish professional digital presence | Public website launch | 1 |
| O2 | Digitize manual service delivery | Electronic order intake live | 1 |
| O3 | Centralize customer management | Unified admin dashboard | 2 |
| O4 | Enable e-commerce | Integrated online store | 3 |
| O5 | Support omni-channel access | Desktop + Mobile apps live | 4 |
| O6 | Enable AI-driven operations | AI Assistant + Automation live | 5 |

### 1.3 Value Streams

| Value Stream | Description | Trigger | Outcomes | Key Metrics |
|:---|:---|:---|:---|:---|
| **Customer Acquisition** | Visitor → Registered Customer | Website visit | Activated account, complete profile | Registration conversion rate, time-to-activate |
| **Service Delivery** | Service Order → Completed Service | Order submission | Delivered service, customer satisfaction rating | Order-to-completion time, CSAT ≥ 4.5/5 |
| **Order Fulfillment** | Product Order → Delivered Product | Checkout completion | Shipped product, delivery confirmation | Fulfillment time, delivery success rate |
| **Support Resolution** | Ticket Opened → Ticket Closed | Ticket creation | Resolved issue, closed ticket | Time-to-resolution < 4h, first-contact resolution rate |
| **Commerce** | Browse → Purchase | Store visit | Completed transaction, revenue recognized | Conversion rate, average order value, revenue |

### 1.4 Business Capabilities Map

Each capability maps to a bounded context domain. Core capabilities are marked **(C)**, supporting **(S)**, and generic **(G)**.

| Domain | Capabilities | Classification |
|:---|:---|:---|
| **Identity** | User registration, authentication (JWT), MFA readiness, session management, RBAC, password reset | Generic (G) |
| **Customer** | Contact management, customer profiles, tagging/segmentation, communication history, import/export, deduplication | Core (C) |
| **Service** | Service catalog, order intake, document upload, order workflow, status tracking, assignment, service ratings | Core (C) |
| **Commerce** | Product catalog, categories, shopping cart, checkout, inventory management, shipping, coupons/discounts, reviews | Core (C) |
| **Support** | Ticket creation, classification/priority, assignment, ticket workflow, knowledge base linking, live chat readiness, SLA tracking | Supporting (S) |
| **Content** | Page management, rich text editor, media library, blog (articles/categories/tags), menu management, SEO metadata, content scheduling, version history | Supporting (S) |
| **Notification** | Email notifications, customizable templates, in-app notifications, SMS readiness, push notification readiness, per-user preferences | Generic (G) |
| **Analytics** | Overview dashboard, sales/revenue reports, employee performance, customer reports, PDF/Excel export, customizable KPIs | Supporting (S) |
| **AI** | Text generation, embeddings, RAG pipeline, support agent, content agent, analytics agent, automation agent, knowledge base ingestion | Core (C) |

### 1.5 Stakeholders

| Stakeholder | Role | Primary Concerns | Engagement Channel |
|:---|:---|:---|:---|
| **Customers** | End users consuming services and products | Browse services, submit orders, track status, make payments, receive support | Web, Mobile, Email, Support Tickets |
| **Employees** | Operational staff processing orders and tickets | Order management, customer communication, content management, support handling | Admin Dashboard, Desktop App |
| **Managers** | Leadership overseeing operations and performance | Dashboards, reports, employee management, KPI tracking | Admin Dashboard |
| **Partners** | External entities integrating via API | API integration, partner reports, shared service management | API, Partner Portal |
| **Developers** | Internal/External developers building on the platform | API documentation, SDK, development environment | API Docs, SDK, GitHub |

### 1.6 Operating Model (Growth Phases)

The platform is delivered across 5 progressive phases, each building on the previous:

| Phase | Name | Duration | Scope | Key Deliverables |
|:---|:---|:---|:---|:---|
| **Phase 0** | Foundation | 2–4 weeks (Jun–Jul 2026) | Documentation, architecture, governance | Vision, PRD, ADRs, C4 diagrams, monorepo skeleton |
| **Phase 1** | Digital Presence | 3–4 months (Jul–Oct 2026) | Public website, CMS, auth, order intake | Next.js website, NestJS API, auth (JWT/RBAC), service catalog, CMS, responsive design |
| **Phase 2** | Internal Management | 4–6 months (Nov 2026–Apr 2027) | Admin dashboard, CRM, invoices, tickets, notifications, analytics | Admin dashboard, CRM, invoicing, support tickets, email notifications, reporting dashboard |
| **Phase 3** | E-Commerce | 4–6 months (May–Oct 2027) | Online store, payments, inventory, shipping | Product catalog, cart/checkout, payment gateway, inventory, shipping, coupons |
| **Phase 4** | Omni-Channel | 6–8 months (Nov 2027–Jun 2028) | Desktop, Android, iOS apps | Electron/Tauri desktop, React Native mobile (Android + iOS), push notifications, offline mode |
| **Phase 5** | Platform as a Service | 8–12 months (Jul 2028–Jul 2029) | SaaS, marketplace, AI, automation | Multi-tenant, marketplace, AI assistant, RAG, automation platform, advanced analytics |

**Total estimated duration:** 2.5–3 years (from Phase 0 to Phase 5 completion).

Reference: [docs/business/README.md](../business/README.md), [docs/roadmap/README.md](../roadmap/README.md)

### 1.7 Core Platform Values

1. **Reliability** — 99.9% uptime, 24/7 availability
2. **Security** — Defense in depth at every layer
3. **Performance** — API response < 200ms (p95), LCP < 2.5s
4. **Scalability** — Horizontal scaling, multi-tenant readiness
5. **Maintainability** — Clean architecture, ≥ 80% test coverage, full documentation

### 1.8 Guiding Principles

| Principle | Implementation |
|:---|:---|
| API First | All functionality exposed through APIs; frontend consumes APIs only |
| Security First | TLS 1.3, AES-256, OWASP Top 10 protection, JWT, RBAC |
| Performance First | Multi-level caching, SSR/SSG, CDN, query optimization |
| Modular First | Domain-driven design, independent modules, replaceable components |
| Mobile Ready | Responsive design, mobile-first CSS, React Native for native apps |
| Cloud Ready | Docker containerization, Kubernetes readiness, infrastructure as code |
| AI Ready | Event-driven architecture, structured data storage, RAG pipeline design |
| Offline Ready | Service workers, local state persistence, offline queues for mobile |

---

## 2. Domain Architecture

### 2.1 Domain-Driven Design Strategy

The platform is organized around 9 bounded contexts following Domain-Driven Design (DDD) principles, as documented in ADR-016. Each domain is an independent NestJS module with its own application, domain, infrastructure, and presentation layers.

Reference: `docs/adr/README.md` — ADR-016 (DDD Adoption)

### 2.2 Subdomain Classification

| Subdomain Type | Definition | Domains |
|:---|:---|:---|
| **Core** | Differentiates the business; built in-house with highest investment | Customer, Service, Commerce, AI |
| **Supporting** | Enables core business but isn't differentiating | Support, Content, Analytics |
| **Generic** | Common capability; could be outsourced but built for control | Identity, Notification |

### 2.3 Bounded Context Registry

#### 2.3.1 Identity Domain

**Purpose:** Authentication, authorization, and user identity management.
**Classification:** Generic (G)

| Element | Details |
|:---|:---|
| **Aggregate Root** | `User` |
| **Key Entities** | `User`, `Role`, `Permission`, `Session`, `RefreshToken`, `MfaDevice`, `ApiKey` |
| **Value Objects** | `Email`, `PasswordHash`, `PhoneNumber`, `AuthToken`, `PermissionSet` |
| **Domain Events** | `UserRegistered`, `UserLoggedIn`, `UserLoggedOut`, `PasswordChanged`, `PasswordResetRequested`, `RoleAssigned`, `RoleRevoked`, `PermissionGranted`, `PermissionRevoked`, `SessionRevoked`, `MfaEnabled`, `MfaDisabled` |
| **Dependencies** | None (foundational domain) |
| **Primary FRs** | FR-101 through FR-109 |

#### 2.3.2 Customer Domain

**Purpose:** Customer relationship management, profiles, and communication tracking.
**Classification:** Core (C)

| Element | Details |
|:---|:---|
| **Aggregate Root** | `Customer` |
| **Key Entities** | `Customer`, `CustomerTag`, `CommunicationLog`, `CustomerNote`, `CustomerSegment` |
| **Value Objects** | `Address`, `ContactInfo`, `CustomerStatus`, `CustomerType` |
| **Domain Events** | `CustomerCreated`, `CustomerUpdated`, `CustomerTagged`, `CustomerMerged`, `CustomerImported`, `CommunicationLogged` |
| **Dependencies** | Identity (owns `userId` → `Customer`) |
| **Primary FRs** | FR-201 through FR-208 |

#### 2.3.3 Service Domain

**Purpose:** Service catalog, order intake, workflow, and delivery tracking.
**Classification:** Core (C)

| Element | Details |
|:---|:---|
| **Aggregate Roots** | `Service`, `Order` |
| **Key Entities** | `Service`, `ServiceCategory`, `Order`, `OrderDocument`, `OrderAssignment`, `OrderStatusHistory` |
| **Value Objects** | `ServiceFee`, `OrderStatus`, `DocumentType`, `Rating` |
| **Domain Events** | `ServicePublished`, `ServiceUpdated`, `OrderSubmitted`, `OrderAssigned`, `OrderStatusChanged`, `DocumentUploaded`, `ServiceRated` |
| **Dependencies** | Identity (customer reference), Customer, Notification (status changes), Commerce (payment link) |
| **Primary FRs** | FR-301 through FR-308 |

#### 2.3.4 Commerce Domain

**Purpose:** E-commerce — products, cart, checkout, inventory, shipping.
**Classification:** Core (C)

| Element | Details |
|:---|:---|
| **Aggregate Roots** | `Product`, `Cart`, `Order` (CommerceOrder) |
| **Key Entities** | `Product`, `ProductCategory`, `ProductVariant`, `Cart`, `CartItem`, `CommerceOrder`, `OrderLineItem`, `Inventory`, `Shipment`, `Coupon`, `ProductReview` |
| **Value Objects** | `Money`, `Quantity`, `ShippingAddress`, `Discount`, `Sku` |
| **Domain Events** | `ProductListed`, `InventoryUpdated`, `ItemAddedToCart`, `OrderPlaced`, `PaymentReceived`, `OrderShipped`, `OrderDelivered`, `ReviewSubmitted` |
| **Dependencies** | Identity, Customer, Notification |
| **Primary FRs** | FR-701 through FR-710 |

#### 2.3.5 Support Domain

**Purpose:** Help desk ticketing, knowledge base linking, and support workflow.
**Classification:** Supporting (S)

| Element | Details |
|:---|:---|
| **Aggregate Root** | `Ticket` |
| **Key Entities** | `Ticket`, `TicketReply`, `TicketAttachment`, `KnowledgeArticle`, `SlaPolicy`, `LiveChatSession` (Phase 5) |
| **Value Objects** | `TicketPriority`, `TicketStatus`, `TicketCategory`, `SlaTarget` |
| **Domain Events** | `TicketOpened`, `TicketAssigned`, `TicketReplied`, `TicketResolved`, `TicketClosed`, `SlaBreached`, `KnowledgeArticlePublished` |
| **Dependencies** | Identity, Customer, Service (linked orders) |
| **Primary FRs** | FR-601 through FR-608 |

#### 2.3.6 Content Domain

**Purpose:** CMS — pages, blog, media, menus, SEO metadata.
**Classification:** Supporting (S)

| Element | Details |
|:---|:---|
| **Aggregate Roots** | `Page`, `Media`, `BlogPost` |
| **Key Entities** | `Page`, `Media`, `BlogPost`, `BlogCategory`, `BlogTag`, `Menu`, `MenuItem`, `PageRevision` |
| **Value Objects** | `SeoMetadata`, `Slug`, `PageStatus`, `MediaVariant` |
| **Domain Events** | `PageCreated`, `PagePublished`, `PageArchived`, `MediaUploaded`, `BlogPostPublished`, `ContentScheduled` |
| **Dependencies** | Identity (author reference) |
| **Primary FRs** | FR-401 through FR-408 |

#### 2.3.7 Notification Domain

**Purpose:** Multi-channel notification dispatch, templates, and user preferences.
**Classification:** Generic (G)

| Element | Details |
|:---|:---|
| **Aggregate Root** | `Notification` |
| **Key Entities** | `Notification`, `NotificationTemplate`, `NotificationPreference`, `DeliveryLog` |
| **Value Objects** | `NotificationChannel` (Email/SMS/Push/InApp), `DeliveryStatus`, `TemplateVariable` |
| **Domain Events** | `NotificationDispatched`, `NotificationDelivered`, `NotificationFailed`, `NotificationBounced` |
| **Dependencies** | Identity (user preferences) |
| **Primary FRs** | FR-801 through FR-806 |

#### 2.3.8 Analytics Domain

**Purpose:** Reporting, dashboards, KPIs, and data export.
**Classification:** Supporting (S)

| Element | Details |
|:---|:---|
| **Aggregate Root** | `Report` |
| **Key Entities** | `Report`, `Dashboard`, `DashboardWidget`, `Kpi`, `ExportJob` |
| **Value Objects** | `DateRange`, `ReportType`, `KpiValue`, `ExportFormat` |
| **Domain Events** | `ReportGenerated`, `ExportCompleted`, `KpiThresholdBreached` |
| **Dependencies** | All other domains (reads aggregates for reporting) |
| **Primary FRs** | FR-901 through FR-906 |

#### 2.3.9 AI Domain

**Purpose:** AI-powered features — agents, RAG, embeddings, automation.
**Classification:** Core (C)

| Element | Details |
|:---|:---|
| **Aggregate Roots** | `Agent`, `KnowledgeBase`, `Prompt` |
| **Key Entities** | `Agent`, `KnowledgeBase`, `Document`, `Embedding`, `Prompt`, `PromptVersion`, `AiInteraction`, `AutomationRule` |
| **Value Objects** | `ModelConfig`, `TokenCount`, `EmbeddingVector`, `PromptVariable` |
| **Domain Events** | `DocumentIngested`, `EmbeddingGenerated`, `AgentInvoked`, `InteractionCompleted`, `AutomationTriggered`, `ContentModerated` |
| **Dependencies** | All domains (consumes events, provides intelligence) |
| **Primary FRs** | AI Platform (Phase 5) |

### 2.4 Domain Relationship Map

```
                        ┌──────────┐
                        │ Identity │  ← Foundational (all domains depend on it)
                        └────┬─────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────┴─────┐        ┌────┴─────┐        ┌────┴──────┐
   │ Customer │◄───────│ Service  │───────►│ Commerce  │
   └────┬─────┘        └────┬─────┘        └────┬──────┘
        │                   │                   │
        │              ┌────┴─────┐             │
        │              │ Support  │             │
        │              └──────────┘             │
        │                                       │
   ┌────┴─────┐                              ┌──┴──────────┐
   │ Content  │                              │ Notification │ ◄── All domains publish to it
   └──────────┘                              └──────┬───────┘
                                                    │
   ┌──────────┐                              ┌──────┴───────┐
   │   AI     │◄─────────────────────────────│  Analytics   │
   └──────────┘                              └──────────────┘
        │
        └── Consumes events from all domains (Phase 5)
```

**Dependency Rules:**
1. Identity is foundational — all domains reference `User` via `userId`.
2. Domains communicate via domain events (Phase 5: event bus). Phase 1–4: synchronous API calls with circuit breaker pattern.
3. No circular dependencies between domains.
4. Analytics is read-only across all domains (reporting database via read replicas).
5. Notification is a shared kernel consumed by all operational domains.
6. AI domain consumes events from all domains and provides intelligence back via API.

### 2.5 Domain Module Structure

Each domain follows the hexagonal architecture pattern documented in [docs/architecture/README.md](../architecture/README.md):

```
domains/{domain}/
├── application/
│   ├── commands/          # CQRS command objects
│   ├── queries/           # CQRS query objects
│   ├── handlers/          # Command/Query handlers
│   └── services/          # Application services (use cases)
├── domain/
│   ├── entities/          # Domain entities
│   ├── value-objects/     # Value objects
│   ├── repositories/      # Repository interfaces (ports)
│   └── events/            # Domain events
├── infrastructure/
│   ├── persistence/       # Repository implementations (adapters)
│   ├── messaging/         # Event bus adapters
│   └── external/          # External service adapters
└── presentation/
    ├── controllers/       # REST controllers
    ├── resolvers/         # GraphQL resolvers
    └── dtos/              # Data transfer objects (validation)
```

---

## 3. Application Architecture

### 3.1 Frontend Architecture

#### 3.1.1 Technology Stack

| Layer | Technology | Justification | ADR |
|:---|:---|:---|:---|
| Framework | Next.js 15 (App Router) | SSR, SSG, SEO, Server Components, file-based routing | ADR-001 |
| Language | TypeScript 5.x | Type safety across the stack | ADR-005 |
| Styling | TailwindCSS + shadcn/ui | Utility-first, design system, RTL support | ADR-013 |
| State Management | TanStack Query (server state) + Zustand (client state) | Declarative data fetching, lightweight stores | ADR-001 |
| Forms | React Hook Form + Zod | Performant forms, schema validation, type inference | ADR-001 |
| Testing | Vitest + Playwright | Unit/integration + E2E | ADR-001 |

#### 3.1.2 Application Shells

| Application | Directory | Purpose | Render Strategy |
|:---|:---|:---|:---|
| Public Website | `apps/web/` | Landing, services, blog, contact | SSR (ISR for content pages) |
| Admin Dashboard | `apps/admin/` | Operational dashboard for employees/managers | SPA with CSR (behind auth) |
| Desktop App | `apps/desktop/` | Electron/Tauri wrapper for admin | Hybrid (web views + native APIs) |
| Mobile App | `apps/mobile/` | React Native for Android/iOS | Native with API communication |

#### 3.1.3 Routing Strategy

| Route Pattern | Type | Auth Required | Render Mode |
|:---|:---|:---|:---|
| `/` | Public | No | SSR (ISR, revalidate: 3600s) |
| `/services/*` | Public | No | SSG + CSR for dynamic filters |
| `/blog/*` | Public | No | ISR (revalidate: 3600s) |
| `/store/*` | Public | No | SSR (ISR for product pages) |
| `/login`, `/register` | Public | No | SSR |
| `/dashboard/*` | Protected | Yes (all roles) | CSR |
| `/admin/*` | Protected | Yes (Admin, Manager) | CSR |
| `/api/*` | API | Varies | API Route handlers |

#### 3.1.4 State Management Strategy

| State Category | Tool | Scope | Persistence |
|:---|:---|:---|:---|
| Server Data | TanStack Query | App-wide | In-memory cache + stale-while-revalidate |
| Auth State | Zustand (auth store) | App-wide | localStorage (access token), httpOnly cookie (refresh token) |
| UI State | Zustand (ui store) | Per-page / global | Session-only (theme, sidebar, locale) |
| Form State | React Hook Form | Per-form | Ephemeral |
| URL State | Next.js `useSearchParams` | Per-route | URL query parameters |
| Cart State | Zustand (cart store) | App-wide | localStorage (guest) / DB (authenticated) |

#### 3.1.5 Shared Packages

| Package | Contents | Consumers |
|:---|:---|:---|
| `@alharistech/ui` | shadcn/ui components, design tokens, layouts | web, admin |
| `@alharistech/auth` | Auth hooks, JWT handling, permission guards | web, admin, mobile |
| `@alharistech/types` | Shared TypeScript interfaces and types | All packages |
| `@alharistech/sdk` | JavaScript SDK for third-party integrations | External partners |
| `@alharistech/utils` | Date formatting, i18n helpers, validation schemas | All packages |
| `@alharistech/config` | ESLint, Prettier, Tailwind, TypeScript config | All packages |

### 3.2 Backend Architecture

#### 3.2.1 Technology Stack

| Layer | Technology | Justification | ADR |
|:---|:---|:---|:---|
| Runtime | Node.js 22 LTS | JavaScript ecosystem, isomorphic code sharing | ADR-002 |
| Framework | NestJS 11 | Enterprise patterns, DI, OpenAPI, modular | ADR-002 |
| Language | TypeScript 5.x | Type safety end-to-end | ADR-005 |
| API Documentation | OpenAPI/Swagger (auto-generated) | API First design | ADR-015 |
| Queue System | BullMQ (backed by Redis) | Job processing, retry logic, scheduling | ADR-009 |
| Validation | class-validator + class-transformer | DTO validation pipeline | ADR-002 |
| ORM | Prisma / Drizzle ORM | Type-safe database access, migrations | ADR-003 |

#### 3.2.2 NestJS Module Architecture

```
apps/api/src/
├── app.module.ts                 # Root module
├── common/                       # Shared cross-cutting
│   ├── decorators/               # @CurrentUser, @Permissions, @Public
│   ├── filters/                  # Global exception filter
│   ├── guards/                   # AuthGuard, RolesGuard, PermissionsGuard
│   ├── interceptors/             # LoggingInterceptor, TransformInterceptor
│   ├── middleware/                # CorrelationId, RequestLogging
│   └── pipes/                    # ValidationPipe, ParseObjectIdPipe
├── config/                       # Configuration module (env vars)
├── domains/                      # Domain modules (9 bounded contexts)
│   ├── identity/
│   ├── customer/
│   ├── service/
│   ├── commerce/
│   ├── support/
│   ├── content/
│   ├── notification/
│   ├── analytics/
│   └── ai/
└── infrastructure/               # Infrastructure modules
    ├── database/                 # Database connection, migrations
    ├── cache/                    # Redis cache module
    ├── storage/                  # S3/MinIO storage module
    ├── queue/                    # BullMQ queue setup
    └── event-bus/                # Event bus (Phase 2+)
```

#### 3.2.3 CQRS Readiness

The platform is designed for future CQRS separation (Phase 3+):

| Concern | Phase 1–2 (Current) | Phase 3+ (CQRS) |
|:---|:---|:---|
| Write Model | Same DB, ORM entities | Dedicated write DB, event sourcing |
| Read Model | Same DB, ORM queries | Read-optimized DB, materialized views |
| Synchronization | N/A | Domain events project to read models |
| Pattern | Traditional CRUD | CQRS with eventual consistency |

**Current scaffolding:**
- All domains use `commands/` and `queries/` directories (prepared for split).
- Application services encapsulate use cases explicitly.
- Read operations use dedicated query objects (not entities).

#### 3.2.4 Hexagonal Architecture (Ports & Adapters)

Each domain module implements the hexagonal pattern:

| Layer | Responsibility | Pattern |
|:---|:---|:---|
| **Domain** (Core) | Entities, value objects, domain events, repository interfaces (ports) | No framework dependency |
| **Application** | Use cases, command/query handlers, DTOs | Orchestrates domain objects |
| **Infrastructure** (Adapters) | Repository implementations (Prisma), event bus (BullMQ), external APIs | Implements ports |
| **Presentation** | REST controllers, GraphQL resolvers, WebSocket gateways | Drives application layer |

**Dependency direction:** Presentation → Application → Domain ← Infrastructure

### 3.3 API Architecture

#### 3.3.1 API Strategy

| Aspect | Decision | ADR |
|:---|:---|:---|
| Primary Protocol | REST (OpenAPI 3.1) + GraphQL for complex queries | ADR-008, ADR-014 |
| API Gateway | NestJS monolith (Phase 1–4) → dedicated gateway (Phase 5) | ADR-002 |
| Documentation | OpenAPI/Swagger auto-generated from decorators | ADR-015 |
| Webhooks | Outbound HTTP callbacks with retry and signing | — |
| Real-time | WebSockets (Socket.io) for notifications, live chat | — |

#### 3.3.2 API Versioning Strategy

| Versioning Method | Usage |
|:---|:---|
| **URL Path** | `/api/v1/...`, `/api/v2/...` |
| **Deprecation** | `Sunset` header with deprecation date; maintain N-1 versions for 6 months |
| **GraphQL** | Schema evolution (additive changes only); deprecated fields annotated with `@deprecated` |
| **Breaking Changes** | New major version; old version sunset after 6-month migration window |

#### 3.3.3 Rate Limiting

| Tier | Rate Limit | Window | Scope |
|:---|:---|:---|:---|
| Anonymous | 60 requests | 1 minute | Per IP |
| Authenticated (Customer) | 300 requests | 1 minute | Per user |
| Authenticated (Employee) | 1,000 requests | 1 minute | Per user |
| Partner API | Configurable | 1 minute | Per API key |
| Admin | 5,000 requests | 1 minute | Per user |

Implementation: Redis-backed sliding window rate limiter via `@nestjs/throttler`.

#### 3.3.4 Pagination Standard

| Style | Use Case | Example |
|:---|:---|:---|
| **Offset-based** | Admin lists with page navigation | `?page=1&limit=20` |
| **Cursor-based** | Infinite scroll, real-time feeds | `?cursor=abc123&limit=20` |
| **Response Envelope** | All endpoints | `{ data: [...], meta: { total, page, limit, cursor } }` |

#### 3.3.5 API Endpoint Inventory (Domain Summary)

| Domain | Endpoint Count (Phase 1) | Endpoint Count (Full) | Auth Required |
|:---|:---|:---|:---|
| Identity | 8 | 14 | Mixed |
| Customer | 4 | 12 | Yes |
| Service | 6 | 14 | Mixed |
| Commerce | 0 | 18 | Mixed |
| Support | 0 | 12 | Yes |
| Content | 8 | 16 | Mixed (admin for write) |
| Notification | 2 | 8 | Yes |
| Analytics | 2 | 10 | Yes |
| AI | 0 | 10 | Yes |
| **Total** | **30** | **114** | — |

### 3.4 Integration Architecture

#### 3.4.1 Integration Patterns

| Pattern | Use Case | Implementation |
|:---|:---|:---|
| **Synchronous REST** | Inter-domain commands, data retrieval | NestJS HTTP module with circuit breaker |
| **Asynchronous Events** | Cross-domain notifications, eventual consistency | BullMQ event bus (Phase 2+) |
| **Webhooks** | Outbound notifications to partners | HTTP POST + HMAC signature + retry (exponential backoff, max 5 retries) |
| **File Exchange** | Bulk data import/export | S3 presigned URLs + CSV/Excel processing |
| **Scheduled Jobs** | Reports, cleanup, billing runs | BullMQ repeatable jobs via cron expressions |

#### 3.4.2 Event Bus Strategy

| Aspect | Phase 1–2 | Phase 3+ |
|:---|:---|:---|
| Transport | Direct service calls | Redis Pub/Sub → RabbitMQ / Kafka |
| Delivery | Synchronous | At-least-once with idempotency keys |
| Schema | TypeScript interfaces | JSON Schema / Protobuf |
| Dead Letter | N/A | Dead letter queue with replay capability |

#### 3.4.3 External Integrations

| Integration | Provider Strategy | Phase |
|:---|:---|:---|
| Email Delivery | SMTP (Phase 1) → SendGrid/Resend (Phase 2) | 1 |
| SMS | Twilio / local provider | 2 |
| Payment Gateway | Single provider (Phase 3) → Multi-provider (Phase 5) | 3 |
| Shipping | Local carriers via API | 3 |
| Maps/Geocoding | Google Maps / OpenStreetMap | 3 |
| AI/LLM | OpenAI (primary), Anthropic (fallback), local model (future) | 5 |
| Social Login | Google, Apple, GitHub OAuth | 3 |

### 3.5 Authentication Architecture

#### 3.5.1 JWT Flow

```
Client                          Server                          Redis/DB
  │                                │                                │
  │  POST /auth/login              │                                │
  │  {email, password}             │                                │
  │ ──────────────────────────────►│                                │
  │                                │  Validate credentials           │
  │                                │ ───────────────────────────────►│
  │                                │  Generate Access Token (15min)  │
  │                                │  Generate Refresh Token (7d)    │
  │                                │  Store hashed RT in DB          │
  │                                │ ───────────────────────────────►│
  │  {accessToken, refreshToken}   │                                │
  │ ◄──────────────────────────────│                                │
  │                                │                                │
  │  GET /api/v1/me                │                                │
  │  Authorization: Bearer AT      │                                │
  │ ──────────────────────────────►│                                │
  │                                │  Verify JWT signature           │
  │                                │  Extract user from payload      │
  │  200 {user}                    │                                │
  │ ◄──────────────────────────────│                                │
  │                                │                                │
  │  [Access Token expires]        │                                │
  │  POST /auth/refresh            │                                │
  │  {refreshToken}                │                                │
  │ ──────────────────────────────►│                                │
  │                                │  Validate RT + rotation         │
  │                                │ ───────────────────────────────►│
  │  {newAT, newRT}                │                                │
  │ ◄──────────────────────────────│                                │
```

#### 3.5.2 Token Configuration

| Parameter | Value | Rationale |
|:---|:---|:---|
| Access Token Algorithm | RS256 (asymmetric) | Public key can be shared; private key stays on auth server |
| Access Token TTL | 15 minutes | Limit blast radius of stolen tokens |
| Refresh Token TTL | 7 days | Balance security with UX |
| Refresh Token Rotation | Enabled | Each refresh invalidates old refresh token |
| Refresh Token Reuse Detection | Enabled | Detects stolen refresh tokens; revokes all sessions |
| Token Storage (Client) | Access: memory; Refresh: httpOnly secure cookie | XSS + CSRF protection |
| Token Blacklisting | Redis set with TTL = remaining token lifetime | Immediate logout support |

Reference: ADR-007 (JWT with Refresh Tokens)

#### 3.5.3 Session Management

| Feature | Implementation |
|:---|:---|
| Multi-device sessions | Each device gets unique refresh token; stored in `sessions` table |
| Session list | User can view and revoke individual sessions |
| Force logout | Admin can revoke all sessions for a user |
| Idle timeout | 30 minutes → automatic logout on frontend; configurable per role |
| Absolute timeout | 8 hours → force re-authentication for sensitive roles |

### 3.6 Authorization Architecture

#### 3.6.1 RBAC Model

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│   User   │────►│     Role     │────►│  Permission   │
└──────────┘     └──────────────┘     └──────────────┘
                         │
                    ┌────┴────┐
                    │  Admin  │
                    │ Manager │
                    │Employee │
                    │Customer │
                    │ Partner │
                    └─────────┘
```

| Role | Scope | Description |
|:---|:---|:---|
| **Admin** | Tenant-wide | Full platform access, user/role management, system configuration |
| **Manager** | Domain-wide | Team management, reporting, content approval, financial oversight |
| **Employee** | Assigned records | Order processing, ticket handling, customer communication |
| **Customer** | Own records | Self-service: orders, tickets, profile, payments |
| **Partner** | API-only | Programmatic access via API keys with scoped permissions |

#### 3.6.2 Granular Permissions

Permissions follow the pattern: `{domain}:{resource}:{action}`

| Domain | Sample Permissions |
|:---|:---|
| **Identity** | `identity:user:create`, `identity:user:read`, `identity:user:update`, `identity:user:delete`, `identity:role:manage` |
| **Customer** | `customer:profile:read`, `customer:profile:update`, `customer:communication:send`, `customer:tag:manage`, `customer:import`, `customer:export` |
| **Service** | `service:catalog:manage`, `service:order:create`, `service:order:read`, `service:order:assign`, `service:order:process`, `service:order:close` |
| **Commerce** | `commerce:product:manage`, `commerce:order:read`, `commerce:order:fulfill`, `commerce:inventory:manage`, `commerce:discount:manage` |
| **Support** | `support:ticket:create`, `support:ticket:read`, `support:ticket:assign`, `support:ticket:resolve`, `support:knowledge:manage` |
| **Content** | `content:page:manage`, `content:blog:write`, `content:blog:publish`, `content:media:manage`, `content:menu:manage` |
| **Notification** | `notification:template:manage`, `notification:send`, `notification:preferences:manage` |
| **Analytics** | `analytics:dashboard:view`, `analytics:report:generate`, `analytics:report:export`, `analytics:kpi:configure` |
| **AI** | `ai:agent:invoke`, `ai:knowledge:manage`, `ai:prompt:manage`, `ai:automation:manage` |

#### 3.6.3 Resource-Level Authorization

For operations on specific resources (e.g., "Employee can only view tickets assigned to them"):

| Mechanism | Usage |
|:---|:---|
| **Ownership check** | `customerId` match on orders/tickets |
| **Assignment check** | `assignedToId` match for employee tasks |
| **Tenant scoping** | `tenantId` filter on all queries (Phase 5: multi-tenant) |
| **Custom policy** | NestJS guard with policy function: `@CheckPolicies((ability) => ability.can('read', ticket))` |

### 3.7 Event Architecture

#### 3.7.1 Domain Events

Domain events are facts that have occurred within a domain. They are raised by aggregates and handled internally within the same bounded context (Phase 1–2) or published to the event bus (Phase 3+).

**Event Envelope:**

```typescript
interface DomainEvent {
  eventId: string;          // UUID v7
  eventType: string;         // e.g., 'OrderSubmitted'
  aggregateId: string;       // Aggregate root ID
  aggregateType: string;     // e.g., 'Order'
  domain: string;            // e.g., 'Service'
  occurredAt: Date;          // Event timestamp
  correlationId: string;     // Cross-service correlation
  causationId: string;       // Previous event that caused this
  payload: Record<string, unknown>;
  version: number;           // Event schema version
}
```

#### 3.7.2 Integration Events

Integration events cross bounded context boundaries. Selected events from domain events become integration events.

| Domain Event | Integration Event | Consumers |
|:---|:---|:---|
| `OrderSubmitted` | `OrderCreated` | Notification (send confirmation), Analytics (update metrics) |
| `OrderStatusChanged` | `OrderUpdated` | Notification (status alert), Customer (update history) |
| `TicketOpened` | `TicketCreated` | Notification (assignee alert), Analytics |
| `PaymentReceived` | `PaymentCompleted` | Notification (receipt), Commerce (update order), Analytics |
| `UserRegistered` | `UserSignedUp` | Notification (welcome email), Customer (create profile) |
| `ServiceRated` | `FeedbackReceived` | Analytics (CSAT tracking) |

#### 3.7.3 Event Sourcing Readiness

The current architecture is designed for future event sourcing adoption (Phase 3+):

- Domain events are explicitly modeled (not CRUD afterthoughts).
- Aggregates have `version` fields for optimistic concurrency.
- Event store schema is designed but not implemented until needed.
- Command handlers are separated from query handlers (CQRS readiness).

### 3.8 Workflow Architecture

#### 3.8.1 Order Processing Workflow

```
OrderSubmitted → [Document Verification] → Assigned → InProgress → Completed → Closed
                      │                                        │
                      └── RequireMoreDocuments ←───────────────┘
                      │
                      └── Cancelled (customer/employee initiated)
```

| State | Actor | Actions |
|:---|:---|:---|
| `SUBMITTED` | Customer | Submit order with documents |
| `AWAITING_DOCUMENTS` | Employee | Request additional documents |
| `VERIFIED` | Employee | Approve documents, assign to processor |
| `IN_PROGRESS` | Employee | Process the service |
| `COMPLETED` | Employee | Mark service as delivered |
| `CLOSED` | System/Employee | Auto-close after rating period |
| `CANCELLED` | Customer/Employee | Cancel before completion |

#### 3.8.2 Support Ticket Lifecycle

```
TicketOpened → [Triaged] → Assigned → InProgress → Resolved → Closed
                                        │              │
                                        └── Reopened ←─┘
```

| State | Actor | SLA Target |
|:---|:---|:---|
| `OPEN` | Customer | — |
| `TRIAGED` | Employee/System | < 30 min |
| `ASSIGNED` | Manager/System | < 1 hour |
| `IN_PROGRESS` | Employee | — |
| `RESOLVED` | Employee | < 4 hours total |
| `CLOSED` | Customer/System | < 24 hours after resolution |
| `REOPENED` | Customer | Reset SLA clock |

#### 3.8.3 Approval Flows

| Flow | Trigger | Approver | Escalation |
|:---|:---|:---|:---|
| Content Publishing | Author submits | Content Manager | Auto-escalate after 24h |
| Discount Approval | Employee creates | Manager | Auto-escalate after 4h |
| Refund Request | Customer/Employee | Manager | Auto-escalate after 2h |
| Role Change | Admin initiates | Second Admin | Second approver required (two-person rule) |

Implementation: BullMQ job per approval request with timeout-based escalation.

---

## 4. Data Architecture

### 4.1 Canonical Data Models

#### 4.1.1 User

| Field | Type | Constraints | Notes |
|:---|:---|:---|:---|
| `id` | UUID v7 | PK | Primary identifier |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL, indexed | Lowercase, trimmed |
| `password_hash` | VARCHAR(255) | NOT NULL | bcrypt, cost factor 12 |
| `full_name` | VARCHAR(255) | NOT NULL | Arabic + English supported |
| `phone` | VARCHAR(30) | NULLABLE, indexed | E.164 format |
| `avatar_url` | VARCHAR(2048) | NULLABLE | S3 key reference |
| `email_verified_at` | TIMESTAMPTZ | NULLABLE | |
| `phone_verified_at` | TIMESTAMPTZ | NULLABLE | |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT true | Soft disable |
| `is_locked` | BOOLEAN | NOT NULL, DEFAULT false | Account lockout |
| `failed_login_attempts` | INTEGER | NOT NULL, DEFAULT 0 | Reset on successful login |
| `locked_until` | TIMESTAMPTZ | NULLABLE | Automatic unlock time |
| `last_login_at` | TIMESTAMPTZ | NULLABLE | |
| `locale` | VARCHAR(10) | NOT NULL, DEFAULT 'ar' | ar-EG, en-US |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Auto-updated via trigger |
| `deleted_at` | TIMESTAMPTZ | NULLABLE | Soft delete |

**Indexes:** `idx_users_email`, `idx_users_phone`, `idx_users_is_active`, `idx_users_created_at`

#### 4.1.2 Customer

| Field | Type | Constraints | Notes |
|:---|:---|:---|:---|
| `id` | UUID v7 | PK | |
| `user_id` | UUID | FK → users(id), UNIQUE | One user = one customer profile |
| `first_name` | VARCHAR(100) | NOT NULL | |
| `last_name` | VARCHAR(100) | NOT NULL | |
| `company_name` | VARCHAR(255) | NULLABLE | For B2B customers |
| `type` | VARCHAR(20) | NOT NULL, DEFAULT 'individual' | individual, company, government |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'active' | active, inactive, blocked, vip |
| `source` | VARCHAR(50) | NULLABLE | How customer was acquired |
| `national_id` | VARCHAR(50) | NULLABLE | Encrypted at rest |
| `tax_id` | VARCHAR(50) | NULLABLE | VAT registration |
| `address_line1` | VARCHAR(255) | NULLABLE | |
| `address_line2` | VARCHAR(255) | NULLABLE | |
| `city` | VARCHAR(100) | NULLABLE | |
| `state_province` | VARCHAR(100) | NULLABLE | |
| `postal_code` | VARCHAR(20) | NULLABLE | |
| `country` | VARCHAR(2) | NULLABLE | ISO 3166-1 alpha-2 |
| `notes` | TEXT | NULLABLE | Internal notes |
| `total_orders` | INTEGER | NOT NULL, DEFAULT 0 | Denormalized counter |
| `total_spent` | DECIMAL(12,2) | NOT NULL, DEFAULT 0 | Denormalized counter |
| `lifetime_value` | DECIMAL(12,2) | NOT NULL, DEFAULT 0 | Calculated field |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| `deleted_at` | TIMESTAMPTZ | NULLABLE | Soft delete (GDPR right to erasure) |

**Indexes:** `idx_customers_user_id`, `idx_customers_type`, `idx_customers_status`, `idx_customers_created_at`, `idx_customers_city`, `idx_customers_country`

#### 4.1.3 Order (Service Order)

| Field | Type | Constraints | Notes |
|:---|:---|:---|:---|
| `id` | UUID v7 | PK | |
| `order_number` | VARCHAR(20) | UNIQUE, NOT NULL | Human-readable: ORD-{YYYY}{MM}-{SEQ} |
| `customer_id` | UUID | FK → customers(id), NOT NULL | |
| `service_id` | UUID | FK → services(id), NOT NULL | |
| `status` | VARCHAR(30) | NOT NULL, DEFAULT 'submitted' | submitted, awaiting_documents, verified, in_progress, completed, closed, cancelled |
| `priority` | VARCHAR(10) | NOT NULL, DEFAULT 'normal' | low, normal, high, urgent |
| `submitted_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| `assigned_to` | UUID | FK → users(id), NULLABLE | Employee assigned |
| `assigned_at` | TIMESTAMPTZ | NULLABLE | |
| `completed_at` | TIMESTAMPTZ | NULLABLE | |
| `closed_at` | TIMESTAMPTZ | NULLABLE | |
| `cancelled_at` | TIMESTAMPTZ | NULLABLE | |
| `cancellation_reason` | TEXT | NULLABLE | |
| `customer_notes` | TEXT | NULLABLE | Notes from customer |
| `internal_notes` | TEXT | NULLABLE | Notes from employees |
| `amount` | DECIMAL(12,2) | NOT NULL | Order amount |
| `currency` | VARCHAR(3) | NOT NULL, DEFAULT 'SAR' | ISO 4217 |
| `payment_status` | VARCHAR(20) | NOT NULL, DEFAULT 'pending' | pending, paid, refunded, partially_refunded |
| `rating` | SMALLINT | NULLABLE, CHECK (1-5) | Customer rating |
| `rating_comment` | TEXT | NULLABLE | |
| `version` | INTEGER | NOT NULL, DEFAULT 1 | Optimistic concurrency |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**Indexes:** `idx_orders_order_number`, `idx_orders_customer_id`, `idx_orders_status`, `idx_orders_assigned_to`, `idx_orders_submitted_at`, `idx_orders_payment_status`

#### 4.1.4 Product

| Field | Type | Constraints | Notes |
|:---|:---|:---|:---|
| `id` | UUID v7 | PK | |
| `sku` | VARCHAR(50) | UNIQUE, NOT NULL | Stock keeping unit |
| `name` | VARCHAR(255) | NOT NULL | Arabic + English |
| `slug` | VARCHAR(255) | UNIQUE, NOT NULL | URL-friendly |
| `description` | TEXT | NULLABLE | Rich text |
| `short_description` | VARCHAR(500) | NULLABLE | For listings |
| `category_id` | UUID | FK → product_categories(id) | |
| `type` | VARCHAR(20) | NOT NULL | physical, digital, service |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'draft' | draft, published, archived |
| `price` | DECIMAL(12,2) | NOT NULL | Base price |
| `compare_at_price` | DECIMAL(12,2) | NULLABLE | Original price for discounts |
| `cost_price` | DECIMAL(12,2) | NULLABLE | Internal cost tracking |
| `taxable` | BOOLEAN | NOT NULL, DEFAULT true | |
| `tax_rate` | DECIMAL(5,2) | NULLABLE | Override default tax |
| `inventory_quantity` | INTEGER | NOT NULL, DEFAULT 0 | |
| `low_stock_threshold` | INTEGER | NULLABLE | Trigger alert |
| `is_backorderable` | BOOLEAN | NOT NULL, DEFAULT false | |
| `weight_kg` | DECIMAL(8,3) | NULLABLE | |
| `dimensions_cm` | JSONB | NULLABLE | {length, width, height} |
| `seo_title` | VARCHAR(255) | NULLABLE | |
| `seo_description` | TEXT | NULLABLE | |
| `average_rating` | DECIMAL(3,2) | NULLABLE | Denormalized |
| `review_count` | INTEGER | NOT NULL, DEFAULT 0 | Denormalized |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| `deleted_at` | TIMESTAMPTZ | NULLABLE | |

**Indexes:** `idx_products_sku`, `idx_products_slug`, `idx_products_status`, `idx_products_category_id`, `idx_products_price`, `idx_products_created_at`
**Full-Text Index:** `products_fts_idx` on `(name, description)` using GIN

#### 4.1.5 Ticket

| Field | Type | Constraints | Notes |
|:---|:---|:---|:---|
| `id` | UUID v7 | PK | |
| `ticket_number` | VARCHAR(20) | UNIQUE, NOT NULL | TKT-{YYYY}{MM}-{SEQ} |
| `customer_id` | UUID | FK → customers(id), NOT NULL | |
| `subject` | VARCHAR(255) | NOT NULL | |
| `description` | TEXT | NOT NULL | |
| `category` | VARCHAR(50) | NOT NULL | technical, billing, service_inquiry, complaint, other |
| `priority` | VARCHAR(10) | NOT NULL, DEFAULT 'normal' | low, normal, high, urgent |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'open' | open, triaged, assigned, in_progress, resolved, closed, reopened |
| `assigned_to` | UUID | FK → users(id), NULLABLE | |
| `assigned_at` | TIMESTAMPTZ | NULLABLE | |
| `resolved_at` | TIMESTAMPTZ | NULLABLE | |
| `closed_at` | TIMESTAMPTZ | NULLABLE | |
| `sla_target_at` | TIMESTAMPTZ | NULLABLE | SLA resolution deadline |
| `sla_breached` | BOOLEAN | NOT NULL, DEFAULT false | |
| `order_id` | UUID | FK → orders(id), NULLABLE | Related service order |
| `satisfaction_score` | SMALLINT | NULLABLE, CHECK (1-5) | Post-resolution survey |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**Indexes:** `idx_tickets_ticket_number`, `idx_tickets_customer_id`, `idx_tickets_status`, `idx_tickets_assigned_to`, `idx_tickets_priority`, `idx_tickets_sla_target_at`, `idx_tickets_created_at`

#### 4.1.6 Invoice

| Field | Type | Constraints | Notes |
|:---|:---|:---|:---|
| `id` | UUID v7 | PK | |
| `invoice_number` | VARCHAR(20) | UNIQUE, NOT NULL | INV-{YYYY}{MM}-{SEQ} |
| `customer_id` | UUID | FK → customers(id), NOT NULL | |
| `order_id` | UUID | FK → orders(id), NULLABLE | |
| `type` | VARCHAR(20) | NOT NULL | service_fee, product_sale, subscription, refund |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'draft' | draft, issued, paid, overdue, cancelled, refunded |
| `subtotal` | DECIMAL(12,2) | NOT NULL | |
| `tax_amount` | DECIMAL(12,2) | NOT NULL, DEFAULT 0 | |
| `discount_amount` | DECIMAL(12,2) | NOT NULL, DEFAULT 0 | |
| `total` | DECIMAL(12,2) | NOT NULL | |
| `currency` | VARCHAR(3) | NOT NULL, DEFAULT 'SAR' | |
| `issued_at` | TIMESTAMPTZ | NULLABLE | |
| `due_at` | TIMESTAMPTZ | NULLABLE | |
| `paid_at` | TIMESTAMPTZ | NULLABLE | |
| `payment_method` | VARCHAR(50) | NULLABLE | card, bank_transfer, wallet, cash |
| `payment_gateway` | VARCHAR(50) | NULLABLE | |
| `payment_reference` | VARCHAR(255) | NULLABLE | Gateway transaction ID |
| `notes` | TEXT | NULLABLE | |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**Indexes:** `idx_invoices_invoice_number`, `idx_invoices_customer_id`, `idx_invoices_order_id`, `idx_invoices_status`, `idx_invoices_issued_at`, `idx_invoices_due_at`

### 4.2 Database Design

#### 4.2.1 PostgreSQL Schema Strategy

| Strategy | Decision |
|:---|:---|
| Database | Single PostgreSQL instance initially (`alharistech`) |
| Schemas | `public` (core tables), `audit` (audit logs), `analytics` (materialized views), `tenant_*` (Phase 5: per-tenant) |
| Migration Tool | Prisma Migrate / Drizzle Kit (TBD during Sprint 1.1) |
| Migration Strategy | Expand-contract pattern; backward-compatible changes |
| Connection Pooling | PgBouncer (transaction mode) for production; direct connections for dev |
| Extensions | `uuid-ossp`, `pgcrypto`, `pg_trgm` (trigram search), `pgvector` (Phase 5), `postgis` (if location features needed) |

#### 4.2.2 Indexing Strategy

| Index Type | Usage | Example |
|:---|:---|:---|
| **B-tree** (Default) | Primary keys, foreign keys, equality/range lookups | `WHERE email = ?`, `ORDER BY created_at` |
| **GIN** | Full-text search, array columns, JSONB | `WHERE to_tsvector('arabic', name) @@ to_tsquery('arabic', ?)` |
| **GiST** | Geometric data, trigram similarity (via `pg_trgm`) | `WHERE name % 'search_term'` |
| **BRIN** | Large append-only tables (audit logs) | Block-range index on `created_at` for audit tables |
| **Partial** | Filtered subsets | `WHERE deleted_at IS NULL` (exclude soft-deleted) |
| **Covering** | Index-only scans | `CREATE INDEX idx_orders_customer_status ON orders(customer_id, status) INCLUDE (total, created_at)` |

#### 4.2.3 Partitioning Readiness

For tables exceeding ~10M rows (Phase 3+):

| Table | Partition Key | Partition Strategy |
|:---|:---|:---|
| `orders` | `created_at` | Range partitioning by month |
| `invoices` | `issued_at` | Range partitioning by month |
| `tickets` | `created_at` | Range partitioning by month |
| `notifications` | `created_at` | Range partitioning by month |
| `audit_logs` | `occurred_at` | Range partitioning by month + BRIN indexes |

Implementation: Native PostgreSQL declarative partitioning (PG 14+), applied when row count exceeds threshold. No premature partitioning.

### 4.3 Storage Design

#### 4.3.1 File/Object Storage

| Storage Tier | Technology | Purpose | Lifecycle |
|:---|:---|:---|:---|
| **Object Storage** | S3 (AWS) / MinIO (dev) | User uploads, documents, media, exports | Permanent (GDPR deletion on request) |
| **Cache Storage** | Redis | Sessions, query cache, rate limiter, queues | Ephemeral (TTL-based) |
| **Database Storage** | PostgreSQL | All structured data | Permanent with archival policy |
| **Backup Storage** | S3 (separate bucket) | Daily backups, WAL archives | 30-day rolling + monthly archives (1 year) |
| **Log Storage** | Local volume → S3 (production) | Application logs | 30-day hot, 90-day cold, 1-year archive |

#### 4.3.2 File Organization (S3)

```
s3://alharistech-{env}/
├── media/
│   ├── images/
│   │   ├── {year}/{month}/{uuid}-original.ext
│   │   ├── {year}/{month}/{uuid}-thumb.webp
│   │   ├── {year}/{month}/{uuid}-medium.webp
│   │   └── {year}/{month}/{uuid}-large.webp
│   ├── documents/
│   │   └── {year}/{month}/{uuid}.pdf
│   └── exports/
│       └── {year}/{month}/{report-type}-{timestamp}.xlsx
├── backups/
│   └── database/
│       └── {YYYY-MM-DD}/
│           └── alharistech_{YYYYMMDD}_HHMMSS.dump.gz
└── tenant-assets/  (Phase 5)
    └── {tenant-id}/
        └── ...same structure as media/
```

**Image processing pipeline:** On upload → generate thumb (150px), medium (600px), large (1200px) variants in WebP format. Originals preserved in original format.

### 4.4 Cache Strategy

#### Multi-Level Caching Architecture

```
┌─────────────────────────────────────────────┐
│ Level 1: CDN Cache                          │
│ Vercel Edge / CloudFront                    │
│ TTL: 1 hour (static assets: 1 year)         │
│ Caches: HTML pages, images, JS/CSS bundles  │
└─────────────────┬───────────────────────────┘
                  │ Miss
┌─────────────────▼───────────────────────────┐
│ Level 2: HTTP Cache                         │
│ ETag + Last-Modified + Cache-Control        │
│ TTL: Per-resource (5 min – 1 hour)          │
│ Caches: API responses, SSR pages            │
└─────────────────┬───────────────────────────┘
                  │ Miss
┌─────────────────▼───────────────────────────┐
│ Level 3: Application Cache (Redis)          │
│ TTL: 5–15 minutes                           │
│ Caches: Query results, computed data,       │
│         session data, rate limit counters   │
│ Patterns: Cache-Aside, Write-Through        │
└─────────────────┬───────────────────────────┘
                  │ Miss
┌─────────────────▼───────────────────────────┐
│ Level 4: Database Cache                     │
│ PostgreSQL Shared Buffers (25% of RAM)      │
│ Caches: Hot data pages, index pages         │
└─────────────────────────────────────────────┘
```

Reference: [docs/architecture/README.md](../architecture/README.md) Caching Strategy

#### Cache Invalidation Strategy

| Pattern | Usage | Example |
|:---|:---|:---|
| **TTL-based** | Content pages, product listings | `Cache-Control: public, max-age=300` |
| **Write-invalidate** | Order/ticket updates | On status change → `DEL cache:order:{id}` |
| **Tag-based** | Related resource groups | `DEL cache:tag:customer:{id}:*` |
| **Stale-while-revalidate** | Dashboard data | Serve stale + refresh in background |

### 4.5 Search Strategy

| Phase | Technology | Capabilities |
|:---|:---|:---|
| **Phase 1–2** | PostgreSQL Full-Text Search (`tsvector`/`tsquery`) | Basic search on services, blog posts, pages. Arabic text search via custom dictionary. GIN indexes on `to_tsvector('arabic', content)`. |
| **Phase 3** | PostgreSQL FTS + `pg_trgm` | Add trigram similarity for fuzzy search on products, customers. |
| **Phase 4–5** | Elasticsearch | Full-featured search: faceted filters, autocomplete, typo tolerance, relevance tuning, analytics. |

**PostgreSQL FTS configuration:**
- Custom text search dictionary for Arabic (using `arabic_stem`).
- English dictionary as secondary.
- Combined search configuration: `CREATE TEXT SEARCH CONFIGURATION alharistech_search (COPY = pg_catalog.simple)` with Arabic + English mappings.
- GIN indexes on searchable text columns.

**Elasticsearch migration path (Phase 4+):**
1. Deploy Elasticsearch cluster alongside PostgreSQL.
2. Implement CDC (Change Data Capture) via application events to index documents.
3. Dual-write during transition: write to PG + publish event → Elasticsearch indexing.
4. Feature-flag driven: toggle between PG FTS and ES per search endpoint.
5. Full cutover after validation period.

### 4.6 Analytics Strategy

| Component | Technology | Purpose | Refresh |
|:---|:---|:---|:---|
| **Operational Reports** | PostgreSQL (primary) | Real-time dashboards | Live queries |
| **Read Replica** | PostgreSQL read replica | Offload reporting queries from primary | Near real-time (streaming replication) |
| **Materialized Views** | PostgreSQL `MATERIALIZED VIEW` | Pre-computed aggregates (daily sales, monthly KPIs) | Scheduled refresh (every 1–6 hours) |
| **Reporting Database** | Denormalized PostgreSQL schema (Phase 3+) | Optimized for analytical queries | ETL pipeline (BullMQ jobs) |
| **Data Warehouse** | ClickHouse / TimescaleDB (Phase 5) | Advanced analytics, time-series | Batch ingestion |

**Materialized View Examples:**

- `mv_daily_order_stats` — orders by day, service, status, payment
- `mv_customer_ltv` — customer lifetime value calculations
- `mv_ticket_sla_performance` — SLA compliance by category, assignee, period
- `mv_product_sales_ranking` — top-selling products by revenue, quantity

### 4.7 Data Governance

#### 4.7.1 Data Retention

| Data Category | Retention Period | Action After Retention |
|:---|:---|:---|
| Active customer data | Indefinite (while account active) | Archive on account closure |
| Closed orders | 7 years (tax compliance) | Anonymize PII after 7 years |
| Financial records (invoices, payments) | 10 years (legal requirement) | Cold storage after 5 years |
| Support tickets | 3 years | Archive + anonymize |
| Audit logs | 3 years | Compress → cold storage |
| Application logs | 90 days | Delete after 90 days |
| Usage analytics | 2 years | Aggregate → delete raw data |
| Backup files | 30 days (daily), 12 months (monthly) | Delete expired |
| Email delivery logs | 90 days | Delete |
| Notification history | 1 year | Delete |
| User sessions | 7 days (refresh tokens), 15 min (access tokens) | Auto-expire |

#### 4.7.2 Data Archival

| Stage | Storage | Access Pattern |
|:---|:---|:---|
| **Hot** (Active) | PostgreSQL primary | Frequent reads/writes |
| **Warm** (Recent history) | PostgreSQL with partitioning | Occasional reads |
| **Cold** (Archive) | S3 Glacier / compressed dump | Rare access, restore on demand |
| **Purged** | Deleted (GDPR/retention expiry) | Irrecoverable |

**Archival process:** BullMQ scheduled jobs identify records past retention thresholds, export to compressed JSON/CSV, store in S3 archive bucket, remove from primary database.

#### 4.7.3 GDPR / PDPL Considerations

| Requirement | Implementation |
|:---|:---|:---|
| **Right to Access** | API endpoint `/api/v1/privacy/data-export` generates JSON/PDF export of all user data within 30 days |
| **Right to Erasure** | Soft delete (`deleted_at`) with 30-day recovery window; hard delete after 30 days with cascade |
| **Right to Rectification** | Profile update endpoints with audit trail |
| **Data Portability** | Export in machine-readable format (JSON, CSV) |
| **Consent Management** | Granular consent flags per processing purpose; stored in `user_consents` table |
| **Data Minimization** | Only collect data needed for specified purpose; field-level justification documented |
| **Breach Notification** | 72-hour notification process; documented in incident response plan |
| **Data Processing Records** | Maintain records of processing activities (ROPA) per Article 30 |
| **PII Encryption** | Field-level AES-256 encryption for `national_id`, `tax_id`, `phone` (at application layer) |
| **Cross-Border Transfer** | Data stays in-region (Saudi Arabia) by default; explicit consent for transfers |

---

## 5. Infrastructure Architecture

### 5.1 Development Environment

| Component | Technology | Purpose |
|:---|:---|:---|
| Runtime | Node.js (bare metal/VM) | Direct host execution |
| API Server | NestJS dev server (`nest start --watch`) | Hot reload on code changes |
| Frontend | Next.js dev server (`next dev`) | HMR (Hot Module Replacement) |
| Database | PostgreSQL 16 (local) | Local development database |
| Cache | Redis 7 (local) | Local cache + queue |
| Storage | Local filesystem / S3 | Local or direct S3 for development |
| Mail Testing | Mailpit (local) or direct SMTP | SMTP capture for development |
| Reverse Proxy | Traefik/Caddy (local) | Local HTTPS + routing |
| Process Manager | Turborepo (`turbo dev`) | Parallel dev server orchestration |
| Code Quality | ESLint + Prettier + commitlint | Pre-commit and CI enforcement |

**Local Development Services:**

The following services run directly on the development machine (bare metal/VM), not in containers:

- PostgreSQL 16 — installed locally, port 5432
- Redis 7 — installed locally, port 6379
- MinIO (optional) — for local S3-compatible storage, or use direct S3
- Mailpit (optional) — local SMTP capture, or configure a real SMTP provider

### 5.2 Testing Infrastructure

| Test Level | Tool | Scope | Coverage Target | CI Stage |
|:---|:---|:---|:---|:---|
| Unit | Vitest (frontend), Jest (backend) | Individual functions, hooks, services | ≥ 80% | PR → Push |
| Integration | Jest + Supertest | API endpoints, database operations | ≥ 70% | PR → Push |
| E2E | Playwright | Critical user journeys | 100% of core flows | PR → Push |
| API Contract | Jest + OpenAPI spec validation | All public endpoints | All endpoints | PR → Push |
| Performance | k6 | Critical paths under load | Response < 200ms (p95) | Nightly |
| Security | OWASP ZAP | Vulnerability scanning | Zero high/critical issues | Weekly |
| Accessibility | axe-core + Playwright | WCAG 2.1 AA compliance | All pages | PR → Push |
| Visual Regression | Playwright screenshot comparison | UI consistency | Critical pages | PR → Push |

**CI/CD Integration:** All tests run in GitHub Actions. PRs cannot merge without passing all checks.

### 5.3 Staging Environment

| Aspect | Configuration |
|:---|:---|
| Hosting | VPS / cloud VM (2 vCPU, 4GB RAM minimum) |
| Deployment | GitHub Actions → direct deployment on VM |
| Database | Separate PostgreSQL instance with sanitized production data |
| Data Strategy | Anonymized subset of production (no real PII) |
| SSL | Let's Encrypt via Traefik |
| Access Control | HTTP Basic Auth + IP whitelist |
| Monitoring | Same stack as production (Prometheus + Grafana) |
| Purpose | Pre-release validation, stakeholder demos, load testing |

### 5.4 Production Environment

#### 5.4.1 Phase 1–4: Docker Compose on VPS

| Service | Instances | Resources (per instance) |
|:---|:---|:---|
| Next.js (Web) | 2 | 1 vCPU, 1GB RAM |
| Next.js (Admin) | 1 | 1 vCPU, 1GB RAM |
| NestJS API | 2 | 2 vCPU, 2GB RAM |
| PostgreSQL | 1 (with replica) | 4 vCPU, 8GB RAM, 100GB SSD |
| Redis | 1 (with sentinel) | 2 vCPU, 4GB RAM |
| MinIO | 1 (distributed mode) | 2 vCPU, 4GB RAM, 200GB storage |
| Traefik | 1 | 0.5 vCPU, 512MB RAM |
| BullMQ Workers | 2 | 1 vCPU, 1GB RAM |

#### 5.4.2 Phase 5: Kubernetes Migration Path

| Current (Docker Compose) | Target (Kubernetes) |
|:---|:---|
| Docker Compose file | Kubernetes manifests / Helm charts |
| Manual scaling | Horizontal Pod Autoscaler (HPA) |
| Traefik on host | Kubernetes Ingress Controller (Traefik/Nginx) |
| Named volumes | Persistent Volume Claims (PVC) |
| Docker networking | Kubernetes CNI (Calico/Cilium) |
| Environment files | Kubernetes Secrets + ConfigMaps |
| Manual deployment | GitOps (ArgoCD / Flux) |
| Host-based monitoring | Prometheus Operator + Grafana dashboards |

### 5.5 Monitoring

#### 5.5.1 Health Checks

| Level | Implementation | Endpoint |
|:---|:---|:---|
| **Liveness** | Lightweight check: app is running | `GET /health/live` → 200 |
| **Readiness** | Check dependencies: DB, Redis, S3 | `GET /health/ready` → 200 or 503 |
| **Startup** | Indicate app has started (for K8s) | `GET /health/startup` |
| **Deep** | Database query, Redis ping, queue depth | `GET /health/deep` → JSON status |

#### 5.5.2 Metrics

| Category | Metrics | Tool |
|:---|:---|:---|
| **Infrastructure** | CPU, memory, disk, network | Node Exporter → Prometheus |
| **Application** | Request rate, error rate, latency (p50/p95/p99) | `prom-client` (NestJS interceptor) |
| **Database** | Connections, query duration, cache hit ratio | PostgreSQL Exporter |
| **Business** | Orders created, tickets opened, registrations | Custom metrics endpoint |
| **Queue** | Job count, wait time, failed jobs | BullMQ metrics |
| **Cache** | Hit/miss ratio, memory usage | Redis Exporter |

**Alerting Thresholds:**

| Alert | Condition | Severity | Action |
|:---|:---|:---|:---|
| API error rate > 1% | `rate(http_requests_total{status=~"5.."}[5m]) > 0.01` | Critical | On-call pager |
| API latency p95 > 500ms | `histogram_quantile(0.95, http_request_duration_seconds) > 0.5` | Warning | Slack + investigate |
| DB connections > 80% | `pg_stat_database_numbackends / max_connections > 0.8` | Warning | Slack |
| Disk usage > 85% | `disk_used_percent > 85` | Warning | Slack |
| Redis memory > 80% | `redis_memory_used_bytes / redis_memory_max_bytes > 0.8` | Critical | On-call pager |
| Queue backlog > 1000 | `bullmq_waiting_jobs > 1000` | Warning | Slack |
| SSL expiry < 7 days | Cert expiry check | Critical | On-call pager |
| Health check failing | `up == 0` for > 1 min | Critical | On-call pager |

**Dashboard:** Grafana with dedicated dashboards for infrastructure, application, business KPIs.

### 5.6 Logging

#### 5.6.1 Structured Logging

**Log Format:** JSON (structured)

```json
{
  "timestamp": "2026-06-20T10:30:00.000Z",
  "level": "info",
  "message": "Order submitted successfully",
  "correlationId": "uuid-v7",
  "userId": "uuid",
  "tenantId": null,
  "domain": "service",
  "action": "order:submit",
  "resourceId": "uuid",
  "duration_ms": 45,
  "http": {
    "method": "POST",
    "path": "/api/v1/orders",
    "statusCode": 201,
    "userAgent": "Mozilla/5.0...",
    "ip": "203.0.113.1"
  },
  "error": null
}
```

**Implementation:** NestJS `Logger` with custom JSON formatter → stdout/stderr → log aggregator.

#### 5.6.2 Correlation IDs

- Generated on entry (API Gateway / Next.js middleware).
- UUID v7 (time-ordered).
- Propagated via `X-Correlation-ID` header to all downstream services.
- Included in all log entries, API responses, and error pages.
- Stored in async context (Node.js `AsyncLocalStorage`).

#### 5.6.3 Log Aggregation

| Phase | Technology | Capabilities |
|:---|:---|:---|
| Phase 1–2 | Local log files + structured logging (Pino/Winston) | Basic log persistence |
| Phase 3+ | Loki + Promtail (or ELK stack) | Centralized aggregation, search, alerting |
| Long-term | S3 archive | Compliance retention |

### 5.7 Observability (OpenTelemetry Readiness)

| Pillar | Phase 1–2 | Phase 3+ (OpenTelemetry) |
|:---|:---|:---|
| **Traces** | Correlation IDs in logs | OpenTelemetry tracing (OTLP → Jaeger/Tempo) |
| **Metrics** | Prometheus + `prom-client` | OpenTelemetry metrics (OTLP → Prometheus) |
| **Logs** | Structured JSON + correlation IDs | OpenTelemetry log bridge (OTLP → Loki) |

**Instrumentation approach:**
- NestJS interceptors for automatic HTTP span creation.
- Manual spans for critical business operations (order processing, payment).
- Next.js middleware for frontend trace context propagation.
- Standard semantic conventions for attribute naming.

### 5.8 Backup

#### 5.8.1 Backup Strategy

| Backup Type | Method | Frequency | Retention |
|:---|:---|:---|:---|
| **Full Database** | `pg_dump -Fc` (custom format, compressed) | Daily (02:00 UTC) | 30 days |
| **WAL Archiving** | PostgreSQL `archive_command` → S3 | Continuous | 7 days |
| **Point-in-Time Recovery** | Base backup + WAL replay | — | Up to 7 days in the past |
| **Configuration** | Git repository (Infrastructure as Code) | Every config change | Permanent |
| **Media Files** | S3 bucket versioning + cross-region replication | Continuous | 30 days (deleted objects) |
| **Monthly Archive** | Full dump to separate S3 bucket | Monthly (1st of month) | 12 months |

#### 5.8.2 Backup Verification

- Automated restore test to ephemeral database weekly.
- Integrity check on backup files (checksum validation).
- Alert on backup failure (missing file, zero-size file, checksum mismatch).

### 5.9 Disaster Recovery

| Metric | Target | Implementation |
|:---|:---|:---|
| **RTO** (Recovery Time Objective) | < 4 hours | Pre-built Docker images, automated DB restore, documented runbook |
| **RPO** (Recovery Point Objective) | < 1 hour | WAL archiving with continuous shipping to S3 |
| **DR Site** | Warm standby (Phase 3+) | Secondary region with replication; Phase 1–2: cold restore from backup |
| **Recovery Testing** | Quarterly | Full DR drill: restore from backup, verify application health |

**DR Plan Summary:**

1. **Detection:** Monitoring alert triggers incident (health check failure, error rate spike).
2. **Declaration:** On-call engineer declares disaster after 5-minute assessment.
3. **Infrastructure:** Provision new server from IaC (Docker Compose / Terraform).
4. **Database:** Restore latest full backup + replay WAL to target point.
5. **Application:** Deploy latest Docker images via CI/CD pipeline.
6. **Validation:** Run smoke tests, verify critical flows.
7. **Cutover:** Update DNS to new infrastructure.
8. **Post-mortem:** Document timeline, root cause, preventive measures.

---

## 6. Security Architecture

### 6.1 Identity and Authentication

| Layer | Mechanism | Details |
|:---|:---|:---|
| **Primary Auth** | JWT (RS256) + Refresh Tokens | Access token: 15 min TTL, signed with private key. Refresh token: 7-day TTL, stored hashed in DB, rotation on use. |
| **Token Transport** | Access token: `Authorization: Bearer` header (memory storage). Refresh token: `httpOnly`, `secure`, `SameSite=Strict` cookie. | Prevents XSS exfiltration and CSRF. |
| **Session Management** | Multi-device via `sessions` table. Each refresh token linked to a session. Users can view/revoke individual sessions. | ADR-007 |
| **Password Policy** | Minimum 8 characters, require mix of character types, check against breached passwords (Have I Been Pwned API), bcrypt hashing (cost factor 12). | NIST SP 800-63B aligned |
| **Account Lockout** | 5 failed attempts → 15-minute lock. Progressive: 5 → 10 → 30 minutes. Notify user via email on lockout. | NFR-305 |
| **Brute Force Protection** | Rate limiting on `/auth/login`: 5 requests per IP per minute. Account-specific rate limiting. | |
| **Password Reset** | Time-limited token (15 min), single-use, sent via email. Reset invalidates all existing sessions. | |

### 6.2 Role-Based Access Control

| Role | Permissions Scope | Default Permissions |
|:---|:---|:---|
| **Admin** | Platform-wide | All permissions across all domains |
| **Manager** | Domain-wide with financial oversight | CRUD on assigned domains, view reports, manage employees, approve content/discounts/refunds |
| **Employee** | Operational within assignments | View assigned orders/tickets, process orders, reply to tickets, manage content (with approval) |
| **Customer** | Own data only | View own profile, orders, tickets; create orders/tickets; manage notification preferences |
| **Partner** | API-only, scoped | API access with specific resource permissions; no admin dashboard access |

**Permission enforcement chain:**
1. `AuthGuard` — validates JWT, extracts user.
2. `RolesGuard` — checks user role meets minimum role requirement.
3. `PermissionsGuard` — checks granular permission (`{domain}:{resource}:{action}`).
4. `PolicyGuard` — evaluates resource-level policies (ownership, assignment).

### 6.3 Multi-Factor Authentication (MFA)

| Phase | Implementation |
|:---|:---|
| **Phase 1** | Not implemented (password-only). Backend models prepared (`mfa_devices` table, `MfaEnabled`/`MfaDisabled` events). |
| **Phase 3** | TOTP (Time-based One-Time Password) using `speakeasy` or similar. QR code enrollment via authenticator apps (Google Authenticator, Authy). |
| **Phase 5** | SMS fallback for TOTP-unavailable scenarios. WebAuthn (passkeys) for passwordless authentication. |

### 6.4 Secrets Management

| Phase | Solution | Details |
|:---|:---|:---|
| **Phase 1–2** | Environment variables (`.env` files) | Git-ignored; `.env.example` committed with placeholder values. Deployed via Docker secrets / CI/CD variables. |
| **Phase 3** | `.env` + CI/CD secrets with rotation process | Manual rotation every 90 days. |
| **Phase 5** | HashiCorp Vault | Dynamic secrets, automatic rotation, audit logging, encryption as a service. |

**Secret categories:**
- Database credentials (username, password, host)
- JWT signing keys (private/public key pair)
- Third-party API keys (SendGrid, Twilio, payment gateway, OpenAI)
- Encryption keys (AES-256 keys for PII)
- S3/MinIO access keys
- OAuth client secrets (Google, Apple, GitHub)

### 6.5 Encryption

| State | Standard | Details |
|:---|:---|:---|
| **In Transit (TLS)** | TLS 1.3 | Minimum TLS 1.2; TLS 1.3 preferred. HSTS header (`max-age=31536000; includeSubDomains; preload`). |
| **At Rest (Database)** | AES-256 | PostgreSQL TDE (Transparent Data Encryption) if supported by hosting provider. Application-layer encryption for PII fields (see below). |
| **At Rest (Files)** | AES-256 (SSE-S3) | Server-side encryption for S3 objects. MinIO supports SSE-S3 in production mode. |
| **At Rest (Backups)** | AES-256 | `pg_dump` files encrypted before upload to S3 using `gpg --symmetric`. |
| **Field-Level (PII)** | AES-256-GCM | Application-layer encryption for: `national_id`, `tax_id`, `phone`, `address_line1`. Encrypted via `crypto` module; keys in environment vars (or Vault). Decrypted only when needed. |

### 6.6 Audit Logging

#### 6.6.1 Audit Log Categories

| Log Type | Contents | Storage | Retention |
|:---|:---|:---|:---|
| **Mutation Audit** | All CUD operations with before/after values | `audit.mutation_log` table | 3 years |
| **Access Log** | All resource reads with user, IP, timestamp | `audit.access_log` table (sampled) | 1 year |
| **Admin Action Log** | All admin/manager actions (role changes, permission grants, user management) | `audit.admin_log` table | 3 years |
| **Auth Log** | Login attempts (success/failure), password changes, MFA events, session revocations | `audit.auth_log` table | 2 years |

#### 6.6.2 Mutation Audit Schema

| Field | Type | Description |
|:---|:---|:---|
| `id` | UUID v7 | PK |
| `occurred_at` | TIMESTAMPTZ | When mutation occurred |
| `user_id` | UUID | Who performed the action |
| `action` | VARCHAR(20) | CREATE, UPDATE, DELETE, RESTORE |
| `entity_type` | VARCHAR(50) | e.g., 'Order', 'Customer', 'User' |
| `entity_id` | UUID | Affected entity ID |
| `changes` | JSONB | `{ field: { from: oldValue, to: newValue } }` |
| `ip_address` | INET | Client IP |
| `user_agent` | VARCHAR(500) | Client user agent |
| `correlation_id` | UUID | Request correlation ID |

### 6.7 Security Logging and Monitoring

| Event | Logged | Alert |
|:---|:---|:---|
| Failed login | Yes (user ID/IP) | > 10/minute per account → Warning |
| Permission denied | Yes (user, resource, permission) | > 50/hour per user → Warning |
| Rate limit hit | Yes (IP, endpoint) | > 1000/hour per IP → Warning |
| Admin action | Yes (all) | Role change, permission grant → Info alert |
| Suspicious IP activity | Yes | Known malicious IPs → Critical |
| Token reuse detection | Yes | Refresh token reuse → Critical (revoke all sessions) |
| Configuration change | Yes | Any env/config change → Info |
| New API key created | Yes | Info alert |

### 6.8 Supply Chain Security

| Control | Tool/Practice | Frequency |
|:---|:---|:---|
| Dependency scanning | Dependabot / Renovate | On every PR (auto-raise) |
| Vulnerability audit | `npm audit` (CI gate) | On every push |
| License compliance | License-checker | On every push |
| Signed commits | GPG signing required | Every commit |
| Code review | Mandatory PR review (≥ 1 approver) | Every PR |
| Branch protection | Require status checks, no direct push to `main` | Always |
| Container scanning | Docker Scout / Trivy | On image build |
| SBOM generation | `npm sbom` / CycloneDX | On release |

### 6.9 Zero Trust Controls

| Principle | Implementation |
|:---|:---|
| **Default Deny** | All API endpoints require authentication by default. Use `@Public()` decorator to explicitly allow anonymous access. |
| **Explicit Allow** | Permissions explicitly granted; no default permissions even for admins (admin role has all permissions explicitly). |
| **Least Privilege** | Roles configured with minimum required permissions. Employees see only assigned resources. |
| **Network Segmentation** | Docker networks separate services. API only exposed via Traefik. Database not exposed publicly. |
| **API Authentication** | All service-to-service calls authenticated (JWT or API key). |
| **Request Validation** | All inputs validated and sanitized at the API gateway. Strict schema validation (Zod/class-validator). |
| **Output Sanitization** | Response data sanitized (no internal IDs leaked unnecessarily, no stack traces in production). |

---

## 7. AI Architecture

### 7.1 AI Services Overview

The AI domain is the final architectural layer (Phase 5), consuming events and data from all other domains to provide intelligent capabilities across the platform.

| Service | Purpose | Input | Output | Phase |
|:---|:---|:---|:---|:---|
| **Text Generation** | Generate responses, summaries, translations | Prompt + context | Generated text | 5 |
| **Embeddings** | Convert text into vector representations | Text chunks | Vector embeddings (1536-dim+) | 5 |
| **RAG Pipeline** | Answer questions using knowledge base | User query | Grounded response with citations | 5 |
| **Content Generator** | Draft blog posts, product descriptions, emails | Topic + style guide | Draft content | 5 |
| **Classifier** | Categorize tickets, detect sentiment, tag customers | Text input | Category/label + confidence | 5 |
| **Translator** | Arabic ↔ English translation | Source text | Translated text | 5 |

### 7.2 AI Agents

| Agent | Role | Capabilities | Tools |
|:---|:---|:---|:---|
| **Support Agent** | First-line customer support | Answer FAQs, suggest knowledge articles, draft ticket responses, classify and route tickets | Knowledge base search, ticket API, customer history lookup |
| **Content Agent** | Content creation and optimization | Draft blog posts, generate SEO metadata, translate content, suggest content improvements | CMS API, SEO analysis, translation service |
| **Analytics Agent** | Natural language analytics queries | "Show me top selling products this month", "Which employee handled most tickets?" — generates SQL and returns results | Analytics API, SQL generation, chart rendering |
| **Automation Agent** | Workflow automation | Trigger actions based on events: "When a ticket is unresolved for 4 hours, escalate to manager" | Event bus listener, action executor (API calls) |

**Agent Architecture Pattern:**

```
┌───────────────────────────────────────────┐
│                AI Agent                    │
│                                            │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Planner │  │ Executor │  │ Memory   │ │
│  │ (LLM)   │  │ (Tool    │  │ (Vector  │ │
│  │         │  │  Calling)│  │  Store)  │ │
│  └────┬────┘  └────┬─────┘  └────┬─────┘ │
│       │            │              │        │
│       └────────────┼──────────────┘        │
│                    │                       │
└────────────────────┼───────────────────────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
    ┌────┴───┐  ┌───┴────┐  ┌───┴────┐
    │ Search │  │  API   │  │ Execute│
    │  Tool  │  │  Tool  │  │  Tool  │
    └────────┘  └────────┘  └────────┘
```

### 7.3 Knowledge Base (Vector Store)

#### 7.3.1 Architecture

| Component | Technology | Purpose |
|:---|:---|:---|
| Vector Database | `pgvector` extension in PostgreSQL | Store and query embeddings alongside relational data |
| Embedding Model | `text-embedding-3-large` (OpenAI) or `multilingual-e5-large` (self-hosted) | Generate vector embeddings; dimension: 1536 or 1024 |
| Document Store | S3 (raw documents) + PostgreSQL (metadata + chunks) | Source of truth for documents |
| Ingestion Pipeline | BullMQ jobs | Chunk → embed → store pipeline |

#### 7.3.2 Document Ingestion Pipeline

```
Raw Document (PDF, HTML, Markdown, TXT)
    │
    ▼
[1] Parse & Extract Text
    │
    ▼
[2] Chunk Text (512 tokens, 64 overlap)
    │
    ▼
[3] Generate Embeddings (batch API)
    │
    ▼
[4] Store in pgvector
    │   - chunk text
    │   - embedding vector
    │   - metadata (source, page, chunk_index)
    │   - document_id reference
    ▼
[5] Index (IVFFlat / HNSW)
```

**Chunking Strategy:**

| Parameter | Value | Rationale |
|:---|:---|:---|
| Chunk size | 512 tokens | Balance context window with retrieval precision |
| Chunk overlap | 64 tokens | Prevent context loss at chunk boundaries |
| Chunking method | Recursive character splitting with language-aware separators | Handles Markdown, code blocks, and natural text |
| Metadata enrichment | Source document, page/section, content type, last modified | Filtered retrieval |

#### 7.3.3 Knowledge Sources

| Source | Content Type | Update Frequency |
|:---|:---|:---|
| Blog Posts | Long-form articles | On publish/update |
| Knowledge Base Articles | Structured help content | On publish/update |
| Service Descriptions | Structured metadata | On update |
| Product Descriptions | E-commerce content | On update |
| Ticket History (anonymized) | Past solutions | Weekly batch |
| System Documentation | Platform docs | On release |

### 7.4 Embeddings Strategy

| Aspect | Decision |
|:---|:---|
| **Primary Model** | `text-embedding-3-large` (OpenAI) — dimensions: 1536 |
| **Fallback Model** | `multilingual-e5-large` (self-hosted via HuggingFace TEI) — dimensions: 1024 |
| **Languages** | Arabic + English; model selection based on detected language |
| **Caching** | Redis cache: `embed:{content_hash}` → vector. Cache hit rate estimated > 60% for static content. |
| **Refresh Strategy** | Re-embed on content update; batch re-embedding weekly for stale cache entries |
| **Batch Processing** | OpenAI batch API for large ingestion jobs (cost reduction ~50%) |
| **Cost Optimization** | Cache embeddings aggressively; use self-hosted model for high-volume/low-latency needs; batch API for bulk |

### 7.5 Prompt Management

#### 7.5.1 Template System

Prompts are managed as versioned, parameterized templates:

```typescript
interface PromptTemplate {
  id: string;
  name: string;              // e.g., 'support-ticket-response'
  version: number;
  status: 'draft' | 'active' | 'deprecated';
  systemPrompt: string;      // System message with {{variables}}
  userPromptTemplate: string; // User message template with {{variables}}
  variables: PromptVariable[];
  model: string;             // e.g., 'gpt-4o', 'claude-sonnet-4'
  temperature: number;       // 0.0 – 2.0
  maxTokens: number;
  metadata: {
    domain: string;
    purpose: string;
    createdBy: string;
    createdAt: Date;
    performance?: {
      avgLatency: number;
      successRate: number;
      usageCount: number;
    };
  };
}
```

**Template Catalog:**

| Template | Domain | Variables | Model |
|:---|:---|:---|:---|
| `support-ticket-response` | Support | `{{customerName}}`, `{{issueSummary}}`, `{{resolution}}`, `{{knowledgeArticles}}` | gpt-4o |
| `support-ticket-classification` | Support | `{{ticketContent}}`, `{{categories}}` | gpt-4o-mini |
| `blog-post-draft` | Content | `{{topic}}`, `{{tone}}`, `{{keywords}}`, `{{length}}`, `{{language}}` | claude-sonnet-4 |
| `seo-meta-generator` | Content | `{{pageTitle}}`, `{{pageContent}}`, `{{targetKeywords}}` | gpt-4o-mini |
| `product-description` | Commerce | `{{productName}}`, `{{features}}`, `{{targetAudience}}`, `{{language}}` | claude-sonnet-4 |
| `analytics-query` | Analytics | `{{userQuestion}}`, `{{schema}}`, `{{examples}}` | gpt-4o |
| `customer-summary` | Customer | `{{customerData}}`, `{{orderHistory}}`, `{{ticketHistory}}` | gpt-4o-mini |
| `rag-qa` | AI | `{{userQuestion}}`, `{{retrievedContext}}`, `{{conversationHistory}}` | gpt-4o |

#### 7.5.2 Prompt Versioning and A/B Testing

| Capability | Implementation |
|:---|:---|:---|
| Version control | Git-tracked prompt files in `prompts/` directory; deployed via CI/CD |
| A/B testing | Traffic splitting by `userId % 2`; compare metrics (quality, latency, cost) |
| Evaluation | Automated eval pipeline: run prompt variants against test dataset, score outputs |
| Rollback | Instant rollback by reverting prompt version; no code change needed |
| Rate limits per prompt | Configurable per template to control costs |

### 7.6 Model Routing

| Layer | Strategy | Details |
|:---|:---|:---|
| **Primary Provider** | OpenAI (gpt-4o, gpt-4o-mini, text-embedding-3-large) | Default for most tasks |
| **Fallback Provider** | Anthropic (claude-sonnet-4, claude-opus-4) | Switched when OpenAI unavailable or error rate > threshold |
| **Self-Hosted** | vLLM / Ollama with open-source models | For high-volume, cost-sensitive tasks (classification, translation). Deployed on dedicated GPU instances. |
| **Routing Logic** | Model router service with circuit breaker pattern | Evaluates: cost, latency, capability match, provider health |

**Model Selection Matrix:**

| Task | Primary | Fallback | Self-Hosted Candidate |
|:---|:---|:---|:---|
| Complex reasoning (agent planning, analytics) | gpt-4o / claude-opus-4 | claude-sonnet-4 | Llama 4 |
| Simple generation (drafts, responses) | gpt-4o | claude-sonnet-4 | Llama 4 / Mistral |
| Classification (sentiment, category) | gpt-4o-mini | — | Llama 4 / BERT-based |
| Translation (AR ↔ EN) | gpt-4o-mini | — | NLLB-200 / SeamlessM4T |
| Embeddings (AR + EN) | text-embedding-3-large | multilingual-e5-large | multilingual-e5-large |
| Summarization | gpt-4o-mini | claude-haiku | BART / Pegasus |

### 7.7 AI Observability

| Metric | Description | Instrumentation | Target |
|:---|:---|:---|:---|
| **Token Usage** | Input/output tokens per request | OpenAI/Anthropic API response headers | Tracked per template + per user |
| **LLM Latency** | Time to first token (TTFT) + total generation time | Custom span in OpenTelemetry | < 3s TTFT, < 15s total |
| **Request Volume** | AI requests per minute, per template | Counter metric | Monitored for cost anomaly detection |
| **Success Rate** | Successful AI responses / total requests | Error rate counter | > 99.5% |
| **Accuracy** | Correct classifications, helpful responses | Human eval + automated scoring | > 90% for classification, qualitative for generation |
| **RAG Relevance** | Retrieved context relevance score | LLM-as-judge evaluation | Mean score > 4/5 |
| **Hallucination Rate** | Factual accuracy of generated content | Groundedness check (citation verification) | < 5% unsupported claims |
| **Cost per Interaction** | USD per AI request | Token count × model pricing | Tracked per domain; alerts on cost spikes |

**Dashboard:** Dedicated Grafana dashboard for AI operations — token usage trends, cost breakdown by model/template, latency distributions, error rates, top consumers.

### 7.8 Safety Controls

| Control | Implementation | Details |
|:---|:---|:---|
| **Content Filtering** | OpenAI Moderation API + custom keyword list | Filter harmful, offensive, or policy-violating content before display |
| **PII Detection** | Presidio / custom regex patterns | Detect and mask PII in AI inputs/outputs; log PII exposure events |
| **Rate Limiting** | Per-user, per-IP, per-template limits | Prevent abuse and cost overruns: 50 AI requests/user/hour, 1000/template/day |
| **Human-in-the-Loop** | Mandatory review for high-stakes outputs | Support responses: draft → employee review → send. Content: draft → editor review → publish. Analytics queries: auto-execute read-only queries only. |
| **Output Validation** | Schema validation on structured outputs | Ensure JSON outputs match expected schema before processing |
| **Prompt Injection Prevention** | Input sanitization, system prompt hardening, delimiting user input | Use delimiters (`"""user input"""`), separate system and user messages, reject suspicious patterns |
| **Jailbreak Detection** | Pattern matching + moderation check | Detect common jailbreak patterns; return generic refusal |
| **Cost Guardrails** | Daily budget per domain + global cap | Auto-disable AI features if daily budget exceeded; alert on 80% threshold |
| **Bias Monitoring** | Periodic audits of AI outputs | Review outputs for demographic/language bias; adjust prompts and models |

**Safety Decision Flow:**

```
User Input
    │
    ▼
[1] Input Sanitization (strip control chars, validate encoding)
    │
    ▼
[2] PII Detection → Mask or block if contains PII and not authorized
    │
    ▼
[3] Content Moderation → Block if harmful/offensive
    │
    ▼
[4] Rate Limit Check → Reject if exceeded
    │
    ▼
[5] Send to LLM with system guardrails
    │
    ▼
[6] LLM Response
    │
    ▼
[7] Output Validation → Validate format, check for PII leakage
    │
    ▼
[8] Content Moderation → Filter harmful content
    │
    ▼
[9] Human Review (if required) → Approve / Edit / Reject
    │
    ▼
[10] Deliver to User
```

---

## Appendix A: Architecture Decision Records Reference

All architectural decisions are documented as ADRs in `docs/adr/`. Key ADRs referenced in this document:

| ADR | Title | Relevance |
|:---|:---|:---|
| ADR-001 | Next.js for Frontend | Section 3.1 — Frontend Architecture |
| ADR-002 | NestJS for Backend | Section 3.2 — Backend Architecture |
| ADR-003 | PostgreSQL as Primary Database | Section 4.2 — Data Architecture |
| ADR-004 | Redis for Caching and Sessions | Section 4.4 — Cache Strategy |
| ADR-005 | TypeScript Across the Stack | Sections 3.1, 3.2 |
| ADR-006 | Architecture Model (Layered + Modular) | Section 2 — Domain Architecture |
| ADR-007 | JWT with Refresh Tokens | Section 3.5 — Authentication |
| ADR-008 | GraphQL alongside REST | Section 3.3 — API Architecture |
| ADR-009 | BullMQ for Queues | Section 3.4 — Integration, Section 5.4 |
| ADR-010 | S3-Compatible Storage | Section 4.3 — Storage Design |
| ADR-011 | Docker for Development and Deployment | Section 5 — Infrastructure |
| ADR-012 | Monorepo with Turborepo | Section 3.1 — Shared Packages |
| ADR-013 | TailwindCSS + shadcn/ui | Section 3.1 — Frontend Architecture |
| ADR-014 | API First Design | Section 3.3 — API Architecture |
| ADR-015 | OpenAPI/Swagger for API Documentation | Section 3.3 — API Architecture |
| ADR-016 | Domain-Driven Design (DDD) | Section 2 — Domain Architecture |

## Appendix B: Key Non-Functional Requirements Cross-Reference

| NFR ID | Requirement | Target | Section |
|:---|:---|:---|:---|
| NFR-101 | API Response Time (p95) | < 200ms | 4.4 Cache, 5.4 Production |
| NFR-102 | LCP (Page Load) | < 2.5s | 3.1 Frontend, 4.4 Cache |
| NFR-201 | Uptime | 99.9% | 5.4 Production, 5.9 DR |
| NFR-202 | RTO | < 4 hours | 5.9 Disaster Recovery |
| NFR-203 | RPO | < 1 hour | 5.8 Backup, 5.9 DR |
| NFR-301 | TLS 1.3 | In Transit | 6.5 Encryption |
| NFR-302 | AES-256 | At Rest | 6.5 Encryption |
| NFR-303 | OWASP Top 10 | Protected | 6 Security Architecture |
| NFR-401 | Registered Users | 10,000+ | 4.2 DB Design, 5.4 Production |
| NFR-501 | WCAG 2.1 AA | Compliant | 5.2 Testing |
| NFR-601 | Test Coverage | ≥ 80% | 5.2 Testing |
| NFR-603 | Architecture Documentation | ADR + C4 + EA | This document |

## Appendix C: Technology Stack Summary

| Category | Technology | Version | License |
|:---|:---|:---|:---|
| Frontend Framework | Next.js | 15.x | MIT |
| Backend Framework | NestJS | 11.x | MIT |
| Language | TypeScript | 5.x | Apache 2.0 |
| Primary Database | PostgreSQL | 16.x | PostgreSQL |
| Cache & Queue | Redis | 7.x | BSD |
| Object Storage | MinIO (dev) / S3 (prod) | Latest | AGPLv3 / Proprietary |
| CSS Framework | TailwindCSS | 4.x | MIT |
| Component Library | shadcn/ui | Latest | MIT |
| ORM | Prisma / Drizzle | Latest | Apache 2.0 / MIT |
| Job Queue | BullMQ | Latest | MIT |
| Container Runtime | Docker | 27.x | Apache 2.0 |
| Build System | Turborepo | 2.x | MPL 2.0 |
| Testing (Unit/Int) | Vitest / Jest | Latest | MIT |
| Testing (E2E) | Playwright | Latest | Apache 2.0 |
| Performance Testing | k6 | Latest | AGPLv3 |
| Security Testing | OWASP ZAP | Latest | Apache 2.0 |
| Monitoring | Prometheus + Grafana | Latest | Apache 2.0 / AGPLv3 |
| Vector Database | pgvector | 0.7+ | PostgreSQL |

---

**Document Control:**

| Version | Date | Author | Changes |
|:---|:---|:---|:---|
| 1.0 | 2026-06-20 | Architecture Team | Initial comprehensive Enterprise Architecture document |

**Next Review:** 2026-09-20 (quarterly review cycle)
