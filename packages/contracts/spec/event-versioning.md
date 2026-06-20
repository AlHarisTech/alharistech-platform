# Event Versioning Strategy

## Status: Specification (v0.6.0)

---

## 1. Overview

Event versioning defines how the 94 event schemas in `event-schemas.yaml` evolve over time without breaking running consumers. It specifies the version format, compatibility rules, deprecation lifecycle, migration process, and how the `SchemaRegistry` and `EventValidator` handle versioned events.

**Design principle:** Events evolve through additive changes. Breaking changes require explicit migration coordination. No consumer ever receives an event it cannot process.

---

## 2. Version Format

### 2.1 SemVer for Events

Events follow **Semantic Versioning (MAJOR.MINOR)** — no PATCH level since events have no bug-fix dimension independent of schema:

```
MAJOR.MINOR

Examples:
  1.0  — Initial version
  1.1  — Added optional field (backward compatible)
  1.2  — Added another optional field (backward compatible)
  2.0  — Removed field or changed type (breaking)
```

- **MAJOR:** Incremented for breaking changes (remove field, change type, rename field, change required→optional)
- **MINOR:** Incremented for backward-compatible changes (add optional field, add enum value, relax constraint)

### 2.2 Version in Event Payload

Every emitted event MUST carry a `_eventVersion` field in the payload. The producer is responsible for stamping this:

```json
{
  "userId": "01JF8XYJ11VQZNBG2S3KT4AR6D",
  "email": "user@example.com",
  "role": "customer",
  "timestamp": "2026-06-20T12:00:00Z",
  "_eventVersion": "1.0"
}
```

The `_eventVersion` is used by `EventValidator` to look up the correct schema. If omitted, the validator defaults to the earliest known version for that event name.

### 2.3 Version in Schema Registry

In `event-schemas.yaml`, each version of an event is a distinct entry identified by `{eventName}.v{MAJOR}_{MINOR}`:

```yaml
events:
  identity.user.registered.v1_0:
    domain: identity
    event: UserRegistered
    version: "1.0"
    schema:
      type: object
      required: [userId, email, role, timestamp]
      properties:
        userId:
          type: string
          format: uuid
        email:
          type: string
          format: email
        role:
          type: string
          enum: [admin, manager, employee, customer, partner]
        timestamp:
          type: string
          format: date-time
    transport:
      type: async
      channel: "bullmq:identity.events"
    retention: "30 days"

  identity.user.registered.v1_1:
    domain: identity
    event: UserRegistered
    version: "1.1"
    supersedes: "1.0"
    changelog: "Added optional phone field"
    schema:
      type: object
      required: [userId, email, role, timestamp]
      properties:
        userId:
          type: string
          format: uuid
        email:
          type: string
          format: email
        phone:
          type: string
          pattern: "^\\+[1-9]\\d{1,14}$"
          description: "Optional phone number in E.164 format"
        role:
          type: string
          enum: [admin, manager, employee, customer, partner]
        timestamp:
          type: string
          format: date-time
    transport:
      type: async
      channel: "bullmq:identity.events"
    retention: "30 days"
```

### 2.4 SchemaRegistry Version Resolution

The `SchemaRegistry` maintains a version index:

```typescript
// In-memory index
const eventVersions: Map<string, Map<string, EventSchemaEntry>> = {
  "identity.user.registered": Map {
    "1.0" => { ... },
    "1.1" => { ... },
  },
  "identity.user.verified": Map {
    "1.0" => { ... },
  },
  // ... for all 94 events
};

function getEventSchema(eventName: string, version?: string): EventSchemaEntry | undefined {
  const versions = eventVersions.get(eventName);
  if (!versions) return undefined;

  if (version) {
    return versions.get(version);
  }

  // No version specified — return latest
  const sorted = Array.from(versions.keys()).sort(semverCompare);
  return versions.get(sorted[sorted.length - 1]);
}
```

---

## 3. Compatibility Rules

### 3.1 MINOR Bump (Backward Compatible)

A MINOR bump means the new schema is a **superset** of the previous version. All existing consumers can process the new event without modification.

**Allowed changes (MINOR bump):**

