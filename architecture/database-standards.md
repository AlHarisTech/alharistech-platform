# Database Standards — AlharisTech Platform

## Overview

This document defines the complete database standards for the AlharisTech platform. All database interactions go through Prisma ORM with PostgreSQL as the primary database. These standards ensure consistency, performance, and maintainability across all domain modules.

---

## Technology Stack

| Component | Technology | Version |
|:---|:---|:---|
| Database | PostgreSQL | 16.x |
| ORM | Prisma | 5.15+ |
| Cache | Redis | 7.x |
| Migration Tool | Prisma Migrate | 5.15+ |
| Admin UI | Prisma Studio | — |
| Connection Pool | pgBouncer (production) | 1.22+ |
| Full-Text Search | PostgreSQL tsvector | Built-in |
| UUID Generation | pg_uuidv7 extension | — |

---

## Naming Conventions

### Tables

```sql
-- snake_case, plural
CREATE TABLE users (...);
CREATE TABLE order_items (...);
CREATE TABLE customer_addresses (...);
CREATE TABLE service_categories (...);

-- Junction tables: alphabetical order
CREATE TABLE order_products (...);
CREATE TABLE user_roles (...);

-- NEVER: PascalCase, camelCase, singular table names (except junction context)
-- BAD:  User, OrderItems, CustomerAddresses
```

### Columns

```sql
-- snake_case
CREATE TABLE users (
  id UUID PRIMARY KEY,
  first_name VARCHAR(100),      -- NOT: firstName, FirstName
  last_name VARCHAR(100),
  email VARCHAR(255),
  password_hash VARCHAR(255),
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);
```

### Prisma Schema Mapping

Prisma models use PascalCase but map to snake_case database tables/columns:

```prisma
model User {
  id           String   @id @default(uuid()) @db.Uuid
  firstName    String   @map("first_name") @db.VarChar(100)
  lastName     String?  @map("last_name") @db.VarChar(100)
  email        String   @unique @db.VarChar(255)
  passwordHash String   @map("password_hash") @db.VarChar(255)
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt    DateTime @updatedAt @map("updated_at") @db.Timestamptz()
  deletedAt    DateTime? @map("deleted_at") @db.Timestamptz()

  @@map("users")
}
```

---

## Primary Keys

### UUID v7 (Time-Sortable)

```sql
-- Enable the extension
CREATE EXTENSION IF NOT EXISTS pg_uuidv7;

-- Default UUID v7 generation
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_uuid_v7()
);
```

```prisma
// Prisma uses uuid() which generates v4 by default.
// In production, we use the pg_uuidv7 extension:
model User {
  id String @id @default(dbgenerated("gen_uuid_v7()")) @db.Uuid
}
```

UUID v7 is chosen because:
1. Time-sortable — new rows cluster together in B-tree indexes
2. Globally unique — no collision risk across shards/tenants
3. Not guessable — suitable as external identifiers
4. Index-friendly — sequential-ish insert pattern reduces index fragmentation

### No Auto-Increment IDs

Auto-increment integers are NEVER used as primary keys:
- They leak row count information
- They collide in multi-master / sharded setups
- They are guessable (IDOR vulnerability)

---

## Timestamps

### Required Columns

Every table MUST include these three timestamp columns:

```sql
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
deleted_at TIMESTAMPTZ          -- NULL = not deleted (soft delete)
```

```prisma
model Example {
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz()
  deletedAt DateTime? @map("deleted_at") @db.Timestamptz()
}
```

### Timestamp Rules

1. ALWAYS use `TIMESTAMPTZ` (never `TIMESTAMP` without timezone)
2. All timestamps stored in UTC
3. Application layer converts to local timezone for display
4. `created_at` — set once on INSERT, never updated
5. `updated_at` — set on INSERT, auto-updated on every UPDATE via trigger or ORM
6. `deleted_at` — NULL = active, set on soft delete

### Auto-Update Trigger for updated_at

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to every table:
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

## Soft Delete

All deletions are soft deletes — the `deleted_at` column is set to the current timestamp.

```prisma
// Prisma client automatically filters deleted records
const users = await prisma.user.findMany({
  where: { deletedAt: null },
});

// Or via Prisma middleware:
prisma.$use(async (params, next) => {
  if (params.action === "findMany" || params.action === "findFirst") {
    params.args.where = { ...params.args.where, deletedAt: null };
  }
  return next(params);
});
```

### Soft Delete Rules

1. `DELETE` operations set `deleted_at`, never remove rows
2. Queries default to excluding soft-deleted rows
3. Include soft-deleted rows only via explicit `includeDeleted: true` param
4. After 90 days, soft-deleted rows are archived to cold storage
5. Hard delete requires admin role + explicit `hard: true` flag

---

