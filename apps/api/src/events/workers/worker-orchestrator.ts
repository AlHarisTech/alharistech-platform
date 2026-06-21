import { Injectable, Logger } from '@nestjs/common';
import type { EventQueueName } from '../infrastructure/queue.constants';
import { EVENT_QUEUES } from '../infrastructure/queue.constants';
import { WorkerFactory, type ActiveWorker } from './worker-factory';
import type { RetryConfig } from './retry-config';
import { DEFAULT_RETRY_CONFIG } from './retry-config';

export interface WorkerOrchestratorHealth {
  status: 'healthy' | 'degraded' | 'stopped';
  activeWorkers: number;
  workers: Array<{
    queueName: string;
    running: boolean;
    startedAt: string;
  }>;
}

@Injectable()
export class WorkerOrchestrator {
  private readonly logger = new Logger(WorkerOrchestrator.name);
  private readonly defaultRetryConfig: RetryConfig;
  private started = false;

  constructor(private readonly factory: WorkerFactory, retryConfig?: Partial<RetryConfig>) {
    this.defaultRetryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  start(): void {
    if (this.started) {
      this.logger.warn('WorkerOrchestrator already started');
      return;
    }

    const queueNames = Object.values(EVENT_QUEUES);

    for (const queueName of queueNames) {
      try {
        this.factory.createWorker(queueName, this.defaultRetryConfig);
      } catch (error) {
        this.logger.error(
          `Failed to create worker for '${queueName}': ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    this.started = true;
    this.logger.log(`WorkerOrchestrator started (${queueNames.length} queues)`);
  }

  startQueue(queueName: EventQueueName, retryConfig?: Partial<RetryConfig>): void {
    const config = { ...this.defaultRetryConfig, ...retryConfig };

    try {
      this.factory.createWorker(queueName, config);
      this.logger.log(`Worker started for queue: ${queueName}`);
    } catch (error) {
      this.logger.error(
        `Failed to start worker for '${queueName}': ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    this.logger.log('Stopping all workers...');
    await this.factory.closeAll();
    this.started = false;
    this.logger.log('All workers stopped');
  }

  async stopQueue(queueName: EventQueueName): Promise<void> {
    await this.factory.closeWorker(queueName);
  }

  health(): WorkerOrchestratorHealth {
    const activeWorkers = this.factory.getActiveWorkers();
    const status = activeWorkers.length > 0 ? 'healthy' : this.started ? 'degraded' : 'stopped';

    return {
      status,
      activeWorkers: activeWorkers.length,
      workers: activeWorkers.map((w: ActiveWorker) => ({
        queueName: w.queueName,
        running: !w.worker.isPaused(),
        startedAt: w.startedAt,
      })),
    };
  }

  isRunning(): boolean {
    return this.started;
  }
}
