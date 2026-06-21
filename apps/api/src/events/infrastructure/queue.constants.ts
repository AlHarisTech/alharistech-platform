export const EVENT_QUEUES = {
  SYSTEM: 'system-events',
  AUTH: 'auth-events',
  NOTIFICATION: 'notification-events',
  AUDIT: 'audit-events',
  INTEGRATION: 'integration-events',
} as const;

export type EventQueueName = (typeof EVENT_QUEUES)[keyof typeof EVENT_QUEUES];

export const DEFAULT_EVENT_QUEUE_OPTIONS = {
  defaultJobOptions: {
    attempts: 5,
    removeOnComplete: 1000,
    removeOnFail: 5000,
    backoff: {
      type: 'exponential' as const,
      delay: 2000,
    },
  },
};

export const EVENT_RUNTIME_TOKEN = 'EVENT_RUNTIME';
export const REDIS_CLIENT_TOKEN = 'REDIS_CLIENT';
export const QUEUE_REGISTRY_TOKEN = 'QUEUE_REGISTRY';
export const QUEUE_FACTORY_TOKEN = 'QUEUE_FACTORY';

export interface EventRuntimeConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db: number;
  queuePrefix: string;
  queueAttempts: number;
  queueBackoffMs: number;
}

export function loadEventRuntimeConfig(): EventRuntimeConfig {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    username: process.env.REDIS_USERNAME || undefined,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    queuePrefix: process.env.EVENT_QUEUE_PREFIX || 'aht',
    queueAttempts: parseInt(process.env.EVENT_QUEUE_ATTEMPTS || '5', 10),
    queueBackoffMs: parseInt(process.env.EVENT_QUEUE_BACKOFF_MS || '2000', 10),
  };
}
