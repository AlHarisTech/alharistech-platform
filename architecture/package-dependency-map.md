# Package Dependency Map — AlharisTech Platform

## Overview

This document defines the complete dependency graph between all packages and applications in the AlharisTech monorepo. It establishes which packages can depend on which, prevents circular dependencies, and sets bundle size budgets for each application.

---

## Dependency Graph (Visual)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         LAYER 5: APPS                               │
│                                                                     │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────┐│
│   │   web    │  │  admin   │  │   api    │  │ desktop  │  │mobile ││
│   │ Next.js  │  │ Next.js  │  │ NestJS   │  │  Tauri   │  │ RN   ││
│   └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──┬───┘│
│        │              │             │             │           │     │
├────────┼──────────────┼─────────────┼─────────────┼───────────┼─────┤
│        │              │    LAYER 4: DOMAINS        │           │     │
│        │              │             │             │           │     │
│   ┌────┴─────┐  ┌─────┴────┐  ┌────┴─────┐       │           │     │
│   │ identity │  │ customer │  │ commerce │  ... 8 more ...   │     │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘       │           │     │
│        │              │             │             │           │     │
├────────┼──────────────┼─────────────┼─────────────┼───────────┼─────┤
│        │     LAYER 3: SHARED PACKAGES (DEPENDENT)  │           │     │
│        │              │             │             │           │     │
│   ┌────┴────┐  ┌──────┴──────┐ ┌───┴────┐  ┌────┴────┐      │     │
│   │   ui    │  │    auth     │ │   sdk  │  │database │      │     │
│   │(shadcn) │  │ (client+   │ │ (REST) │  │(Prisma) │      │     │
│   │         │  │  server)   │ │        │  │         │      │     │
│   └────┬────┘  └──────┬──────┘ └───┬────┘  └────┬────┘      │     │
│        │              │             │             │           │     │
│   ┌────┴──────────────┴─────────────┴─────────────┴────┐      │     │
│   │                    logger                          │      │     │
│   │                  (Winston)                        │      │     │
│   └──────────────────────┬────────────────────────────┘      │     │
│                          │                                   │     │
├──────────────────────────┼───────────────────────────────────┼─────┤
│    LAYER 2: SHARED PACKAGES (UTILITY)                        │     │
│                          │                                   │     │
│   ┌──────────────────────┴──────────────────────────┐        │     │
│   │                    utils                        │        │     │
│   │           (date, string, validation,            │        │     │
│   │            formatting, result, pagination)      │        │     │
│   └──────────────────────┬──────────────────────────┘        │     │
│                          │                                   │     │
├──────────────────────────┼───────────────────────────────────┼─────┤
│    LAYER 1: FOUNDATION PACKAGES                              │     │
│                          │                                   │     │
│   ┌──────────────────────┴──────────────────────────┐        │     │
│   │                    types                        │        │     │
│   │     (All shared TypeScript interfaces,          │        │     │
│   │      types, enums, Zod schemas)                 │        │     │
│   └─────────────────────────────────────────────────┘        │     │
│                                                               │     │
│   ┌──────────────────────────────────────────────────┐       │     │
│   │                    config                        │       │     │
│   │     (ESLint, TypeScript, Tailwind, Vitest)       │       │     │
│   └──────────────────────────────────────────────────┘       │     │
└─────────────────────────────────────────────────────────────────────┘

Legend:
  ───  Direct dependency (imports)
  →    Depends on
