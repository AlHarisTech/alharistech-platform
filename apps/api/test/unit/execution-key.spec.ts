import { buildExecutionKey, parseExecutionKey } from "../../src/events/idempotency/execution-key";

describe("ExecutionKey", () => {
  it("builds execution key with exec: prefix", () => {
    const key = buildExecutionKey("identity.user.registered", "evt-001");
    expect(key).toBe("exec:identity.user.registered:evt-001");
  });

  it("parses execution key correctly", () => {
    const result = parseExecutionKey("exec:identity.user.registered:evt-001");
    expect(result).toEqual({
      eventType: "identity.user.registered",
      eventId: "evt-001",
    });
  });

  it("returns null for malformed key", () => {
    expect(parseExecutionKey("invalid")).toBeNull();
    expect(parseExecutionKey("exec:only-two-parts")).toBeNull();
    expect(parseExecutionKey("")).toBeNull();
  });

  it("handles event IDs with hyphens and dots", () => {
    const key = buildExecutionKey("order.created", "ord-123.456");
    expect(key.startsWith("exec:")).toBe(true);
    const parsed = parseExecutionKey(key);
    expect(parsed?.eventId).toBe("ord-123.456");
    expect(parsed?.eventType).toBe("order.created");
  });
});
