# SRP Refactoring Plan
## SchemaRegistry + PolicyGuard — Future Extraction

**Status:** Deferred — Post-Sprint 1 (no action required now).

---

## SchemaRegistry → Multi-Service Extraction

Current: 710-line monolithic service handling loading, compiling, caching, resolving, watching, and health.

### Proposed split:

```
SchemaRegistryFacade          ← Public API (50 lines)
├── SchemaLoader              ← Loads OpenAPI YAML + Event YAML + Policy YAML (100 lines)
├── SchemaCompiler            ← AJV compilation + sanitization (80 lines)
├── SchemaCache               ← In-memory Map cache + Redis cache (60 lines)
├── SchemaResolver            ← $ref resolution, recursive (150 lines)
├── SchemaWatcher             ← fs.watch hot-reload + Redis pub/sub (80 lines)
└── SchemaHealth              ← Stats + readiness probe (40 lines)
```

**Trigger:** When SchemaRegistry exceeds 800 lines or when a second consumer needs schema access independently.

---

## PolicyGuard → Multi-Component Extraction

Current: policy resolution, JWT parsing, condition evaluation, error formatting all in one guard.

### Proposed split:

```
PolicyGuard                   ← NestJS guard, delegates to below (30 lines)
├── CallerContextFactory      ← Extracts user from JWT/request, builds PolicyUser (50 lines)
├── PolicyResolver            ← Route→resource mapping, policy matching (60 lines)
├── ConditionEvaluator        ← Condition DSL interpreter (80 lines)
├── PolicyStore               ← Loads/refreshes compiled policies (40 lines)
└── AuthorizationErrorFactory ← Standard 403 response formatting (30 lines)
```

**Trigger:** When PolicyGuard exceeds 500 lines or when a second guard needs condition evaluation.

---

## EventValidator → Runtime Activation

EventValidator code is correct. Missing:
1. BullMQ worker process bootstrap
2. Redis DLQ client injection
3. Replay API endpoint
4. DLQ metrics dashboard

**Trigger:** Sprint 0.6 — Event Enforcement Activation.

---

## Timeline

| Refactoring | Trigger | Phase |
|:---|:---|:---|
| SchemaRegistry split | > 800 lines | Phase 2 (before multi-domain) |
| PolicyGuard split | > 500 lines | Phase 2 |
| EventValidator runtime | BullMQ worker needed | Sprint 0.6 |
