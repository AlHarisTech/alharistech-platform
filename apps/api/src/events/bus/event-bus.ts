import { Injectable, Logger } from '@nestjs/common';
import type { DomainEvent } from '../contracts/domain-event';
import type { EventReceipt } from './event-receipt';
import type { PublishOptions, ScheduleOptions } from './publish-options';
import { EventValidator } from '../validation/event-validator';
import { QueueResolver } from './queue-resolver';
import { QueueRegistry } from '../infrastructure/queue-registry';
import { EventPublishException } from '../exceptions/event-publish.exception';
import { EventScheduleException } from '../exceptions/event-schedule.exception';

@Injectable()
export class EventBus {
  private readonly logger = new Logger(EventBus.name);

  constructor(
    private readonly validator: EventValidator,
    private readonly resolver: QueueResolver,
    private readonly registry: QueueRegistry,
  ) {}

  async publish<T>(event: DomainEvent<T>, options?: PublishOptions): Promise<EventReceipt> {
    this.validator.validate(event);

    const queue = this.resolver.resolve(event.type);

    try {
      const job = await queue.add(event.type, this.serializePayload(event), {
        ...options,
        removeOnComplete: options?.removeOnComplete ?? 1000,
        removeOnFail: options?.removeOnFail ?? 5000,
      });

      if (!job.id) {
        throw new EventPublishException(event.type, 'BullMQ returned job without id');
      }

      this.logger.debug(`Published: ${event.type}:v${event.version} (job=${job.id})`);

      return this.buildReceipt(event, job.id, queue.name, false);
    } catch (error) {
      if (error instanceof EventPublishException) throw error;
      throw new EventPublishException(
        event.type,
        `BullMQ add failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  async publishMany<T>(events: DomainEvent<T>[], options?: PublishOptions): Promise<EventReceipt[]> {
    if (events.length === 0) return [];

    for (const event of events) {
      this.validator.validate(event);
    }

    const receipts = await Promise.all(
      events.map(async (event) => {
        const queue = this.resolver.resolve(event.type);
        try {
          const job = await queue.add(event.type, this.serializePayload(event), {
            ...options,
            removeOnComplete: options?.removeOnComplete ?? 1000,
            removeOnFail: options?.removeOnFail ?? 5000,
          });

          if (!job.id) {
            throw new EventPublishException(event.type, 'BullMQ returned job without id');
          }

          return this.buildReceipt(event, job.id, queue.name, false);
        } catch (error) {
          throw new EventPublishException(
            event.type,
            `BullMQ add failed: ${error instanceof Error ? error.message : String(error)}`,
            error instanceof Error ? error : undefined,
          );
        }
      }),
    );

    return receipts;
  }

  async schedule<T>(event: DomainEvent<T>, options: ScheduleOptions): Promise<EventReceipt> {
    if (options.delayMs < 0) {
      throw new EventScheduleException(
        event.type,
        options.delayMs,
        'delayMs must be >= 0 (PI-004)',
      );
    }

    this.validator.validate(event);

    const queue = this.resolver.resolve(event.type);

    try {
      const job = await queue.add(event.type, this.serializePayload(event), {
        ...options,
        delay: options.delayMs,
        removeOnComplete: options?.removeOnComplete ?? 1000,
        removeOnFail: options?.removeOnFail ?? 5000,
      });

      if (!job.id) {
        throw new EventScheduleException(event.type, options.delayMs, 'BullMQ returned job without id');
      }

      const scheduledFor = new Date(Date.now() + options.delayMs).toISOString();
      this.logger.debug(`Scheduled: ${event.type}:v${event.version} (job=${job.id}, +${options.delayMs}ms)`);

      return this.buildReceipt(event, job.id, queue.name, true, scheduledFor);
    } catch (error) {
      if (error instanceof EventScheduleException) throw error;
      throw new EventScheduleException(
        event.type,
        options.delayMs,
        `BullMQ add failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  async cancel(jobId: string): Promise<boolean> {
    try {
      this.logger.debug(`Attempting to cancel job: ${jobId}`);

      const queues = this.registry.resolveAll();
      for (const queue of queues) {
        const job = await queue.getJob(jobId);
        if (job) {
          await job.remove();
          this.logger.debug(`Cancelled job: ${jobId} (queue: ${queue.name})`);
          return true;
        }
      }

      this.logger.debug(`Job not found for cancellation: ${jobId}`);
      return false;
    } catch (error) {
      throw new EventScheduleException(
        'unknown',
        0,
        `Cancel failed for job '${jobId}': ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  private serializePayload<T>(event: DomainEvent<T>): Record<string, unknown> {
    return {
      id: event.id,
      type: event.type,
      version: event.version,
      occurredAt: event.occurredAt,
      correlationId: event.correlationId,
      causationId: event.causationId,
      payload: event.payload as unknown as Record<string, unknown>,
      metadata: event.metadata,
    };
  }

  private buildReceipt(
    event: DomainEvent<unknown>,
    jobId: string,
    queueName: string,
    scheduled: boolean,
    scheduledFor?: string,
  ): EventReceipt {
    return {
      eventId: event.id,
      type: event.type,
      version: event.version,
      queue: queueName,
      jobId,
      publishedAt: new Date().toISOString(),
      scheduled,
      scheduledFor,
    };
  }
}
