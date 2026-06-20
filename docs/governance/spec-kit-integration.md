# Spec-Kit Integration
## Specification-Driven Development for AlharisTech Platform

**Status:** Integrated  
**Spec-Kit Location:** `tools/spec-kit/`  
**Date:** 2026-06-20

---

## 1. Overview

**Spec-Kit** (github/spec-kit) is an open-source toolkit implementing **Spec-Driven Development (SDD)**. It translates specifications into executable implementation plans, tasks, and code through AI agent integration.

For AlharisTech, spec-kit serves as the **Specification Management Layer** within the Engineering Operating System, bridging the gap between architecture documentation and implementation.

---

## 2. Installation

```bash
# Clone into tools/
git clone https://github.com/github/spec-kit.git tools/spec-kit

# Install the CLI
cd tools/spec-kit
pip install -e .

# Initialize in project root (adjust for existing structure)
cd /home/asem/workspace/projects/Alharistech
specify init . --here --force
```

---

## 3. Architecture Mapping

### How spec-kit maps to our existing structure:

| AlharisTech Asset | Spec-Kit Equivalent | Mapping |
|:---|:---|:---|
| `docs/vision/` | `.specify/memory/constitution.md` | Governing principles and development laws |
| `docs/requirements/prd.md` | `specs/001-platform/spec.md` | Product requirements + user stories |
| `docs/requirements/system-requirements.md` | `specs/001-platform/spec.md` (FR section) | Functional + non-functional requirements |
| `docs/architecture/` | `specs/001-platform/plan.md` | Technical implementation plan |
| `docs/adr/` | `specs/001-platform/research.md` | Architecture decision records and rationale |
| `docs/c4/` | `specs/001-platform/contracts/` | Interface contracts and diagrams |
| `docs/diagrams/` | `specs/001-platform/contracts/` | Visual architecture contracts |
| `architecture/repository-blueprint.md` | `specs/001-platform/plan.md` (Project Structure) | Monorepo structure specification |
| `tasks/master-plan.md` | `specs/001-platform/tasks.md` | Task breakdown by phase |
| `.governance/` | `.specify/` (constitution checks) | Quality gates and enforcement |

### Spec-Kit AI Commands Available (`/speckit.*`):

| Command | Purpose | When to Use |
|:---|:---|:---|
| `/speckit.constitution` | Create/update project principles | Sprint 0 — establish governance |
| `/speckit.specify` | Define feature requirements | Start of each phase |
| `/speckit.clarify` | Clarify ambiguous requirements | Before planning |
| `/speckit.plan` | Create implementation plan | After specification approved |
| `/speckit.tasks` | Generate executable tasks | After plan approved |
| `/speckit.taskstoissues` | Convert tasks to GitHub issues | Sprint planning |
| `/speckit.implement` | Execute tasks to build feature | During sprint execution |
| `/speckit.analyze` | Cross-artifact consistency check | Before merge |
| `/speckit.checklist` | Generate quality checklists | Before release |
| `/speckit.converge` | Assess code against spec/plan | Post-implementation review |

---

## 4. Specification Lifecycle

```
┌─────────────────────────────────────────────────────────┐
│              SPECIFICATION LIFECYCLE                     │
│                                                         │
│  1. INITIATE                                            │
│     /speckit.constitution                                │
│     → Establish governing principles                     │
│                                                         │
│  2. SPECIFY                                              │
│     /speckit.specify "Feature description"               │
│     → User stories, requirements, success criteria       │
│                                                         │
│  3. CLARIFY                                              │
│     /speckit.clarify                                     │
│     → Resolve ambiguities, refine scope                  │
│                                                         │
│  4. PLAN                                                 │
│     /speckit.plan + tech stack context                   │
│     → Architecture, data model, API contracts            │
│                                                         │
│  5. TASKS                                                │
│     /speckit.tasks                                       │
│     → Executable task breakdown with file paths          │
│                                                         │
│  6. IMPLEMENT                                            │
│     /speckit.implement                                   │
│     → Code generation, tests, documentation              │
│                                                         │
│  7. CONVERGE                                             │
│     /speckit.converge                                    │
│     → Assess against spec, identify gaps                 │
│                                                         │
│  8. ANALYZE                                              │
│     /speckit.analyze                                     │
│     → Consistency & coverage across all artifacts        │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Requirements Lifecycle

| Stage | Artifact | Owner | Output |
|:---|:---|:---|:---|
| Discovery | Feature request / stakeholder input | Product Owner | Feature description |
| Specification | `/speckit.specify` | Product + Tech Lead | `spec.md` (user stories, FRs) |
| Clarification | `/speckit.clarify` | Tech Lead | Refined `spec.md` |
| Validation | Review against constitution | Architecture Board | Approved spec |
| Planning | `/speckit.plan` | Tech Lead | `plan.md`, `data-model.md`, `contracts/` |
| Tasking | `/speckit.tasks` | Engineering Team | `tasks.md` |
| Implementation | `/speckit.implement` | Engineers | Code + tests |
| Verification | `/speckit.converge` | Reviewer | Gap analysis |
| Sign-off | `/speckit.checklist` | QA | Quality checklist |

---

## 6. Change Management Workflow

```
Change Request Received
  → Evaluate impact (scope, domains affected)
    → Create or update specification:
      ├── New feature: /speckit.specify
      ├── Feature change: update existing spec.md
      ├── Architecture change: update plan.md + ADR
      └── Bug: fix without full spec cycle
    → Re-plan affected areas: /speckit.plan (with context)
    → Re-task: /speckit.tasks
    → Re-implement: /speckit.implement
    → Converge: /speckit.converge
    → Review & Merge