```

---

## Dependency Matrix

| | types | config | utils | logger | auth | database | ui | sdk | identity | customer | commerce | web | admin | api | desktop | mobile |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **types** | - | N | N | N | N | N | N | N | N | N | N | N | N | N | N | N |
| **config** | N | - | N | N | N | N | N | N | N | N | N | N | N | N | N | N |
| **utils** | Y | N | - | N | N | N | N | N | N | N | N | N | N | N | N | N |
| **logger** | Y | N | N | - | N | N | N | N | N | N | N | N | N | N | N | N |
| **auth** | Y | N | Y | N | - | N | N | N | N | N | N | N | N | N | N | N |
| **database** | Y | N | Y | N | N | - | N | N | N | N | N | N | N | N | N | N |
| **ui** | Y | N | Y | N | N | N | - | N | N | N | N | N | N | N | N | N |
| **sdk** | Y | N | Y | N | N | N | N | - | N | N | N | N | N | N | N | N |
| **identity** | Y | N | Y | Y | Y | Y | N | N | - | N | N | N | N | N | N | N |
| **customer** | Y | N | Y | Y | Y | Y | N | N | N | - | N | N | N | N | N | N |
| **commerce** | Y | N | Y | Y | Y | Y | N | N | N | N | - | N | N | N | N | N |
| **web** | Y | N | Y | Y | Y | N | Y | Y | N | N | N | - | N | N | N | N |
| **admin** | Y | N | Y | Y | Y | N | Y | Y | N | N | N | N | - | N | N | N |
| **api** | Y | Y | Y | Y | Y | Y | N | N | Y | Y | Y | N | N | - | N | N |
| **desktop** | Y | N | Y | N | N | N | Y | Y | N | N | N | N | N | N | - | N |
| **mobile** | Y | N | Y | N | N | N | Y | Y | N | N | N | N | N | N | N | - |

**Legend:** Y = Depends on, N = Does NOT depend on

**Column = dependency target** (what is being imported).  
**Row = dependent** (who is doing the importing).

Example: Row `web`, Column `ui` → Y means `@alharistech/web` depends on `@alharistech/ui`.

---

## Dependency Rules by Package

### Layer 1: Foundation (Zero Internal Dependencies)

#### `@alharistech/types`
- **Depends on:** Nothing (except `zod` - external)
- **Depended on by:** Everything except `config`
- **Contents:** All shared interfaces, types, enums, Zod schemas for validation
- **Rule:** Must remain pure type definitions. No runtime logic. No side effects.

#### `@alharistech/config`
- **Depends on:** Nothing
- **Depended on by:** All devDependencies
- **Contents:** Shared ESLint configs, TypeScript base configs, Tailwind presets, Vitest defaults
- **Rule:** Must be dev-only. Never imported at runtime.

### Layer 2: Utility (Depends only on `types`)

#### `@alharistech/utils`
- **Depends on:** `@alharistech/types`
- **Depended on by:** All packages except `config`
- **Contents:** Pure utility functions: date, string, validation, formatting, Result type, pagination helpers
- **Rule:** No side effects. All functions pure. No React/NestJS imports.

#### `@alharistech/logger`
- **Depends on:** `@alharistech/types`
- **Depended on by:** Apps, domains
- **Contents:** Winston-based structured logger with JSON, console, and file transports
- **Rule:** Single logger instance per process. Must support correlation IDs.

### Layer 3: Shared Packages (Dependent)

#### `@alharistech/auth`
- **Depends on:** `types`, `utils`
- **Depended on by:** Apps, identity domain
- **Contents:** Client-side auth helpers (JWT storage, refresh), server-side middleware, types
- **Rule:** Must work in both browser and Node.js. Tree-shakeable client/server code.

#### `@alharistech/database`
- **Depends on:** `types`, `utils`
- **Depended on by:** API, domains
- **Contents:** Prisma client, schema, migrations, seeds
- **Rule:** Must not export Prisma client directly — wrap in repository pattern. Only imported server-side.

#### `@alharistech/ui`
- **Depends on:** `types`, `utils`
- **Depended on by:** web, admin, desktop
- **Contents:** shadcn/ui-based React components, layouts, forms, hooks
- **Rule:** React-only. No server logic. No API calls. All data via props.

#### `@alharistech/sdk`
- **Depends on:** `types`, `utils`
- **Depended on by:** web, admin, desktop, mobile
- **Contents:** Typed API client, endpoint definitions, request/response types
- **Rule:** Browser-safe only. No Node.js dependencies. Must be tree-shakeable.

### Layer 4: Domain Modules

#### `@alharistech/domain-*`
- **Depends on:** `types`, `utils`, `logger`, `auth`, `database`
- **Depended on by:** `api`
- **Contents:** DDD-structured business logic per business domain
- **Rule:** Domains MUST NOT import from each other. Cross-domain communication via events or application layer.

### Layer 5: Applications

#### `@alharistech/web` and `@alharistech/admin`
- **Depends on:** `ui`, `auth`, `sdk`, `types`, `utils`, `logger`
- **Depended on by:** Nothing
- **Purpose:** End-user applications. Never imported by any package.

#### `@alharistech/api`
- **Depends on:** `auth`, `database`, `types`, `utils`, `logger`, `config`, all `domain-*`
- **Depended on by:** Nothing
- **Purpose:** API Gateway that composes domains into endpoints.

#### `@alharistech/desktop` and `@alharistech/mobile`
- **Depends on:** `ui` (subset), `sdk`, `types`, `utils`, `logger`
- **Depended on by:** Nothing
- **Note:** Desktop/mobile use a subset of `@alharistech/ui` — web-specific components are excluded.

---

## Circular Dependency Prevention Rules

### Rule 1: No Bidirectional Dependencies
No two packages may depend on each other. This is enforced by Turborepo's `dependsOn` and ESLint rules.

### Rule 2: Layer Direction is One-Way
Packages may only depend on packages in lower layers:

```
Layer 5 (Apps) → can import from Layers 1-4
Layer 4 (Domains) → can import from Layers 1-3
Layer 3 (Shared Dependent) → can import from Layers 1-2
Layer 2 (Shared Utility) → can import from Layer 1 only
Layer 1 (Foundation) → can import from nothing internal
```

### Rule 3: No Horizontal Imports Between Domains
`@alharistech/domain-commerce` MUST NOT import `@alharistech/domain-customer`. Cross-domain communication must use:
- Application-level orchestration in `api/`
- Event-driven communication via `@nestjs/event-emitter`
- Shared types from `@alharistech/types`

### Rule 4: No Upward Imports
Apps can never be imported. Packages can never import from apps. This is an absolute rule.

### Rule 5: Config is Dev-Only
`@alharistech/config` may ONLY appear in `devDependencies`. Runtime code must never import from it.

### Detection

```bash
# Check for circular dependencies automatically in CI:
pnpm run typecheck  # Turbo runs all typechecks, catches import errors

