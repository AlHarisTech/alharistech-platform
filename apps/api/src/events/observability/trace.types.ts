export enum TraceAction {
  PUBLISH = 'publish',
  EXECUTION_STARTED = 'execution_started',
  EXECUTION_COMPLETED = 'execution_completed',
  EXECUTION_FAILED = 'execution_failed',
  RETRY = 'retry',
  DLQ_ROUTED = 'dlq_routed',
  REPLAY = 'replay',
  IDEMPOTENCY_SKIP = 'idempotency_skip',
  SCHEDULE = 'schedule',
}

export interface TraceEntry {
  eventId: string;
  eventType: string;
  action: TraceAction;
  timestamp: string;
  durationMs?: number;
  error?: string;
}

export interface TraceSnapshot {
  entries: TraceEntry[];
}
