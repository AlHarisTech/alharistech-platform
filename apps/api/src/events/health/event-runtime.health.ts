import { Injectable } from '@nestjs/common';
import { RedisManager } from '../infrastructure/redis-manager';
import { QueueRegistry } from '../infrastructure/queue-registry';
import type { EventRuntimeHealth as HealthReport, EventRuntimeStatus } from '../infrastructure/queue.types';

@Injectable()
export class EventRuntimeHealthService {
  constructor(
    private readonly redisManager: RedisManager,
    private readonly queueRegistry: QueueRegistry,
  ) {}

  check(): HealthReport {
    const connected = this.redisManager.isConnected();
    const errored = this.redisManager.isInErrorState();

    let status: EventRuntimeStatus;
    if (connected) {
      status = 'healthy';
    } else if (errored) {
      status = 'degraded';
    } else {
      status = 'unavailable';
    }

    return {
      status,
      redis: this.redisStatus(),
      queues: this.queueRegistry.size,
      uptime: this.redisManager.getUptime(),
    };
  }

  private redisStatus(): 'connected' | 'disconnected' | 'error' {
    if (this.redisManager.isConnected()) return 'connected';
    if (this.redisManager.isInErrorState()) return 'error';
    return 'disconnected';
  }
}
