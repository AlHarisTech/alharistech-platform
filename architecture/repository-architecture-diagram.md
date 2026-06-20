# Repository Architecture Diagram — AlharisTech Platform

## Overview

This document provides a visual and textual representation of the entire monorepo architecture: directory tree with annotations, package dependency graph, data flow between layers, build pipeline flow, and import boundary rules.

---

## Full Monorepo Tree with Annotations

```
Alharistech/                                    # Root monorepo
│
├── .github/                                    # ─── CI/CD ───
│   ├── workflows/
│   │   ├── ci.yml                              # PR checks: lint, test, typecheck, build
│   │   ├── deploy-staging.yml                  # Auto-deploy develop -> staging
│   │   ├── deploy-production.yml               # Manual deploy main -> production
│   │   ├── security-audit.yml                  # Weekly dependency + SAST scan
│   │   └── bundle-size.yml                     # Bundle size check on PR
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── dependabot.yml                          # Auto-dependency updates
│
├── apps/                                       # ─── APPLICATIONS (Layer 5) ───
│   │                                           # Entry points. Never imported by packages.
│   │
│   ├── web/                                    # @alharistech/web
│   │   ├── src/
│   │   │   ├── app/                            # Next.js App Router pages
│   │   │   │   ├── [locale]/                   # Locale-prefixed routes (ar/en)
│   │   │   │   │   ├── (marketing)/            # Public pages (route group)
│   │   │   │   │   │   ├── page.tsx            # Homepage
│   │   │   │   │   │   ├── about/page.tsx
│   │   │   │   │   │   └── layout.tsx
│   │   │   │   │   ├── (dashboard)/            # Authenticated pages
│   │   │   │   │   │   ├── dashboard/page.tsx
│   │   │   │   │   │   ├── orders/page.tsx
│   │   │   │   │   │   └── layout.tsx
│   │   │   │   │   ├── api/                    # Next.js API routes (proxy to NestJS)
│   │   │   │   │   └── layout.tsx              # Root layout with providers
│   │   │   ├── components/                     # Web-specific React components
│   │   │   ├── hooks/                          # Web-specific custom hooks
│   │   │   ├── lib/                            # Web-specific utilities
│   │   │   └── styles/                         # Global + Tailwind styles
│   │   ├── public/                             # Static assets
│   │   │   ├── images/
│   │   │   ├── fonts/
│   │   │   └── favicon.ico
│   │   ├── messages/                           # next-intl translation files
│   │   │   ├── ar.json
│   │   │   └── en.json
│   │   ├── next.config.ts                      # Next.js configuration
│   │   ├── tailwind.config.ts                  # Tailwind CSS configuration
│   │   ├── postcss.config.js
│   │   ├── middleware.ts                       # Auth + Locale middleware
│   │   ├── instrumentation.ts                  # OpenTelemetry setup
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── admin/                                  # @alharistech/admin
│   │   ├── src/
│   │   │   ├── app/                            # Next.js App Router
│   │   │   │   ├── [locale]/
│   │   │   │   │   ├── (auth)/                 # Login page
│   │   │   │   │   ├── (dashboard)/            # Admin dashboard
│   │   │   │   │   │   ├── dashboard/page.tsx
│   │   │   │   │   │   ├── users/page.tsx
│   │   │   │   │   │   ├── customers/page.tsx
│   │   │   │   │   │   ├── services/page.tsx
│   │   │   │   │   │   ├── orders/page.tsx
│   │   │   │   │   │   ├── tickets/page.tsx
│   │   │   │   │   │   ├── reports/page.tsx
│   │   │   │   │   │   ├── settings/page.tsx
│   │   │   │   │   │   └── layout.tsx
│   │   │   │   │   └── layout.tsx
│   │   │   ├── components/                     # Admin-specific components
│   │   │   │   ├── charts/                     # Recharts wrappers
│   │   │   │   ├── data-tables/                # TanStack Table configs
│   │   │   │   └── forms/                      # Admin form components
│   │   │   ├── hooks/
│   │   │   └── lib/
│   │   ├── messages/
│   │   │   ├── ar.json
│   │   │   └── en.json
│   │   ├── next.config.ts
│   │   ├── middleware.ts
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── api/                                    # @alharistech/api
│   │   ├── src/
│   │   │   ├── main.ts                         # Bootstrap: NestFactory, global pipes, Swagger
│   │   │   ├── app.module.ts                   # Root module importing all domain modules
│   │   │   ├── common/                         # ─── CROSS-CUTTING ───
│   │   │   │   ├── guards/
│   │   │   │   │   ├── jwt-auth.guard.ts       # JWT verification
│   │   │   │   │   ├── roles.guard.ts          # RBAC enforcement
│   │   │   │   │   └── throttle.guard.ts       # Rate limiting guard
│   │   │   │   ├── interceptors/
│   │   │   │   │   ├── wrap-response.interceptor.ts  # Envelope wrapping
│   │   │   │   │   ├── response-time.interceptor.ts  # Timing header
│   │   │   │   │   └── logging.interceptor.ts        # Request logging
│   │   │   │   ├── filters/
│   │   │   │   │   └── http-exception.filter.ts      # Global error handler
│   │   │   │   ├── pipes/
│   │   │   │   │   ├── zod-validation.pipe.ts         # Zod-based validation
│   │   │   │   │   └── parse-uuid.pipe.ts
│   │   │   │   ├── decorators/
│   │   │   │   │   ├── current-user.decorator.ts      # @CurrentUser() param decorator
│   │   │   │   │   ├── public.decorator.ts            # @Public() skip auth
│   │   │   │   │   └── roles.decorator.ts             # @Roles() RBAC decorator
│   │   │   │   └── middleware/
│   │   │   │       ├── request-id.middleware.ts
│   │   │   │       └── cors.middleware.ts
│   │   │   ├── config/                         # Configuration module
│   │   │   │   ├── app.config.ts
│   │   │   │   ├── database.config.ts
│   │   │   │   ├── redis.config.ts
│   │   │   │   ├── jwt.config.ts
│   │   │   │   └── storage.config.ts
│   │   │   └── modules/                        # ─── DOMAIN MODULES ───
│   │   │       ├── auth/
│   │   │       │   ├── auth.module.ts
│   │   │       │   ├── auth.controller.ts
│   │   │       │   ├── auth.service.ts
│   │   │       │   ├── strategies/
│   │   │       │   │   └── jwt.strategy.ts
│   │   │       │   └── dtos/
│   │   │       │       ├── login.dto.ts
│   │   │       │       └── register.dto.ts
│   │   │       ├── users/
│   │   │       ├── customers/
│   │   │       ├── services/
│   │   │       ├── orders/
│   │   │       └── ...                         # One module per domain
│   │   ├── test/                               # E2E tests
│   │   │   ├── app.e2e-spec.ts
│   │   │   └── jest-e2e.json
│   │   ├── nest-cli.json
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── desktop/                                # @alharistech/desktop
│   │   ├── src/
│   │   │   ├── main.tsx                        # React entry point
│   │   │   ├── App.tsx
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── lib/
│   │   ├── src-tauri/                          # Tauri Rust backend
│   │   │   ├── Cargo.toml
│   │   │   ├── tauri.conf.json
│   │   │   └── src/
│   │   │       └── main.rs
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── mobile/                                 # @alharistech/mobile
│       ├── src/
│       │   ├── app/                            # Expo Router
│       │   ├── components/
│       │   ├── hooks/
│       │   └── lib/
│       ├── app.json                            # Expo config
│       ├── tsconfig.json
│       └── package.json
│
├── packages/                                   # ─── SHARED PACKAGES (Layers 1-3) ───
│   │                                           # Importable by apps and domains
│   │
│   ├── ui/                                     # @alharistech/ui (Layer 3)
│   │   ├── src/
│   │   │   ├── components/                     # shadcn/ui-based components
│   │   │   │   ├── ui/                         # shadcn primitives (button, input, etc.)
│   │   │   │   ├── data-table/                 # DataTable component
│   │   │   │   ├── forms/                      # FormField, FormSelect, etc.
│   │   │   │   └── feedback/                   # Toast, Alert, Skeleton
│   │   │   ├── layouts/                        # Layout components
│   │   │   │   ├── sidebar/
│   │   │   │   ├── header/
│   │   │   │   └── shell/
│   │   │   ├── hooks/                          # Shared UI hooks
│   │   │   │   ├── use-media-query.ts
│   │   │   │   └── use-intersection-observer.ts
│   │   │   ├── lib/
│   │   │   │   └── cn.ts                       # clsx + tailwind-merge
│   │   │   └── index.ts                        # Barrel export
│   │   ├── stories/                            # Storybook stories
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── auth/                                   # @alharistech/auth (Layer 3)
│   │   ├── src/
│   │   │   ├── client.ts                       # Browser: token storage, refresh
│   │   │   ├── server.ts                       # Node: JWT verify, cookie parse
│   │   │   ├── middleware.ts                    # Next.js middleware helper
│   │   │   ├── types.ts                        # Auth-specific types
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── database/                               # @alharistech/database (Layer 3)
│   │   ├── src/
│   │   │   ├── client.ts                       # Prisma client singleton
│   │   │   ├── schema/                         # Generated Zod validators
│   │   │   ├── repository/                     # Base repository class
│   │   │   └── index.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma                   # Database schema (source of truth)
│   │   │   ├── migrations/                     # Generated migration files
│   │   │   └── seeds/                          # Seed scripts
│   │   │       ├── development.ts
│   │   │       ├── test.ts
│   │   │       └── production.ts               # Reference data only
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── sdk/                                    # @alharistech/sdk (Layer 3)
│   │   ├── src/
│   │   │   ├── client.ts                       # API client with auth injection
│   │   │   ├── endpoints/                      # Auto-generated endpoint functions
│   │   │   │   ├── users.ts
│   │   │   │   ├── orders.ts
│   │   │   │   └── ...
│   │   │   ├── types.ts                        # Generated request/response types
│   │   │   └── index.ts
│   │   ├── scripts/
│   │   │   └── generate.ts                     # SDK generation from OpenAPI
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── config/                                 # @alharistech/config (Layer 1)
│   │   ├── eslint/                             # Shared ESLint configurations
│   │   │   ├── base.js                         # Base rules for all packages
│   │   │   ├── next.js                         # Next.js specific rules
│   │   │   ├── nest.js                         # NestJS specific rules
│   │   │   └── react.js                        # React specific rules
│   │   ├── typescript/                         # Shared TypeScript configurations
│   │   │   ├── base.json                       # Base compiler options
│   │   │   ├── next.json                       # Next.js specific
│   │   │   ├── nest.json                       # NestJS specific
│   │   │   └── react.json                      # React library specific
│   │   ├── tailwind/
│   │   │   └── base.ts                         # Shared Tailwind preset
│   │   └── vitest/
│   │       └── base.ts                         # Shared Vitest configuration
│   │
│   ├── logger/                                 # @alharistech/logger (Layer 2)
│   │   ├── src/
│   │   │   ├── logger.ts                       # Winston logger factory
│   │   │   ├── transports/                     # Console, File, JSON transports
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── types/                                  # @alharistech/types (Layer 1)
│   │   ├── src/
│   │   │   ├── user.ts                         # User types + Zod schemas
│   │   │   ├── customer.ts                     # Customer types
│   │   │   ├── order.ts                        # Order types
│   │   │   ├── product.ts                      # Product types
│   │   │   ├── service.ts                      # Service types
│   │   │   ├── ticket.ts                       # Ticket types
│   │   │   ├── api.ts                          # API envelope types
│   │   │   ├── auth.ts                         # Auth payload types
│   │   │   ├── common.ts                       # Shared types (ID, Timestamp, etc.)
│   │   │   └── index.ts                        # Barrel export
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── utils/                                  # @alharistech/utils (Layer 2)
│       ├── src/
│       │   ├── date.ts                         # date-fns wrappers
│       │   ├── string.ts                       # String utilities
│       │   ├── validation.ts                   # Common Zod schemas
│       │   ├── formatting.ts                   # Currency, date formatting (ar/en)
│       │   ├── cn.ts                           # Tailwind class merging
│       │   ├── result.ts                       # Result type implementation
│       │   ├── pagination.ts                   # Cursor/offset pagination helpers
│       │   └── index.ts
│       ├── tsconfig.json
│       └── package.json
│
├── domains/                                    # ─── DOMAIN MODULES (Layer 4) ───
│   │                                           # DDD-structured business logic
│   │
│   ├── identity/                               # @alharistech/domain-identity
│   │   ├── application/                        # Use cases and application services
│   │   │   ├── commands/                       # CQRS commands
│   │   │   ├── queries/                        # CQRS queries
│   │   │   ├── handlers/                       # Command/query handlers
│   │   │   └── services/                       # Application services
│   │   │       └── authentication.service.ts
│   │   ├── domain/                             # Core business logic
│   │   │   ├── entities/
│   │   │   │   ├── user.entity.ts
│   │   │   │   └── session.entity.ts
│   │   │   ├── value-objects/
│   │   │   │   ├── email.vo.ts
│   │   │   │   └── password.vo.ts
│   │   │   ├── repositories/                   # Interfaces (ports)
│   │   │   │   ├── user.repository.ts
│   │   │   │   └── session.repository.ts
│   │   │   └── events/
│   │   │       └── user-registered.event.ts
│   │   ├── infrastructure/                     # Implementations (adapters)
│   │   │   ├── persistence/
│   │   │   │   ├── prisma-user.repository.ts
│   │   │   │   └── redis-session.repository.ts
│   │   │   └── messaging/
│   │   │       └── auth-event.publisher.ts
│   │   ├── presentation/                       # API contracts
│   │   │   ├── dtos/
│   │   │   │   ├── register-user.dto.ts
│   │   │   │   └── login.dto.ts
│   │   │   └── mappers/
│   │   │       └── user.mapper.ts
│   │   ├── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── customer/                               # @alharistech/domain-customer
│   ├── service/                                # @alharistech/domain-service
│   ├── commerce/                               # @alharistech/domain-commerce
│   ├── support/                                # @alharistech/domain-support
│   ├── content/                                # @alharistech/domain-content
│   ├── notification/                           # @alharistech/domain-notification
│   ├── analytics/                              # @alharistech/domain-analytics
│   └── ai/                                     # @alharistech/domain-ai
│
├── infrastructure/                             # ─── DEPLOYMENT ───
│   ├── k8s/                                    # Kubernetes manifests
│   │   ├── base/
│   │   │   ├── namespace.yaml
│   │   │   ├── api-deployment.yaml
│   │   │   ├── api-service.yaml
│   │   │   ├── web-deployment.yaml
│   │   │   └── postgres-statefulset.yaml
│   │   └── overlays/
│   │       ├── staging/
│   │       └── production/
│   └── terraform/                              # Infrastructure as Code
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
│
├── docs/                                       # ─── DOCUMENTATION ───
│   ├── vision/
│   ├── business/
│   ├── requirements/
│   ├── architecture/
│   ├── adr/
│   ├── c4/
│   ├── diagrams/
│   ├── roadmap/
│   ├── workflows/
│   └── governance/
│
├── specs/                                      # ─── SPECIFICATIONS ───
│   ├── identity/
│   ├── customer/
│   ├── service/
│   ├── commerce/
│   ├── support/
│   ├── content/
│   ├── notification/
│   ├── analytics/
│   └── ai/
│
├── tasks/                                      # ─── IMPLEMENTATION PLANS ───
│   ├── master-plan.md
│   ├── phase-1/
│   ├── phase-2/
│   └── phase-3/
│
├── scripts/                                    # ─── SCRIPTS ───
│   ├── setup.sh                                # First-time setup
│   ├── dev.sh                                  # Start all dev services
│   └── db-reset.sh                             # Reset database
│
├── tools/                                      # ─── INTERNAL TOOLS ───
│   ├── code-generator/                         # Code scaffolding
│   └── seed-generator/                         # Fake data generator
│
├── .github/                                    # (duplicated for clarity)
├── .gitignore
├── .gitattributes
├── .editorconfig
├── .prettierrc
├── .eslintrc.js
├── turbo.json
├── package.json                                # Root workspace config
├── pnpm-workspace.yaml                         # Workspace definition
├── pnpm-lock.yaml                              # Lockfile (committed)
├── tsconfig.json                               # Root TypeScript config
├── biome.json                                  # Linter + Formatter
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

---

## Package Dependency Graph

```
                          ┌────────────────────────────────┐
                          │          LAYER 5: APPS          │
                          │                                │
         ┌────────────────┼───────────────────────────────┐│
         │                │                               ││
    ┌────┴─────┐    ┌─────┴──────┐    ┌────────────┐     ││
    │   web    │    │   admin    │    │    api     │      ││
    │ Next.js  │    │  Next.js   │    │  NestJS    │      ││
    └────┬─────┘    └─────┬──────┘    └─────┬──────┘      ││
         │                │                │              ││
    ┌────┴─────┐    ┌─────┴──────┐         │              ││
    │ desktop  │    │   mobile   │         │              ││
    │  Tauri   │    │  Expo/RN   │         │              ││
    └────┬─────┘    └─────┬──────┘         │              ││
         │                │                │              ││
         └────────────────┼────────────────┘              ││
                          │                               ││
         ┌────────────────┼───────────────────────────────┘│
         │                │                                │
         │    LAYER 4: DOMAINS (imported by api only)     │
         │                │                                │
         │   ┌────────────┼────────────┐                   │
         │   │   identity │ commerce  │  ... 7 more ...   │
         │   │   customer │ service   │                   │
         │   └────────────┼────────────┘                   │
         │                │                                │
         │    LAYER 3: SHARED (DEPENDENT)                  │
         │                │                                │
         │   ┌────────────┼────────────┐                   │
         │   │   ui       │ database   │                   │
         │   │   auth     │ sdk        │  logger           │
         │   └────────────┼────────────┘                   │
         │                │                                │
         │    LAYER 2: SHARED (UTILITY)                    │
         │                │                                │
         │   ┌────────────┴────────────┐                   │
         │   │         utils           │                   │
         │   └────────────┬────────────┘                   │
         │                │                                │
         │    LAYER 1: FOUNDATION                          │
         │                │                                │
         │   ┌────────────┴────────────┐                   │
         │   │    types  │   config    │                   │
         │   └────────────┴────────────┘                   │
         │                                                │
         └────────────────────────────────────────────────┘

