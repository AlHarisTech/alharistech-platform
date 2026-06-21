export interface DomainEvent<TPayload = Record<string, unknown>> {
  id: string;
  type: string;
  version: number;
  occurredAt: string;
  correlationId: string;
  causationId?: string;
  payload: TPayload;
  metadata?: Record<string, unknown>;
}

export interface EventMetadata {
  source: string;
  timestamp: string;
  contentType: string;
  schemaVersion: string;
}

export type EventVersion = number;
