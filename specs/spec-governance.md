# Spec Governance
## Specification Management Policies for AlharisTech Platform

**Version:** 1.0
**Date:** 2026-06-20

---

## 1. Specification Principles

1. **Single Source of Truth** — Specifications are the authoritative description of what to build
2. **Intent Before Implementation** — Define what before how
3. **Progressive Refinement** — Start high-level, refine incrementally
4. **Traceability** — Every requirement traces to a task, every task to code
5. **Living Documents** — Specifications evolve with the project, not frozen at start
6. **Constitution Compliance** — Every spec must satisfy `.specify/memory/constitution.md`

---

## 2. Specification Ownership

| Role | Responsibility |
|:---|:---|
| **Product Owner** | Feature descriptions, user stories, acceptance criteria |
| **Tech Lead** | Architecture decisions, tech stack, contracts |
| **Domain Lead** | Domain-specific requirements, business rules |
| **Engineer** | Task breakdown, implementation |
| **Architecture Board** | Constitution compliance, cross-domain consistency |

---

## 3. Specification Structure

### Per-Feature Directory

```
specs/
├── 001-platform-core/        # Phase 1 core
│   ├── spec.md               # User stories + requirements
│   ├── plan.md               # Technical implementation plan
│   ├── research.md           # Technology decisions
│   ├── data-model.md         # Entity definitions
│   ├── tasks.md              # Executable task breakdown
│   └── contracts/            # API contracts, schemas
│       ├── auth-api.yaml
│       └── user-api.yaml
├── 002-crm/                  # Phase 2 CRM
│   ├── spec.md
│   ├── plan.md
│   └── ...
└── ...
```

### Spec.md Template Structure

```markdown
# Feature: [Name]

## User Scenarios
### User Story 1 — [Title] (Priority: P1)
[As a..., I want..., So that...]
**Acceptance Criteria:**
- [Criterion 1]

## Functional Requirements
- FR-001: [Requirement]

## Success Criteria
- SC-001: [Measurable outcome]

## Key Entities
- [Entity]: [Description]

## Edge Cases
- [Edge case description]

## Assumptions
- [Assumption]
```

---

## 4. Quality Gates for Specifications

| Gate | Criteria | Tool |
|:---|:---|:---|
| **G-SPEC-1: Completeness** | All user stories have acceptance criteria; all FRs have IDs; no NEEDS CLARIFICATION markers | `/speckit.analyze` |
| **G-SPEC-2: Constitution** | Spec aligns with project constitution principles | `/speckit.plan` gate check |
| **G-SPEC-3: Consistency** | No contradictions between spec, plan, and data-model | `/speckit.analyze` |
| **G-SPEC-4: Coverage** | All requirements have corresponding tasks | `/speckit.converge` |
| **G-SPEC-5: Clarity** | No ambiguous language; all domain terms defined | `/speckit.clarify` |

---

## 5. Specification Lifecycle States

```
Draft → Clarified → Planned → Implemented → Verified → Released
  │        │          │          │             │           │
  │        │          │          │             │           └── In production
  │        │          │          │             └── QA verified
  │        │          │          └── Code complete
  │        │          └── Plan + tasks approved
  │        └── Ambiguities resolved
  └── Initial creation
```

---

## 6. Change Request Process

1. Change proposed (issue/PR template)
2. Impact assessment (domains, specs, ADRs affected)
3. Specification updated (`spec.md` or `plan.md`)
4. If architecture affected: ADR created/updated
5. Tasks regenerated (`/speckit.tasks`)
6. Re-implementation (`/speckit.implement`)
7. Convergence check (`/speckit.converge`)
8. Review and merge

---

## 7. Specification Template Customization

AlharisTech extensions to standard spec-kit templates:

1. **Arabic-First Fields** — `name_ar`, `description_ar` for all entities
2. **Domain Assignment** — Each spec tagged with primary domain
3. **Multi-Tenant Considerations** — Section for tenant isolation requirements
4. **RBAC Matrix** — Required permissions table per endpoint
5. **C4 Reference** — Link to affected C4 diagram components

---

## 8. Enforcement

- CI/CD pipeline validates spec formatting on PR
- `/speckit.constitution` gate runs before merge
- Specifications without approved plans cannot proceed to implementation
- Tasks without spec traceability are rejected in review
