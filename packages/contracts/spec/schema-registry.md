# SchemaRegistry Specification

## Status: Design Specification (Sprint 0.5/1)

---

## 1. Overview

**Component:** `SchemaRegistry`
**Type:** NestJS Provider (Injectable Singleton)
**Purpose:** Central schema management service for the entire platform. Loads all OpenAPI specifications, event schemas, and policy rules at startup. Provides a single access point for all contract enforcement components (ContractGuard, ContractInterceptor, ContractPipe, PolicyGuard, EventValidator). Watches for schema changes in development and reloads via Redis pub/sub in production.

**Availability requirement:** SchemaRegistry must be initialized before any HTTP requests or event processing. Failure to load schemas at startup is a fatal error.

**Source of truth:** All specification files under `specs/contracts/`:
- `specs/contracts/openapi/*.yaml` — 9 domain API specs
- `specs/contracts/events/event-schemas.yaml` — 94 event schemas
- `specs/contracts/policy/access-control.yaml` — 162 policy rules
- `specs/contracts/service-catalog.yaml` — 149 endpoints
- `specs/contracts/event-catalog.yaml` — event catalog
- `specs/contracts/permission-matrix.yaml` — permission matrix reference
- `specs/contracts/execution-boundaries.yaml` — execution boundaries

---

## 2. Interface

### 2.1 NestJS Provider Interface

```
@Injectable()
class SchemaRegistry implements OnModuleInit, OnModuleDestroy {
  // Lifecycle
  async onModuleInit(): Promise<void>;
  async onModuleDestroy(): Promise<void>;

  // Schema accessors
  getOpenApiSpec(domain: string): OpenApiSpec | undefined;
  getOpenApiSpecs(): Map<string, OpenApiSpec>;
  getRouteSchema(method: string, path: string): RouteSchema | undefined;
  getEventSchema(eventName: string): EventSchema | undefined;
  getEventSchemas(): Map<string, EventSchema>;
  getPolicyRules(): CompiledPolicy[];
  getServiceCatalog(): ServiceCatalogEntry[];
  getResourceMapping(): Map<string, ResourceMapping>;

  // Health
  getHealth(): SchemaHealth;

  // Reload
  async reload(): Promise<void>;
  async reloadDomain(domain: string): Promise<void>;
  async reloadEvents(): Promise<void>;
  async reloadPolicies(): Promise<void>;
}
```

### 2.2 Type Definitions

```
interface OpenApiSpec {
  domain: string;
  version: string;
  spec: object;               // Parsed OpenAPI 3.1 document
  paths: Map<string, PathItem>; // Method → Operation mapping
  schemas: Map<string, object>; // $ref → resolved JSON Schema
  loadedAt: string;           // ISO 8601 timestamp
  sourcePath: string;         // File path or Redis key
  checksum: string;           // SHA-256 of raw YAML content
}

interface EventSchema {
  name: string;               // "identity.user.registered"
  domain: string;             // "identity"
  event: string;              // "UserRegistered"
  version: string;            // "1.0"
  schema: object;             // Resolved JSON Schema for payload
  transport: {
    type: 'async' | 'sync';
    channel: string;          // "bullmq:identity.events"
  };
  retention: string;          // "30 days"
  loadedAt: string;
}

interface RouteSchema {
  method: string;
  path: string;
  domain: string;
  operationId: string;
  requestSchema?: object;     // Request body JSON Schema
  responseSchemas: Map<string, object>; // Status code → response JSON Schema
  parameters: Parameter[];    // Query/path/header parameters
  security: SecurityRequirement[];
}

interface CompiledPolicy {
  id: string;
  effect: 'allow' | 'deny';
  roles: Set<string>;
  resources: Set<string>;
  actions: Set<string>;
  conditions: Condition[];
  priority: number;
}

interface SchemaHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  schemasLoaded: number;
  totalSchemas: number;
  lastLoaded: string;
  errors: SchemaLoadError[];
  domainStatus: Map<string, 'ok' | 'error'>;
}

interface SchemaLoadError {
  domain: string;
  file: string;
  error: string;
  timestamp: string;
}
```

---

## 3. Behavior

### 3.1 Startup Sequence

