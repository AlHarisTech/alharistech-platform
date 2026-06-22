import { DlqRouter } from "../../src/events/dlq/dlq-router";
import { DlqRegistry } from "../../src/events/dlq/dlq-registry";
import { DlqService } from "../../src/events/dlq/dlq-service";
import { EventMetricsService } from "../../src/events/observability/event-metrics.service";
import { EventTracerService } from "../../src/events/observability/event-tracer.service";
import { InMemoryRedis } from "../test-utils";

describe("DlqService (integration)", () => {
  let redis: InMemoryRedis;
  let router: DlqRouter;
  let registry: DlqRegistry;
  let service: DlqService;
  let metrics: EventMetricsService;
  let tracer: EventTracerService;

  // Minimal mock EventBus that just records calls
  const createMockEventBus = () => ({
    publish: jest.fn().mockResolvedValue({ id: "pub-1" }),
    publishMany: jest.fn(),
    schedule: jest.fn(),
    cancel: jest.fn(),
  });

  beforeEach(() => {
    redis = new InMemoryRedis();
    registry = new DlqRegistry();
    router = new DlqRouter(redis as any, registry);
    metrics = new EventMetricsService();
    tracer = new EventTracerService();
    service = new DlqService(router, createMockEventBus() as any, metrics, tracer);
  });

  const makeEntry = (eventId: string, queueName = "system-events") => ({
    eventId,
    eventType: "test.event",
    version: 1,
    queueName,
    payload: { key: "value" },
    jobId: `job-${eventId}`,
    failedAt: new Date().toISOString(),
    failureReason: "Test error",
    attempt: 1,
    maxAttempts: 5,
  });

  it("routes entry to DLQ and can inspect", async () => {
    await router.route(makeEntry("evt-001"));
    const entries = await service.inspect("system-events", 10);
    expect(entries).toHaveLength(1);
    expect(entries[0].eventId).toBe("evt-001");
    expect(entries[0].failureReason).toBe("Test error");
    expect(entries[0].queueName).toBe("system-events");
  });

  it("removes entry from DLQ", async () => {
    await router.route(makeEntry("evt-001"));
    const removed = await service.remove("evt-001", "system-events");
    expect(removed).toBe(true);
    const entries = await service.inspect("system-events", 10);
    expect(entries).toHaveLength(0);
  });

  it("clears entire queue", async () => {
    await router.route(makeEntry("evt-001"));
    await router.route(makeEntry("evt-002"));
    await service.clearQueue("system-events");
    const entries = await service.inspect("system-events", 10);
    expect(entries).toHaveLength(0);
  });

  it("returns summary for queue", async () => {
    await router.route(makeEntry("evt-001"));
    const summary = await service.summary("system-events");
    expect(summary.totalEntries).toBe(1);
    expect(summary.queueName).toBe("system-events");
    expect(summary.oldestEntry).toBeDefined();
    expect(summary.newestEntry).toBeDefined();
  });

  it("tracks poison events", async () => {
    for (let i = 0; i < 5; i++) {
      await router.route(makeEntry("evt-001"));
    }
    const poison = await service.poisonEvents(3);
    expect(poison.length).toBeGreaterThanOrEqual(1);
    expect(poison[0].eventId).toBe("evt-001");
    expect(poison[0].count).toBeGreaterThanOrEqual(3);
  });

  it("increments replay metric on successful replay", async () => {
    await router.route(makeEntry("evt-001"));
    const result = await service.replay("evt-001", "system-events");
    expect(result.success).toBe(true);
    expect(metrics.snapshot().replayTotal).toBe(1);
  });
});
