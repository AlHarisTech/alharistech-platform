# ADR-010: S3-Compatible Object Storage

## Status
Accepted

## Date
2026-06-20

## Context
The AlharisTech platform handles file uploads across multiple domains: user-uploaded documents (identity verification, contracts, certificates), product images and media assets, system-generated files (PDF invoices and reports from background jobs per ADR-009), and database backups. These files must be stored durably, served efficiently, and must not reside on the application server's local filesystem — that would prevent horizontal scaling and make deployments risky.

The platform targets both cloud (AWS primary, with Cloudflare R2 as a cost-optimized alternative for high-egress workloads) and on-premise deployments for certain enterprise clients. This requires storage abstraction that works identically in development (local), staging, and production without code changes.

## Decision Drivers
1. Files must survive application server restarts, deployments, and scaling events (stateless application nodes)
2. Development environment must mirror production behavior without requiring cloud credentials or internet access
3. Production must support multiple S3-compatible providers (AWS S3, Cloudflare R2) for cost optimization and multi-cloud flexibility
4. Access control: public URLs for media assets, signed expiring URLs for sensitive documents
5. Large file uploads (up to 100MB) must be supported for document-heavy workflows

## Options Considered

### Option A: S3 API via MinIO (local dev) → S3/R2 (production)
- **Description:** Use the S3 API as the universal storage protocol. MinIO runs as a Docker container in local development, emulating the full S3 API. In production, the same S3 SDK connects to AWS S3 or Cloudflare R2 via environment-configured endpoint and credentials. An application-layer `StorageService` abstraction wraps the S3 SDK.
- **Pros:**
  - MinIO provides a production-identical S3 API in development — zero divergence between environments
  - Multi-cloud: switch between AWS S3 and Cloudflare R2 with a single environment variable change
  - S3 SDK is mature, well-tested, and available in every language — the TypeScript `@aws-sdk/client-s3` is officially maintained
  - Signed URLs for secure, time-limited access to private documents without proxying through the application server
  - Presigned POST for direct browser-to-S3 uploads, reducing application server bandwidth
  - Lifecycle policies for automatic archival (Glacier) or expiration
  - Versioning and object locking for compliance-sensitive documents
  - MinIO runs as a lightweight Docker container — starts in seconds, no cloud account required
- **Cons:**
  - MinIO adds a service dependency to the local Docker Compose stack (but trivial to run)
  - S3 event notifications (e.g., trigger on upload) require additional configuration (SNS/SQS or MinIO webhooks)
  - The `@aws-sdk/client-s3` is a large dependency (~3MB) — but tree-shaking mitigates this
  - Not optimized for frequent small writes (append-to-file patterns) — but our use cases are upload-once, read-many

### Option B: Local filesystem
- **Description:** Store files directly on the application server's filesystem under a configured upload directory. In production, use a network-mounted filesystem (NFS, EFS) for shared access.
- **Pros:**
  - Zero dependencies — Node.js `fs` module is all that's needed
  - Fastest possible read/write latency for local disk
  - Simple mental model — files are just paths
- **Cons:**
  - Application server becomes stateful — cannot horizontally scale without a shared filesystem
  - Network filesystems (NFS/EFS) introduce latency, locking issues, and are a single point of failure
  - No built-in signed URLs — must proxy file downloads through the application server, consuming bandwidth and compute
  - No lifecycle management, versioning, or replication — must build or buy separately
  - Backup requires separate tooling and process from the rest of the infrastructure
  - Development-to-production parity is poor — local filesystem behavior differs significantly from NFS/EFS

### Option C: Cloudinary (managed media platform)
- **Description:** Use Cloudinary as a fully managed media storage and transformation service. Uploads go directly to Cloudinary; it handles resizing, format optimization, CDN delivery, and asset management.
- **Pros:**
  - On-the-fly image transformations (resize, crop, format conversion) via URL parameters — no server-side processing needed
  - Automatic CDN delivery with global edge caching
  - AI-powered features (tagging, moderation, background removal) available on higher tiers
  - Rich dashboard for asset management
  - Reduces server-side media processing code significantly
- **Cons:**
  - Vendor lock-in — migrating millions of assets off Cloudinary is non-trivial
  - Pricing scales with storage, bandwidth, and transformations — unpredictable costs at scale
  - Not suitable for non-media files (documents, backups, system-generated PDFs)
  - No local development equivalent — development without internet is impossible, and free tier has strict limits
  - On-premise deployments are impossible — Cloudinary is SaaS-only
  - Adds a second storage system alongside whatever we use for non-media files — fragmentation

