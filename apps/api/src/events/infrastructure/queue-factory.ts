import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { QueueOptions } from 'bullmq';
import type { Redis } from 'ioredis';
import { QueueRegistry } from './queue-registry';
import type { EventQueueName } from './queue.constants';
import { DEFAULT_EVENT_QUEUE_OPTIONS } from './queue.constants';

@Injectable()
export class QueueFactory {
  private readonly logger = new Logger(QueueFactory.name);

  constructor(private readonly registry: QueueRegistry) {}

  createQueue(name: EventQueueName, connection: Redis, prefix: string): Queue {
    const existing = this.registry.resolve(name);
    if (existing) {
      this.logger.debug(`Queue already exists: ${name} — returning existing`);
      return existing;
    }

    const options: QueueOptions = {
      connection: connection as QueueOptions['connection'],
      prefix,
      ...DEFAULT_EVENT_QUEUE_OPTIONS,
    };

    const queue = new Queue(name, options);
    this.registry.register(name, queue);
    this.logger.log(`Queue created: ${prefix}:${name}`);
    return queue;
  }

  getQueue(name: EventQueueName): Queue | undefined {
    return this.registry.resolve(name);
  }

  async closeQueue(name: EventQueueName): Promise<void> {
    const queue = this.registry.resolve(name);
    if (!queue) return;
    await queue.close();
    this.logger.debug(`Queue closed: ${name}`);
  }

  async closeAllQueues(): Promise<void> {
    const queues = this.registry.resolveAll();
    await Promise.allSettled(queues.map((q) => q.close()));
    this.logger.log(`Closed ${queues.length} queues`);
  }
}
