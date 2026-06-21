# ARCHITECTURE_KNOWN_GAPS
## AlharisTech Platform — v0.6.1-audit-clean

### Audit Limitations
- **Endpoint Count Discrepancy (RESOLVED):** Service catalog initially reported 184. OpenAPI path+method verification confirmed 149. Fixed in v0.6.1 across all files including contract specs.
- **Monorepo Bootstrap Gap (RESOLVED):** Root package.json, pnpm-workspace.yaml, and turbo.json were missing. Created in v0.6.1.
- **Docker References in Docs (RESOLVED):** Multiple operational docs referenced Docker despite explicit decision not to use Docker in development. Cleaned in v0.6.1.
- **ADR Depth (RESOLVED):** ADR-001, 002, 012 were concise. Expanded to full format in v0.6.1.
- **TypeScript Build Errors (RESOLVED in v0.6.3):** Initial build had 18 TS errors. v0.6.1 fixed ContractInterceptor/ContractPipe AJV boolean issues and main.ts Reflector typing (14 errors). v0.6.3 fixes remaining: policy.guard.ts JWT payload type narrowing (4 errors) and schema-registry.service.ts resolvedOp typing (4 errors). Endpoint count 184→149 completed across all 7 files including execution-boundaries.yaml.

### Runtime Assumptions
- PostgreSQL 16 is installed and running locally on the developer's machine (not via Docker)
- Redis 7 is installed and running locally
- Node.js 20+ is available
- pnpm 9+ is installed globally
- No containerization layer exists between developer and services
- This applies to development only. Production deployment strategy is not yet determined.

### Known Architectural Risks
1. **CRBL-001 — ContractPipe DTO Validation (RESOLVED in v0.6.10):** ContractPipe is request-scoped, injects Fastify request via REQUEST token, extracts route pattern from `request.routeOptions.url`, converts Fastify `:param` → OpenAPI `{param}`, and calls SchemaRegistry.getRequestValidator(). Matching fixed for parameterized routes. ContractInterceptor also updated with same route pattern resolution. HTTP enforcement reaches ~95%.
2. **CRBL Centralization:** ContractGuard, PolicyGuard, ContractPipe, ContractInterceptor, EventValidator, and SchemaRegistry all live in the same NestJS process. If CRBL grows further, it may need extraction into a dedicated enforcement service.
3. **EventValidator Runtime Gap:** EventValidator is implemented but BullMQ worker infrastructure is not yet deployed. Event enforcement exists in code but cannot be tested end-to-end without a running worker.
4. **Single Database Instance:** Current design assumes a single PostgreSQL instance. Read replicas for analytics and horizontal scaling are designed but not implemented.
5. **No Observability Stack:** Prometheus, Grafana, OpenTelemetry are specified but not configured. Development relies on console logging.
6. **No CI/CD Pipeline:** GitHub Actions workflows are specified but not active. Token scope limitation prevents workflow file deployment.
7. **JWT Dev Defaults:** JWT secrets use `dev-*-change-in-production` placeholders. These must be rotated before any production deployment.

### Deferred Decisions
1. **Kubernetes Migration (Phase 5):** Current architecture uses direct process execution. Kubernetes is deferred to Phase 5.
2. **GraphQL Federation:** Single GraphQL endpoint via NestJS code-first for Phase 1-4. Apollo Federation evaluated at Phase 5.
3. **Multi-Tenant Strategy:** Database-per-tenant vs schema-per-tenant decision deferred to Phase 5 design.
4. **Observability Stack Selection:** Prometheus vs Grafana Cloud vs Datadog — deferred to Sprint 0.6.1 or Phase 2.
5. **Email/SMS Provider Selection:** Provider selection deferred to Phase 2 (Notification domain implementation).

### Review Readiness
- [x] All ADRs written and accepted (24/24)
- [x] All domain specs complete (9/9)
- [x] All OpenAPI specs complete (9/9, 149 endpoints)
- [x] CRBL consistency: 5/5 layers unified canonical routes (ContractGuard, PolicyGuard, ContractPipe, ContractInterceptor, SchemaRegistry) — v0.6.12
- [x] CRBL components: 4/6 runtime-active, 1 structural (SchemaRegistry), 1 spec (EventValidator)
- [x] Endpoint count corrected
- [x] Monorepo config present
- [x] Docker references cleaned
- [x] ADRs expanded to full format
- [ ] External architectural review not yet performed
- [ ] Sprint 1 authorization not yet granted
