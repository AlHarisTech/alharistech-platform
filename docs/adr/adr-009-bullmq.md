# ADR-009: BullMQ for Background Jobs & Queues

## Status
Accepted

## Date
2026-06-20

## Context
The AlharisTech platform has multiple operations that must not block HTTP request-response cycles: sending transactional emails (welcome, password reset, order confirmation), generating PDF documents (invoices, reports, certificates), processing uploaded media (image resizing, thumbnailing), delivering push notifications, and executing scheduled maintenance tasks (data cleanup, expired token purging). If any of these run synchronously within an HTTP handler, they degrade response latency, risk timeouts under load, and tie up Node.js event-loop threads that should be servicing other requests.

Redis is already provisioned in the stack as the caching and session store per ADR-004. NestJS (ADR-002) offers the `@nestjs/bullmq` package, which wraps BullMQ with decorator-based queue consumers and producers that integrate seamlessly with the NestJS module system and dependency injection container.

## Decision Drivers
1. Background processing must not block or delay HTTP responses — fire-and-forget or scheduled execution model
2. Jobs must survive process restarts and deployments (persistence and at-least-once delivery)
3. Job retry with configurable backoff for transient failures (email delivery, external API calls)
4. Observable job state (queued, active, completed, failed) for monitoring and alerting
5. Minimal infrastructure overhead — prefer leveraging existing stack components
6. Smooth integration with NestJS dependency injection and module lifecycle

## Options Considered

### Option A: BullMQ + Redis
- **Description:** Use BullMQ as the job queue library backed by the existing Redis instance (ADR-004). BullMQ provides job producers, consumers, repeatable jobs, concurrency control, and retry/backoff strategies. The `@nestjs/bullmq` package wraps it with decorators (`@InjectQueue`, `@Processor`, `@Process`).
- **Pros:**
  - Redis is already in the stack (ADR-004) — no new infrastructure required
  - `@nestjs/bullmq` provides first-class NestJS integration with minimal boilerplate
  - Bull Board UI for real-time queue monitoring and inspection
  - Built-in retry with exponential backoff, job rate limiting, and concurrency control
  - Repeatable jobs (cron) for scheduled tasks without a separate scheduler service
  - Active maintenance by the Taskforce.sh team with a large NestJS community
  - Sandboxed processors available for CPU-intensive jobs to avoid event-loop blocking
- **Cons:**
  - Tied to Redis — if Redis is unavailable, the entire queue system is down (jobs are not lost, just paused)
  - Not suitable for ultra-high throughput (100K+ jobs/second) — but far beyond Phase 1-4 requirements
  - Redis memory is consumed by job data — large job payloads must be stored externally (S3 per ADR-010)
  - No multi-region queue replication out of the box

### Option B: RabbitMQ
- **Description:** Use RabbitMQ as a dedicated message broker with AMQP 0-9-1 protocol. NestJS provides `@nestjs/microservices` with RabbitMQ transport.
- **Pros:**
  - Purpose-built message broker with advanced routing (exchanges, bindings, topics)
  - Message acknowledgments built into the protocol
  - Dead-letter exchanges for failed message handling
  - Clustering and federation for high availability
  - Language-agnostic — useful if non-Node.js workers are added later
- **Cons:**
  - Requires deploying and managing an additional infrastructure component (RabbitMQ server/cluster)
  - Operational complexity (node clustering, partition handling, upgrades)
  - NestJS integration via `@nestjs/microservices` is more generic and less queue-focused than `@nestjs/bullmq`
  - No built-in job scheduling (cron) — requires a separate scheduler or plugin
  - Overkill for Phase 1-4 job volumes and patterns (primarily fire-and-forget tasks)

### Option C: AWS SQS
- **Description:** Use Amazon SQS (Simple Queue Service) as the managed queue service. NestJS provides SQS transport via `@nestjs/microservices` or third-party libraries like `@ssut/nestjs-sqs`.
- **Pros:**
  - Fully managed — zero operational overhead for the queue infrastructure
  - Unlimited scalability with no throughput caps
  - FIFO queues available for ordered processing
  - Dead-letter queues (DLQ) built-in for failed message inspection
  - Works well in an AWS-deployed environment
- **Cons:**
  - Vendor lock-in to AWS — complicates multi-cloud and on-premise deployments
  - No local development equivalent (LocalStack adds complexity and divergence)
  - No built-in job scheduling — requires AWS EventBridge or a separate scheduler
  - No built-in UI for queue monitoring (requires CloudWatch dashboards or third-party tools)
  - SQS polling model adds latency compared to Redis pub/sub
  - NestJS integration is less mature than `@nestjs/bullmq`

