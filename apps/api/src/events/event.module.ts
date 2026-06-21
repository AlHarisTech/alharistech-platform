import { Global, Module, OnApplicationShutdown, Logger } from '@nestjs/common';
import { RedisManager } from './infrastructure/redis-manager';
import { QueueRegistry } from './infrastructure/queue-registry';
import { QueueFactory } from './infrastructure/queue-factory';
import { EventRuntimeHealthService } from './health/event-runtime.health';
import { redisClientProvider } from './providers/redis.provider';
import { QUEUE_PROVIDERS } from './providers/queue.provider';
import { loadEventRuntimeConfig } from './infrastructure/queue.constants';

@Global()
@Module({
  providers: [
    {
      provide: 'EVENT_RUNTIME_CONFIG',
      useFactory: loadEventRuntimeConfig,
    },
    {
      provide: RedisManager,
      useFactory: (config: ReturnType<typeof loadEventRuntimeConfig>) => new RedisManager(config),
      inject: ['EVENT_RUNTIME_CONFIG'],
    },
    redisClientProvider,
    QueueRegistry,
    QueueFactory,
    ...QUEUE_PROVIDERS,
    EventRuntimeHealthService,
  ],
  exports: [
    RedisManager,
    QueueRegistry,
    QueueFactory,
    EventRuntimeHealthService,
    ...QUEUE_PROVIDERS.map((p) => p.provide),
  ],
})
export class EventModule implements OnApplicationShutdown {
  private readonly logger = new Logger(EventModule.name);

  constructor(private readonly queueRegistry: QueueRegistry) {}

  async onApplicationShutdown(): Promise<void> {
    this.logger.log('Shutting down Event Runtime...');
    await this.queueRegistry.shutdown();
    this.logger.log('Event Runtime shutdown complete');
  }
}
