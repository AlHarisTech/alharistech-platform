import { Injectable, Logger } from '@nestjs/common';
import type { EventWorker } from './event-worker';

@Injectable()
export class WorkerRegistry {
  private readonly logger = new Logger(WorkerRegistry.name);
  private readonly handlers = new Map<string, EventWorker>();

  register(worker: EventWorker): void {
    const key = worker.eventType;

    if (this.handlers.has(key)) {
      this.logger.warn(`Handler already registered for '${key}' — call replace() to override`);
      return;
    }

    this.handlers.set(key, worker);
    this.logger.debug(`Handler registered: ${key}:v${worker.version}`);
  }

  replace(worker: EventWorker): void {
    const key = worker.eventType;
    this.handlers.set(key, worker);
    this.logger.debug(`Handler replaced: ${key}:v${worker.version}`);
  }

  resolve(eventType: string): EventWorker | undefined {
    return this.handlers.get(eventType);
  }

  has(eventType: string): boolean {
    return this.handlers.has(eventType);
  }

  resolveAll(): EventWorker[] {
    return Array.from(this.handlers.values());
  }

  unregister(eventType: string): boolean {
    const removed = this.handlers.delete(eventType);
    if (removed) {
      this.logger.debug(`Handler unregistered: ${eventType}`);
    }
    return removed;
  }

  get size(): number {
    return this.handlers.size;
  }
}
