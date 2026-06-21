import { Injectable, Logger } from '@nestjs/common';
import type { DomainEvent } from '../contracts/domain-event';
import { EventRegistry } from './event-registry';
import { InvalidEventException } from '../exceptions/invalid-event.exception';
import { EventSchemaException } from '../exceptions/event-schema.exception';

export interface ValidatedEvent {
  id: string;
  type: string;
  version: number;
  validatedAt: string;
}

@Injectable()
export class EventValidator {
  private readonly logger = new Logger(EventValidator.name);

  constructor(private readonly registry: EventRegistry) {}

  validate<T>(event: DomainEvent<T>): ValidatedEvent {
    if (!event.type) {
      throw new InvalidEventException('unknown', 'Event type is required');
    }

    if (!event.id) {
      throw new InvalidEventException(event.type, 'Event id is required (EI-001)');
    }

    if (event.version === undefined || event.version === null) {
      throw new InvalidEventException(event.type, 'Event version is required (EI-002)');
    }

    if (!event.correlationId) {
      throw new InvalidEventException(event.type, 'Event correlationId is required (EI-003)');
    }

    if (!this.registry.isReady()) {
      throw new EventSchemaException(event.type, event.version, 'EventRegistry not ready (fail-closed)');
    }

    const validator = this.registry.resolve(event.type, event.version);
    if (!validator) {
      throw new EventSchemaException(
        event.type,
        event.version,
        `No registered validator for '${event.type}:v${event.version}' (EI-004)`,
      );
    }

    const payload = event.payload ?? ({} as T);
    const valid = validator(payload);

    if (!valid) {
      const errors = (validator.errors || []).map((e) => ({
        field: e.instancePath || e.params?.missingProperty || 'payload',
        message: e.message || 'validation failed',
      }));

      throw new InvalidEventException(event.type, 'Event payload failed schema validation', errors);
    }

    this.logger.debug(`Event validated: ${event.type}:v${event.version} (${event.id})`);

    return {
      id: event.id,
      type: event.type,
      version: event.version,
      validatedAt: new Date().toISOString(),
    };
  }
}
