import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { SchemaRegistry } from './schema-registry.service';

export interface ValidatedEvent {
  eventName: string;
  version: string;
  payload: Record<string, unknown>;
  validatedAt: string;
  schemaVersion: string;
}

export interface DeadLetterEvent {
  eventName: string;
  version: string;
  originalPayload: Record<string, unknown>;
  error: {
    message: string;
    errors: Array<{ field: string; message: string }>;
  };
  failedAt: string;
  retryCount: number;
}

@Injectable()
export class EventValidator implements OnModuleInit {
  private readonly logger = new Logger(EventValidator.name);
  private ready = false;

  constructor(private readonly schemaRegistry: SchemaRegistry) {}

  async onModuleInit() {
    this.ready = this.schemaRegistry.isReady();
    if (this.ready) {
      this.logger.log('EventValidator activated — async enforcement online');
    } else {
      this.logger.warn('EventValidator waiting for SchemaRegistry...');
    }
  }

  /**
   * Validates an event before it enters the BullMQ processing pipeline.
   * Called as BullMQ worker middleware.
   *
   * @returns ValidatedEvent if valid
   * @throws EventValidationError if invalid (event goes to DLQ)
   */
  validate(eventName: string, payload: Record<string, unknown>, version = '1.0'): ValidatedEvent {
    if (!this.ready) {
      throw new EventValidationError(eventName, 'SchemaRegistry not ready — rejecting all events (fail-closed)');
    }

    const schemaVersion = this.schemaRegistry.getEventSchema(eventName);
    if (!schemaVersion) {
      throw new EventValidationError(eventName, `Unknown event: ${eventName}. Not in event catalog. (fail-closed)`);
    }

    const validator = this.schemaRegistry.getEventValidator(eventName);
    if (!validator) {
      throw new EventValidationError(eventName, `No compiled validator for event: ${eventName}`);
    }

    const valid = validator(payload);
    if (!valid) {
      const errors = (validator.errors || []).map(e => ({
        field: e.instancePath || e.params?.missingProperty || 'payload',
        message: e.message || 'validation failed',
      }));
      throw new EventValidationError(eventName, 'Event payload failed schema validation', errors);
    }

    this.logger.debug(`Event validated: ${eventName} v${version}`);

    return {
      eventName,
      version,
      payload,
      validatedAt: new Date().toISOString(),
      schemaVersion,
    };
  }

  /**
   * BullMQ worker middleware signature.
   * Use in worker options: { middleware: [eventValidatorMiddleware] }
   */
  createMiddleware() {
    return async (job: any, next: () => Promise<void>) => {
      try {
        const { eventName, payload, version } = job.data;
        this.validate(eventName, payload, version);
        await next();
      } catch (error) {
        if (error instanceof EventValidationError) {
          await this.sendToDLQ(job, error);
        }
        throw error;
      }
    };
  }

  /**
   * Sends invalid event to Dead Letter Queue.
   *
   * DLQ Storage (Redis):
   *   Key:   dlq:{queueName}
   *   Type:  Redis List (FIFO)
   *   TTL:   30 days (2592000 seconds) per key
   *   Cap:   Max 10,000 entries per queue; oldest evicted on overflow
   *
   * Per-event structure (JSON-serialized in Redis list entry):
   *   { eventName, version, originalPayload, error, failedAt, retryCount }
   *
   * Integration point: Redis client injection deferred to Sprint 0.6.
   * When activated, replace comments below with:
   *   await this.redis.lpush(`dlq:${job.queueName}`, JSON.stringify(dlqEntry));
   *   await this.redis.expire(`dlq:${job.queueName}`, 2592000);
   */
  private async sendToDLQ(job: any, error: EventValidationError): Promise<void> {
    const dlqEntry: DeadLetterEvent = {
      eventName: error.eventName,
      version: job.data?.version || 'unknown',
      originalPayload: job.data?.payload || {},
      error: {
        message: error.message,
        errors: error.validationErrors || [],
      },
      failedAt: new Date().toISOString(),
      retryCount: (job.opts?.attempts || 0) - (job.attemptsMade || 0),
    };

    // Deferred — Redis client injection in Sprint 0.6
    // await this.redis.lpush(`dlq:${job.queueName}`, JSON.stringify(dlqEntry));
    // await this.redis.expire(`dlq:${job.queueName}`, 30 * 24 * 3600);

    this.logger.error(
      `Event REJECTED → DLQ: ${error.eventName}`,
      JSON.stringify(dlqEntry.error),
    );

    // Deferred — Prometheus metric
    // metrics.increment('crbl.event.validation_failed', { event: error.eventName });
  }

  isReady(): boolean {
    return this.ready;
  }

  getStats() {
    return {
      status: this.ready ? 'active' : 'initializing',
      eventCount: this.schemaRegistry.getStats().eventSchemas,
    };
  }
}

export class EventValidationError extends Error {
  public readonly validationErrors: Array<{ field: string; message: string }>;

  constructor(
    public readonly eventName: string,
    message: string,
    validationErrors: Array<{ field: string; message: string }> = [],
  ) {
    super(`Event validation failed for '${eventName}': ${message}`);
    this.name = 'EventValidationError';
    this.validationErrors = validationErrors;
  }
}
