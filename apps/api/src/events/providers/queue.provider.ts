import type { FactoryProvider } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { QueueFactory } from '../infrastructure/queue-factory';
import { EVENT_QUEUES, REDIS_CLIENT_TOKEN } from '../infrastructure/queue.constants';
import type { EventQueueName } from '../infrastructure/queue.constants';
import { loadEventRuntimeConfig } from '../infrastructure/queue.constants';

const config = loadEventRuntimeConfig();

export const QUEUE_PROVIDERS: FactoryProvider[] = Object.values(EVENT_QUEUES).map((name: EventQueueName) => ({
  provide: `QUEUE_${name.toUpperCase().replace(/-/g, '_')}`,
  useFactory: (client: Redis | null, factory: QueueFactory) => {
    if (!client) return null;
    return factory.createQueue(name, client, config.queuePrefix);
  },
  inject: [REDIS_CLIENT_TOKEN, QueueFactory],
}));