DEPENDENCY DIRECTION: Bottom → Up
  Layer 5 depends on Layers 1-4
  Layer 4 depends on Layers 1-3
  Layer 3 depends on Layers 1-2
  Layer 2 depends on Layer 1 only
  Layer 1 depends on nothing internal

APP DEPENDENCIES:
  web:     ui, auth, sdk, types, utils, logger
  admin:   ui, auth, sdk, types, utils, logger
  api:     auth, database, types, utils, logger, config, all domains
  desktop: ui, sdk, types, utils, logger
  mobile:  ui, sdk, types, utils, logger
```

---

## Data Flow Between Layers

```
┌──────────────────────────────────────────────────────────────────────┐
│                          USER INTERACTION                            │
│                                                                      │
│  ┌─────────┐    ┌──────────┐    ┌──────────┐    ┌────────────────┐  │
│  │ Browser │    │ Desktop  │    │  Mobile  │    │  Third-Party   │  │
│  │ (Next)  │    │ (Tauri)  │    │ (RN)     │    │  (SDK/REST)    │  │
│  └────┬────┘    └────┬─────┘    └────┬─────┘    └───────┬────────┘  │
│       │              │              │                    │           │
│       │   HTTPS      │   HTTPS      │   HTTPS           │  HTTPS    │
│       ▼              ▼              ▼                    ▼           │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                   PRESENTATION LAYER                         │    │
│  │                                                              │    │
│  │  ┌──────────────────────────────────────────────────────┐   │    │
│  │  │              API Gateway (NestJS)                     │   │    │
│  │  │                                                       │   │    │
│  │  │  ┌─────────┐  ┌──────────┐  ┌──────────┐            │   │    │
│  │  │  │ REST    │  │ GraphQL  │  │ Webhook   │            │   │    │
│  │  │  │ /api/v1 │  │ /graphql │  │ /webhooks │            │   │    │
│  │  │  └────┬────┘  └────┬─────┘  └────┬─────┘            │   │    │
│  │  │       │            │             │                   │   │    │
│  │  │       ▼            ▼             ▼                   │   │    │
│  │  │  ┌──────────────────────────────────────────────┐   │   │    │
│  │  │  │     Common Layer                             │   │   │    │
│  │  │  │  Guards → Interceptors → Pipes → Controllers │   │   │    │
│  │  │  └──────────────────────┬───────────────────────┘   │   │    │
│  │  └─────────────────────────┼───────────────────────────┘   │    │
│  └─────────────────────────────┼───────────────────────────────┘    │
│                                 │                                    │
│                                 ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                   APPLICATION LAYER                          │    │
│  │                                                              │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │    │
│  │  │  identity/   │  │  commerce/   │  │  support/    │ ...  │    │
│  │  │  commands    │  │  commands    │  │  commands    │      │    │
│  │  │  queries     │  │  queries     │  │  queries     │      │    │
│  │  │  handlers    │  │  handlers    │  │  handlers    │      │    │
│  │  │  services    │  │  services    │  │  services    │      │    │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │    │
│  └─────────┼──────────────────┼──────────────────┼─────────────┘    │
│            │                  │                  │                   │
│            ▼                  ▼                  ▼                   │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                     DOMAIN LAYER                             │    │
│  │                                                              │    │
│  │  Entities · Value Objects · Domain Services · Events        │    │
│  │  Repository Interfaces (Ports)                              │    │
│  └─────────────────────────────┬───────────────────────────────┘    │
│                                 │                                    │
│                                 ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                 INFRASTRUCTURE LAYER                         │    │
│  │                                                              │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │    │
│  │  │PostgreSQL│  │  Redis   │  │  S3/Mi-  │  │  BullMQ  │   │    │
│  │  │ (Prisma) │  │ (Cache,  │  │  nIO     │  │ (Jobs,   │   │    │
│  │  │          │  │ Session) │  │ (Files)  │  │  Queue)  │   │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │    │
│  │                                                              │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │    │
│  │  │  Email   │  │   SMS    │  │ Payment  │                  │    │
│  │  │ Provider │  │ Provider │  │ Gateway  │                  │    │
│  │  └──────────┘  └──────────┘  └──────────┘                  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              FRONTEND STATE LAYER                            │    │
│  │                                                              │    │
│  │  TanStack Query (Server State)                               │    │
│  │    ↓                                                         │    │
│  │  @alharistech/sdk (Typed API Client)                         │    │
│  │    ↓                                                         │    │
│  │  HTTP Request → API Gateway → ... (flow above)               │    │
│  │    ↓                                                         │    │
│  │  HTTP Response (Envelope: { data, meta, error })             │    │
│  │    ↓                                                         │    │
│  │  Zod Validation → TypeScript Types                           │    │
│  │    ↓                                                         │    │
│  │  React State → UI Render                                     │    │
│  └─────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Build Pipeline Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                          BUILD PIPELINE                               │
│                                                                       │
│  git push → GitHub                                                    │
│      │                                                                │
│      ▼                                                                │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                    CI PIPELINE (per PR)                       │    │
│  │                                                               │    │
│  │  Step 1: Install                                              │    │
│  │    pnpm install --frozen-lockfile                             │    │
│  │                                                               │    │
│  │  Step 2: Format Check                                         │    │
│  │    pnpm format:check                                          │    │
│  │                                                               │    │
│  │  Step 3: Lint                                                 │    │
│  │    turbo lint     ← Runs in parallel across packages          │    │
│  │                                                               │    │
│  │  Step 4: TypeCheck                                            │    │
│  │    turbo typecheck ← Cached, re-runs only on changes          │    │
│  │                                                               │    │
│  │  Step 5: Test                                                 │    │
│  │    turbo test     ← Vitest, parallel                          │    │
│  │                                                               │    │
│  │  Step 6: Build                                                │    │
│  │    turbo build    ← Parallel: types+config → utils → apps     │    │
│  │                                                               │    │
│  │  Step 7: Security Audit                                       │    │
│  │    pnpm audit --audit-level=high                              │    │
│  │    CodeQL analysis                                            │    │
│  │                                                               │    │
│  │  Step 8: Bundle Size Check                                    │    │
│  │    Compare with budgets                                       │    │
│  │                                                               │    │
│  │  All Passed → PR can be merged                                │    │
│  └──────────────────────────────────────────────────────────────┘    │
│      │                                                                │
│      ▼ (merge to develop)                                            │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                  DEPLOY STAGING                                │    │
│  │                                                               │    │
│  │  Step 1: Build Application                                    │    │
│  │    pnpm build                                                 │    │
│  │                                                               │    │
│  │  Step 2: Run Migrations                                       │    │
│  │    pnpm db:migrate:prod (against staging DB)                  │    │
│  │                                                               │    │
│  │  Step 4: Deploy to Staging (Kubernetes)                       │    │
│  │    kubectl apply -k infrastructure/k8s/overlays/staging       │    │
│  │                                                               │    │
│  │  Step 5: Health Check                                         │    │
│  │    curl https://api.staging.alharistech.com/api/health        │    │
│  │                                                               │    │
│  │  Step 6: E2E Smoke Tests                                      │    │
│  │    Playwright against staging                                 │    │
│  └──────────────────────────────────────────────────────────────┘    │
│      │                                                                │
│      ▼ (merge to main, manual trigger)                               │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                 DEPLOY PRODUCTION                              │    │
│  │                                                               │    │
│  │  Same steps as staging, but:                                  │    │
│  │  - Production database                                        │    │
│  │  - Gradual rollout (canary → 10% → 50% → 100%)               │    │
│  │  - Monitor: error rate, latency, CPU, memory                  │    │
│  │  - Auto-rollback if error rate > threshold                    │    │
│  └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Turborepo Build Order (Topological)