## Indexes

### Naming Convention

```
idx_{table}_{column(s)}
```

```sql
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_orders_customer_status ON orders (customer_id, status);
CREATE INDEX idx_orders_created_at ON orders (created_at DESC);
CREATE UNIQUE INDEX idx_users_email_active ON users (email) WHERE deleted_at IS NULL;
```

```prisma
model User {
  email String @db.VarChar(255)

  @@index([email], name: "idx_users_email")
  @@index([email], name: "idx_users_email_active", where: "deleted_at IS NULL")
}
```

### Index Strategy

| Index Type | When to Create |
|:---|:---|
| Single column | Column used in `WHERE`, `ORDER BY`, or `JOIN` |
| Composite | Multiple columns frequently queried together |
| Unique | Enforce business uniqueness (email, tax_number) |
| Partial | Unique constraint that ignores soft-deleted rows |
| GIN (JSONB) | Querying inside JSONB columns |
| GIN (Full-text) | Full-text search on TEXT/VARCHAR |
| BRIN | Very large tables with natural insert order |
| Covering | Queries that need columns not in the index (INCLUDE) |

### Index Rules

1. Index all foreign key columns
2. Index all columns used in WHERE clauses with high selectivity
3. Composite indexes: most selective column first
4. Avoid redundant indexes (e.g., `(a, b)` already covers `(a)`)
5. Monitor unused indexes — PostgreSQL `pg_stat_user_indexes`
6. No indexes on boolean columns (low cardinality, unless partial)
7. No indexes on small tables (< 1000 rows, unless critical path)
8. Create indexes CONCURRENTLY for production to avoid table locks

---

## Foreign Keys

### Naming Convention

```
fk_{table}_{referenced_table}
```

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_uuid_v7(),
  customer_id UUID NOT NULL,
  CONSTRAINT fk_orders_customers FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_uuid_v7(),
  order_id UUID NOT NULL,
  product_id UUID NOT NULL,
  CONSTRAINT fk_order_items_orders FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_order_items_products FOREIGN KEY (product_id) REFERENCES products(id)
);
```

### Foreign Key Rules

1. Always define foreign keys explicitly with names
2. Always add indexes on FK columns (PostgreSQL does NOT auto-index them)
3. Use `ON DELETE RESTRICT` by default (prevent orphaned data)
4. Use `ON DELETE CASCADE` only for truly dependent child rows (e.g., order_items when order is deleted)
5. Use `ON DELETE SET NULL` when the relation is optional
6. NEVER use `ON DELETE SET DEFAULT`

```sql
-- Standard pattern:
FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT

-- For composition (child cannot exist without parent):
FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE

-- For optional relations:
FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
```

---

## Constraints

### Naming Convention

| Constraint | Pattern | Example |
|:---|:---|:---|
| Primary Key | `pk_{table}` | `pk_users` |
| Foreign Key | `fk_{table}_{ref_table}` | `fk_orders_customers` |
| Unique | `uq_{table}_{column(s)}` | `uq_users_email` |
| Check | `ck_{table}_{rule}` | `ck_orders_amount_positive` |
| Default | `df_{table}_{column}` | `df_users_created_at` |
| Index | `idx_{table}_{column(s)}` | `idx_users_email` |

### Example Table with All Constraints

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_uuid_v7(),
  customer_id UUID NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT pk_orders PRIMARY KEY (id),
  CONSTRAINT fk_orders_customers FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT ck_orders_amount_positive CHECK (total_amount >= 0),
  CONSTRAINT ck_orders_status_valid CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'))
);

CREATE INDEX idx_orders_customer_id ON orders (customer_id);
CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_orders_created_at ON orders (created_at DESC);
```

---

## Data Types

### Standard Type Mapping

| PostgreSQL Type | Prisma Type | Use For |
|:---|:---|:---|
| `UUID` | `String @db.Uuid` | Primary keys, foreign keys |
| `VARCHAR(n)` | `String @db.VarChar(n)` | Short text (emails, names, codes) |
| `TEXT` | `String @db.Text` | Long text (descriptions, notes, content) |
| `INTEGER` | `Int` | Counts, small numbers |
| `BIGINT` | `BigInt` | Large numbers, file sizes |
| `DECIMAL(p,s)` | `Decimal @db.Decimal(p,s)` | Money, precise calculations |
| `BOOLEAN` | `Boolean` | True/false flags |
| `TIMESTAMPTZ` | `DateTime @db.Timestamptz()` | All date/time values |
| `DATE` | `DateTime @db.Date` | Date-only (birth date) |
| `JSONB` | `Json` | Flexible data, metadata, tags |
| `BYTEA` | `Bytes` | Binary data, small files |
| `TSVECTOR` | `Unsupported("tsvector")` | Full-text search |