| Change | Example | Consumer Impact |
|:---|:---|:---|
| Add optional field | Add `phone?: string` | Old consumers ignore the field. New consumers handle its absence. |
| Add enum value | Add `"partner"` to role enum | Old consumers may not recognize the value — must handle unknown enum values gracefully. |
| Relax constraint | Change `minimum: 1` to `minimum: 0` | Old consumers already accept the relaxed range. |
| Add array item schema | New optional item shape in tuple | Old consumers ignore extra items. |
| Add pattern to string | Add `pattern: "^\\+..."` to optional phone | Old consumers don't validate the pattern (field didn't exist). |
| Change description only | Update `description` field | No consumer impact. |

**Forbidden in MINOR bump:**

| Change | Reason | Correct Bump |
|:---|:---|:---|
| Add required field | Old producers don't emit it → old consumers crash | MAJOR |
| Remove field | Old consumers reference it → crash | MAJOR |
| Change field type | `string` → `number` → old consumers type error | MAJOR |
| Remove enum value | Old producers emit removed value → old consumers reject | MAJOR |
| Rename field | Old consumers reference old name | MAJOR |
| Change required → optional | Consumers may rely on the field being present | MAJOR |
| Tighten constraint | `minimum: 0` → `minimum: 1` | MAJOR |

### 3.2 MAJOR Bump (Breaking)

A MAJOR bump means the new schema is **incompatible** with the previous version. Consumers of the old version MUST migrate before the new version is emitted.

**Breaking change examples:**

```yaml
# v1.0
properties:
  email:
    type: string

# v2.0 (MAJOR) — field renamed
properties:
  emailAddress:      # Old consumers looking for "email" will fail
    type: string
```

```yaml
# v1.0
required: [userId, email, role, timestamp]

# v2.0 (MAJOR) — field removed, field type changed
required: [userId, role, timestamp]
properties:
  userId:
    type: number     # Changed from string to number
```

### 3.3 Compatibility Matrix

The `SchemaRegistry` maintains a compatibility matrix for automated validation:

```yaml
# specs/contracts/events/compatibility-matrix.yaml
compatibility:
  identity.user.registered:
    versions:
      - version: "1.0"
        compatibleWith: ["1.0"]
        deprecated: false
        deprecatedAt: null
      - version: "1.1"
        compatibleWith: ["1.0", "1.1"]  # Consumers of 1.0 can process 1.1
        deprecated: false
        deprecatedAt: null
      - version: "2.0"
        compatibleWith: ["2.0"]         # NOT compatible with 1.x
        deprecated: false
        deprecatedAt: null
```

### 3.4 Automated Compatibility Check

CI enforces compatibility on every schema change:

```bash
# packages/contracts/scripts/check-event-compatibility.ts
# Run: pnpm run check:event-compat

# Validates:
# 1. All versions follow MAJOR.MINOR format
# 2. MINOR bumps are backward-compatible (schema diff analysis)
# 3. MAJOR bumps have ADR reference
# 4. Deprecated versions are marked correctly
# 5. No version gaps (continuous version history)
# 6. Compatibility matrix is consistent with schema definitions
```

---

## 4. Schema Registry Versioning Behavior

### 4.1 Version Lookup During Validation

When `EventValidator` processes a job, version resolution follows this order:

```
1. Extract _eventVersion from job data payload
2. If _eventVersion present:
   a. Look up schema for "{eventName}.v{MAJOR}_{MINOR}"
   b. Found → validate against that schema
   c. Not found → reject to DLQ (UNKNOWN_VERSION)
3. If _eventVersion absent:
   a. Look up latest version for event name
   b. Found → validate against latest schema
   c. Not found → reject to DLQ (SCHEMA_NOT_FOUND)
```

### 4.2 Version Mismatch Handling

| Scenario | strictVersionCheck=true | strictVersionCheck=false |
|:---|:---|:---|
| Event v1.0, latest schema v1.0 | Pass | Pass |
| Event v1.0, latest schema v1.1 (backward compat) | Pass (v1.0 schema found) | Pass + warn |
| Event v1.0, latest schema v2.0 (breaking) | Pass (v1.0 schema found) | Pass + warn |
| Event v2.0, only v1.0 schema exists | Reject to DLQ (UNKNOWN_VERSION) | Reject to DLQ (UNKNOWN_VERSION) |
| Event v1.0, schema v1.0 deleted from registry | Reject to DLQ (UNKNOWN_VERSION) | Reject to DLQ (UNKNOWN_VERSION) |