```

---

## 7. Architecture Decision Workflow

```
Architectural Question
  → Draft ADR using template (.docs-runtime/templates/adr-template.md)
  → Reference ADR in /speckit.plan's research.md section
  → Constitution gate checks alignment
  → Architecture board review
  → Decision recorded in docs/adr/
  → Spec-kit plan updated to reflect decision
  → Tasks regenerated if affected
```

---

## 8. Review Workflow

```
Feature Complete
  → /speckit.converge — compare code against spec/plan/tasks
    → Classification:
      ├── missing (spec says yes, code says no) → CRITICAL
      ├── partial (spec says yes, code partially) → HIGH
      ├── contradicts (code does different from spec) → CRITICAL
      └── unrequested (code has, spec does not) → MEDIUM
  → /speckit.analyze — cross-artifact consistency
  → /speckit.checklist — quality verification
  → Human code review (per governance policy)
  → Merge when all gates pass
```

---

## 9. Implementation Workflow

```
/speckit.implement Execution:
  Phase 0: Prerequisites check (environment, tools, dependencies)
  Phase 1: Setup (configuration, scaffolding, database setup)
  Phase 2: Foundational (shared types, utilities, base components)
  Phase 3: User Story 1 (highest priority) — TDD cycle
  Phase 4: User Story 2 — TDD cycle
  Phase 5: User Story 3 — TDD cycle
  Phase N: Polish (documentation, tests, performance)
  Checkpoint validation after each phase
```

---

## 10. AI Agent Integration

Spec-kit supports 30+ AI agents. For AlharisTech:

| Agent | Use Case | Status |
|:---|:---|:---|
| **opencode** | Primary development agent | Active |
| Claude | Architecture review, ADRs, diagrams | Active |
| Copilot | Code completion, inline suggestions | Optional |

Agent configuration in `.specify/integrations/`.

---

## 11. Custom Preset for AlharisTech

We define a custom preset to enforce:

1. **Domain-Driven Structure** — specs organized by domain (identity, customer, service...) not just sequential numbers
2. **Arabic-First Naming** — UI components, routes, content follow Arabic conventions
3. **Monorepo Task Patterns** — tasks scoped to `apps/`, `packages/`, `domains/`
4. **C4 Architecture Gates** — constitution validates against C4 compliance
5. **Multi-Tenant Ready** — all specs must consider tenant isolation
6. **API-First** — every feature must include API contracts

---

## 12. Mapping: Vision → Release

```
Vision                        (docs/vision/)
  ↓
PRD                           (docs/requirements/prd.md)
  ↓
System Requirements           (docs/requirements/system-requirements.md)
  ↓
Architecture                  (docs/architecture/)
  ↓
ADR                           (docs/adr/)
  ↓
Constitution                  (.specify/memory/constitution.md) ← /speckit.constitution
  ↓
Specification                 (specs/XXX-feature/spec.md) ← /speckit.specify
  ↓
Clarification                 (specs/XXX-feature/spec.md refined) ← /speckit.clarify
  ↓
Implementation Plan           (specs/XXX-feature/plan.md) ← /speckit.plan
  ↓
Tasks                         (specs/XXX-feature/tasks.md) ← /speckit.tasks
  ↓
Implementation                (apps/, packages/, domains/) ← /speckit.implement
  ↓
Validation                    (converge + analyze + checklist) ← /speckit.converge
  ↓
Release                       (deployment) ← CI/CD pipeline
```