# Manual check with madge:
npx madge --circular --extensions ts,tsx packages/types/src/index.ts
npx madge --circular --extensions ts,tsx apps/api/src/main.ts
```

---

## Bundle Size Budgets

Enforced via `@next/bundle-analyzer` (web/admin) and custom tooling for other apps.

### `@alharistech/web` — Public Website

| Resource | Budget | Measurement |
|:---|:---|:---|
| Initial JS (gzipped) | < 150 KB | `next build` output |
| Total JS (gzipped) | < 250 KB | `next build` output |
| First Load CSS (gzipped) | < 30 KB | `next build` output |
| Largest chunk (gzipped) | < 80 KB | `next build` output |
| Images total | < 500 KB | Manual audit |
| Lighthouse Performance | ≥ 90 | CI audit |

### `@alharistech/admin` — Admin Dashboard

| Resource | Budget | Measurement |
|:---|:---|:---|
| Initial JS (gzipped) | < 200 KB | `next build` output |
| Total JS (gzipped) | < 350 KB | `next build` output |
| First Load CSS (gzipped) | < 50 KB | `next build` output |
| Largest chunk (gzipped) | < 120 KB | `next build` output |
| Lighthouse Performance | ≥ 85 | CI audit |

### `@alharistech/desktop` — Desktop App

| Resource | Budget | Measurement |
|:---|:---|:---|
| App bundle (gzipped) | < 500 KB | Tauri build output |
| Memory (idle) | < 100 MB | Manual profiling |
| Memory (active) | < 300 MB | Manual profiling |

### `@alharistech/mobile` — Mobile App

| Resource | Budget | Measurement |
|:---|:---|:---|
| APK size (Android) | < 30 MB | Expo build output |
| IPA size (iOS) | < 40 MB | Expo build output |
| JS bundle (gzipped) | < 200 KB | Metro bundler |
| Startup time (cold) | < 2s | Manual profiling |

### `@alharistech/api` — API (no bundle budget, performance budget instead)

| Metric | Budget | Measurement |
|:---|:---|:---|
| p95 latency | < 200ms | OpenTelemetry / k6 |
| p99 latency | < 500ms | OpenTelemetry / k6 |
| Memory usage | < 512 MB | Process metrics |
| CPU usage | < 70% | Process metrics |

### Shared Package Bundle Impact

Shared packages are tree-shaken by bundlers (Next.js, Vite, Metro). However, each shared package must keep its bundle impact minimal:

| Package | Max uncompressed size | Enforcement |
|:---|:---|:---|
| `@alharistech/types` | N/A (types erased at compile time) | — |
| `@alharistech/utils` | < 20 KB | `size-limit` in CI |
| `@alharistech/logger` | < 15 KB (server-only) | `size-limit` in CI |
| `@alharistech/auth` | < 10 KB browser, < 5 KB server | `size-limit` in CI |
| `@alharistech/sdk` | < 25 KB | `size-limit` in CI |
| `@alharistech/ui` | < 50 KB (per imported component) | Storybook + manual |
| `@alharistech/database` | N/A (server-only, not bundled) | — |

---

## Dependency Update Strategy

### Automated Updates

```
Renovate / Dependabot configured with:
  - Schedule: weekly (Monday 9 AM UTC+3)
  - Grouped PRs: all non-major updates in one PR
  - Auto-merge: patch updates after CI passes
  - Manual review: major and minor updates
  - Lockfile: pnpm-lock.yaml committed