## Decision
We chose **Option A: BullMQ + Redis**. The existing Redis instance (ADR-004) serves as the queue backend, eliminating the need for new infrastructure. The `@nestjs/bullmq` package provides idiomatic NestJS integration with decorators that fit naturally into the module system established by ADR-002.

Rationale:
1. Zero new infrastructure — Redis is already deployed and managed per ADR-004; adding BullMQ is purely an application-layer dependency
2. `@nestjs/bullmq` offers the tightest NestJS integration: `@InjectQueue()` for producers, `@Processor()`/`@Process()` for consumers, all participating in the DI container
3. Bull Board provides an instant admin UI for queue monitoring without additional deployment
4. Repeatable jobs cover cron-style scheduling (e.g., daily report generation, token cleanup) without a separate scheduler
5. For Phase 1-4 job volumes (hundreds to low thousands per minute), BullMQ's throughput is more than sufficient
6. If throughput requirements outgrow BullMQ at Phase 5+, migration to RabbitMQ or SQS is feasible because the job producer/consumer interfaces are abstracted behind application-level service classes

## Consequences

### Positive
- Redis serves double duty (cache per ADR-004 + queue) — maximizing infrastructure ROI
- Decorator-based NestJS integration means queue producers and consumers look like any other NestJS provider — no context switch for developers
- Bull Board UI gives operations visibility into queue health, failed jobs, and throughput without building custom dashboards
- Retry with exponential backoff handles transient failures automatically — email providers or external APIs that return 5xx get retried without manual intervention
- Sandboxed processors isolate CPU-intensive jobs (PDF generation, image processing) from the main event loop

### Negative
- Queue system availability depends on Redis — if Redis is down, both caching and queueing are affected simultaneously
- Job data stored in Redis memory imposes a soft limit on payload size — large payloads (e.g., base64-encoded files) must be offloaded to S3 (ADR-010) and referenced by key
- BullMQ lacks native multi-region replication — if we go multi-region at Phase 5, queue failover strategy must be designed separately
- Not a general-purpose message bus for interservice communication — if we later need a full event-driven architecture, a dedicated broker (RabbitMQ/Kafka) may be needed

### Risks
- **Risk 1: Redis memory exhaustion from large job payloads** — Mitigation: Enforce a maximum job data size (recommend 10KB). Jobs requiring large payloads store data in S3 (ADR-010) and pass only the S3 key. Add monitoring alerts when Redis memory usage exceeds 70%.
- **Risk 2: Job loss on Redis failure** — Mitigation: Enable Redis AOF (append-only file) persistence for durability. Schedule periodic Redis backups. BullMQ's at-least-once semantics mean jobs may be re-processed after recovery — idempotency keys are required for all job handlers.
- **Risk 3: Stalled jobs accumulating during deployments** — Mitigation: Configure `stalledInterval` and `maxStalledCount`. BullMQ automatically re-queues stalled jobs when workers restart. Graceful shutdown via NestJS lifecycle hooks (`onApplicationShutdown`) drains active jobs before process exit.
- **Risk 4: Queue monitoring blind spot in production** — Mitigation: Deploy Bull Board behind an admin authentication guard. Integrate BullMQ metrics (job counts, latency, failure rate) into the application monitoring stack via `bullmq/metrics` or custom Prometheus exporters.

## Compliance
- All job handlers must be idempotent (safe to re-execute) — enforced by code review checklist
- Job payload size must not exceed 10KB — enforced by a custom NestJS pipe on the `Queue.add()` wrapper service
- Every `@Processor` class must register `onApplicationShutdown` to gracefully stop processing
- Queue names must follow the convention `{domain}.{action}` (e.g., `email.send`, `document.generate`) per DDD bounded contexts (ADR-016)

## Related Decisions
- [ADR-002: NestJS for Backend Services](./adr-002-nestjs-backend.md) — NestJS module system and `@nestjs/bullmq` integration
- [ADR-004: Redis for Caching & Sessions](./adr-004-redis.md) — Redis is the shared backend for caching and queuing
- [ADR-005: TypeScript Across the Stack](./adr-005-typescript.md) — TypeScript-decorated job processors with full type safety
- [ADR-010: S3-Compatible Object Storage](./adr-010-s3-storage.md) — Large job payloads offloaded to S3
- [ADR-016: Domain-Driven Design](./adr-016-ddd.md) — Queue naming convention follows bounded context boundaries

## References
- [BullMQ Documentation](https://docs.bullmq.io/)
- [NestJS BullMQ Integration](https://docs.nestjs.com/techniques/queues)
- [Bull Board UI](https://github.com/felixmosh/bull-board)
- [BullMQ Metrics & Monitoring](https://docs.bullmq.io/guide/metrics)