### Money/Currency

```sql
-- ALWAYS use DECIMAL for money, NEVER FLOAT/REAL
amount DECIMAL(12,2) NOT NULL,
currency VARCHAR(3) NOT NULL DEFAULT 'SAR',  -- ISO 4217

-- CHECK constraint for currency codes
CONSTRAINT ck_payments_currency_valid CHECK (currency IN ('SAR', 'USD', 'EUR', 'AED'))
```

### JSONB Usage

```sql
-- ✅ Good use cases for JSONB:
metadata JSONB,          -- Dynamic key-value data
documents JSONB,         -- Array of document references
tags JSONB,              -- Array of strings
attributes JSONB,        -- Product/service attributes

-- ❌ Bad: using JSONB instead of proper columns
-- BAD:  data JSONB containing { email, name, address }
-- GOOD: Separate columns for email, name; JSONB for address (variable structure)

-- Indexing JSONB:
CREATE INDEX idx_products_metadata ON products USING GIN (metadata);
CREATE INDEX idx_products_metadata_color ON products ((metadata->>'color'));
```

---

## Migrations

### Migration File Naming

```
prisma/migrations/YYYYMMDDHHMMSS_description/
└── migration.sql

Example:
prisma/migrations/20260601143000_add_user_table/
└── migration.sql
```

### Migration Rules

1. **Every schema change in a migration file** — no manual DDL in production
2. **One migration per logical change** — don't combine unrelated changes
3. **Migration file is the source of truth** — schema.prisma models the desired state
4. **Always test migrations on staging first**
5. **Always review generated SQL** — Prisma's generated SQL may need adjustment
6. **No data migrations in schema migrations** — use separate seed/script files

### Migration Workflow

```bash
# 1. Edit schema.prisma
# 2. Generate migration (development)
pnpm --filter=@alharistech/database db:migrate:dev -- --name add_user_role_column

# 3. Review the generated SQL in the migration file
# 4. Commit migration file to git
# 5. CI runs migration against staging
# 6. Deploy migration to production:
pnpm --filter=@alharistech/database db:migrate:prod
```

### Migration Safety Rules

1. **No destructive changes without approval** — dropping columns/tables requires ADR
2. **Add columns with defaults** — avoid long-running ALTER TABLE locks
3. **Create indexes CONCURRENTLY** — for production tables
4. **Backward compatible** — migrations must work with running app code
5. **Rollback plan** — every migration must have a documented rollback

### Destructive Changes Requiring Approval

| Change | Approval Required |
|:---|:---|
| DROP COLUMN | Tech Lead + ADR |
| DROP TABLE | Tech Lead + ADR |
| RENAME COLUMN | Tech Lead |
| CHANGE DATA TYPE | Tech Lead |
| REMOVE CONSTRAINT | Tech Lead |
| ADD COLUMN (nullable) | Peer review |
| ADD COLUMN (not null with default) | Peer review |
| ADD INDEX | Peer review |
| ADD CONSTRAINT | Peer review |

---

## Seeds

### Development Seeds

```typescript
// packages/database/src/seeds/development.ts

export async function seedDevelopment() {
  // Create test users
  const admin = await prisma.user.create({
    data: {
      email: "admin@alharistech.local",
      passwordHash: await hash("Admin123!"),
      firstName: "Admin",
      role: "ADMIN",
    },
  });

  // Create sample data: customers, services, orders...
  // All data clearly marked as test data
  // Emails use @alharistech.local domain (never real)
}
```

### Test Seeds (for Integration Tests)

```typescript
// packages/database/src/seeds/test.ts

export async function seedTest() {
  // Minimal data required for each test suite
  // Tests clean up after themselves
  // Use transactions for test isolation
}
```

### Seed Rules

1. Seeds are version-controlled alongside migrations
2. Development seeds create realistic-but-fake data
3. Test seeds create minimal data per test suite
4. Production seeds only for reference/lookup data (countries, currencies, etc.)
5. Never seed real user data, even in staging
6. All seeded emails use `@alharistech.local`
7. All seeded phone numbers use test ranges (e.g., +966500000000)

---

## No Business Logic in Database

### Forbidden in Database

```sql
-- ❌ Stored procedures with business logic
CREATE FUNCTION calculate_order_total(order_id UUID) ...

-- ❌ Triggers that enforce business rules
CREATE TRIGGER prevent_duplicate_order ...

-- ❌ Database views that contain business rules
CREATE VIEW active_customers AS ...

-- ❌ Complex functions
CREATE FUNCTION is_eligible_for_discount(customer_id UUID) ...
```

### Allowed in Database