```
turbo build execution plan:
────────────────────────────

PHASE 1 (parallel, no dependencies):
  ┌────────────────────┐  ┌────────────────────┐
  │ @alharistech/types │  │ @alharistech/config│
  │     (tsc)          │  │     (no build)     │
  └────────┬───────────┘  └─────────┬──────────┘
           │                        │
PHASE 2 (parallel, depend on Phase 1):
           ▼                        │
  ┌────────────────────┐            │
  │ @alharistech/utils │  ◄─────────┘
  │     (tsc)          │
  └────────┬───────────┘
           │
PHASE 3 (parallel, depend on Phase 2):
           ▼
  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐
  │ @alharistech/logger│  │ @alharistech/auth  │  │ @alharistech/ui    │
  │     (tsc)          │  │     (tsc)          │  │     (tsc)          │
  └────────┬───────────┘  └────────┬───────────┘  └────────┬───────────┘
           │                       │                       │
  ┌────────┴───────────┐  ┌────────┴───────────┐          │
  │ @alharistech/      │  │ @alharistech/sdk   │          │
  │ database            │  │     (tsc)          │          │
  │ (tsc + generate)   │  └────────┬───────────┘          │
  └────────┬───────────┘           │                       │
           │                       │                       │
PHASE 4 (parallel, depend on Phase 3):
           ▼                       ▼                       ▼
  ┌────────────────────────────────────────────────────────────┐
  │  @alharistech/domain-identity   @alharistech/domain-...    │
  │  (tsc — 9 domain packages)                                 │
  └────────────────────────────┬───────────────────────────────┘
                               │
PHASE 5 (parallel, depend on Phase 4 + Phase 3):
                               ▼
  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │  @alh/web    │  │ @alh/admin   │  │  @alh/api    │
  │  next build  │  │  next build  │  │  nest build  │
  └──────────────┘  └──────────────┘  └──────────────┘
  ┌──────────────┐  ┌──────────────┐
  │ @alh/desktop │  │ @alh/mobile  │
  │ tauri build  │  │ expo build   │
  └──────────────┘  └──────────────┘

Total build time (cold): ~2-3 minutes
Total build time (cached, no changes): ~30 seconds
```

