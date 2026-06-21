import { Logger } from '@nestjs/common';

export abstract class EventWorker<TPayload = Record<string, unknown>> {
  protected readonly logger: Logger;

  abstract readonly eventType: string;
  abstract readonly version: number;

  constructor() {
    this.logger = new Logger(`${this.constructor.name}`);
  }

  abstract execute(payload: TPayload): Promise<void>;

  onStart?(): void | Promise<void>;
  onSuccess?(): void | Promise<void>;
  onFailure?(error: Error): void | Promise<void>;
  onRetry?(attempt: number, error: Error): void | Promise<void>;
}
