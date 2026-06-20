/**
 * EventValidator Specification
 * =============================
 *
 * STATUS: SPECIFICATION — Implementation deferred to Sprint 0.6
 *
 * 1. OVERVIEW
 *    Component:  EventValidator
 *    Type:       BullMQ Worker Middleware
 *    Purpose:    Validates every event payload before a BullMQ job handler processes
 *                it. Rejects invalid events into a dead-letter queue (DLQ) for
 *                inspection and replay.
 *
 *    Source of truth: specs/contracts/events/event-schemas.yaml (94 event schemas)
 *
 *    Fail-closed: If the event schema cannot be found or validation fails, the event
 *    is rejected to the DLQ — never silently processed with invalid data.
 *
 * 2. INTERFACE
 *
 *    ```typescript
 *    interface EventValidatorOptions {
 *      rejectToDLQ: boolean;           // Default: true
 *      dlqPrefix: string;              // Default: "dlq"
 *      dlqRetention: number;           // Default: 2592000 (30 days in seconds)
 *      maxReplayBatch: number;         // Default: 100
 *      strictVersionCheck: boolean;    // Default: true
 *      skipValidationQueues: string[]; // Default: []
 *    }
 *
 *    function eventValidatorMiddleware(
 *      schemaRegistry: SchemaRegistry,
 *      options: EventValidatorOptions,
 *    ): (job: Job, next: () => Promise<void>) => Promise<void>;
 *    ```
 *
 *    Applied per-worker via BullMQ worker.use():
 *
 *    ```typescript
 *    const worker = new Worker("identity.events", processor, {
 *      connection: redisConnection,
 *    });
 *    worker.use(eventValidatorMiddleware(schemaRegistry, { rejectToDLQ: true }));
 *    ```
 *
 * 3. EVENT PROCESSING FLOW
 *
 *    ```
 *    BullMQ Job Received
 *      |
 *      +-- 1. Skip Check
 *      |     If queue name in skipValidationQueues → pass through
 *      |     If job has x-skip-validation flag → pass through
 *      |
 *      +-- 2. Event Name Extraction
 *      |     job.data.event → "identity.user.registered"
 *      |     job.data.eventName → alternate key
 *      |     job.data.type → fallback key
 *      |     If no event name found → reject to DLQ (MISSING_EVENT_NAME)
 *      |
 *      +-- 3. Schema Resolution
 *      |     event name → schema lookup via SchemaRegistry.getEventSchema()
 *      |     Event schemas follow: {domain}.{aggregate}.{action}
 *      |     If schema not found → reject to DLQ (SCHEMA_NOT_FOUND)
 *      |
 *      +-- 4. Version Check
 *      |     Extract version: job.data.version or job.data.schemaVersion
 *      |     If mismatch and strictVersionCheck → reject (VERSION_MISMATCH)
 *      |     If mismatch and !strictVersionCheck → warn + continue
 *      |
 *      +-- 5. Schema Compilation
 *      |     Compile JSON Schema → AJV validator (cached)
 *      |     L1: in-memory LRU, L2: Redis cache (TTL 1h)
 *      |     Cache key: "event:validator:{eventName}:{version}"
 *      |
 *      +-- 6. Validation
 *      |     AJV validate(job.data.payload || job.data.data)
 *      |
 *      +-- 7. Result
 *      |     Valid:   Set job.data._validated = true, call next()
 *      |     Invalid: Reject to DLQ with errors + metadata, do NOT call next()
 *      |
 *      +-- 8. Error Handling
 *            Schema lookup error → reject to DLQ + log
 *            AJV compilation error → reject to DLQ + log + alert
 *            DLQ write failure → log + throw (let BullMQ retry)
 *    ```
 *
 * 4. DEAD-LETTER QUEUE FORMAT
 *
 *    Key:   dlq:{queueName}
 *    Type:  Redis List (FIFO), max 10,000 events, TTL 30 days
 *
 *    ```json
 *    {
 *      "id": "dlq_018f9a92-3c5f-7a8b-9c0d-1e2f3a4b5c6d",
 *      "queueName": "identity.events",
 *      "eventName": "identity.user.registered",
 *      "eventVersion": "1.0",
 *      "rejectedAt": "2026-06-20T12:00:00Z",
 *      "rejectionReason": "VALIDATION_ERROR",
 *      "errors": [
 *        {
 *          "keyword": "required",
 *          "dataPath": ".payload",
 *          "params": { "missingProperty": "userId" },
 *          "message": "must have required property 'userId'"
 *        }
 *      ],
 *      "originalJob": {
 *        "id": "job-abc123",
 *        "data": { ... },
 *        "opts": { ... },
 *        "attemptsMade": 0,
 *        "timestamp": 1718899200000
 *      },
 *      "schemaVersion": "1.0",
 *      "ttl": 2592000
 *    }
 *    ```
 *
 * 5. REPLAY MECHANISM
 *
 *    Admin API endpoint: POST /api/system/events/dlq/:queueName/replay
 *    Body: { "eventIds": ["dlq_abc123", "dlq_def456"] }
 *
 *    Replay process:
 *    1. Fetch event(s) from DLQ list
 *    2. Validate event still matches current schema version
 *    3. Re-add to the original queue
 *    4. Remove from DLQ list
 *    5. Log replay action (audit log)
 *
 *    Safety: Events replayed to ORIGINAL queue. Handler must be idempotent.
 *    Rate-limited: 10 replays per minute per admin user.
 *    Deduplication: Same event replayed twice only processes once (by event ID).
 *
 * 6. REJECTION REASONS
 *
 *    | Code                  | Description                                      |
 *    |-----------------------|--------------------------------------------------|
 *    | MISSING_EVENT_NAME    | Job data has no event/eventName/type field       |
 *    | SCHEMA_NOT_FOUND      | Event name has no matching schema in registry    |
 *    | VERSION_MISMATCH      | Event version doesn't match schema version       |
 *    | VALIDATION_ERROR      | Payload doesn't match JSON Schema                |
 *    | SCHEMA_COMPILE_ERROR  | AJV failed to compile the JSON Schema            |
 *    | SCHEMA_CORRUPTED      | Schema YAML/JSON is unparseable                  |
 *
 * 7. CONFIGURATION (Environment Variables)
 *
 *    | Variable                          | Type     | Default                                    |
 *    |-----------------------------------|----------|---------------------------------------------|
 *    | EVENT_SCHEMA_SOURCE               | local|redis | local                                   |
 *    | EVENT_SCHEMA_PATH                 | string   | specs/contracts/events/event-schemas.yaml   |
 *    | EVENT_DLQ_ENABLED                 | boolean  | true                                       |
 *    | EVENT_DLQ_PREFIX                  | string   | dlq                                        |
 *    | EVENT_DLQ_RETENTION_SECONDS       | integer  | 2592000                                    |
 *    | EVENT_DLQ_MAX_EVENTS              | integer  | 10000                                      |
 *    | EVENT_STRICT_VERSION              | boolean  | true                                       |
 *    | EVENT_SKIP_VALIDATION_QUEUES      | string[] | []                                         |
 *
 * 8. PERFORMANCE BUDGET
 *
 *    | Metric                            | Target     |
 *    |-----------------------------------|------------|
 *    | Schema lookup                     | < 1ms      |
 *    | AJV schema compilation (first use)| < 50ms     |
 *    | AJV validate (cached)             | < 2ms      |
 *    | DLQ write                         | < 1ms      |
 *    | Total overhead per event (cached) | < 3ms      |
 *
 * 9. INTEGRATION POINTS
 *
 *    - SchemaRegistry: event schema lookup via getEventSchema()
 *    - BullMQ Worker: middleware hook into job processing pipeline
 *    - Redis: DLQ storage, validator cache L2
 *    - Logger: validation errors and DLQ operations
 *    - Prometheus: event_validator_duration_ms histogram
 *    - Admin API: DLQ inspection and replay endpoints
 *
 * 10. DEPENDENCIES (when implemented)
 *
 *     | Package   | Version | Purpose                       |
 *     |-----------|---------|-------------------------------|
 *     | bullmq    | ^5.x    | Queue worker and middleware   |
 *     | ajv       | ^8.12+  | JSON Schema validation        |
 *     | ioredis   | ^5.x    | Redis connection              |
 *     | js-yaml   | ^4.x    | YAML parsing                  |
 *
 * 11. FUTURE CONSIDERATIONS
 *
 *     - Schema evolution with compatibility matrix
 *     - Event schema registry as a separate service
 *     - Dead-letter analytics dashboard
 *     - Automatic schema inference from TypeScript types
 */

export const EVENT_VALIDATOR_SPEC = true;
