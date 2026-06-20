# ARCHITECTURE_KNOWN_GAPS
## AlharisTech Platform — v0.6.1-audit-clean

### Audit Limitations
- **Endpoint Count Discrepancy (RESOLVED):** Service catalog initially reported 184. OpenAPI path+method verification confirmed 149. Fixed in v0.6.1.
- **Monorepo Bootstrap Gap (RESOLVED):** Root package.json, pnpm-workspace.yaml, and turbo.json were missing. Created in v0.6.1.
- **Docker References in Docs (RESOLVED):** Multiple operational docs referenced Docker despite explicit decision not to use Docker in development. Cleaned in v0.6.1.
- **ADR Depth (RESOLVED):** ADR-001, 002, 012 were concise. Expanded to full format in v0.6.1.

### Runtime Assumptions
- PostgreSQL 16 is installed and running locally on the developer's machine (not via Docker)
- Redis 7 is installed and running locally
- Node.js 20+ is available
- pnpm 9+ is installed globally
- No containerization layer exists between developer and services
- This applies to development only. Production deployment strategy is not yet determined.

### Known Architectural Risks
1. **CRBL Centralization:** ContractGuard, PolicyGuard, ContractPipe, ContractInterceptor, EventValidator, and SchemaRegistry all live in the same NestJS process. If CRBL grows further, it may need extraction into a dedicated enforcement service.
2. **EventValidator Runtime Gap:** EventValidator is implemented but BullMQ worker infrastructure is not yet deployed. Event enforcement exists in code but cannot be tested end-to-end without a running worker.
3. **Single Database Instance:** Current design assumes a single PostgreSQL instance. Read replicas for analytics and horizontal scaling are designed but not implemented.
4. **No Observability Stack:** Prometheus, Grafana, OpenTelemetry are specified but not configured. Development relies on console logging.
5. **No CI/CD Pipeline:** GitHub Actions workflows are specified but not active. Token scope limitation prevents workflow file deployment.
6. **JWT Dev Defaults:** JWT secrets use `dev-*-change-in-production` placeholders. These must be rotated before any production deployment.

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
- [x] CRBL active (5/6 components, EventValidator spec-only)
- [x] Endpoint count corrected
- [x] Monorepo config present
- [x] Docker references cleaned
- [x] ADRs expanded to full format
- [ ] External architectural review not yet performed
- [ ] Sprint 1 authorization not yet granted
