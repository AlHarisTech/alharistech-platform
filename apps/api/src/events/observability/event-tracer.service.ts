import { Injectable } from '@nestjs/common';
import type { TraceEntry, TraceSnapshot } from './trace.types';
import { TraceAction } from './trace.types';

const DEFAULT_CAPACITY = 1000;

@Injectable()
export class EventTracerService {
  private readonly buffer: TraceEntry[] = [];
  private readonly capacity: number;

  constructor(capacity = DEFAULT_CAPACITY) {
    this.capacity = capacity;
  }

  trace(
    eventId: string,
    eventType: string,
    action: TraceAction,
    extra?: { durationMs?: number; error?: string },
  ): void {
    const entry: TraceEntry = {
      eventId,
      eventType,
      action,
      timestamp: new Date().toISOString(),
      ...extra,
    };

    if (this.buffer.length >= this.capacity) {
      this.buffer.shift();
    }

    this.buffer.push(entry);
  }

  tracePublish(eventId: string, eventType: string): void {
    this.trace(eventId, eventType, TraceAction.PUBLISH);
  }

  traceExecutionStarted(eventId: string, eventType: string): void {
    this.trace(eventId, eventType, TraceAction.EXECUTION_STARTED);
  }

  traceExecutionCompleted(eventId: string, eventType: string, durationMs?: number): void {
    this.trace(eventId, eventType, TraceAction.EXECUTION_COMPLETED, { durationMs });
  }

  traceExecutionFailed(eventId: string, eventType: string, error: string): void {
    this.trace(eventId, eventType, TraceAction.EXECUTION_FAILED, { error });
  }

  traceRetry(eventId: string, eventType: string): void {
    this.trace(eventId, eventType, TraceAction.RETRY);
  }

  traceDlqRouted(eventId: string, eventType: string): void {
    this.trace(eventId, eventType, TraceAction.DLQ_ROUTED);
  }

  traceReplay(eventId: string, eventType: string): void {
    this.trace(eventId, eventType, TraceAction.REPLAY);
  }

  traceIdempotencySkip(eventId: string, eventType: string): void {
    this.trace(eventId, eventType, TraceAction.IDEMPOTENCY_SKIP);
  }

  snapshot(): TraceSnapshot {
    return { entries: [...this.buffer] };
  }

  clear(): void {
    this.buffer.length = 0;
  }
}