## Decision
We chose **Option A: S3 API via MinIO (local dev) → AWS S3 / Cloudflare R2 (production)**. All file storage goes through an application-level `StorageService` that wraps `@aws-sdk/client-s3`. In local development, MinIO runs as a Docker Compose service. In production, the same code connects to the configured S3-compatible endpoint.

Rationale:
1. MinIO gives us production-identical behavior in development — no "works on my machine" issues with file storage
2. The S3 API is the industry standard for object storage; every cloud provider and on-premise solution supports it, eliminating vendor lock-in
3. Cloudflare R2 offers zero-egress-fee pricing — significant cost savings for high-bandwidth media serving compared to AWS S3 egress charges
4. Signed URLs move file transfer off the application server entirely — the app generates a URL, the client uploads/downloads directly to/from S3
5. A thin `StorageService` abstraction around the S3 client allows swapping providers, adding middleware (virus scanning, audit logging), or introducing caching without touching business logic
6. On-premise enterprise deployments can use MinIO in production mode (distributed, multi-node) — the same code, same API

## Consequences

### Positive
- Stateless application servers — files persist independently of any application node lifecycle
- Direct-to-S3 presigned uploads remove the application server from the data path, freeing bandwidth and compute for API requests
- Signed URLs for downloads enforce time-limited access to private documents without streaming through the backend
- Multi-cloud flexibility: AWS S3 for deep Glacier archival, Cloudflare R2 for high-egress public media — switchable per bucket via configuration
- Local development with MinIO is fast, offline-capable, and identical to production behavior
- S3 Lifecycle policies automate archival and expiration, reducing storage costs for old documents

### Negative
- MinIO in the Docker Compose stack adds another service to manage locally (though it's lightweight and starts quickly)
- S3 eventual-consistency model means an object may not be immediately available after upload (though S3 and R2 now offer strong read-after-write consistency for new objects)
- Presigned URL generation requires the application to know client file metadata (size, type) upfront — adds complexity to upload flows
- The `@aws-sdk/client-s3` package is large; bundle size impacts cold-start times in serverless environments (but we run long-lived containers per ADR-011)

### Risks
- **Risk 1: Accidental public bucket exposure** — Mitigation: All buckets default to private. Public-read is enabled only on specific buckets via explicit Terraform/IaC configuration and requires a security review. S3 Block Public Access is enabled at account level.
- **Risk 2: Presigned URL leakage (URLs shared beyond intended recipient)** — Mitigation: Set short expiration times (15 minutes for downloads, 5 minutes for uploads). For highly sensitive documents, avoid presigned URLs entirely and proxy through the backend with an additional authorization check.
- **Risk 3: MinIO/S3 API version incompatibility in development** — Mitigation: Pin the MinIO Docker image version and test against the same S3 API version targeted in production. Run an integration test suite against both MinIO and the target production provider.
- **Risk 4: Large file uploads (100MB+) causing request timeouts at the API gateway** — Mitigation: Use S3 multipart upload with presigned URLs for each part. The client splits the file and uploads parts in parallel. The application server only orchestrates the multipart session (initiate, presign parts, complete).
- **Risk 5: Vendor-specific features leaking into application code** — Mitigation: The `StorageService` abstraction must only expose S3-standard APIs. Any provider-specific feature (e.g., R2's custom headers, S3's Object Lambda) must be behind an explicit configuration flag and documented as non-portable.

## Compliance
- All S3 buckets must have Block Public Access enabled unless explicitly approved for public-read
- Presigned URL maximum lifetime: 15 minutes for downloads, 5 minutes for uploads — enforced in `StorageService`
- Bucket naming convention: `{environment}-{domain}-{purpose}` (e.g., `prod-identity-documents`, `staging-media-assets`)
- All file access must be logged via S3 Server Access Logs or CloudTrail for auditability
- Integration tests must pass against both MinIO (CI) and the configured production provider (staging environment)

## Related Decisions
- [ADR-002: NestJS for Backend Services](./adr-002-nestjs-backend.md) — `StorageService` is a NestJS injectable provider
- [ADR-004: Redis for Caching & Sessions](./adr-004-redis.md) — Presigned URL metadata and upload session state cached in Redis
- [ADR-009: BullMQ for Background Jobs](./adr-009-bullmq.md) — Large job payloads (generated PDFs) stored in S3; jobs pass S3 keys
- [ADR-011: Docker for Development & Deployment](./adr-011-docker.md) — MinIO runs as a Docker Compose service in development
- [ADR-016: Domain-Driven Design](./adr-016-ddd.md) — Bucket naming and `StorageService` namespace follow bounded context boundaries

## References
- [AWS SDK for JavaScript v3 — S3 Client](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/)
- [MinIO Documentation](https://min.io/docs/minio/container/index.html)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [S3 Presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)
