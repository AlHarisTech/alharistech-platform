import { Injectable, Logger } from '@nestjs/common';
import { DlqRouter } from './dlq-router';
import { EventBus } from '../bus/event-bus';
import type { DomainEvent } from '../contracts/domain-event';
import type { DlqEntry } from './dlq-event';
import { EventMetricsService } from '../observability/event-metrics.service';
import { EventTracerService } from '../observability/event-tracer.service';

export interface ReplayResult {
  success: boolean;
  eventId: string;
  eventType: string;
  error?: string;
}

@Injectable()
export class DlqService {
  private readonly logger = new Logger(DlqService.name);

  constructor(
    private readonly router: DlqRouter,
    private readonly eventBus: EventBus,
    private readonly metrics?: EventMetricsService,
    private readonly tracer?: EventTracerService,
  ) {}

  async inspect(queueName: string, limit = 50): Promise<DlqEntry[]> {
    return this.router.inspect(queueName, limit);
  }

  async summary(queueName: string) {
    return this.router.summary(queueName);
  }

  async replay(eventId: string, queueName: string): Promise<ReplayResult> {
    const entry = await this.router.replay(eventId, queueName);

    if (!entry) {
      return { success: false, eventId, eventType: 'unknown', error: 'Not found in DLQ' };
    }

    try {
      const event: DomainEvent = {
        id: entry.eventId,
        type: entry.eventType,
        version: entry.version,
        occurredAt: new Date().toISOString(),
        correlationId: entry.eventId,
        causationId: entry.eventId,
        payload: entry.payload,
      };

      await this.eventBus.publish(event);

      this.metrics?.incrementReplay();
      this.tracer?.traceReplay(entry.eventId, entry.eventType);
      this.logger.log(`Replayed: ${entry.eventType} (id=${entry.eventId})`);
      return { success: true, eventId: entry.eventId, eventType: entry.eventType };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Replay failed: ${entry.eventType} (id=${entry.eventId}): ${message}`);

      await this.router.remove(eventId, queueName);

      return { success: false, eventId, eventType: entry.eventType, error: message };
    }
  }

  async replayAll(queueName: string): Promise<ReplayResult[]> {
    const entries = await this.router.inspect(queueName, 1000);
    const results: ReplayResult[] = [];

    for (const entry of entries) {
      const result = await this.replay(entry.eventId, queueName);
      results.push(result);
    }

    this.logger.log(
      `ReplayAll (${queueName}): ${results.filter((r) => r.success).length} succeeded, ` +
        `${results.filter((r) => !r.success).length} failed`,
    );

    return results;
  }

  async remove(eventId: string, queueName: string): Promise<boolean> {
    const removed = await this.router.remove(eventId, queueName);
    if (removed) {
      this.logger.debug(`Removed from DLQ: ${eventId} (queue=${queueName})`);
    }
    return removed;
  }

  async clearQueue(queueName: string): Promise<void> {
    await this.router.clearQueue(queueName);
  }

  async poisonEvents(threshold?: number) {
    return this.router.poisonEvents(threshold);
  }
}
