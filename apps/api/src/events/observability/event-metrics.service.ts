import { Injectable } from '@nestjs/common';

export interface MetricsSnapshot {
  publishedTotal: number;
  publishedByType: Record<string, number>;
  executionStartedTotal: number;
  executionCompletedTotal: number;
  executionFailedTotal: number;
  dlqRoutedTotal: number;
  idempotencySkippedTotal: number;
  retryAttemptsTotal: number;
  replayTotal: number;
}

@Injectable()
export class EventMetricsService {
  private publishedTotal = 0;
  private publishedByType = new Map<string, number>();
  private executionStartedTotal = 0;
  private executionCompletedTotal = 0;
  private executionFailedTotal = 0;
  private dlqRoutedTotal = 0;
  private idempotencySkippedTotal = 0;
  private retryAttemptsTotal = 0;
  private replayTotal = 0;

  incrementPublished(eventType: string): void {
    this.publishedTotal++;
    this.publishedByType.set(eventType, (this.publishedByType.get(eventType) ?? 0) + 1);
  }

  incrementExecutionStarted(): void {
    this.executionStartedTotal++;
  }

  incrementExecutionCompleted(): void {
    this.executionCompletedTotal++;
  }

  incrementExecutionFailed(): void {
    this.executionFailedTotal++;
  }

  incrementDlqRouted(): void {
    this.dlqRoutedTotal++;
  }

  incrementIdempotencySkipped(): void {
    this.idempotencySkippedTotal++;
  }

  incrementRetryAttempt(): void {
    this.retryAttemptsTotal++;
  }

  incrementReplay(): void {
    this.replayTotal++;
  }

  snapshot(): MetricsSnapshot {
    const byType: Record<string, number> = {};
    for (const [k, v] of this.publishedByType) {
      byType[k] = v;
    }

    return {
      publishedTotal: this.publishedTotal,
      publishedByType: byType,
      executionStartedTotal: this.executionStartedTotal,
      executionCompletedTotal: this.executionCompletedTotal,
      executionFailedTotal: this.executionFailedTotal,
      dlqRoutedTotal: this.dlqRoutedTotal,
      idempotencySkippedTotal: this.idempotencySkippedTotal,
      retryAttemptsTotal: this.retryAttemptsTotal,
      replayTotal: this.replayTotal,
    };
  }

  reset(): void {
    this.publishedTotal = 0;
    this.publishedByType.clear();
    this.executionStartedTotal = 0;
    this.executionCompletedTotal = 0;
    this.executionFailedTotal = 0;
    this.dlqRoutedTotal = 0;
    this.idempotencySkippedTotal = 0;
    this.retryAttemptsTotal = 0;
    this.replayTotal = 0;
  }
}