---

## Import Boundary Rules

```
╔══════════════════════════════════════════════════════════════════╗
║                      IMPORT BOUNDARIES                          ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  APPS (web, admin, api, desktop, mobile)                         ║
║  │                                                               ║
║  ├── ✅ CAN import from: packages/*                              ║
║  ├── ✅ CAN import from: domains/*    (api only)                 ║
║  ├── ❌ CANNOT import from: other apps                           ║
║  │   e.g., web CANNOT import from admin                          ║
║  │                                                                  ║
║  DOMAINS (identity, customer, commerce, ...)                     ║
║  │                                                               ║
║  ├── ✅ CAN import from: packages/* (except config at runtime)   ║
║  ├── ❌ CANNOT import from: other domains                        ║
║  │   e.g., commerce CANNOT import from customer                  ║
║  ├── ❌ CANNOT import from: apps/*                               ║
║  │                                                                  ║
║  SHARED PACKAGES (ui, auth, database, sdk, logger)               ║
║  │                                                               ║
║  ├── ✅ CAN import from: packages/types                          ║
║  ├── ✅ CAN import from: packages/utils                          ║
║  ├── ❌ CANNOT import from: apps/*                               ║
║  ├── ❌ CANNOT import from: domains/*                            ║
║  ├── ❌ CANNOT import from: other shared packages                ║
║  │   e.g., ui CANNOT import from auth                            ║
║  │                                                                  ║
║  UTILITY PACKAGES (utils)                                        ║
║  │                                                               ║
║  ├── ✅ CAN import from: packages/types                          ║
║  ├── ❌ CANNOT import from: anything else                        ║
║  │                                                                  ║
║  FOUNDATION PACKAGES (types, config)                             ║
║  │                                                               ║
║  ├── ❌ CANNOT import from: ANY internal package                 ║
║  │   Only external dependencies allowed (zod, etc.)              ║
║  │                                                                  ║
║  CONFIG PACKAGE                                                  ║
║  │                                                               ║
║  ├── May only appear in devDependencies                          ║
║  ├── NEVER imported at runtime                                   ║
║  │                                                                  ║
╚══════════════════════════════════════════════════════════════════╝

ENFORCEMENT:
  ├── ESLint: import/no-restricted-paths (CI blocks violations)
  ├── Turborepo: dependsOn (cyclic deps cause build failure)
  ├── TypeScript: project references (incorrect imports = type error)
  └── Code Review: manual check for boundary violations
```

