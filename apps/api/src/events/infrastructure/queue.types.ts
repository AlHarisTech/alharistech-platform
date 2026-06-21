export type EventRuntimeStatus = 'healthy' | 'degraded' | 'unavailable';

export interface EventRuntimeHealth {
  status: EventRuntimeStatus;
  redis: 'connected' | 'disconnected' | 'error';
  queues: number;
  uptime: number;
}
