# Future Expansion Strategy — AlharisTech Platform

## Overview

This document defines how the current architecture supports future growth scenarios. Every architectural decision today is made with these expansion paths in mind — we design for tomorrow while building for today.

---

## Multi-Tenant SaaS

### Current State (Phase 1-2)

Single-tenant architecture: one database, one schema, multi-user with RBAC.

### Future Target (Phase 3+)

Multi-tenant SaaS supporting organizations with isolated data.

### Strategy: Database Per Tenant (Enterprise) + Schema Per Tenant (SMB)

| Tier | Isolation Model | When |
|:---|:---|:---|
| SMB | Schema per tenant (shared database) | Phase 3 |
| Enterprise | Database per tenant | Phase 3 |
| Premium | Dedicated cluster per tenant | Phase 4+ |

### Implementation Pathway

```
Phase 1-2: Single database, user-level isolation (current)
Phase 3:   Schema per tenant (shared PostgreSQL)
Phase 4:   Database per tenant (separate PostgreSQL instances)
Phase 5:   Cross-tenant analytics warehouse (data lake)
```

### Schema Per Tenant Design

```sql
-- Tenant identification
CREATE SCHEMA tenant_018f9a92;
CREATE SCHEMA tenant_018f9a93;

-- Set search_path per request
SET search_path = 'tenant_018f9a92', 'public';

-- Public schema holds shared data:
--   tenants table (tenant registry)
--   countries, currencies, configuration
```

### Prisma Multi-Schema Strategy

```typescript
// Connection per tenant
const tenants = await prisma.tenant.findMany();
const prismaClients = new Map<string, PrismaClient>();

for (const tenant of tenants) {
  const schema = `tenant_${tenant.id}`;
  const client = new PrismaClient({
    datasources: { db: { url: `${process.env.DATABASE_URL}?schema=${schema}` } },
  });
  prismaClients.set(tenant.id, client);
}

// Middleware resolves tenant from request
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const tenantId = req.headers["x-tenant-id"] as string;
    const prisma = tenantPrismaManager.getClient(tenantId);
    req.prisma = prisma;
    next();
  }
}
```

### Tenant-Agnostic Code

```typescript
// Domain code never references tenant explicitly
// Tenant context is injected at the infrastructure layer

// ✅ Domain (tenant-agnostic)
async createOrder(input: CreateOrderInput): Promise<Order> { ... }

// ✅ Infrastructure (tenant-aware)
async createOrder(tenantId: string, input: CreateOrderInput): Promise<Order> {
  const prisma = this.tenantManager.getPrisma(tenantId);
  // Use tenant-specific Prisma client
}
```

### Data Isolation Guarantees

1. Every table includes `tenant_id` (for shared-database model) OR uses separate schema
2. Query middleware automatically scopes to current tenant
3. Cross-tenant access requires explicit admin override (audit logged)
4. Tenant data never mixed in cache (tenant-prefixed keys in Redis)

---

## Marketplace (Multi-Vendor)

### Current State (Phase 1-2)

Single-operator platform: AlharisTech provides services directly.

### Future Target (Phase 3+)

Multi-vendor marketplace where third-party vendors offer products/services.

### Required Extensions

| Concept | Implementation |
|:---|:---|
| Vendor entity | New domain: `domains/marketplace/` |
| Vendor onboarding | KYC verification, document upload, approval workflow |
| Product catalog | Per-vendor products, shared or per-vendor categories |
| Order routing | Orders routed to vendor, platform takes commission |
| Payment split | Stripe Connect or equivalent for split payments |
| Rating & reviews | Per-vendor, per-product reviews system |
| Vendor dashboard | Admin-like UI scoped to vendor's data |

### Domain Model Extension

```
domains/marketplace/
├── vendor/
│   ├── vendor.entity.ts          # Vendor profile, status, commission rate
│   ├── vendor.repository.ts
│   └── vendor.service.ts
├── catalog/
│   ├── product.entity.ts         # Extended with vendorId
│   ├── listing.entity.ts         # Vendor-specific pricing/availability
│   └── catalog.service.ts
├── commission/
│   ├── commission.entity.ts      # Commission rules, payouts
│   └── commission.service.ts
└── rating/
    ├── review.entity.ts
    └── review.service.ts
```

### API Versioning for Marketplace

```
/api/v1/...            # Current endpoints (AlharisTech as operator)
/api/v2/marketplace/... # Marketplace-specific endpoints
  /api/v2/marketplace/vendors
  /api/v2/marketplace/products
  /api/v2/marketplace/orders
  /api/v2/marketplace/payouts
```

