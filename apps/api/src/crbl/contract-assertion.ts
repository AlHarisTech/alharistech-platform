import type { Validated } from '@aht/types';

const CRBL_ASSERTION_KEY = Symbol('crbl:validated');

export function markValidated<T>(value: T): Validated<T> {
  (value as Record<symbol, true>)[CRBL_ASSERTION_KEY] = true;
  return value as Validated<T>;
}

export function isValidated<T>(value: unknown): value is Validated<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    CRBL_ASSERTION_KEY in (value as Record<symbol, unknown>)
  );
}
