export interface DlqEntry {
  eventId: string;
  eventType: string;
  version: number;
  queueName: string;
  payload: Record<string, unknown>;
  jobId: string;
  failedAt: string;
  failureReason: string;
  attempt: number;
  maxAttempts: number;
  poisonCount: number;
}

export interface DlqSummary {
  queueName: string;
  totalEntries: number;
  oldestEntry?: string;
  newestEntry?: string;
}
