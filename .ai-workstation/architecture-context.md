# Architecture Context
# Persistent architecture knowledge — decisions, constraints, patterns
# Loaded second in every engineering session

## Architecture Style

**Modular Layered Architecture** with Domain-Driven Design and Hexagonal (Ports & Adapters) within each domain.

## Architecture Patterns

| Pattern | Status | Phase |
|:---|:---|:---|
| Modular Layered Architecture | Active | Sprint 0 |
| Domain-Driven Design (DDD) | Active | Sprint 0 |
| Hexagonal Architecture | Active | Sprint 0 |
| API Gateway | Active | Sprint 0 |
| CQRS | Planned | Phase 2+ |
| Event-Driven | Planned | Phase 2+ |
| Microservices | Planned | Phase 5 |

## Layer Model

```
Presentation Layer  → Next.js (Web, Admin), React Native (Mobile), Tauri (Desktop)
API Layer           → NestJS (REST + GraphQL + Webhooks)
Application Layer   → Domain Modules (Use Cases, Application Services)
Domain Layer        → Entities, Value Objects, Aggregates, Repository Interfaces
Infrastructure Layer → PostgreSQL, Redis, S3, BullMQ, Email, SMS, Payments
```

## Technology Stack

| Layer | Technology | ADR |
|:---|:---|:---|
| Frontend | Next.js 15+ (App Router), React 19+, TailwindCSS 4, shadcn/ui | ADR-001, ADR-013 |
| Backend | NestJS 11+, TypeScript, GraphQL, REST | ADR-002, ADR-008 |
| Database | PostgreSQL 16 | ADR-003 |
| Cache | Redis 7 | ADR-004 |
| Storage | S3-Compatible (MinIO) | ADR-010 |
| Queue | BullMQ | ADR-009 |
| Auth | JWT + Refresh Tokens + RBAC | ADR-007 |
| Monorepo | Turborepo + pnpm | ADR-012 |
| Container | Docker | ADR-011 |
| CI/CD | GitHub Actions | — |
| ORM | UNRESOLVED (Prisma vs Drizzle) | ADR needed |
| Mobile | React Native (settled, ADR needed) | ADR needed |
| Desktop | Tauri (preferred, ADR needed) | ADR needed |

## Architecture Decisions (ADRs)

16 indexed, 3 fully written, 13 stubs. See `docs/adr/`.

## Key Design Constraints

1. Arabic-first (RTL) with English support — all UI must be bilingual-ready
2. API First — every feature starts with OpenAPI contract
3. RBAC — granular permissions from day one
4. Multi-tenant ready — database design must support tenant isolation (Phase 5)
5. Offline-ready — mobile and desktop apps must function offline (Phase 4)
6. WCAG 2.1 AA — accessibility compliance

## Bounded Contexts (Domains)

9 domains with clear boundaries:
Identity → Customer → Service → Commerce → Support → Content → Notification → Analytics → AI

## Cross-Domain Integration

- Synchronous: REST/GraphQL through API Gateway
- Asynchronous: BullMQ events for cross-domain notifications
- Data sharing: Analytics domain reads from all other domains (read replicas in Phase 5)

## Security Architecture

- TLS 1.3 for all transport
- JWT (short-lived access + long-lived refresh with rotation)
- RBAC with granular permissions
- AES-256 for data at rest
- Rate limiting at API Gateway
- Audit logging for all mutations
- Secrets managed via environment variables (Hashicorp Vault in Phase 5)

## Performance Targets

- API p95 latency: < 200ms
- Page LCP: < 2.5s
- Page FID: < 100ms
- Concurrent users: 1,000+
- Requests/second: 500+

## Deployment Architecture

```
Development → Direct Node.js + PostgreSQL + Redis (local)
Staging → GitHub Actions + VM
Production → Kubernetes (Phase 5)
```

## Unresolved Architecture Questions

1. ORM: Prisma vs Drizzle (ADR pending)
2. GraphQL Federation: Apollo vs Mercurius (ADR pending)
3. API Versioning: URL-based vs Header-based (ADR pending)
4. Mobile state management: Zustand vs Redux (ADR pending)
5. Test runner: Jest vs Vitest (ADR pending)
6. Form library: React Hook Form vs TanStack Form (ADR pending)