### 4.3 Caching Strategy

Validators are cached by `{eventName}:{version}`:

```typescript
const validatorCacheKey = `event:validator:${eventName}:${version}`;

// L1: In-memory LRU cache (SchemaRegistry)
// L2: Redis cache (TTL: 1 hour)
// Compilation: AJV compile on cache miss, store in L1 + L2
```

When a new schema version is deployed, the cache is invalidated:
- Hot-reload in dev: File watcher triggers `SchemaRegistry.reload()`
- Production: `SchemaRegistry.reload()` clears all caches, re-loads from updated YAML

---

## 5. Deprecation Policy

### 5.1 Deprecation Triggers

A schema version is deprecated when:
1. Two newer MAJOR versions exist (e.g., v1.0 deprecated when v3.0 is released)
2. OR 12 months have passed since a newer MAJOR version was released

### 5.2 Deprecation Lifecycle

```
Version Lifecycle:
  Active ──(2 newer MAJOR versions exist)──▶ Deprecated ──(6 months)──▶ Removed

  1.0 (active) ──▶ 2.0 released ──▶ 1.0 still active
  2.0 (active) ──▶ 3.0 released ──▶ 1.0 deprecated, 2.0 still active
  3.0 (active) ──▶ 4.0 released ──▶ 1.0 removed (6 months since deprecation),
                                    2.0 deprecated,
                                    3.0 still active
```

### 5.3 Deprecation Behavior

When a deprecated version is emitted:

1. **Log warning:** `Event 'identity.user.registered' version '1.0' is deprecated. Migrate to version '3.0'.`
2. **Metric increment:** `crbl_event_deprecated_version_total{eventName="identity.user.registered",version="1.0"}`
3. **Validation still passes** — deprecated versions are NOT rejected
4. **Admin UI shows warning badge** on the event catalog page

### 5.4 Removal Behavior

When a version is removed from `event-schemas.yaml`:

1. All producers MUST have migrated to emit newer versions
2. All consumers MUST have registered compatibility with newer versions
3. Events arriving with removed version → rejected to DLQ (UNKNOWN_VERSION)
4. DLQ events referencing removed version → cannot be replayed (marked with `schemaVersion: "1.0 (removed)"`)

### 5.5 Deprecation Metadata in Schema

```yaml
events:
  identity.user.registered.v1_0:
    version: "1.0"
    status: "deprecated"           # active | deprecated | removed
    deprecatedAt: "2026-03-15"
    deprecatedBy: "ADR-042"
    replacedBy: "identity.user.registered.v3_0"
    removalScheduledAt: "2026-09-15"  # 6 months after deprecation
    migrationGuide: "https://wiki.alharistech.sa/events/identity.user.registered/migration-v1-to-v3"
```

---

## 6. Migration Strategy

### 6.1 Consumer Registry

Each consumer of an event declares which versions it supports. This is tracked in a `consumer-registry.yaml`:

```yaml
# specs/contracts/events/consumer-registry.yaml
consumers:
  notification.email:
    subscribesTo:
      - event: "identity.user.registered"
        versions: ["1.0", "1.1", "2.0"]
        registeredAt: "2026-01-15"
      - event: "commerce.order.placed"
        versions: ["1.0"]
        registeredAt: "2026-01-15"
    owner: "notification-team"
    sla: "process within 5 minutes"

  analytics.kpi:
    subscribesTo:
      - event: "service.order.completed"
        versions: ["1.0"]
        registeredAt: "2026-02-01"
    owner: "analytics-team"
    sla: "process within 1 hour"

  support.ticket:
    subscribesTo:
      - event: "commerce.order.placed"
        versions: ["1.0"]
        registeredAt: "2026-03-01"
    owner: "support-team"
    sla: "process within 5 minutes"
```

### 6.2 Producer Version Bump Gate

A producer can only bump the emitted version when ALL registered consumers support the new version:

