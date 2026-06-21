import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QueueRegistry } from '../infrastructure/queue-registry';
import { EVENT_QUEUES } from '../infrastructure/queue.constants';
import type { EventQueueName } from '../infrastructure/queue.constants';

@Injectable()
export class QueueResolver {
  private readonly logger = new Logger(QueueResolver.name);
  private readonly domainMappings: Array<[RegExp, EventQueueName]> = [
    [/^auth\./, EVENT_QUEUES.AUTH],
    [/^notification\./, EVENT_QUEUES.NOTIFICATION],
    [/^audit\./, EVENT_QUEUES.AUDIT],
    [/^integration\./, EVENT_QUEUES.INTEGRATION],
  ];

  constructor(private readonly registry: QueueRegistry) {}

  resolve(eventType: string): Queue {
    const queueName = this.resolveQueueName(eventType);
    const queue = this.registry.resolve(queueName);

    if (!queue) {
      throw new Error(`Queue '${queueName}' not registered for event '${eventType}'`);
    }

    return queue;
  }

  resolveQueueName(eventType: string): EventQueueName {
    const match = this.domainMappings.find(([pattern]) => pattern.test(eventType));
    if (match) return match[1];
    return EVENT_QUEUES.SYSTEM;
  }
}
