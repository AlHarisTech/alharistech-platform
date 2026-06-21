export interface QueueHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unavailable';
  waiting?: number;
  active?: number;
  failed?: number;
  delayed?: number;
}

export interface RedisHealth {
  status: 'connected' | 'disconnected' | 'unavailable';
  latencyMs?: number;
}

export interface DlqHealth {
  totalEntries: number;
  queueNames: string[];
}

export interface IdempotencyHealth {
  status: 'available' | 'unavailable' | 'degraded';
  reason?: string;
}

export interface WorkerHealth {
  status: 'running' | 'stopped' | 'degraded';
  activeCount: number;
  registeredHandlers: number;
}

export interface EventRuntimeHealth {
  status: 'healthy' | 'degraded' | 'unavailable';
  redis: RedisHealth;
  queues: QueueHealth[];
  workers: WorkerHealth;
  dlq: DlqHealth;
  idempotency: IdempotencyHealth;
  uptimeMs: number;
  startedAt: string;
}
