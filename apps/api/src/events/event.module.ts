import { Global, Module, OnApplicationShutdown, Logger } from '@nestjs/common';
import { RedisManager } from './infrastructure/redis-manager';
import { QueueRegistry } from './infrastructure/queue-registry';
import { QueueFactory } from './infrastructure/queue-factory';
import { EventRuntimeHealthService } from './health/event-runtime.health';
import { redisClientProvider } from './providers/redis.provider';
import { QUEUE_PROVIDERS } from './providers/queue.provider';
import { loadEventRuntimeConfig } from './infrastructure/queue.constants';
import { EventRegistry } from './validation/event-registry';
import { EventValidator } from './validation/event-validator';
import { QueueResolver } from './bus/queue-resolver';
import { EventBus } from './bus/event-bus';
import { WorkerRegistry } from './workers/worker-registry';
import { WorkerFactory } from './workers/worker-factory';
import { WorkerOrchestrator } from './workers/worker-orchestrator';

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
    EventRegistry,
    EventValidator,
    QueueResolver,
    EventBus,
    WorkerRegistry,
    WorkerFactory,
    WorkerOrchestrator,
  ],
  exports: [
    RedisManager,
    QueueRegistry,
    QueueFactory,
    EventRuntimeHealthService,
    EventRegistry,
    EventValidator,
    QueueResolver,
    EventBus,
    WorkerRegistry,
    WorkerFactory,
    WorkerOrchestrator,
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
