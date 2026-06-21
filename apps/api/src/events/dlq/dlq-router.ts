import { Injectable, Logger, Inject } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT_TOKEN } from '../infrastructure/queue.constants';
import type { DlqEntry, DlqSummary } from './dlq-event';
import type { DlqReceipt } from './dlq-receipt';
import { DlqRegistry } from './dlq-registry';
import { DlqRoutingException } from '../exceptions/dlq-routing.exception';

const DLQ_KEY_PREFIX = 'dlq';
const DLQ_POISON_KEY_PREFIX = 'dlq:poison';

@Injectable()
export class DlqRouter {
  private readonly logger = new Logger(DlqRouter.name);

  constructor(
    @Inject(REDIS_CLIENT_TOKEN) private readonly redis: Redis | null,
    private readonly registry: DlqRegistry,
  ) {}

  async route(entry: Omit<DlqEntry, 'poisonCount'>): Promise<DlqReceipt> {
    if (!this.redis) {
      throw new DlqRoutingException(
        entry.eventId,
        entry.eventType,
        entry.queueName,
        'Redis unavailable — cannot route to DLQ',
      );
    }

    const poisonKey = `${DLQ_POISON_KEY_PREFIX}:${entry.eventId}`;
    const currentPoisonCount = await this.getPoisonCount(poisonKey);
    const newPoisonCount = currentPoisonCount + 1;
    const maxPoison = this.registry.getMaxPoisonCount(entry.eventType);

    const dlqEntry: DlqEntry = {
      ...entry,
      poisonCount: newPoisonCount,
    };

    const dlqKey = `${DLQ_KEY_PREFIX}:${entry.queueName}`;
    const json = JSON.stringify(dlqEntry);

    try {
      const multi = this.redis.multi();
      multi.lpush(dlqKey, json);
      multi.ltrim(dlqKey, 0, 9999);
      multi.setex(poisonKey, 2592000, String(newPoisonCount));
      await multi.exec();
    } catch (error) {
      throw new DlqRoutingException(
        entry.eventId,
        entry.eventType,
        entry.queueName,
        `Redis write failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined,
      );
    }

    if (newPoisonCount >= maxPoison) {
      this.logger.warn(
        `Poison event detected: ${entry.eventType} (id=${entry.eventId}, ` +
          `count=${newPoisonCount}, max=${maxPoison})`,
      );
    }

    this.logger.debug(
      `DLQ routed: ${entry.eventType} (id=${entry.eventId}, queue=${entry.queueName}, ` +
        `attempt=${entry.attempt}/${entry.maxAttempts})`,
    );

    return {
      eventId: entry.eventId,
      eventType: entry.eventType,
      queueName: entry.queueName,
      storedAt: entry.failedAt,
      poisonCount: newPoisonCount,
    };
  }

  async inspect(queueName: string, limit = 50): Promise<DlqEntry[]> {
    if (!this.redis) return [];

    const dlqKey = `${DLQ_KEY_PREFIX}:${queueName}`;
    const entries = await this.redis.lrange(dlqKey, 0, limit - 1);

    return entries
      .map((e) => {
        try {
          return JSON.parse(e) as DlqEntry;
        } catch {
          return null;
        }
      })
      .filter((e): e is DlqEntry => e !== null);
  }

  async summary(queueName: string): Promise<DlqSummary> {
    const entries = await this.inspect(queueName, 1);
    const total = await this.redis?.llen(`${DLQ_KEY_PREFIX}:${queueName}`) ?? 0;

    return {
      queueName,
      totalEntries: total,
      oldestEntry: entries[entries.length - 1]?.failedAt,
      newestEntry: entries[0]?.failedAt,
    };
  }

  async replay(eventId: string, queueName: string): Promise<DlqEntry | null> {
    const entries = await this.inspect(queueName, 1000);
    const entry = entries.find((e) => e.eventId === eventId);
    if (!entry) return null;

    const dlqKey = `${DLQ_KEY_PREFIX}:${queueName}`;
    await this.redis?.lrem(dlqKey, 1, JSON.stringify(entry));
    await this.redis?.del(`${DLQ_POISON_KEY_PREFIX}:${eventId}`);

    return entry;
  }

  async remove(eventId: string, queueName: string): Promise<boolean> {
    const entries = await this.inspect(queueName, 1000);
    const entry = entries.find((e) => e.eventId === eventId);
    if (!entry) return false;

    const dlqKey = `${DLQ_KEY_PREFIX}:${queueName}`;
    await this.redis?.lrem(dlqKey, 1, JSON.stringify(entry));
    await this.redis?.del(`${DLQ_POISON_KEY_PREFIX}:${eventId}`);
    return true;
  }

  async clearQueue(queueName: string): Promise<void> {
    await this.redis?.del(`${DLQ_KEY_PREFIX}:${queueName}`);
    this.logger.log(`DLQ cleared: ${queueName}`);
  }

  async poisonEvents(threshold?: number): Promise<Array<{ eventId: string; eventType: string; count: number }>> {
    const limit = threshold ?? this.registry.getMaxPoisonCount('*');
    const poisoned: Array<{ eventId: string; eventType: string; count: number }> = [];

    const keys = await this.redis?.keys(`${DLQ_POISON_KEY_PREFIX}:*`) ?? [];

    for (const key of keys) {
      const count = parseInt((await this.redis?.get(key)) ?? '0', 10);
      if (count >= limit) {
        const eventId = key.replace(`${DLQ_POISON_KEY_PREFIX}:`, '');
        poisoned.push({ eventId, eventType: 'unknown', count });
      }
    }

    return poisoned;
  }

  private async getPoisonCount(key: string): Promise<number> {
    const count = await this.redis?.get(key);
    return count ? parseInt(count, 10) : 0;
  }
}
