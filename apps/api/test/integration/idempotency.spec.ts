import { ExecutionStore } from "../../src/events/idempotency/execution-store";
import { ExecutionLock } from "../../src/events/idempotency/execution-lock";
import { IdempotencyService } from "../../src/events/idempotency/idempotency-service";
import { InMemoryRedis } from "../test-utils";

describe("IdempotencyService (integration)", () => {
  let redis: InMemoryRedis;
  let store: ExecutionStore;
  let lock: ExecutionLock;
  let service: IdempotencyService;

  beforeEach(() => {
    redis = new InMemoryRedis();
    store = new ExecutionStore(redis as any);
    lock = new ExecutionLock(redis as any);
    service = new IdempotencyService(store, lock);
  });

  it("checkAndLock returns true for first execution", async () => {
    const result = await service.checkAndLock("test.event", "evt-001");
    expect(result).toBe(true);
  });

  it("checkAndLock returns false for duplicate execution", async () => {
    await service.checkAndLock("test.event", "evt-001");
    const result = await service.checkAndLock("test.event", "evt-001");
    expect(result).toBe(false);
  });

  it("markCompleted records successful execution", async () => {
    await service.checkAndLock("test.event", "evt-001");
    await service.markCompleted("test.event", "evt-001", 1, 1);
    const exists = await redis.get("exec:test.event:evt-001");
    expect(exists).not.toBeNull();
    const record = JSON.parse(exists!);
    expect(record.status).toBe("completed");
    expect(record.eventType).toBe("test.event");
    expect(record.eventId).toBe("evt-001");
    expect(record.version).toBe(1);
    expect(record.attempts).toBe(1);
  });

  it("markFailed records failed execution", async () => {
    await service.checkAndLock("test.event", "evt-001");
    await service.markFailed("test.event", "evt-001", 1, 3, "Test error");
    const record = JSON.parse((await redis.get("exec:test.event:evt-001"))!);
    expect(record.status).toBe("failed");
    expect(record.error).toBe("Test error");
    expect(record.attempts).toBe(3);
  });

  it("completed execution blocks subsequent checkAndLock", async () => {
    const r1 = await service.checkAndLock("test.event", "evt-001");
    expect(r1).toBe(true);
    await service.markCompleted("test.event", "evt-001", 1, 1);
    const r2 = await service.checkAndLock("test.event", "evt-001");
    expect(r2).toBe(false);
  });

  it("releases lock after markCompleted", async () => {
    await service.checkAndLock("test.event", "evt-001");
    await service.markCompleted("test.event", "evt-001", 1, 1);
    const lockExists = await redis.exists("exec:test.event:evt-001:lock");
    expect(lockExists).toBe(0);
  });

  it("releases lock after markFailed", async () => {
    await service.checkAndLock("test.event", "evt-001");
    await service.markFailed("test.event", "evt-001", 1, 1, "error");
    const lockExists = await redis.exists("exec:test.event:evt-001:lock");
    expect(lockExists).toBe(0);
  });

  it("allows different event IDs independently", async () => {
    const r1 = await service.checkAndLock("test.event", "evt-001");
    const r2 = await service.checkAndLock("test.event", "evt-002");
    expect(r1).toBe(true);
    expect(r2).toBe(true);
    await service.markCompleted("test.event", "evt-001", 1, 1);
    const r3 = await service.checkAndLock("test.event", "evt-002");
    expect(r3).toBe(false);
  });
});
