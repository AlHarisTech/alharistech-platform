# Sprint 4 Backlog — Architecture Formalization & Security Hardening

## Status
Draft — open for revision before kickoff

## Baseline
- **Previous:** Sprint 3 — v0.9.9-rc2 (`2a4591f`)
- **CI:** verify ✅ integration ✅ e2e ✅
- **Gates:** OI-001–OI-027, G-01–G-06 enforced
- **ADR count:** 25/25 accepted

---

## P0 — مؤكدة من audit v0.9.9-rc2 (دين تقني حقيقي)

### P0.1 — CRBL-002: Circular $ref in Category/MenuItem

| Field | Value |
|-------|-------|
| **Type** | Architectural Decision + Code |
| **Evidence** | Audit log: `Circular $ref resolved via open schema: Category (×4)`, `MenuItem (×6)` |
| **Impact** | Commerce endpoints using these schemas bypass request validation (open schema fallback) |
| **Required** | ADR-026 deciding flattening vs manual resolution order, then implementation |
| **Estimate** | ADR (1 session) + Implementation (1–2 sessions) |

**Options:**
1. **Flattening** — Resolve all `$ref` at load time, produce standalone schemas. Cleaner, but loses DRY.
2. **Manual resolution order** — Register referenced schemas before dependents via `addSchema()`. Preserves DRY, but fragile.

### P0.2 — AJV Duplicate Schema Registration Guard

| Field | Value |
|-------|-------|
| **Type** | Bug fix |
| **Evidence** | Audit stderr: multiple schemas (e.g. `ErrorResponse`, `PaginationMeta`, `DeleteResponse`) registered twice |
| **Impact** | AJV errors on stderr, no functional breakage (registry continues, status=healthy) |
| **Required** | `try/catch` or pre-check in the schema loading loop |
| **Estimate** | < 1 session |
| **ADR needed?** | No |

---

## P1 — من Sprint 3 Handoff + Audit

### P1.1 — Auth Middleware for Mutation Routes

| Field | Value |
|-------|-------|
| **Source** | Sprint 3 handoff — TD-001 partial resolution completed (rc2) |
| **What's done** | Controller-level `@Public()` removed → read-only routes public, mutation routes fail-closed (404 from ContractGuard) |
| **Remaining** | Wire actual auth guard so mutation routes return 401/403 with proper challenge, not 404 |
| **Dependencies** | Requires JWT verification or API key infrastructure — scope unclear |
| **Estimate** | TBD — depends on auth strategy decision |

### P1.2 — Runtime E2E Flakiness Validation

| Field | Value |
|-------|-------|
| **Source** | Sprint 3 handoff, FR-001 |
| **Current state** | CI has PG+Redis services, but local runs blocked (no Docker on dev machine) |
| **Goal** | 10–20 successful local runs before promotion |
| **Blocked by** | Local PG/Redis setup, or Docker availability |
| **Workaround** | CI-only validation — less ideal but functional |

---

## Future Candidates (not yet prioritized)

- **Vite → API proxy hardening:** current proxy assumes `:4000` hardcoded
- **SchemaRegistry stats endpoint hardening:** add TTL cache, rate limiting
- **EventValidator activation (Stage 4):** pending CRBL completion
- **Docker Compose deployment model:** production packaging
- **Container registry + release pipeline:** CI/CD for deployments

---

## Notes

- Sprint 4 opens with **no open CI failures** — clean handoff from Sprint 3
- P0 items are audit-confirmed, not speculative — implementation directly improves system integrity
- P0.1 and P0.2 can run in parallel (different files, no dependency)
