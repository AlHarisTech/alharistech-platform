import { Injectable, Logger, OnApplicationShutdown, Inject } from '@nestjs/common';
import { Worker as BullWorker } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';
import type { Redis } from 'ioredis';
import { WorkerRegistry } from './worker-registry';
import { REDIS_CLIENT_TOKEN } from '../infrastructure/queue.constants';
import type { RetryConfig } from './retry-config';
import { calculateBackoffDelay } from './retry-config';
import { EventExecutionException } from '../exceptions/event-execution.exception';

export interface ActiveWorker {
  queueName: string;
  worker: BullWorker;
  startedAt: string;
}

@Injectable()
export class WorkerFactory implements OnApplicationShutdown {
  private readonly logger = new Logger(WorkerFactory.name);
  private readonly activeWorkers = new Map<string, ActiveWorker>();

  constructor(
    @Inject(REDIS_CLIENT_TOKEN) private readonly redis: Redis | null,
    private readonly registry: WorkerRegistry,
  ) {}

  createWorker(queueName: string, retryConfig: RetryConfig): BullWorker {
    if (this.activeWorkers.has(queueName)) {
      this.logger.warn(`Worker already exists for queue '${queueName}' — returning existing`);
      return this.activeWorkers.get(queueName)!.worker;
    }

    if (!this.redis) {
      throw new Error(`Cannot create worker for '${queueName}': Redis unavailable`);
    }

    const worker = new BullWorker(
      queueName,
      async (job) => {
        const eventType = job.data.type as string | undefined;
        const eventId = job.data.id as string | undefined;

        if (!eventType) {
          this.logger.error(`Job ${job.id} has no event type — failing`);
          throw new Error('Job missing event type');
        }

        const handler = this.registry.resolve(eventType);
        if (!handler) {
          this.logger.error(`No handler registered for event type '${eventType}' (job ${job.id})`);
          throw new Error(`No handler for event type '${eventType}'`);
        }

        const payload = job.data.payload as Record<string, unknown>;

        try {
          await handler.execute(payload);
          await handler.onSuccess?.();
        } catch (error) {
          const execError = error instanceof Error ? error : new Error(String(error));
          const attempt = (job.attemptsMade || 0) + 1;

          await handler.onRetry?.(attempt, execError);

          if (attempt >= retryConfig.maxAttempts) {
            await handler.onFailure?.(execError);
            throw new EventExecutionException(
              eventId ?? 'unknown',
              eventType,
              attempt,
              `Max retries (${retryConfig.maxAttempts}) exceeded`,
              execError,
            );
          }

          const delay = calculateBackoffDelay(attempt, retryConfig);
          this.logger.debug(
            `Retrying ${eventType} (job ${job.id}): attempt ${attempt}/${retryConfig.maxAttempts}, ` +
              `delay ${delay}ms`,
          );
          throw execError;
        }
      },
      {
        connection: this.redis as ConnectionOptions,
        concurrency: 5,
        lockDuration: 30000,
        maxStalledCount: 3,
      },
    );

    worker.on('completed', (job) => {
      this.logger.debug(`Worker completed: ${queueName} (job ${job.id})`);
    });

    worker.on('failed', (job, error) => {
      this.logger.error(`Worker failed: ${queueName} (job ${job?.id}): ${error.message}`);
    });

    worker.on('error', (error) => {
      this.logger.error(`Worker error: ${queueName}: ${error.message}`);
    });

    worker.on('active', (job) => {
      this.logger.debug(`Worker active: ${queueName} (job ${job.id})`);
    });

    worker.on('stalled', (jobId) => {
      this.logger.warn(`Worker stalled: ${queueName} (job ${jobId})`);
    });

    this.activeWorkers.set(queueName, {
      queueName,
      worker,
      startedAt: new Date().toISOString(),
    });

    this.logger.log(`Worker created: ${queueName}`);
    return worker;
  }

  getWorker(queueName: string): BullWorker | undefined {
    return this.activeWorkers.get(queueName)?.worker;
  }

  async closeWorker(queueName: string): Promise<void> {
    const entry = this.activeWorkers.get(queueName);
    if (!entry) return;

    await entry.worker.close();
    this.activeWorkers.delete(queueName);
    this.logger.log(`Worker closed: ${queueName}`);
  }

  async closeAll(): Promise<void> {
    if (this.activeWorkers.size === 0) return;
    this.logger.log(`Closing ${this.activeWorkers.size} workers...`);
    await Promise.allSettled(
      Array.from(this.activeWorkers.keys()).map((name) => this.closeWorker(name)),
    );
    this.logger.log('All workers closed');
  }

  async onApplicationShutdown(): Promise<void> {
    await this.closeAll();
  }

  get activeCount(): number {
    return this.activeWorkers.size;
  }

  getActiveWorkers(): ActiveWorker[] {
    return Array.from(this.activeWorkers.values());
  }
}