---

## Technology Stack Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     TECHNOLOGY STACK                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  FRONTEND                                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Next.js 15 (App Router) · React 19 · TypeScript 5    │  │
│  │ TailwindCSS · shadcn/ui · Radix UI · Lucide Icons    │  │
│  │ TanStack Query · TanStack Table · React Hook Form    │  │
│  │ next-intl · next-themes · Recharts · date-fns        │  │
│  │ Zod · Sonner (toasts)                                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  BACKEND                                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ NestJS 10 · TypeScript 5 · Prisma 5 · PostgreSQL 16  │  │
│  │ Redis 7 · BullMQ · Apollo GraphQL · Swagger/OpenAPI   │  │
│  │ Passport · JWT · bcryptjs · Helmet · Zod              │  │
│  │ Winston (logging) · class-validator · class-transformer│  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  DESKTOP                                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Tauri 2 · React 19 · Vite · Rust (backend)           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  MOBILE                                                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Expo 51 · React Native 0.74 · React Navigation       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  INFRASTRUCTURE                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Docker · Kubernetes · Terraform · GitHub Actions     │  │
│  │ PostgreSQL · Redis · MinIO/S3 · pgBouncer            │  │
│  │ Prometheus · Grafana · OpenTelemetry · Sentry        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  TOOLING                                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Turborepo · pnpm · Changesets · Biome · ESLint       │  │
│  │ Prettier · Vitest · Playwright · Storybook           │  │
│  │ Husky · lint-staged · Commitlint                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Environment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     ENVIRONMENTS                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  DEVELOPMENT (Local)                                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ PostgreSQL + Redis (local, installed directly)       │  │
│  │ pnpm dev (all apps in parallel via Turbo)            │  │
│  │ Hot reload on all apps                               │  │
│  │ Localhost: web:3000, admin:3001, api:4000            │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  STAGING                                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Kubernetes cluster (small)                           │  │
│  │ staging.alharistech.com                              │  │
│  │ Anonymized test data                                 │  │
│  │ Full monitoring                                      │  │
│  │ Auto-deployed from develop branch                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  PRODUCTION                                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Kubernetes cluster (production scale)                │  │
│  │ alharistech.com · admin.alharistech.com              │  │
│  │ Managed PostgreSQL + Redis                           │  │
│  │ CDN (CloudFront) · WAF                               │  │
│  │ Auto-scaling · Read replicas · Backup automation     │  │
│  │ Manual deploy from main branch                       │  │
│  │ Canary deployments · Auto-rollback                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```