```
Application Bootstrap
  │
  ├─ Phase 1: Module Initialization
  │     SchemaRegistryModule registered in AppModule imports
  │     SchemaRegistry instantiated as singleton
  │
  ├─ Phase 2: onModuleInit()
  │     1. Determine schema source (local files vs Redis)
  │     2. Load and parse all schema files:
  │        a. service-catalog.yaml → 149 endpoints
  │        b. All openapi/*.yaml files → 9 domain specs
  │        c. event-schemas.yaml → 94 event schemas
  │        d. access-control.yaml → 162 policy rules
  │        e. permission-matrix.yaml → reference data
  │        f. execution-boundaries.yaml → domain boundaries
  │     3. Validate all schemas (parse must succeed)
  │     4. Resolve all $ref pointers in OpenAPI specs
  │     5. Compile policy rules into optimized structure
  │     6. Build route-to-schema lookup indexes
  │     7. Build event-name-to-schema lookup map
  │     8. Compute checksums for change detection
  │     9. Publish loaded schemas to Redis (if production)
  │    10. Start file watchers (if development)
  │    11. Subscribe to Redis pub/sub (if production)
  │
  │     If ANY required schema fails to load → throw fatal error
  │     (Application should not start with missing/corrupt schemas)
  │
  ├─ Phase 3: Operational
  │     SchemaRegistry is ready
  │     Other services (ContractGuard, PolicyGuard, etc.) can query schemas
  │
  └─ Phase 4: onModuleDestroy()
        Stop file watchers
        Unsubscribe from Redis pub/sub
        Clear in-memory cache
```

### 3.2 Schema Loading (Filesystem)

For `SCHEMA_SOURCE=local` (dev/staging):

```
async function loadFromFilesystem(): Promise<void> {
  const basePath = process.env.CONTRACT_SCHEMA_PATH || 'specs/contracts';

  // 1. Load service catalog
  const catalogYaml = readFileSync(`${basePath}/service-catalog.yaml`);
  const catalog = parseYaml(catalogYaml);

  // 2. Load each domain's OpenAPI spec
  const openApiDir = `${basePath}/openapi`;
  const openApiFiles = readdirSync(openApiDir).filter(f => f.endsWith('.yaml'));
  for (const file of openApiFiles) {
    const domain = file.replace('-api.yaml', '');
    const specYaml = readFileSync(`${openApiDir}/${file}`);
    const spec = parseYaml(specYaml);
    // Resolve $refs, build indexes
    specs.set(domain, processOpenApiSpec(domain, spec, file));
  }

  // 3. Load event schemas
  const eventsYaml = readFileSync(`${basePath}/events/event-schemas.yaml`);
  const events = parseYaml(eventsYaml);
  for (const [name, schema] of Object.entries(events.events)) {
    eventSchemas.set(name, processEventSchema(name, schema));
  }

  // 4. Load policy rules
  const policyYaml = readFileSync(`${basePath}/policy/access-control.yaml`);
  const policies = parseYaml(policyYaml);
  policyRules = compilePolicies(policies.policies);
}
```

### 3.3 Schema Loading (Redis)

For `SCHEMA_SOURCE=redis` (production):

```
async function loadFromRedis(): Promise<void> {
  // All schemas are pre-loaded into Redis by the deployment process
  // or by SchemaRegistry itself during the initial startup

  // Load service catalog from Redis Hash
  const catalog = await redis.hgetall('schema:catalog');

  // Load each domain spec from Redis String
  const domains = await redis.smembers('schema:domains');
  for (const domain of domains) {
    const specJson = await redis.get(`schema:openapi:${domain}`);
    const spec = JSON.parse(specJson);
    specs.set(domain, processOpenApiSpec(domain, spec));
  }

  // Load event schemas
  const eventsJson = await redis.get('schema:events');
  const events = JSON.parse(eventsJson);
  // ... process event schemas

  // Load policy rules
  const policiesJson = await redis.get('schema:policies');
  const policies = JSON.parse(policiesJson);
  policyRules = compilePolicies(policies);
}
```

### 3.4 Schema Publishing (to Redis)

In production, after loading schemas from filesystem, SchemaRegistry publishes them to Redis for other pods:

