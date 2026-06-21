export interface DlqReceipt {
  eventId: string;
  eventType: string;
  queueName: string;
  storedAt: string;
  poisonCount: number;
}