```typescript
function canProducerBumpVersion(eventName: string, newVersion: string): boolean {
  const consumers = consumerRegistry.getConsumersFor(eventName);
  return consumers.every(c => c.versions.includes(newVersion));
}

// CI gate: PR that bumps produced version is blocked if consumers not ready
```

### 6.3 Migration Playbook

```
Step 1: Producer implements new event version emission (v2.0)
  - Feature-flagged behind EVENT_VERSION_UPGRADE_{EVENT_NAME}=v2.0
  - Dual-emission: emit both v1.0 and v2.0 during migration window

Step 2: Consumer A migrates to handle v2.0
  - Update consumer-registry.yaml: consumer A now supports v2.0
  - Deploy consumer A
  - Verify: consumer A processes v2.0 events correctly

Step 3: Consumer B migrates to handle v2.0
  - Same process as Step 2

Step 4: All consumers registered for v2.0
  - canProducerBumpVersion() returns true
  - Producer feature flag enabled: emits only v2.0
  - v1.0 emission stops
  - Monitor for 48 hours (no errors)

Step 5: Deprecate v1.0
  - Mark v1.0 as deprecated in event-schemas.yaml
  - Set removalScheduledAt = now + 6 months

Step 6: Remove v1.0 (6 months later)
  - Verify no consumers reference v1.0
  - Remove v1.0 schema from event-schemas.yaml
  - Archive schema to specs/contracts/events/archived/
```

### 6.4 Dual-Emission Pattern

During migration, producers emit both old and new versions:

```typescript
async function emitUserRegistered(payload: UserRegisteredPayload): Promise<void> {
  const currentVersion = featureFlag.get('EVENT_VERSION_UPGRADE_IDENTITY_USER_REGISTERED');

  if (currentVersion === 'dual') {
    // Emit both versions during migration window
    await eventBus.emit('identity.user.registered.v1_0', { ...payload, _eventVersion: '1.0' });
    await eventBus.emit('identity.user.registered.v2_0', { ...payload, _eventVersion: '2.0' });
  } else {
    // Single version
    await eventBus.emit('identity.user.registered', { ...payload, _eventVersion: currentVersion });
  }
}
```

---

## 7. Breaking Change Process

### 7.1 Process Flow

```
  ┌──────────────────────┐
  │ 1. ADR for breaking  │
  │    change            │
  └────────┬─────────────┘
           │
  ┌────────▼─────────────┐
  │ 2. Create new event  │
  │    version (v2.0)    │
  └────────┬─────────────┘
           │
  ┌────────▼─────────────┐
  │ 3. Migrate consumers │
  │    (one at a time)   │
  └────────┬─────────────┘
           │
  ┌────────▼─────────────┐
  │ 4. Dual-emit         │
  │    (both v1+v2)      │
  └────────┬─────────────┘
           │
  ┌────────▼─────────────┐
  │ 5. Switch to v2 only │
  │    (all consumers    │
  │     migrated)        │
  └────────┬─────────────┘
           │
  ┌────────▼─────────────┐
  │ 6. Deprecate v1      │
  │    (6 months)        │
  └────────┬─────────────┘
           │
  ┌────────▼─────────────┐
  │ 7. Remove v1 schema  │
  │    (after 6 months)  │
  └──────────────────────┘
```

### 7.2 ADR Template for Breaking Event Changes

```markdown
# ADR-XXX: Breaking Change to {EventName}

**Status:** Proposed | Accepted | Deprecated | Superseded
**Date:** YYYY-MM-DD
**Deciders:** [list]
**Supersedes:** ADR-YYY (if applicable)

## Context
Why is this breaking change needed? What limitation of the current schema requires breaking?

## Options Considered
1. Option A: Non-breaking alternative (why rejected)
2. Option B: Breaking change (why accepted)
3. Option C: New event entirely (why rejected)

## Decision
Breaking change: {describe change} — bumping from v{old} to v{new}

## Impact Analysis
- Producers affected: [list of services]
- Consumers affected: [list of services]
- Estimated migration effort: {N} person-days
- Rollback strategy: [describe]

## Migration Plan
1. Create v{new} schema in event-schemas.yaml
2. Update consumer-registry.yaml for each consumer
3. Migration timeline: {start} → {complete}
4. Deprecation schedule: v{old} deprecated {date}, removed {date+6mo}

## Consequences
- Positive: [what improves?]
- Negative: [what worsens?]
- Neutral: [what changes without impact?]
```

