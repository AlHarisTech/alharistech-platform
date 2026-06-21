import { Injectable, Logger } from '@nestjs/common';
import { ExecutionStore } from './execution-store';
import { ExecutionLock } from './execution-lock';

export interface IdempotencyResult {
  skipped: boolean;
  eventId: string;
  eventType: string;
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(
    private readonly store: ExecutionStore,
    private readonly lock: ExecutionLock,
  ) {}

  async checkAndLock(eventType: string, eventId: string): Promise<boolean> {
    const exists = await this.store.exists(eventType, eventId);
    if (exists) {
      const record = await this.store.get(eventType, eventId);
      this.logger.debug(
        `Idempotency: ${eventType} (id=${eventId}) already ${record?.status ?? 'processed'}`,
      );
      return false;
    }

    const locked = await this.lock.acquire(eventType, eventId);
    if (!locked) {
      this.logger.debug(`Idempotency: ${eventType} (id=${eventId}) currently locked by another worker`);
      return false;
    }

    const doubleCheck = await this.store.exists(eventType, eventId);
    if (doubleCheck) {
      await this.lock.release(eventType, eventId);
      this.logger.debug(`Idempotency: ${eventType} (id=${eventId}) completed between lock attempts`);
      return false;
    }

    return true;
  }

  async markCompleted(eventType: string, eventId: string, version: number, attempts: number): Promise<void> {
    await this.store.markCompleted(eventType, eventId, version, attempts);
    await this.lock.release(eventType, eventId);
  }

  async markFailed(
    eventType: string,
    eventId: string,
    version: number,
    attempts: number,
    error: string,
  ): Promise<void> {
    await this.store.markFailed(eventType, eventId, version, attempts, error);
    await this.lock.release(eventType, eventId);
  }

  async releaseLock(eventType: string, eventId: string): Promise<void> {
    await this.lock.release(eventType, eventId);
  }
}
