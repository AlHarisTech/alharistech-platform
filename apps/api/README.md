# apps/api — Runtime Anchor
## NestJS Minimal Skeleton — No Business Logic

**STATUS: Infrastructure/Plumbing Only**
**DO NOT add features, controllers with real endpoints, or business logic.**
**This is the CRBL anchor point — the minimum runtime that enforcement hooks bind to.**

## What This Contains
- NestJS + Fastify bootstrap (main.ts)
- Empty AppModule with CRBL hook slots
- Health check endpoint (GET /health)
- Configuration module (env loading)
- Database connection (Drizzle + PostgreSQL)
- Redis connection (ioredis)
- CRBL hook points (empty guards, interceptors, pipes — pass-through until Sprint 0.5.1)

## What This Does NOT Contain
- No domain controllers
- No business services
- No order processing
- No customer management
- No authentication endpoints (CRBL guards validate auth, but no login endpoint yet)
- No feature code whatsoever

## Running
```bash
# From project root
pnpm install
pnpm --filter @aht/api dev
```

## Request Lifecycle (for CRBL binding)
```
Incoming HTTP Request
  → Fastify adapter
    → Global Guards (CRBL: ContractGuard slot, PolicyGuard slot)
      → Global Interceptors (CRBL: ContractInterceptor slot)
        → Global Pipes (CRBL: ValidationPipe slot)
          → Controller (HealthCheck only)
            → Response
```
