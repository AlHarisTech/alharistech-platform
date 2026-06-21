import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT_TOKEN, EVENT_QUEUES } from '../infrastructure/queue.constants';
import type { EventQueueName } from '../infrastructure/queue.constants';
import { QueueRegistry } from '../infrastructure/queue-registry';
import { WorkerRegistry } from '../workers/worker-registry';
import { DlqRouter } from '../dlq/dlq-router';
import type { EventRuntimeHealth, QueueHealth, RedisHealth, DlqHealth, IdempotencyHealth, WorkerHealth } from './runtime-health.types';

const STARTED_AT = new Date().toISOString();
let START_TIME = Date.now();

@Injectable()
export class RuntimeHealthService {
  private readonly logger = new Logger(RuntimeHealthService.name);

  constructor(
    @Inject(REDIS_CLIENT_TOKEN) private readonly redis: Redis | null,
    private readonly queueRegistry: QueueRegistry,
    private readonly workerRegistry: WorkerRegistry,
    private readonly dlqRouter: DlqRouter,
  ) {}

  async getHealth(): Promise<EventRuntimeHealth> {
    const redisHealth = await this.getRedisHealth();
    const queueHealth = await this.getQueueHealth();
    const workerHealth = this.getWorkerHealth();
    const dlqHealth = await this.getDlqHealth();
    const idempotencyHealth = this.getIdempotencyHealth(redisHealth);

    const status = redisHealth.status === 'connected' && workerHealth.status === 'running'
      ? 'healthy'
      : redisHealth.status === 'disconnected'
        ? 'unavailable'
        : 'degraded';

    return {
      status,
      redis: redisHealth,
      queues: queueHealth,
      workers: workerHealth,
      dlq: dlqHealth,
      idempotency: idempotencyHealth,
      uptimeMs: Date.now() - START_TIME,
      startedAt: STARTED_AT,
    };
  }

  private async getRedisHealth(): Promise<RedisHealth> {
    if (!this.redis) {
      return { status: 'unavailable' };
    }

    try {
      const start = Date.now();
      await this.redis.ping();
      return { status: 'connected', latencyMs: Date.now() - start };
    } catch {
      return { status: 'disconnected' };
    }
  }

  private async getQueueHealth(): Promise<QueueHealth[]> {
    const results: QueueHealth[] = [];
    const queueNames = Object.values(EVENT_QUEUES) as EventQueueName[];

    for (const name of queueNames) {
      const queue = this.queueRegistry.resolve(name);
      if (!queue) {
        results.push({ name, status: 'unavailable' });
        continue;
      }

      try {
        const jobCounts = await queue.getJobCounts('waiting', 'active', 'failed', 'delayed');
        results.push({
          name,
          status: 'healthy',
          waiting: jobCounts.waiting,
          active: jobCounts.active,
          failed: jobCounts.failed,
          delayed: jobCounts.delayed,
        });
      } catch {
        results.push({ name, status: 'degraded' });
      }
    }

    return results;
  }

  private getWorkerHealth(): WorkerHealth {
    const handlers = this.workerRegistry.resolveAll();
    return {
      status: 'running',
      activeCount: handlers.length,
      registeredHandlers: handlers.length,
    };
  }

  private async getDlqHealth(): Promise<DlqHealth> {
    const queueNames = Object.values(EVENT_QUEUES) as EventQueueName[];
    let totalEntries = 0;

    for (const name of queueNames) {
      try {
        const summary = await this.dlqRouter.summary(name);
        totalEntries += summary.totalEntries;
      } catch {
        continue;
      }
    }

    return { totalEntries, queueNames: [...queueNames] };
  }

  private getIdempotencyHealth(redisHealth: RedisHealth): IdempotencyHealth {
    if (redisHealth.status === 'unavailable') {
      return { status: 'unavailable', reason: 'Redis unavailable' };
    }
    return { status: 'available' };
  }

  resetUptime(): void {
    START_TIME = Date.now();
  }
}