```
async function publishToRedis(): Promise<void> {
  const pipeline = redis.pipeline();

  // Publish each domain spec
  for (const [domain, spec] of specs) {
    pipeline.set(`schema:openapi:${domain}`, JSON.stringify(spec.spec));
    pipeline.sadd('schema:domains', domain);
  }

  // Publish event schemas
  pipeline.set('schema:events', JSON.stringify(Array.from(eventSchemas.entries())));

  // Publish policy rules
  pipeline.set('schema:policies', JSON.stringify(policyRules));

  // Publish metadata
  pipeline.hset('schema:meta', {
    'version': SCHEMA_VERSION,
    'loadedAt': new Date().toISOString(),
    'checksum': computeGlobalChecksum(),
  });

  await pipeline.exec();
}
```

### 3.5 Hot-Reload

#### Development Mode (File Watcher)

```
// On file change in specs/contracts/:
const watcher = chokidar.watch('specs/contracts/**/*.yaml', {
  ignored: /node_modules/,
  persistent: true,
  ignoreInitial: true,
});

watcher.on('change', async (filePath) => {
  logger.info(`Schema file changed: ${filePath}`);

  if (filePath.includes('openapi/')) {
    const domain = path.basename(filePath).replace('-api.yaml', '');
    await reloadDomain(domain);
  } else if (filePath.includes('event-schemas.yaml')) {
    await reloadEvents();
  } else if (filePath.includes('access-control.yaml')) {
    await reloadPolicies();
  }

  // Notify other components via internal EventEmitter
  eventEmitter.emit('schema:reloaded', { file: filePath, timestamp: new Date() });
});

// Debounce: wait 500ms after last change before reloading
```

#### Production Mode (Redis Pub/Sub)

```
// Subscribe to schema update channel
await redis.subscribe('schema:updated');

redis.on('message', async (channel, message) => {
  if (channel === 'schema:updated') {
    const update = JSON.parse(message);
    // update: { type: "openapi" | "event" | "policy", domain?: string }

    switch (update.type) {
      case 'openapi':
        await reloadDomain(update.domain);
        break;
      case 'event':
        await reloadEvents();
        break;
      case 'policy':
        await reloadPolicies();
        break;
      case 'all':
        await reload();
        break;
    }

    eventEmitter.emit('schema:reloaded', update);
  }
});
```

### 3.6 Schema Reloading (Atomic)

To prevent serving partial/inconsistent schemas during reload:

```
async reloadDomain(domain: string): Promise<void> {
  // 1. Load new spec
  const newSpec = await loadDomainSpec(domain);

  // 2. Validate new spec
  const validationResult = validateOpenApiSpec(newSpec);
  if (!validationResult.valid) {
    logger.error(`Failed to reload domain ${domain}: invalid schema`, validationResult.errors);
    alerts.raise('SchemaReloadFailed', { domain, errors: validationResult.errors });
    return; // Keep old spec
  }

  // 3. Atomic swap
  const oldSpec = specs.get(domain);
  specs.set(domain, newSpec);

  // 4. Invalidate caches for this domain
  invalidateCaches(domain);

  // 5. Log success
  logger.info(`Domain schema reloaded: ${domain} (v${newSpec.version})`);

  // 6. If in production, publish to Redis for other pods
  if (isProduction) {
    await publishDomainToRedis(domain, newSpec);
  }
}
```

### 3.7 Health Check Endpoint

```
GET /api/health/schemas

Response:
{
  "status": "healthy",
  "schemasLoaded": 105,          // 9 openapi + 94 events + 1 policy + 1 catalog
  "totalSchemas": 105,
  "lastLoaded": "2026-06-20T12:00:00Z",
  "uptime": 3600,
  "domainStatus": {
    "identity": "ok",
    "customer": "ok",
    "service": "ok",
    "commerce": "ok",
    "support": "ok",
    "content": "ok",
    "notification": "ok",
    "analytics": "ok",
    "ai": "ok"
  },
  "eventSchemasCount": 94,
  "policyRulesCount": 162,
  "endpointsCount": 184,
  "errors": []
}
```

**Status determination:**
- `healthy` — All schemas loaded successfully, no errors
- `degraded` — Some schemas loaded with warnings (e.g., optional schema not found, but core schemas OK)
- `unhealthy` — Any required schema failed to load

---

## 4. Schema Resolution & $ref Handling

### 4.1 OpenAPI $ref Resolution

OpenAPI specs use `$ref` pointers extensively. The registry MUST resolve all references:

