import type { Validated } from '@aht/types';

const CRBL_MARKER = Symbol('crbl:validated');

export function markValidated<T>(value: T): Validated<T> {
  if (typeof value !== 'object' || value === null) {
    return value as Validated<T>;
  }
  Object.defineProperty(value, CRBL_MARKER, {
    value: true,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return value as Validated<T>;
}

export function assertValidated<T>(value: unknown): asserts value is Validated<T> {
  if (typeof value !== 'object' || value === null || !(CRBL_MARKER in value)) {
    throw new Error(
      `Domain contract violation: data did not pass through CRBL validation. ` +
      `Use Validated<T> parameters only — raw data cannot enter domain layer.`,
    );
  }
}
