export type ExecutionStatus = 'completed' | 'failed' | 'processing';

export interface ExecutionRecord {
  eventId: string;
  eventType: string;
  version: number;
  status: ExecutionStatus;
  executedAt: string;
  completedAt?: string;
  error?: string;
  attempts: number;
}