```
// Before storage, resolve all $refs
function resolveRefs(spec: object): object {
  const resolved = {};

  for (const [key, value] of Object.entries(spec)) {
    if (typeof value === 'object' && value !== null) {
      if ('$ref' in value) {
        // Resolve the reference
        const refPath = value.$ref; // "#/components/schemas/User"
        resolved[key] = resolveRefPath(spec, refPath);
      } else {
        resolved[key] = resolveRefs(value);
      }
    } else {
      resolved[key] = value;
    }
  }

  return resolved;
}
```

**Circular reference handling:**
- Track resolved refs in a Set to detect cycles
- On cycle detection, set `$ref` to the `$id` of the target (AJV handles this natively)
- Log warnings for circular refs but allow them (common in entity schemas)

### 4.2 Route-to-Schema Lookup Index

Building the route lookup index for fast ContractGuard access:

```
interface RouteKey {
  method: string;
  pathPattern: string;  // "/api/v1/users/:id"
}

function buildRouteIndex(): Map<string, RouteSchema> {
  const index = new Map<string, RouteSchema>();

  for (const [domain, spec] of specs) {
    for (const [path, pathItem] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        const key = `${method.toUpperCase()}:${path}`;
        index.set(key, {
          method,
          path,
          domain,
          operationId: operation.operationId,
          requestSchema: operation.requestBody?.content?.['application/json']?.schema,
          responseSchemas: extractResponseSchemas(operation.responses),
          parameters: operation.parameters || [],
          security: operation.security || spec.security || [],
        });
      }
    }
  }

  return index;
}
```

---

## 5. Caching

### 5.1 Internal Cache Structure

```
class SchemaRegistry {
  // Primary stores (always in-memory)
  private specs: Map<string, OpenApiSpec>;           // domain → parsed OpenAPI spec
  private eventSchemas: Map<string, EventSchema>;    // eventName → schema
  private policyRules: CompiledPolicy[];             // 162 compiled policies
  private routeIndex: Map<string, RouteSchema>;      // "GET:/api/v1/users" → route schema
  private resourceMapping: Map<string, ResourceMapping>; // domain:resource → API path
  private serviceCatalog: ServiceCatalogEntry[];     // 149 endpoints

  // Derived caches (computed from primary stores)
  private policyByRole: Map<string, CompiledPolicy[]>;  // role → policies index
  private schemaChecksums: Map<string, string>;          // file → SHA-256
}
```

### 5.2 Cache Invalidation

| Trigger | Action |
|:---|:---|
| Schema file changed (dev) | Reload affected domain, rebuild indexes, emit `schema:reloaded` |
| Redis `schema:updated` message (prod) | Reload affected schemas, emit event |
| Admin API reload request | Full reload of all schemas |
| Process restart | Fresh load from filesystem/Redis |

### 5.3 Downstream Cache Invalidation

When SchemaRegistry reloads schemas, it emits events that other components use to flush their caches:

```
eventEmitter.on('schema:reloaded', (event) => {
  contractGuard.onSchemaReloaded(event);
  contractInterceptor.onSchemaReloaded(event);
  policyGuard.onSchemaReloaded(event);
  eventValidator.onSchemaReloaded(event);
});
```

---

## 6. Error Handling

### 6.1 Startup Errors

| Scenario | Behavior |
|:---|:---|
| Schema file not found (local) | Fatal error — application fails to start |
| Schema YAML parse error | Fatal error — log file + line number + error detail |
| Schema validation error (invalid OpenAPI) | Fatal error — log validation errors |
| Redis connection failure (prod) | Retry with exponential backoff (max 30s). If still failing after 3 retries → fatal error. |
| Partial schema load failure | Fatal error — don't start with incomplete schemas |

### 6.2 Runtime Errors

| Scenario | Behavior |
|:---|:---|
| File watcher error (dev) | Log error, retry watcher setup |
| Redis pub/sub disconnection (prod) | Reconnect with backoff. During disconnect, serve from last-known-good schemas. |
| Schema reload parse error | Log error + alert. Keep previous valid schema. Do NOT swap. |
| Schema not found on query | Return undefined. Caller handles (ContractGuard → 500, EventValidator → DLQ). |
| Checksum mismatch on reload | Log warning. This means schema was modified externally. |

### 6.3 Alerts

