# ai-workstation-core Integration
## Engineering Operating System for AlharisTech Platform

**Status:** Integrated
**Version:** 1.0
**Date:** 2026-06-20

---

## 1. Purpose

ai-workstation-core serves as the **Engineering Operating System** that governs the entire lifecycle of the AlharisTech Platform, from vision through production operations.

---

## 2. Engineering Lifecycle

```
┌─────────────────────────────────────────────────────────┐
│                  ENGINEERING LIFECYCLE                    │
│                                                         │
│  Vision ──► PRD ──► Requirements ──► Architecture        │
│    │                                         │          │
│    │                                         ▼          │
│    │                               ADR (Decision Records)│
│    │                                         │          │
│    │                                         ▼          │
│    │                               Specifications        │
│    │                                         │          │
│    │                                         ▼          │
│    │                               Implementation Plans  │
│    │                                         │          │
│    │                                         ▼          │
│    │                               Task Breakdown        │
│    │                                         │          │
│    │                                         ▼          │
│    │                               Code Generation       │
│    │                                         │          │
│    │                                         ▼          │
│    │                               Review ◄──────────────┤
│    │                                         │          │
│    │                                         ▼          │
│    │                               Test & Validate       │
│    │                                         │          │
│    │                                         ▼          │
│    │                               Documentation         │
│    │                                         │          │
│    │                                         ▼          │
│    └─────────────────────────────► Deploy                │
│                                          │               │
│                                          ▼               │
│                                    Operate & Monitor     │
│                                          │               │
│                                          ▼               │
│                                    Feedback ─────────────┘
└─────────────────────────────────────────────────────────┘
```

### Phase Gates

| Gate | Entry Criteria | Exit Criteria |
|:---|:---|:---|
| **G0: Vision** | Stakeholder need identified | Vision document approved |
| **G1: Requirements** | Vision approved | PRD + System Requirements approved |
| **G2: Architecture** | Requirements approved | Architecture document + C4 + ADRs approved |
| **G3: Design** | Architecture approved | Domain specifications + API spec approved |
| **G4: Implementation** | Design approved | Code complete + tests pass |
| **G5: Validation** | Code complete | All tests pass + security audit pass |
| **G6: Release** | Validation pass | Deployed to production + monitoring active |
| **G7: Operations** | In production | KPIs met + incidents resolved |

---

## 3. Context Management

### Context Layers

| Layer | Scope | Persistence | Location |
|:---|:---|:---|:---|
| **Project Context** | Vision, principles, constraints | Permanent | `.ai-workstation/project-context.md` |
| **Architecture Context** | C4, ADRs, patterns | Long-lived | `.ai-workstation/architecture-context.md` |
| **Session Context** | Current work session | Ephemeral | `.runtime/sessions/` |
| **Task Context** | Current task details | Task duration | `.runtime/tasks/` |
| **Decision Context** | Evidence for decisions | Permanent | `.runtime/decisions/` |

### Context Loading Order
1. Load Project Context (vision, mission, principles)
2. Load Architecture Context (C4, ADRs, patterns)
3. Load Session Context (current work, previous decisions)
4. Load Task Context (current task specification)

---

## 4. Session Management

### Session Lifecycle

```
Session Start
  ├── Load Project Context
  ├── Load Architecture Context
  ├── Create Session Record in .runtime/sessions/
  ├── Load Active Task
  ├── Execute Task
  ├── Record Decisions in .runtime/decisions/
  ├── Record Evidence in .runtime/evidence/
  ├── Update Context Map if changed
  └── Close Session with Summary
```

### Session Record Schema

```yaml
session_id: "ses_YYYYMMDD_HHMMSS"
started: "ISO8601"
agent: "build-agent"
phase: "sprint-0"
task_ids: []
decisions_made: []
files_created: []
files_modified: []
context_snapshot: {}
evidence_collected: []
status: "active"
```

---

## 5. Architecture Governance

### Architecture Review Process

1. **Proposal**: Any team member proposes architecture change via ADR draft
2. **Review**: Architecture review board evaluates against principles
3. **Decision**: Accept, reject, or request modification
4. **Record**: Accepted ADRs stored in `docs/adr/`
5. **Propagate**: Update affected diagrams and specifications
6. **Enforce**: CI/CD gates check architecture compliance

### Architecture Principles (PERP)

| Principle | Description | Enforcement |
|:---|:---|:---|
| **Security First** | Every design starts with security | Security review gate |
| **Scalability First** | Design for horizontal scaling | Load test gate |
| **Maintainability First** | Clean code, clear boundaries | Code review + linting |
| **Minimal Complexity** | Simplest solution that meets requirements | Architecture review |
| **Evidence First** | Decisions backed by data | Decision record required |
| **Modular First** | Every component independently replaceable | Dependency analysis |
| **API First** | Everything starts with API contract | OpenAPI validation |
| **Fail Closed** | Default deny, explicit allow | Security audit |

---

## 6. Documentation Governance

### Document Hierarchy

```
Level 0: Vision & Strategy        (docs/vision/, docs/business/)
Level 1: Requirements             (docs/requirements/)
Level 2: Architecture             (docs/architecture/, docs/adr/, docs/c4/)
Level 3: Specifications           (specs/)
Level 4: Implementation Plans     (tasks/)
Level 5: Code + API Docs          (apps/**/*.md, OpenAPI)
Level 6: Operations               (docs/operations/)
```

### Document Lifecycle

```
Draft → Review → Approved → Published → Maintained → Archived
```

### Document Ownership