```sql
-- ✅ Performance-critical queries (via ORM repository)
-- ✅ Simple referential integrity constraints
-- ✅ CHECK constraints for data validity (simple rules)
-- ✅ Indexes for query performance
-- ✅ The updated_at trigger (purely infrastructural)
-- ✅ pg_uuidv7 extension (utility)
```

### Why No Business Logic in Database

1. Business logic must be version-controlled, tested, and reviewed in application code
2. Database functions are not easily tested in CI
3. Database functions cannot use application services (email, notifications)
4. Database functions create vendor lock-in
5. Business logic in DB creates split-brain across application and database

---

## Connection Management

### Development

```env
DATABASE_URL="postgresql://alharistech:password@localhost:5432/alharistech?schema=public"
```

### Production (with pgBouncer)

```env
DATABASE_URL="postgresql://alharistech:password@pgbouncer:6432/alharistech?schema=public&pgbouncer=true"
```

### Prisma Connection Pool

```typescript
// packages/database/src/client.ts
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development"
    ? ["query", "info", "warn", "error"]
    : ["error"],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});
```

### Connection Pool Rules

1. Use pgBouncer in transaction mode for production
2. Prisma's `connection_limit` set to `(pool_size / active_instances) - 1`
3. Minimum 5 connections, maximum 20 per instance
4. Monitor connection count in production (alert if > 80% pool used)
5. Implement circuit breaker for database outages

---

## Query Performance

### N+1 Prevention

```typescript
// ❌ N+1: Separate queries for each user's orders
const users = await prisma.user.findMany();
for (const user of users) {
  const orders = await prisma.order.findMany({ where: { userId: user.id } });
}

// ✅ Single query with include:
const users = await prisma.user.findMany({
  include: { orders: true },
});

// ✅ For large datasets, batch-fetch:
const userIds = users.map(u => u.id);
const orders = await prisma.order.findMany({
  where: { userId: { in: userIds } },
});
```

### Query Optimization

```typescript
// ✅ Select only needed columns
const users = await prisma.user.findMany({
  select: { id: true, email: true, firstName: true },
});

// ✅ Paginate large result sets
const users = await prisma.user.findMany({
  take: 20,
  skip: 0,
  orderBy: { createdAt: "desc" },
});

// ✅ Use raw queries only when Prisma cannot express the query
const result = await prisma.$queryRaw<MonthlyReport[]>`
  SELECT date_trunc('month', created_at) as month, COUNT(*) as total
  FROM orders
  WHERE created_at >= ${startDate}
  GROUP BY month
  ORDER BY month
`;
```

### Slow Query Monitoring

```typescript
// Prisma middleware for slow query logging
prisma.$use(async (params, next) => {
  const start = Date.now();
  const result = await next(params);
  const duration = Date.now() - start;

  if (duration > 100) { // 100ms threshold
    logger.warn("Slow query detected", {
      model: params.model,
      action: params.action,
      duration,
    });
  }

  return result;
});
```

---

## Backup Strategy

| Type | Frequency | Retention | Tool |
|:---|:---|:---|:---|
| Full backup | Daily | 30 days | `pg_dump` or provider automated |
| WAL archiving | Continuous | 7 days | PostgreSQL WAL |
| Point-in-time recovery | Enabled | 7 days | Provider PITR |
| Before migration backup | Before each deploy | 7 days | `pg_dump` snapshot |

---

## Environment-Specific Configuration

### Development

```env
DATABASE_URL="postgresql://alharistech:devpass@localhost:5432/alharistech_dev"
# Log all queries
# Automatically run migrations on startup (optional)
```

### Test

```env
DATABASE_URL="postgresql://alharistech:testpass@localhost:5432/alharistech_test"
# Use separate database for tests
# Reset database between test runs
# Use transactions for test isolation
```

### Staging

```env
DATABASE_URL="postgresql://alharistech:stagingpass@staging-db.internal:5432/alharistech_staging"
# pgBouncer enabled
# Connection pooling
# Anonymized production-like data
```

### Production

```env
DATABASE_URL="postgresql://alharistech:prodpass@prod-db.internal:5432/alharistech"
# pgBouncer REQUIRED
# SSL REQUIRED
# No query logging
# Connection limit carefully tuned
# Read replicas for analytics queries
```

---

## Database Checklist (Before Deploy)

- [ ] All migrations reviewed and tested on staging
- [ ] No destructive changes (DROP COLUMN/TABLE) without approval
- [ ] Foreign key columns have indexes
- [ ] All timestamps use TIMESTAMPTZ
- [ ] All tables have created_at, updated_at, deleted_at
- [ ] Primary keys are UUID v7
- [ ] No business logic in triggers or functions
- [ ] Connection pool size tuned for deployment
- [ ] Backup verified within last 24 hours
- [ ] Slow query log reviewed (no new slow queries)
- [ ] Database credentials rotated (if applicable)
