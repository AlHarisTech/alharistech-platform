import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { EventQueueName } from './queue.constants';

@Injectable()
export class QueueRegistry {
  private readonly logger = new Logger(QueueRegistry.name);
  private readonly store = new Map<EventQueueName, Queue>();

  register(name: EventQueueName, queue: Queue): void {
    if (this.store.has(name)) {
      this.logger.warn(`Queue already registered: ${name} — overwriting`);
    }
    this.store.set(name, queue);
    this.logger.debug(`Queue registered: ${name}`);
  }

  resolve(name: EventQueueName): Queue | undefined {
    return this.store.get(name);
  }

  resolveAll(): Queue[] {
    return Array.from(this.store.values());
  }

  async shutdown(): Promise<void> {
    if (this.store.size === 0) return;
    this.logger.log(`Shutting down ${this.store.size} queues...`);
    const queues = this.resolveAll();
    await Promise.allSettled(queues.map((q) => q.close()));
    this.store.clear();
    this.logger.log('All queues closed');
  }

  get size(): number {
    return this.store.size;
  }

  get registeredNames(): EventQueueName[] {
    return Array.from(this.store.keys());
  }
}