---

## AI Platform

### Current State (Phase 1-2)

Basic AI integration: chatbots, content generation via external APIs.

### Future Target (Phase 3+)

Pluggable AI platform supporting multiple providers, custom models, and prompt management.

### Architecture

```
domains/ai/
├── providers/
│   ├── provider.interface.ts     # AIProvider interface
│   ├── openai.provider.ts        # OpenAI implementation
│   ├── anthropic.provider.ts     # Anthropic implementation
│   ├── gemini.provider.ts        # Google Gemini implementation
│   └── local.provider.ts         # Local/self-hosted models (Ollama, etc.)
├── prompts/
│   ├── prompt.entity.ts          # Prompt template, version, variables
│   ├── prompt.repository.ts
│   └── prompt-version.entity.ts  # Versioned prompts with A/B testing
├── agent/
│   ├── agent.entity.ts           # AI Agent with tools and memory
│   ├── tool.interface.ts         # Tool definition interface
│   └── agent-orchestrator.ts     # Multi-agent coordination
├── embeddings/
│   ├── embedding.service.ts      # Text-to-vector embeddings
│   └── vector-store.adapter.ts   # pgvector, Pinecone, etc.
└── evaluation/
    ├── eval-runner.ts            # Automated evaluation of AI outputs
    └── metrics.ts                # Accuracy, latency, cost tracking
```

### Provider Interface

```typescript
interface AIProvider {
  id: string;
  name: string;
  models: AIModel[];

  chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResponse>;
  stream(messages: ChatMessage[], options: ChatOptions): AsyncIterable<ChatChunk>;
  embed(text: string): Promise<number[]>;
}

interface ChatOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  tools?: Tool[];
  promptVersion?: string;  // Track which prompt version was used
}

// Configuration-driven provider selection
@Injectable()
export class AIOrchestrator {
  constructor(
    @Inject("AI_PROVIDERS") private providers: AIProvider[],
    private configService: ConfigService,
  ) {}

  async chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResponse> {
    const provider = this.selectProvider(options.model);
    const prompt = await this.promptService.resolve(options.promptVersion);
    const enrichedMessages = [prompt.toSystemMessage(), ...messages];
    return provider.chat(enrichedMessages, options);
  }
}
```

### Prompt Versioning

```
prompts/
├── customer-support/
│   ├── v1.0.0.md                  # Initial version
│   ├── v1.1.0.md                  # Improved empathy
│   └── v2.0.0.md                  # Added Arabic support
├── order-summary/
│   └── v1.0.0.md
└── content-generator/
    ├── v1.0.0.md
    └── v1.0.1.md                  # Minor tweak
```

### AI-Specific Database Tables

```sql
CREATE TABLE ai_prompts (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  version VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  variables JSONB,
  model VARCHAR(50),
  temperature DECIMAL(3,2) DEFAULT 0.7,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  agent_id UUID,
  provider VARCHAR(50),
  model VARCHAR(50),
  prompt_version VARCHAR(20),
  messages JSONB,            -- Full conversation history
  token_count INTEGER,
  cost DECIMAL(10,6),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## White-Label (Customizable Branding)

### Strategy

Tenants customize their instance with:
- Logo and favicon
- Primary/secondary colors
- Company name
- Custom domain (CNAME)
- Custom email templates
- Custom SMS sender ID
- Feature flags (enable/disable features per tenant)

### Implementation

```typescript
interface TenantBranding {
  id: string;
  tenantId: string;
  companyName: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;       // #HEX
  secondaryColor: string;
  accentColor: string;
  fontFamily?: string;
  customDomain?: string;      // app.tenant-company.com
  customCss?: string;         // Tenant-specific CSS overrides
}

// CSS Custom Properties (theming)
// Generated per tenant:
:root {
  --color-primary: <tenant.primaryColor>;
  --color-secondary: <tenant.secondaryColor>;
  --color-accent: <tenant.accentColor>;
  --font-family: <tenant.fontFamily>;
  --logo-url: url('<tenant.logoUrl>');
}

