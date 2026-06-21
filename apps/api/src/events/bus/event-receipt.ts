export interface EventReceipt {
  eventId: string;
  type: string;
  version: number;
  queue: string;
  jobId: string;
  publishedAt: string;
  scheduled: boolean;
  scheduledFor?: string;
}