```

### Vulnerability Response

```
Critical: Patch within 24 hours, deploy immediately
High: Patch within 72 hours, deploy at next release window
Medium: Patch within 1 week
Low: Patch within next sprint
```

### Dependency Audit Command

```bash
pnpm audit                # Check for known vulnerabilities
pnpm why <package-name>   # Find why a package is installed
pnpm dedupe              # Deduplicate dependencies
```

---

## New Package Addition Checklist

When adding a new package to the monorepo:

1. Create directory under `packages/` or `domains/`
2. Add `package.json` with `"name": "@alharistech/<name>"`
3. Add to `pnpm-workspace.yaml` (if new top-level, e.g., `tools/*` already exists)
4. Add `turbo.json` tasks if needed
5. Create `tsconfig.json` extending `@alharistech/config/typescript/base.json` (or specific)
6. Create barrel export `src/index.ts`
7. Run `pnpm install` to link the package
8. Verify with `pnpm list --depth=0 --filter=@alharistech/<name>`
9. Update this document with new dependency matrix row/column
10. Submit PR with dependency map diff

---

## Summary of Critical Rules

| Rule | Enforcement | Severity |
|:---|:---|:---|
| No circular dependencies | CI: `madge --circular` | **BLOCKER** |
| No apps importing apps | ESLint `no-restricted-paths` | **BLOCKER** |
| No packages importing apps | ESLint `no-restricted-paths` | **BLOCKER** |
| `types` must have zero internal deps | CI: dependency check script | **BLOCKER** |
| `config` must have zero internal deps | CI: dependency check script | **BLOCKER** |
| Bundle size exceeds budget | CI: Bundle analyzer comparison | **WARNING** |
| `config` in `dependencies` (not `devDependencies`) | CI: package.json linter | **BLOCKER** |
| Domains importing each other | ESLint `no-restricted-imports` | **BLOCKER** |
| `database` imported in browser bundle | Tree-shaking verification | **BLOCKER** |