| Document | Owner | Review Cycle |
|:---|:---|:---|
| Vision | Product Owner | Quarterly |
| PRD | Product Owner | Per phase |
| Architecture | Tech Lead | Per phase |
| ADRs | Tech Lead | Ad-hoc |
| Specifications | Domain leads | Per sprint |
| Tasks | Engineering team | Per sprint |

---

## 7. Review Workflows

### Code Review (Per PR)

```
1. Author opens PR with template
2. Automated checks run (lint, typecheck, test)
3. At least 1 reviewer assigned
4. Reviewer checks:
   a. Security (no secrets, input validation)
   b. Performance (no N+1 queries)
   c. Architecture compliance (follows ADRs)
   d. Test coverage (≥80%)
   e. Documentation (API docs updated)
5. Reviewer approves or requests changes
6. Author addresses feedback
7. PR merged (squash & merge)
8. Branch deleted
```

### Architecture Review (Per ADR)

```
1. Draft ADR using template
2. Submit for review (PR to docs/adr/)
3. Architecture board reviews within 48h
4. Decision: Accept / Reject / Request Changes
5. If accepted:
   a. Merge ADR
   b. Update C4 diagrams if affected
   c. Update specifications if affected
   d. Broadcast decision to team
```

### Specification Review (Per Domain)

```
1. Draft specification in specs/<domain>/
2. Submit for review (PR)
3. Domain expert + architect review
4. Validate against:
   a. Business requirements
   b. Architecture constraints
   c. API standards
   d. Data model consistency
5. Approve and merge
```

---

## 8. Task Pipelines

### Pipeline: Feature Development

```
Specification Approved
  → Task Breakdown (tasks/<phase>/<feature>.md)
    → Sprint Assignment
      → Development Branch (feature/<id>)
        → Implementation
          → Unit Tests
            → Integration Tests
              → Code Review
                → Merge to Develop
                  → Deploy to Staging
                    → E2E Tests
                      → QA Approval
                        → Merge to Main
                          → Deploy to Production
                            → Monitor
                              → Close Task
```

### Pipeline: Bug Fix

```
Bug Reported (GitHub Issue)
  → Triage (severity, priority)
    → Assign Developer
      → Fix Branch (fix/<id>)
        → Implementation
          → Tests (regression)
            → Code Review
              → Merge to Develop
                → Hotfix to Main (if critical)
                  → Deploy
                    → Verify
                      → Close Issue
```

### Pipeline: Architecture Change

```
Change Proposed (ADR draft)
  → Architecture Review Board
    → Impact Analysis
      → Decision (ADR accepted/rejected)
        → Propagate Changes
          ├── Update C4 Diagrams
          ├── Update Specifications
          ├── Update Implementation Plans
          └── Communicate to Team
```

---

## 9. Evidence Reports

### Report Types

| Report | Frequency | Location |
|:---|:---|:---|
| Architecture Compliance | Per sprint | `reports/architecture-compliance.md` |
| Test Coverage | Per build | CI artifact |
| Security Audit | Monthly | `reports/security-audit.md` |
| Performance Benchmark | Per release | `reports/performance-benchmark.md` |
| Sprint Retrospective | Per sprint | `reports/sprint-retrospective.md` |
| Architecture Review | Per phase | `reports/architecture-review/` |
| Decision Record | Per decision | `.runtime/decisions/` |

---

## 10. Decision Records

### Location: `.runtime/decisions/`

Each decision records:
- Decision ID
- Context (what problem are we solving?)
- Options considered
- Evidence gathered
- Decision made
- Rationale
- Consequences (intended and unintended)
- Review date
- Reversal conditions

---

## 11. Integration Points

### ai-workstation-core ↔ Spec-Kit

```
ai-workstation-core              Spec-Kit
─────────────────              ─────────
Engineering Lifecycle    ←→     Specification Lifecycle
Context Management       ←→     Requirements Management
Decision Records         ←→     Architecture Decisions
Task Pipelines           ←→     Implementation Plans
Evidence Reports         ←→     Review Artifacts
```

### ai-workstation-core ↔ CI/CD

```
ai-workstation-core              CI/CD
─────────────────              ─────
Quality Gates            ←→     Pipeline Gates
Architecture Principles  ←→     Lint Rules
Code Review Standards    ←→     PR Checks
Test Coverage Targets    ←→     Coverage Reports
Security Standards       ←→     Security Scans
```

---

## 12. Runtime Configuration

### Manifest: `.runtime/project-runtime-manifest.yaml`
Defines project identity, lifecycle phases, and current phase.

### Context Map: `.runtime/context-map.yaml`
Maps all context sources and their relationships.

### Workflows: `.runtime/workflows.yaml`
Defines all repeatable workflows (development, review, deployment, etc.).

---

## 13. Governance Files Structure

```
.ai-workstation/
├── project-context.md          # Permanent project context
├── architecture-context.md     # Architecture decisions summary
├── agent-config.yaml           # Agent configuration
└── sessions/                   # Session logs

.docs-runtime/
├── templates/
│   ├── adr-template.md
│   ├── spec-template.md
│   ├── pr-template.md
│   └── issue-template.md
└── schemas/
    ├── adr-schema.json
    └── spec-schema.json

.runtime/
├── project-runtime-manifest.yaml
├── context-map.yaml
├── workflows.yaml
├── decisions/
├── evidence/
├── sessions/
└── tasks/

.governance/
├── principles.yaml
├── quality-gates.yaml
├── review-policies.yaml
└── enforcement.yaml
```