// Next.js middleware applies branding
export async function middleware(request: NextRequest) {
  const hostname = request.headers.get("host");
  const tenant = await getTenantByDomain(hostname);
  const branding = await getTenantBranding(tenant.id);

  const response = NextResponse.next();
  response.headers.set("X-Tenant-Id", tenant.id);
  response.headers.set("X-Tenant-Branding", JSON.stringify(branding));
  return response;
}
```

---

## Internationalization (Beyond AR/EN)

### Current State (Phase 1-2)

Arabic (primary) + English (secondary).

### Future Target (Phase 3+)

Multi-locale system supporting any RTL/LTR language.

### Architecture

```
Locales:
  ar-SA  — Arabic (Saudi Arabia) — PRIMARY
  en-US  — English (United States)
  en-GB  — English (United Kingdom) — future
  ur-PK  — Urdu (Pakistan) — future
  fa-IR  — Persian (Iran) — future
  fr-FR  — French (France) — future
  tr-TR  — Turkish (Turkey) — future
  id-ID  — Indonesian (Indonesia) — future
```

### Implementation with next-intl

```typescript
// Middleware detects locale from path, cookie, or Accept-Language header
// /ar/users  -> Arabic
// /en/users  -> English

// Translation files organized by locale
messages/
├── ar.json           # Arabic (complete)
├── en.json           # English (complete)
├── ur.json           # Urdu (partial, falls back to ar)
└── fr.json           # French (partial, falls back to en)

// Fallback chain: requested locale -> ar -> key name
```

### Database Internationalization

```sql
-- For content with translations:
CREATE TABLE services (
  id UUID PRIMARY KEY,
  name JSONB NOT NULL,        -- { "ar": "خدمة", "en": "Service", "ur": "خدمت" }
  description JSONB,          -- { "ar": "...", "en": "..." }
  -- Query: services WHERE name->>'ar' ILIKE '%search%'
);

-- OR: Separate translation table
CREATE TABLE service_translations (
  id UUID PRIMARY KEY,
  service_id UUID REFERENCES services(id),
  locale VARCHAR(5) NOT NULL, -- 'ar-SA', 'en-US'
  name VARCHAR(255) NOT NULL,
  description TEXT,
  UNIQUE(service_id, locale)
);
```

### RTL/LTR Handling

```css
/* Tailwind automatically handles RTL with dir="rtl" */
/* Layout components use logical properties */
.sidebar {
  margin-inline-start: 0;
  padding-inline: 1rem;
}
```

---

## Horizontal Scaling

### Stateless Services

All services are designed to be stateless from the start:

```typescript
// ✅ Stateless — can be replicated infinitely
@Injectable()
export class OrdersService {
  async createOrder(input: CreateOrderInput): Promise<Order> {
    // All state in database/cache, nothing in memory
    return this.orderRepo.create(input);
  }
}

// ❌ Stateful — breaks with multiple instances
const inMemoryCounter = {}; // State in memory = NO
```

### Scaling Strategy

| Layer | Scaling Method | Trigger |
|:---|:---|:---|
| API (NestJS) | Horizontal (more instances) | CPU > 70% or p95 latency > 200ms |
| Web (Next.js) | Horizontal (more instances) or CDN | Traffic increase |
| Database | Read replicas -> Sharding | Connection pool exhaustion |
| Redis | Cluster mode | Memory > 70% |
| File Storage | S3 (infinitely scalable) | N/A |
| Background Jobs | More BullMQ workers | Queue depth > 1000 |

### Read Replicas

```typescript
// Prisma read replica configuration
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,       // Primary (write)
    },
  },
});

// Separate client for read replica
const prismaRead = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_READ_URL,  // Read replica
    },
  },
});

// Repository pattern abstracts this:
class OrderRepository {
  async findById(id: string): Promise<Order | null> {
    return prismaRead.order.findUnique({ where: { id } }); // Read from replica
  }

  async create(data: CreateOrderInput): Promise<Order> {
    return prisma.order.create({ data }); // Write to primary
  }
}
```

### Database Sharding (Phase 4+)

```sql
-- Shard by tenant_id
-- Shard 1: tenants starting with a-m
-- Shard 2: tenants starting with n-z

