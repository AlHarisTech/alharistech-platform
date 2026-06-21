import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { ValidateFunction } from 'ajv';
import { SchemaRegistry } from '../../crbl/schema-registry.service';
import { buildEventRegistryKey, parseEventRegistryKey } from '../schemas/event-schemas';

interface ValidatorEntry {
  type: string;
  version: number;
  validator: ValidateFunction;
}

@Injectable()
export class EventRegistry implements OnModuleInit {
  private readonly logger = new Logger(EventRegistry.name);
  private readonly validators = new Map<string, ValidatorEntry>();
  private ready = false;

  constructor(private readonly schemaRegistry: SchemaRegistry) {}

  onModuleInit(): void {
    this.compileAllEventValidators();
  }

  private compileAllEventValidators(): void {
    const schemaEntries = this.schemaRegistry['eventSchemas'];

    if (!schemaEntries || schemaEntries.size === 0) {
      this.logger.warn('No event schemas found in SchemaRegistry — EventRegistry empty');
      this.ready = true;
      return;
    }

    let compiled = 0;
    let failed = 0;

    for (const [eventName] of schemaEntries) {
      try {
        const schema = this.schemaRegistry['eventSchemas'].get(eventName);
        if (!schema) continue;

        const majorVersion = parseInt((schema.version ?? '1').split('.')[0], 10);
        const registryKey = buildEventRegistryKey(eventName, majorVersion);

        const existingValidator = this.schemaRegistry.getEventValidator(eventName);
        if (!existingValidator) {
          failed++;
          this.logger.error(`No validator for event: ${eventName}`);
          continue;
        }

        this.validators.set(registryKey, {
          type: eventName,
          version: majorVersion,
          validator: existingValidator,
        });
        compiled++;
      } catch (error) {
        failed++;
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to compile event schema '${eventName}': ${message}`);
      }
    }

    this.ready = true;

    if (failed > 0) {
      this.logger.warn(`EventRegistry: ${compiled} validators compiled, ${failed} failed`);
    } else {
      this.logger.log(`EventRegistry: ${compiled} validators compiled successfully`);
    }
  }

  resolve(type: string, version: number): ValidateFunction | undefined {
    const key = buildEventRegistryKey(type, version);
    return this.validators.get(key)?.validator;
  }

  has(type: string, version: number): boolean {
    const key = buildEventRegistryKey(type, version);
    return this.validators.has(key);
  }

  resolveAll(): Array<{ type: string; version: number }> {
    return Array.from(this.validators.keys()).map((key) => {
      const parsed = parseEventRegistryKey(key);
      return { type: parsed?.type ?? key, version: parsed?.version ?? 0 };
    });
  }

  isReady(): boolean {
    return this.ready;
  }

  get size(): number {
    return this.validators.size;
  }
}
