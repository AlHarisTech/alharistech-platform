import { Injectable, Logger, Inject } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT_TOKEN } from '../infrastructure/queue.constants';
import { buildExecutionKey } from './execution-key';

const LOCK_TTL = 30000;

@Injectable()
export class ExecutionLock {
  private readonly logger = new Logger(ExecutionLock.name);

  constructor(@Inject(REDIS_CLIENT_TOKEN) private readonly redis: Redis | null) {}

  async acquire(eventType: string, eventId: string, ttl = LOCK_TTL): Promise<boolean> {
    if (!this.redis) return false;

    const key = `${buildExecutionKey(eventType, eventId)}:lock`;
    const result = await this.redis.set(key, Date.now().toString(), 'PX', ttl, 'NX');
    return result === 'OK';
  }

  async release(eventType: string, eventId: string): Promise<void> {
    if (!this.redis) return;

    const key = `${buildExecutionKey(eventType, eventId)}:lock`;
    await this.redis.del(key);
  }

  async isLocked(eventType: string, eventId: string): Promise<boolean> {
    if (!this.redis) return false;

    const key = `${buildExecutionKey(eventType, eventId)}:lock`;
    const exists = await this.redis.exists(key);
    return exists === 1;
  }
}
