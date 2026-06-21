import type { Validated } from '@aht/types';

const contractRegistry = new WeakMap<object, true>();

export function markValidated<T>(value: T): Validated<T> {
  if (typeof value !== 'object' || value === null) {
    return value as Validated<T>;
  }
  contractRegistry.set(value, true);
  deepFreeze(value);
  return value as Validated<T>;
}

export function assertValidated<T>(value: unknown): asserts value is Validated<T> {
  if (typeof value !== 'object' || value === null || !contractRegistry.has(value)) {
    throw new Error(
      `Domain contract violation: data did not pass through CRBL validation. ` +
      `Use Validated<T> parameters only — raw data cannot enter domain layer.`,
    );
  }
}

function deepFreeze<T extends object>(obj: T, frozen = new WeakSet<object>()): void {
  if (frozen.has(obj)) return;
  frozen.add(obj);

  const propNames = Object.getOwnPropertyNames(obj);
  for (const name of propNames) {
    const value = (obj as Record<string, unknown>)[name];
    if (value && typeof value === 'object') {
      deepFreeze(value as Record<string, unknown>, frozen);
    }
  }

  Object.freeze(obj);
}
