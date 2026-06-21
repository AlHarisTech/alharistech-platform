import { Injectable, Logger, Inject } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT_TOKEN } from '../infrastructure/queue.constants';
import { buildExecutionKey } from './execution-key';
import type { ExecutionRecord } from './execution-record';

const EXEC_STORE_TTL = 604800;

@Injectable()
export class ExecutionStore {
  private readonly logger = new Logger(ExecutionStore.name);

  constructor(@Inject(REDIS_CLIENT_TOKEN) private readonly redis: Redis | null) {}

  async markCompleted(eventType: string, eventId: string, version: number, attempts: number): Promise<void> {
    if (!this.redis) return;

    const key = buildExecutionKey(eventType, eventId);
    const record: ExecutionRecord = {
      eventId,
      eventType,
      version,
      status: 'completed',
      executedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      attempts,
    };

    await this.redis.setex(key, EXEC_STORE_TTL, JSON.stringify(record));
  }

  async markFailed(
    eventType: string,
    eventId: string,
    version: number,
    attempts: number,
    error: string,
  ): Promise<void> {
    if (!this.redis) return;

    const key = buildExecutionKey(eventType, eventId);
    const record: ExecutionRecord = {
      eventId,
      eventType,
      version,
      status: 'failed',
      executedAt: new Date().toISOString(),
      error,
      attempts,
    };

    await this.redis.setex(key, EXEC_STORE_TTL, JSON.stringify(record));
  }

  async get(eventType: string, eventId: string): Promise<ExecutionRecord | null> {
    if (!this.redis) return null;

    const key = buildExecutionKey(eventType, eventId);
    const raw = await this.redis.get(key);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as ExecutionRecord;
    } catch {
      return null;
    }
  }

  async exists(eventType: string, eventId: string): Promise<boolean> {
    if (!this.redis) return false;
    const key = buildExecutionKey(eventType, eventId);
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  async delete(eventType: string, eventId: string): Promise<void> {
    if (!this.redis) return;
    const key = buildExecutionKey(eventType, eventId);
    await this.redis.del(key);
  }
}
