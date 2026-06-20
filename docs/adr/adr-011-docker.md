# ADR-011: Docker for Development & Deployment

## Status
Accepted

## Date
2026-06-20

## Context
The AlharisTech platform is a multi-service system spanning the Next.js frontend (ADR-001), NestJS API (ADR-002), PostgreSQL (ADR-003), Redis (ADR-004), MinIO (ADR-010), and BullMQ workers (ADR-009). Each service has its own runtime dependencies, environment variables, and configuration. Developers joining the project must be able to run the full stack with a single command. Staging and production environments must run the exact same container images that were tested in CI — eliminating "works on my machine" discrepancies.

The monorepo structure (ADR-012) with Turborepo complicates service orchestration: each app and package has its own `package.json`, build script, and environment needs. Without containerization, starting the full stack requires manually running 5+ processes with coordinated environment variables and dependency ordering (Postgres before API, Redis before workers).

## Decision Drivers
1. Consistent environments across development, CI, staging, and production — same Docker images everywhere
2. Single-command local development startup for the entire service stack
3. Isolated service dependencies (correct Node.js version, system libraries) without polluting developer machines
4. CI/CD pipeline efficiency: build once, deploy everywhere
5. Orchestration strategy that scales from single-machine development to multi-node production
6. Support for on-premise enterprise deployments where Kubernetes may not be available

## Options Considered

### Option A: Docker Compose (dev/staging) → Docker Swarm or Kubernetes (production)
- **Description:** Docker Compose defines the full service topology for local development and CI. Each service has its own `Dockerfile`, built from the monorepo using Turborepo's dependency graph to optimize layer caching. Production can use Docker Swarm (simpler, built into Docker Engine) for Phase 1-4, with a planned migration to Kubernetes at Phase 5 when scale and multi-region requirements demand it.
- **Pros:**
  - Docker Compose provides a single `docker compose up` command to start the entire stack locally
  - Identical container images flow from developer machine → CI → staging → production (build once)
  - Docker layer caching combined with Turborepo caching (ADR-012) produces fast incremental builds
  - Docker Swarm is built into Docker Engine — zero additional infrastructure for basic orchestration
  - Kubernetes path is kept open: same Docker images, same containers, just a different orchestrator
  - Multi-stage builds keep production images small by excluding devDependencies and build tooling
  - Compose profiles allow selectively starting only needed services (e.g., `--profile worker` to add BullMQ workers)
  - On-premise customers who cannot run Kubernetes can use Docker Compose or Swarm
- **Cons:**
  - Docker knowledge is required across the entire development team
  - Docker Swarm has a smaller community and fewer cloud-managed offerings compared to Kubernetes
  - File-watching (hot reload) inside Docker containers requires additional configuration (bind mounts, polling)
  - Docker Desktop licensing changes (2021) may affect some developers — mitigated by using the free Docker Engine + CLI
  - Kubernetes deferred to Phase 5 means re-tooling deployment pipelines, health checks, and service discovery later

### Option B: Bare metal / direct process execution
- **Description:** Developers install Node.js, PostgreSQL, Redis, and MinIO natively on their machines. Each service is started as a separate process. CI/CD deploys directly to VPS instances or bare-metal servers using process managers (PM2, systemd).
- **Pros:**
  - No Docker overhead — no container build times, no virtualization layer, no image registry
  - Direct filesystem access simplifies debugging and hot reload during development
  - Familiar to developers with traditional Node.js backgrounds
- **Cons:**
  - "Works on my machine" syndrome — OS differences, Node.js version mismatches, system library incompatibilities
  - Onboarding time is high — each new developer spends hours installing the correct versions of every dependency
  - CI/CD must reproduce the exact OS and dependency versions of production — fragile and error-prone
  - Scaling requires manual provisioning or separate automation (Ansible, Chef)
  - No isolation between services — a memory leak in one process can affect co-located services
  - Rollback involves stopping processes and re-deploying files — no immutable deployment artifact

### Option C: Vercel-only (frontend) + managed backend
- **Description:** Deploy the Next.js frontend on Vercel, use managed services for the API (e.g., AWS Lambda, Cloud Run), managed Postgres (Supabase, RDS), and managed Redis (Upstash). No Docker, no orchestration.
- **Pros:**
  - Minimal infrastructure management — everything is a managed service
  - Vercel provides optimized Next.js hosting with edge functions and analytics
  - No Docker or orchestration knowledge required
  - Automatic scaling for serverless components
- **Cons:**
  - Complete vendor lock-in — migrating off Vercel + managed services is a full rewrite of deployment
  - On-premise enterprise deployments are impossible (managed services are cloud-only)
  - Serverless cold starts impact API latency for infrequently accessed endpoints
  - Cost at scale is unpredictable and often higher than self-managed containers
  - BullMQ workers (ADR-009) require long-running processes — incompatible with serverless execution models
  - The platform's NestJS backend (ADR-002) is designed for long-running servers, not function-as-a-service
  - Local development diverges significantly from production — undermines environment parity

## Decision
We chose **Option A: Docker Compose (development/staging) → Docker Swarm or Kubernetes (production)**. Docker Compose orchestrates the full service stack in development with a single `docker compose up` command. CI builds production images once, pushes them to a container registry, and promotes the same image through staging to production. Docker Swarm serves as the production orchestrator for Phase 1-4, with a planned evaluation and migration to Kubernetes in Phase 5.