| Alert | Condition | Severity |
|:---|:---|:---|
| `SchemaRegistryLoadFailure` | Any required schema fails at startup | P0 |
| `SchemaRegistryReloadFailure` | Schema reload fails (parse/validation error) | P1 |
| `SchemaRegistryRedisDisconnected` | Redis pub/sub disconnected > 60s | P2 |
| `SchemaRegistryStaleSchemas` | Schemas not reloaded for > 24h in production | P2 |
| `SchemaRegistryChecksumMismatch` | Schema checksum changed unexpectedly | P2 |

---

## 7. Configuration

### 7.1 Environment Variables

| Variable | Type | Default | Description |
|:---|:---|:---|
| `SCHEMA_SOURCE` | `local` \| `redis` | `local` | Schema loading source |
| `SCHEMA_PATH` | string | `specs/contracts` | Base path for schema files |
| `SCHEMA_REDIS_URL` | string | `redis://localhost:6379` | Redis connection |
| `SCHEMA_WATCH_ENABLED` | boolean | `true` (dev) / `false` (prod) | Enable file watcher |
| `SCHEMA_WATCH_DEBOUNCE` | integer | `500` | File change debounce in ms |
| `SCHEMA_RELOAD_LOCK_TTL` | integer | `30` | Distributed lock TTL for reload in seconds |
| `SCHEMA_LOAD_TIMEOUT` | integer | `30000` | Max time for startup load in ms |
| `SCHEMA_VALIDATE_ON_LOAD` | boolean | `true` | Validate schemas during loading |

### 7.2 Module Registration

```
@Module({
  imports: [],
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: (registry: SchemaRegistry) => () => registry.onModuleInit(),
      deps: [SchemaRegistry],
      multi: true,
    },
    SchemaRegistry,
  ],
  exports: [SchemaRegistry],
})
export class SchemaRegistryModule {}
```

---

## 8. Integration Points

| Consumer | Method Used | Purpose |
|:---|:---|:---|
| ContractGuard | `getRouteSchema(method, path)` | Request body/param validation |
| ContractInterceptor | `getRouteSchema(method, path)` | Response body validation |
| ContractPipe | `getOpenApiSpec(domain)` | DTO Zod schema generation |
| PolicyGuard | `getPolicyRules()` | RBAC policy evaluation |
| EventValidator | `getEventSchema(eventName)` | Event payload validation |
| HealthController | `getHealth()` | Schema health endpoint |
| Admin API | `reload()` / `reloadDomain()` | Manual schema reload |
| SDK Generator | `getOpenApiSpec(domain)` | TypeScript client generation |

---

## 9. Testing Strategy

### 9.1 Unit Tests

| Test | Description |
|:---|:---|
| `should load all OpenAPI specs successfully` | 9 domain specs parsed and validated |
| `should load all 94 event schemas` | Event schemas parsed with JSON Schema |
| `should load all 162 policy rules` | Policy rules compiled and indexed |
| `should resolve $ref pointers recursively` | Nested $ref → fully resolved schema |
| `should detect circular $ref and handle gracefully` | Entity → Entity circular ref → not infinite loop |
| `should build route index for all 149 endpoints` | Every endpoint has a route schema entry |
| `should build event name index for all events` | Every event name → schema lookup |
| `should build policy-by-role index` | Policies indexed by role for fast lookup |
| `should return undefined for unknown schema` | Unknown domain/event → undefined |
| `should reload domain on file change (dev)` | File modified → domain spec updated |
| `should NOT swap on reload failure` | Corrupted file → old spec retained |
| `should emit schema:reloaded event on reload` | Internal event emitted |
| `should publish schemas to Redis (prod)` | Schemas published to Redis after load |

### 9.2 Integration Tests

| Test | Description |
|:---|:---|
| `should load from filesystem within 5 seconds` | Startup time benchmark |
| `should load from Redis within 2 seconds` | Redis loading benchmark |
| `should handle concurrent schema queries` | Multiple components querying simultaneously |
| `should detect schema changes via Redis pub/sub` | Publish message → reload triggered |
| `should validate all schemas on load` | Invalid schemas → load rejected |

### 9.3 E2E Tests

| Test | Description |
|:---|:---|
| `health endpoint returns healthy after startup` | GET /api/health/schemas → 200, healthy |
| `health endpoint returns degraded when schema missing` | Remove schema file → degraded status |

---

## 10. Dependencies

### 10.1 Runtime Dependencies