-- Application-side routing
function getShard(tenantId: string): number {
  return tenantId.charCodeAt(0) % shardCount;
}
```

---

## GraphQL Federation

### Current State (Phase 1-2)

Monolithic GraphQL schema served by single NestJS instance.

### Future Target (Phase 3+)

Federated GraphQL where each domain is an independent subgraph.

```
Gateway (Apollo Router / GraphQL Mesh)
├── Identity Subgraph    (NestJS, @apollo/subgraph)
├── Customer Subgraph    (NestJS, @apollo/subgraph)
├── Commerce Subgraph    (NestJS, @apollo/subgraph)
├── Service Subgraph     (NestJS, @apollo/subgraph)
├── Support Subgraph     (NestJS, @apollo/subgraph)
├── Content Subgraph     (NestJS, @apollo/subgraph)
├── Notification Subgraph (NestJS, @apollo/subgraph)
├── Analytics Subgraph   (NestJS, @apollo/subgraph)
└── AI Subgraph          (NestJS, @apollo/subgraph)
```

### Federation-Ready Design

```typescript
// Current: monolithic types
@ObjectType()
class User {
  @Field(() => ID)
  id: string;

  @Field()
  email: string;
}

// Future: federated types (backward compatible)
@ObjectType()
@Directive('@key(fields: "id")')
class User {
  @Field(() => ID)
  id: string;

  @Field()
  email: string;

  @Field(() => [Order])  // Resolved by Commerce subgraph
  orders?: Order[];

  @ResolveField(() => [Order])
  async orders(@Parent() user: User): Promise<Order[]> {
    // This reference resolution will move to the Commerce subgraph
    return this.orderLoader.load(user.id);
  }
}
```

### Migration Path

```
Phase 1-2: Monolithic GraphQL (current)
Phase 3:   Split into subgraphs, add Apollo Router gateway
Phase 4:   Each subgraph independently deployable
Phase 5:   Subgraphs owned by separate teams (if org grows)
```

---

## Plugin System

### Current State (Phase 1-2)

Closed-source, monolithic application.

### Future Target (Phase 3+)

Extension points allowing third-party developers to build plugins.

### Extension Points

```typescript
interface Plugin {
  name: string;
  version: string;
  hooks: PluginHook[];
  routes?: PluginRoute[];
  databaseMigrations?: Migration[];
  uiComponents?: PluginUIComponent[];
}

interface PluginHook {
  event: string;          // "order.created", "user.registered"
  handler: (payload: unknown) => Promise<void>;
  priority: number;       // Execution order
}

// Extension point registry
@Injectable()
export class PluginRegistry {
  private plugins: Map<string, Plugin> = new Map();

  register(plugin: Plugin): void {
    this.plugins.set(plugin.name, plugin);
    logger.info(`Plugin registered: ${plugin.name}@${plugin.version}`);
  }

  async executeHook(event: string, payload: unknown): Promise<void> {
    const hooks = Array.from(this.plugins.values())
      .flatMap(p => p.hooks.filter(h => h.event === event))
      .sort((a, b) => a.priority - b.priority);

    for (const hook of hooks) {
      try {
        await hook.handler(payload);
      } catch (error) {
        logger.error(`Plugin hook failed: ${event}`, { error });
        // Don't fail the main flow — plugins are non-critical
      }
    }
  }
}
```

### Plugin Sandbox

```typescript
// Plugins run in isolated context
// Limited API surface (no direct database access)
// Event-driven communication only
// Version-gated API (plugins declare API version dependency)

interface PluginSDK {
  // Whitelisted APIs
  events: {
    on(event: string, handler: EventHandler): void;
    emit(event: string, payload: unknown): void;
  };
  storage: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
  };
  logger: Logger;
  // NO database access, NO file system, NO network (except SDK APIs)
}
```

---

## Evolution Timeline Summary

| Phase | Timeline | Key Expansions |
|:---|:---|:---|
| Phase 1 | MVP | Single tenant, single database, AR/EN, monolithic GraphQL |
| Phase 2 | Growth | Performance optimization, caching, basic analytics |
| Phase 3 | Scale | Schema-per-tenant, marketplace, AI platform, GraphQL federation |
| Phase 4 | Enterprise | Database-per-tenant, read replicas, white-label, plugins |
| Phase 5 | Platform | Full multi-tenant, sharding, marketplace, developer ecosystem |

---

## Architectural Principles for Future-Proofing

1. **Domain isolation** — Domains are independently deployable from day one (even if deployed together)
2. **Repository pattern** — Abstracts database, enabling future sharding/replication
3. **Event-driven communication** — Loose coupling between domains via events
4. **Config-driven behavior** — Feature flags, provider selection via configuration
5. **Interface over implementation** — Depend on abstractions, swap implementations
6. **Stateless services** — Horizontal scaling without session affinity
7. **API versioning** — Backward-compatible changes, explicit version bumps for breaking
8. **Tenant-agnostic domain logic** — Business logic doesn't know about tenants