Rationale:
1. Docker Compose provides the tightest development loop — `docker compose up` starts Postgres, Redis, MinIO, API, frontend, and workers in dependency order
2. "Build once, run anywhere" eliminates environment drift — the image tested in CI is the image deployed to production
3. Docker Swarm is built into Docker Engine and sufficient for single-region deployments in Phase 1-4 (rolling updates, service replication, secret management, health checks)
4. Kubernetes is not rejected — it is deferred to Phase 5 when multi-region, auto-scaling, and service mesh requirements justify its complexity
5. Turborepo's `--filter` combined with Docker layer caching (`package.json` and `lockfile` changes only rebuild dependency layers) keeps builds fast
6. Multi-stage Dockerfiles (build stage with devDependencies → production stage with only runtime dependencies) keep images small and secure
7. On-premise deployments can use Docker Compose or Swarm without a Kubernetes cluster — critical for enterprise contracts

## Consequences

### Positive
- Single-command onboarding: `docker compose up` and a new developer has the entire platform running locally
- Identical container images across environments eliminate "works on my machine" and deployment-surprise bugs
- Docker layer caching + Turborepo caching together produce sub-second incremental builds for code-only changes
- Each service runs in isolation with declarative resource limits (CPU, memory) — a runaway process in one container cannot starve others
- Docker Compose profiles allow selective startup: run only `api` + `db` + `redis` when doing backend work, add `frontend` only when needed
- Production rollback is a single command: `docker service rollback` (Swarm) or `kubectl rollout undo` (K8s), reverting to the previous immutable image

### Negative
- Docker knowledge is now a hard requirement for every developer — the team must invest in Docker training and troubleshooting skills
- File-watching (hot reload) inside containers adds complexity: bind mounts must be configured correctly, and some file systems (especially macOS) have poor bind-mount performance requiring polling workarounds
- Docker Swarm has a limited ecosystem compared to Kubernetes — fewer cloud-managed offerings, smaller community, limited third-party tool integrations (logging, monitoring, service mesh)
- Kubernetes migration at Phase 5 means re-tooling deployment pipelines, learning a new orchestrator, and rewriting service definitions from Compose/Swarm format to Helm charts or Kustomize

### Risks
- **Risk 1: Docker Desktop licensing issues for the team** — Mitigation: Use the free Docker Engine daemon with the Docker CLI (available on Linux, WSL2, and via Colima/Minikube on macOS). Document alternatives in onboarding guide. CI uses Docker Engine in GitHub Actions runners (no license needed).
- **Risk 2: Bind-mount performance degradation on non-Linux hosts** — Mitigation: Use `docker compose watch` (Compose v2.22+) which syncs files into running containers more efficiently than bind mounts. For macOS, document Colima as an alternative VM. For worst-case scenarios, provide a "native mode" where services run directly on the host and only infrastructure (Postgres, Redis, MinIO) runs in Docker.
- **Risk 3: Production image contains build-time secrets** — Mitigation: Use multi-stage builds with `--secret` flags for build-time credentials. Production stage starts from a clean base image. Scan images with Trivy or Docker Scout in CI before pushing to registry.
- **Risk 4: Kubernetes migration introduces significant operational complexity at Phase 5** — Mitigation: Start the Kubernetes evaluation early (Phase 4) as a non-blocking spike. Define the migration criteria clearly (must support: multi-region, auto-scaling, 99.95% uptime SLA). If Swarm remains sufficient, defer K8s further. If K8s is adopted, use a managed offering (EKS, GKE) to reduce operational burden.

## Compliance
- Every service must have a `Dockerfile` at its package root in the monorepo
- The root `docker-compose.yml` must start the full stack with `docker compose up` without manual intervention
- All container images must pass vulnerability scanning (Trivy) in CI before push to registry
- Production images must use `:latest` is forbidden — images are tagged with the git commit SHA and build timestamp
- Container resource limits (CPU, memory) must be defined for every service in Compose and Swarm/K8s configurations
- All services must implement Docker health checks (`HEALTHCHECK` in Dockerfile or `healthcheck` in Compose)

## Related Decisions
- [ADR-001: Next.js Frontend](./adr-001-nextjs-frontend.md) — Next.js app is containerized from a standalone build output
- [ADR-002: NestJS Backend](./adr-002-nestjs-backend.md) — NestJS API runs as a long-lived Docker container
- [ADR-003: PostgreSQL Database](./adr-003-postgresql.md) — PostgreSQL runs as a Docker container in development; managed in production
- [ADR-004: Redis for Caching & Sessions](./adr-004-redis.md) — Redis runs as a Docker container in development; managed in production
- [ADR-009: BullMQ for Background Jobs](./adr-009-bullmq.md) — BullMQ workers run as separate Docker containers in the swarm
- [ADR-010: S3-Compatible Object Storage](./adr-010-s3-storage.md) — MinIO runs as a Docker container in development
- [ADR-012: Monorepo with Turborepo](./adr-012-monorepo-turborepo.md) — Turborepo's dependency graph optimizes Docker build layer caching

## References
- [Docker Compose Specification](https://docs.docker.com/compose/compose-file/)
- [Docker Swarm Mode](https://docs.docker.com/engine/swarm/)
- [Docker Multi-Stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [Trivy Container Scanner](https://github.com/aquasecurity/trivy)
