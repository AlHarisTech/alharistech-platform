# ADR-026: Recursive Schema Validation — Resolving Circular `$ref` in CRBL

## Status
Proposed

## Date
2026-06-24

## Context

### The Problem

Two OpenAPI component schemas contain self-referencing circular `$ref`:

- **`Category`** (`commerce-api.yaml`): `children` array items reference `#/components/schemas/Category`
- **`MenuItem`** (`content-api.yaml`): `children` array items reference `#/components/schemas/MenuItem`

The SchemaRegistry's `resolveRefsRecursive` pipeline manually inlines all `$ref` before passing schemas to AJV. When it detects a circular reference (already in `visitedRefs`), it returns a boolean `true` — an open-schema placeholder that accepts any value. This means:

1. The `children` subtree in `Category` and `MenuItem` payloads is **never validated**
2. ~12 endpoints referencing these schemas accept **any payload structure** for nested children
3. ContractGuard cannot reject invalid nested data (e.g., `children[0].name_ar` missing, wrong types in `MenuItem.children[0].url`)
4. AJV logs `Circular $ref resolved via open schema: {name} (×10)` at every boot

### Existing Infrastructure

- `registerComponentSchemas()` (line 409) already registers every schema with AJV via `ajv.addSchema(schema, refPath)` — this populates AJV's internal schema registry
- `compileSchema()` (line 549) receives a **fully-resolved schema** with no `$ref` keywords (circular parts replaced with `true`)
- The `sanitizeSchemaForAjv()` helper strips OpenAPI-only keywords but does **not** remove `$ref`
- AJV 8 supports recursive schemas natively via `$recursiveAnchor` + `$recursiveRef` (draft 2019-09) and via `$id`-based self-reference (any draft)

### Why This Matters Now

CRBL-002 is the last validation gap in the Contract Runtime Bridge Layer. Every other boundary is enforced. With Sprint 3 closed and v0.9.9-rc2 verified, closing this gap is the highest-priority architectural debt.

## Decision

Three options were evaluated:

### Option A — AJV-Native Resolution

Change `compileSchema` to pass raw schemas (with `$ref` intact) to AJV's `compile()`, relying on the already-registered component schemas for resolution. For circular refs, AJV resolves the first level normally; deeper recursion depends on the schema draft:

| Draft | Self-ref support | Action |
|-------|-----------------|--------|
| OpenAPI 3.0 (JSON Schema Draft 07) | Not natively | Add `$id` matching ref path to each schema; AJV resolves `$ref` against `addSchema`'d schemas |
| JSON Schema 2019-09 / 2020-12 | `$recursiveAnchor` / `$recursiveRef` | Works natively but requires upgrading spec declarations |

**Steps:**
1. Inject `$id: "#/components/schemas/{name}"` into every component schema during `registerComponentSchemas`
2. In `compileSchema`, skip `resolveRefsRecursive` and pass the schema-with-`$ref` directly to `ajv.compile()`
3. AJV resolves `$ref` against its internal registry; circular refs resolve to the registered schema
4. Remove the `visitedRefs` circularity branch from `resolveRefsRecursive`

**Pros:**
- AJV validates **every level** of recursion, no depth limit
- Removes the manual `$ref` resolution pipeline entirely (simplifies ~70 lines)
- Schema definitions stay DRY (no duplication)
- Follows JSON Schema spec design

**Cons:**
- Requires adding `$id` to all component schemas — touches 9 spec files, ~200 schemas
- Risk of inter-file `$ref` resolution: `commerce-api.yaml` schemas reference `commerce-api.yaml` paths only; cross-file `$ref` is not used. However, AJV resolves by `$id` (string), not by file — as long as `$id` is globally unique, it works.
- Changes the resolution behavior for ALL schemas, not just the two circular ones. Regression risk.
- Some OpenAPI-specific keywords (`discriminator`, `xml`) already stripped by `sanitizeSchemaForAjv` — these don't affect validation.

### Option B — Bounded Recursion (Minimal Change)

Replace the `return true` placeholder in `resolveRefsRecursive` with a structured schema that validates the non-recursive fields and bounds recursion at the parent level.

**Steps:**
1. When circular ref detected, instead of `return true`, return `{ type: "object" }` — validates that the value is an object, but does not validate its properties
2. The parent schema (`Category` or `MenuItem`) still validates its own direct properties
3. The `children` array items must at least be objects (no primitive injection)
4. No changes to registration pipeline or other schemas

**Pros:**
- Minimal change: 1 line (`true` → `{ type: "object" }`)
- No risk to other schemas
- Validates structure at the immediate level (prevents type confusion attacks — e.g., string instead of object)
- Can be implemented and deployed in minutes

**Cons:**
- Does **not** validate nested properties beyond depth 0
- `children[0].name_ar` missing still passes
- `children[0].children[0].url` as number still passes
- The gap is reduced but not closed — only type confusion is prevented
- Still logs debug messages for circular refs (cosmetic, not functional)

### Option C — Hybrid (Recommended)

Apply Option B immediately as a tactical fix (closes the type-confusion attack surface), then implement Option A in the Sprint 4 timeframe for full validation.

**Tactical (hours):** `true` → `{ type: "object" }` for circular refs. This prevents:
- Primitive injection in `children` arrays (string, number, null where object expected)
- Array injection (array where object expected in `children` items)
- The open-schema log message becomes accurate: "circular ref bounded to type:object"

**Strategic (days):** AJV-native resolution with `$id` injection across all specs. This closes:
- Deep validation of nested children
- Full CRBL boundary enforcement for all 12 affected endpoints
- Clean `$ref` resolution without custom pipeline

## Consequences

### Positive (all options)
- CRBL-002 gap acknowledged with a documented resolution path
- Type-confusion attack surface closed immediately (Options B/C)
- Last CRBL validation gap addressed (Option A/C)

### Negative
- Option A adds ~5KB of `$id` annotations across spec files
- Option A requires careful testing of all 149 endpoints to ensure no regression
- Option B leaves a semantic gap (missing properties not detected at depth > 0)

### Neutral
- Circular ref detection log messages remain until Option A is deployed
- The `resolveRefsRecursive` pipeline remains for Option B; Option A removes it

## Compliance

- For Option B: `children` items must validate as `type: object` — implemented in `resolveRefsRecursive` circular branch
- For Option A: Every component schema must have a unique `$id` matching its ref path — verified at boot
- All 28 unit/integration tests must pass after implementation
- Integration job must assert `GET /events/schema/stats` returns `endpoints >= 149` (no regression)
- No new `Circular $ref resolved via open schema` log entries at boot

## Related Decisions

- [ADR-021: CRBL Architecture](./adr-021-contract-runtime-bridge.md) — CRBL mandates every endpoint have a compiled validator; circular refs are the final gap.
- [ADR-022: CRBL Runtime Anchor (NestJS)](./adr-022-crbl-runtime-anchor.md) — SchemaRegistry is a NestJS singleton; AJV instance lives for app lifetime.
- [ADR-023: CRBL Activation Strategy](./adr-023-crbl-activation-strategy.md) — Stage 4 (EventValidator) complete; Stage 5 (Full AJV Native Resolution) proposed here.
- [ADR-025: Lightweight Runtime Harness](./adr-025-lightweight-runtime-harness.md) — CI services provide the runtime context for integration tests.
