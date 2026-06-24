# Sprint 4 Backlog — Architecture Formalization & Security Hardening

## Status
Active — P0 closed, P1 in progress

## Baseline
- **Previous:** Sprint 3 — v0.9.9-rc2 (`2a4591f`)
- **CI:** verify ✅ integration ✅ e2e ✅
- **Gates:** OI-001–OI-027, G-01–G-06 enforced
- **ADR count:** 25/26 (25 accepted, 1 proposed)

---

## P0 — مغلق في v0.9.9-rc2

### P0.1 — CRBL-002: Circular $ref ✅ (Option B)

| Field | Value |
|-------|-------|
| **Closed in** | `6b38d37` — v0.9.9-rc2 |
| **ADR** | [ADR-026](./adr/adr-026-recursive-schema-validation.md) — Option C: tactical B now, strategic A later |
| **What closed** | `return true` → `{ type: 'object' }` — primitive injection prevented |
| **Remaining** | Deep property validation (Option A) → P1.3 |

### P0.2 — AJV Duplicate Schema Registration ✅

| Field | Value |
|-------|-------|
| **Closed in** | `1f3bff6` — v0.9.9-rc2 |
| **What closed** | `already exists` errors now debug-logged, not error-logged |

---

## P1 — Active (Sprint 4)

### P1.1 — Auth Middleware for Mutation Routes

| Field | Value |
|-------|-------|
| **Priority** | 1 — ثغرة أمنية فعلية |
| **Source** | Sprint 3 handoff — TD-001 partial resolution completed (rc2) |
| **What's done** | Controller-level `@Public()` removed → read-only routes public, mutation routes fail-closed (404 from ContractGuard) |
| **Remaining** | Wire actual auth guard so mutation routes return 401/403 with proper challenge, not 404 |
| **Dependencies** | Requires JWT verification or API key infrastructure — scope unclear |
| **Estimate** | TBD — depends on auth strategy decision |

### P1.2 — Runtime E2E Flakiness Validation

| Field | Value |
|-------|-------|
| **Priority** | 3 |
| **Source** | Sprint 3 handoff, FR-001 |
| **Current state** | CI has PG+Redis services, but local runs blocked (no Docker on dev machine) |
| **Goal** | 10–20 successful local runs before promotion |
| **Blocked by** | Local PG/Redis setup, or Docker availability |
| **Workaround** | CI-only validation — less ideal but functional |

### P1.3 — Deep Recursive Schema Validation (CRBL-002 Option A)

| Field | Value |
|-------|-------|
| **Priority** | 2 — دين معماري |
| **Source** | ADR-026 — Option C |
| **What's done** | Option B: type-confusion gap closed |
| **Remaining** | AJV-native `$ref` resolution with `$id` injection across all 9 spec files |
| **Dependencies** | None — can proceed independently |
| **Estimate** | 1–2 sessions |

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