### 7.3 Breaking Change CI Gate

```yaml
# .github/workflows/event-schema-check.yml
name: Event Schema Compatibility Check

on:
  pull_request:
    paths:
      - 'specs/contracts/events/event-schemas.yaml'

jobs:
  check-compatibility:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: pnpm install --filter @aht/contracts
      - name: Run compatibility check
        run: pnpm --filter @aht/contracts check:event-compat
      - name: Check ADR for breaking changes
        run: pnpm --filter @aht/contracts check:event-adr-required
```

---

## 8. Implementation in SchemaRegistry

### 8.1 Schema Storage Enhancement

The `SchemaRegistry.eventSchemas` map is extended to support versioned lookups:

```typescript
// Current: flat map by event name
private readonly eventSchemas = new Map<string, EventSchemaEntry>();
// "identity.user.registered" → schema entry

// Enhanced: nested map by event name + version
private readonly eventSchemas = new Map<string, Map<string, EventSchemaEntry>>();
// "identity.user.registered" → Map { "1.0" → schema, "1.1" → schema }

function getEventSchema(eventName: string, version?: string): EventSchemaEntry | undefined {
  const versions = this.eventSchemas.get(eventName);
  if (!versions) return undefined;

  if (version) {
    const entry = versions.get(version);
    if (!entry) return undefined;

    // Check if deprecated and log warning
    if (entry.status === 'deprecated') {
      this.logger.warn(
        `Event '${eventName}' v${version} is deprecated. ` +
        `Replaced by: ${entry.replacedBy}. ` +
        `Scheduled removal: ${entry.removalScheduledAt}`
      );
    }

    return entry;
  }

  // Return latest non-deprecated version
  const sorted = Array.from(versions.entries())
    .filter(([_, e]) => e.status !== 'deprecated')
    .sort(([a], [b]) => semverCompare(a, b));

  return sorted.length > 0 ? sorted[sorted.length - 1][1] : undefined;
}
```

### 8.2 YAML Schema Format Update

The `event-schemas.yaml` format is updated to include versioning metadata:

```yaml
events:
  identity.user.registered.v1_0:
    domain: identity
    event: UserRegistered
    version: "1.0"
    status: "active"            # NEW: active | deprecated | removed
    supersededBy: null          # NEW: version that replaces this one
    migrationGuide: null        # NEW: URL to migration documentation
    schema: { ... }
    transport: { ... }
    retention: "30 days"
```

### 8.3 Validator Cache Key Change

```typescript
// Old: cache by event name only
const key = eventName;                    // "identity.user.registered"

// New: cache by event name + version
const key = `${eventName}:${version}`;    // "identity.user.registered:1.0"
```

---

## 9. Version Count and Storage

### 9.1 Initial State (v0.6.0)

```
94 events × 1 version (1.0) = 94 schema entries
~5 MB compiled validators (L1 cache)
~2 MB Redis cache (L2)
```

### 9.2 Growth Projections

```
Year 1: 94 events × 2 versions avg = 188 entries (~10 MB validators)
Year 2: 94 events × 3 versions avg = 282 entries (~15 MB validators)
Year 3: 94 events × 3 versions avg (older removed) = 282 entries (steady state)
```

### 9.3 Storage Limits

| Resource | Limit | Mitigation if Exceeded |
|:---|:---|:---|
| Validators per event | 5 versions | Deprecation/removal reduces count |
| Total compiled validators | 500 | LRU eviction for least-used validators |
| Redis cache per validator | 50 KB | Compression, shorter TTL |
| event-schemas.yaml file size | 500 KB | Split into domain-specific files |

---

## 10. Monitoring

### 10.1 Metrics

