import { EventMetricsService } from "../../src/events/observability/event-metrics.service";

describe("EventMetricsService", () => {
  let service: EventMetricsService;

  beforeEach(() => {
    service = new EventMetricsService();
  });

  it("initializes with zero counters", () => {
    const snap = service.snapshot();
    expect(snap.publishedTotal).toBe(0);
    expect(snap.executionCompletedTotal).toBe(0);
    expect(snap.executionFailedTotal).toBe(0);
    expect(snap.dlqRoutedTotal).toBe(0);
    expect(snap.idempotencySkippedTotal).toBe(0);
    expect(snap.retryAttemptsTotal).toBe(0);
    expect(snap.replayTotal).toBe(0);
  });

  it("increments publishedTotal and tracks by type", () => {
    service.incrementPublished("identity.user.registered");
    service.incrementPublished("identity.user.registered");
    service.incrementPublished("auth.login");
    const snap = service.snapshot();
    expect(snap.publishedTotal).toBe(3);
    expect(snap.publishedByType["identity.user.registered"]).toBe(2);
    expect(snap.publishedByType["auth.login"]).toBe(1);
  });

  it("increments execution counters", () => {
    service.incrementExecutionStarted();
    service.incrementExecutionCompleted();
    service.incrementExecutionFailed();
    service.incrementDlqRouted();
    service.incrementIdempotencySkipped();
    service.incrementRetryAttempt();
    service.incrementReplay();
    const snap = service.snapshot();
    expect(snap.executionStartedTotal).toBe(1);
    expect(snap.executionCompletedTotal).toBe(1);
    expect(snap.executionFailedTotal).toBe(1);
    expect(snap.dlqRoutedTotal).toBe(1);
    expect(snap.idempotencySkippedTotal).toBe(1);
    expect(snap.retryAttemptsTotal).toBe(1);
    expect(snap.replayTotal).toBe(1);
  });

  it("reset clears all counters", () => {
    service.incrementPublished("test.event");
    service.incrementExecutionStarted();
    service.incrementExecutionCompleted();
    service.reset();
    const snap = service.snapshot();
    expect(snap.publishedTotal).toBe(0);
    expect(snap.executionStartedTotal).toBe(0);
    expect(snap.executionCompletedTotal).toBe(0);
    expect(snap.publishedByType).toEqual({});
  });
});