| Package | Version | Purpose |
|:---|:---|:---|
| `@nestjs/common` | ^10.x | Injectable, OnModuleInit, OnModuleDestroy |
| `@nestjs/core` | ^10.x | Module system, APP_INITIALIZER |
| `@nestjs/event-emitter` | ^2.x | Internal event system for schema reload notifications |
| `js-yaml` | ^4.x | YAML parsing |
| `ajv` | ^8.12+ | OpenAPI schema validation |
| `ioredis` | ^5.x | Redis client |
| `chokidar` | ^3.x | File watcher (dev mode only) |
| `redlock` | ^5.x | Distributed lock for schema reload (multi-pod) |

### 10.2 Dev Dependencies

| Package | Version | Purpose |
|:---|:---|:---|
| `@nestjs/testing` | ^10.x | Provider unit testing |
| `ioredis-mock` | ^8.x | Mock Redis for tests |

---

## 11. Implementation Notes

### 11.1 Singleton Guarantee

SchemaRegistry MUST be a true singleton — only one instance per process. NestJS's default provider scope (`DEFAULT`) ensures this. Do NOT use `@Injectable({ scope: Scope.REQUEST })` or `@Injectable({ scope: Scope.TRANSIENT })`.

### 11.2 Memory Footprint

| Data | Approximate Size |
|:---|:---|
| 9 OpenAPI specs (parsed + resolved) | 5-8 MB |
| 94 event schemas | 1-2 MB |
| 162 compiled policies | 0.5 MB |
| Route index (184 entries) | 1 MB |
| Event name index (94 entries) | 0.2 MB |
| Policy-by-role index | 0.2 MB |
| **Total** | **~10 MB** |

Monitor via `process.memoryUsage()` logged every 5 minutes in development.

### 11.3 Startup Performance

| Operation | Target | Notes |
|:---|:---|:---|
| Read all YAML files | < 100ms | 9 files, ~50KB each |
| Parse YAML | < 200ms | js-yaml parser |
| Validate OpenAPI specs | < 1s | AJV for each spec |
| Resolve $ref pointers | < 500ms | Recursive resolution |
| Compile policy rules | < 100ms | 162 rules |
| Build indexes | < 100ms | Route + event indexes |
| **Total startup** | **< 3s** (filesystem), **< 2s** (Redis) | |

### 11.4 Distributed Reload Coordination

In production with multiple pods, schema reload must be coordinated to prevent different pods serving different schema versions:

```
async reloadDomain(domain: string): Promise<void> {
  // Acquire distributed lock to prevent concurrent reloads
  const lock = await redlock.acquire(`schema:reload:${domain}`, 30000);

  try {
    // Load and validate new schema
    const newSpec = await loadDomainSpec(domain);

    // Publish to Redis FIRST
    await publishDomainToRedis(domain, newSpec);

    // THEN notify other pods via pub/sub
    await redis.publish('schema:updated', JSON.stringify({
      type: 'openapi',
      domain,
      version: newSpec.version,
      checksum: newSpec.checksum,
    }));

    // THEN update local copy
    specs.set(domain, newSpec);
    invalidateCaches(domain);

  } finally {
    await lock.release();
  }
}
```

### 11.5 Security Considerations

- **Schema file access:** Schema files are read-only at runtime. No write access needed (except dev file watcher).
- **Redis schema storage:** Schemas in Redis are read-only for consumers. Only SchemaRegistry writes to Redis.
- **Admin API access control:** Reload endpoints require admin role. Audit log every reload.
- **Schema integrity:** Compute SHA-256 checksums for all schemas. Verify on load and reload. Alert on mismatch.
- **No code execution:** Schema files are parsed as data (YAML→JSON), never executed. No `eval()`, no `require()`, no `import()`.

### 11.6 Future Considerations

- **Schema version history:** Track schema changes over time. Enable rollback to previous version.
- **Schema compatibility testing:** Automatically test new schema versions against recorded API traffic for breaking changes.
- **Schema registry as a separate service:** Extract to a standalone gRPC service for cross-language access (Go workers, Python AI services).
- **Schema-driven mock server:** Generate mock API server from OpenAPI specs for frontend development.
- **Schema-driven contract testing:** Generate consumer-driven contract tests from schemas.
- **Schema analytics:** Dashboard showing schema complexity, most-changed schemas, breaking change frequency.