```
# Emitted events by version
crbl_event_emitted_total{eventName="identity.user.registered",version="1.0"} 1503
crbl_event_emitted_total{eventName="identity.user.registered",version="1.1"} 892

# Deprecated version emissions (should trend to 0)
crbl_event_deprecated_version_total{eventName="identity.user.registered",version="1.0"} 47

# Validation failures by version
crbl_event_validation_failures_total{eventName="identity.user.registered",version="2.0",reason="UNKNOWN_VERSION"} 12

# Schema version count per event (gauge)
crbl_event_schema_versions{eventName="identity.user.registered"} 3
```

### 10.2 Alerts

```yaml
- alert: EventDeprecatedVersionEmitted
  expr: rate(crbl_event_deprecated_version_total[1h]) > 0
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "Deprecated event version still being emitted for {{ $labels.eventName }} v{{ $labels.version }}"

- alert: EventUnknownVersionRejected
  expr: rate(crbl_event_validation_failures_total{reason="UNKNOWN_VERSION"}[5m]) > 1
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "Events with unknown version being rejected for {{ $labels.eventName }}"

- alert: EventSchemaVersionsExceeded
  expr: crbl_event_schema_versions > 5
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "{{ $labels.eventName }} has {{ $value }} active versions — deprecation may be needed"
```

---

## 11. Integration with DLQ

### 11.1 Version Mismatch in DLQ

When an event with an unknown version arrives, it is stored in the DLQ with the version marked:

```json
{
  "eventId": "dlq_01JF8XYKZ3QN7WPA4R5T6BVE8M",
  "eventName": "identity.user.registered",
  "version": "3.0",
  "error": {
    "code": "UNKNOWN_VERSION",
    "message": "Schema version '3.0' not found for event 'identity.user.registered'. Available versions: 1.0, 1.1, 2.0.",
    "errors": []
  }
}
```

### 11.2 Version Changed During DLQ Retention

If a schema version is removed while events exist in the DLQ:

1. DLQ events referencing the removed version become unreplayable
2. Admin UI shows `schemaVersion: "1.0 (removed)"` with a warning badge
3. Operator options:
   - Extract `originalPayload` and map to current schema manually
   - Discard the event if no longer relevant
   - Restore the archived schema temporarily for replay

---

## 12. Testing

### 12.1 Version Compatibility Tests

```typescript
describe('Event Version Compatibility', () => {
  it('should validate v1.0 event against v1.0 schema', () => { ... });
  it('should validate v1.0 event against v1.1 schema (backward compat)', () => { ... });
  it('should reject v1.1 event against v1.0 schema (forward compat fail)', () => { ... });
  it('should reject v2.0 event against v1.x schema (major bump)', () => { ... });
  it('should detect breaking change in schema diff', () => { ... });
  it('should detect non-breaking change as MINOR bump', () => { ... });
  it('should reject unknown version in strict mode', () => { ... });
  it('should log warning for deprecated version', () => { ... });
});
```

### 12.2 Migration Simulation Tests

```typescript
describe('Event Version Migration', () => {
  it('should process dual-emitted events without duplicates', () => { ... });
  it('should verify all consumers registered before producer bump', () => { ... });
  it('should handle consumer upgrading one at a time', () => { ... });
  it('should not lose events during version switch', () => { ... });
});
```

---

## 13. Governance

### 13.1 Version Policy Enforcement

| Rule | Enforcement | CI Gate |
|:---|:---|:---|
| All new event versions MUST be backward compatible (or ADR for breaking) | Schema diff analysis | `check:event-compat` |
| Breaking changes REQUIRE ADR | ADR file presence check | `check:event-adr-required` |
| Deprecated versions have migration guide | URL validation | `check:event-migration-guide` |
| No more than 5 active versions per event | Count check | `check:event-version-count` |
| Removed versions have all consumers migrated | consumer-registry.yaml check | `check:event-consumer-migration` |
| Version numbers follow MAJOR.MINOR | Regex validation | `check:event-version-format` |

### 13.2 Ownership

| Role | Responsibility |
|:---|:---|
| Event producer team | Emit correct version, dual-emit during migration |
| Event consumer team | Register supported versions, migrate on breaking changes |
| Platform team | Maintain SchemaRegistry, event-schemas.yaml, consumer-registry.yaml |
| Architecture review | Approve breaking changes via ADR process |
---