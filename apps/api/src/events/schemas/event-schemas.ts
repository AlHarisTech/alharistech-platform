import type { ValidateFunction } from 'ajv';

export const EVENT_SCHEMA_VERSION = 1;

export const EVENT_TYPE_PREFIX = {
  IDENTITY: 'identity',
  CUSTOMER: 'customer',
  SERVICE: 'service',
  COMMERCE: 'commerce',
  INVENTORY: 'inventory',
  FINANCE: 'finance',
  HR: 'hr',
  CRM: 'crm',
  NOTIFICATION: 'notification',
  AUDIT: 'audit',
  INTEGRATION: 'integration',
} as const;

export const EVENT_TYPES = {
  identity_user_registered: 'identity.user.registered',
  identity_user_verified: 'identity.user.verified',
  identity_user_logged_in: 'identity.user.logged_in',
  identity_user_logged_out: 'identity.user.logged_out',
  identity_auth_password_changed: 'identity.auth.password_changed',
  identity_user_role_changed: 'identity.user.role_changed',
  identity_user_account_locked: 'identity.user.account_locked',
  identity_user_account_disabled: 'identity.user.account_disabled',
} as const;

export type EventTypeKey = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

export function buildEventRegistryKey(type: string, version: number): string {
  return `${type}:v${version}`;
}

export function parseEventRegistryKey(key: string): { type: string; version: number } | null {
  const match = key.match(/^(.+):v(\d+)$/);
  if (!match) return null;
  return { type: match[1], version: parseInt(match[2], 10) };
}

export interface EventSchemaDefinition {
  type: string;
  version: number;
  schema: Record<string, unknown>;
  validator?: ValidateFunction;
}
