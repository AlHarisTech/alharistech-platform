import { EventTracerService } from "../../src/events/observability/event-tracer.service";
import { TraceAction } from "../../src/events/observability/trace.types";

describe("EventTracerService", () => {
  let service: EventTracerService;

  beforeEach(() => {
    service = new EventTracerService();
  });

  it("initializes with empty trace buffer", () => {
    const snap = service.snapshot();
    expect(snap.entries).toHaveLength(0);
  });

  it("records publish trace entry", () => {
    service.tracePublish("evt-001", "identity.user.registered");
    const snap = service.snapshot();
    expect(snap.entries).toHaveLength(1);
    expect(snap.entries[0].action).toBe(TraceAction.PUBLISH);
    expect(snap.entries[0].eventId).toBe("evt-001");
    expect(snap.entries[0].eventType).toBe("identity.user.registered");
  });

  it("records all trace actions", () => {
    const actions: [string, string, TraceAction][] = [
      ["e1", "t1", TraceAction.PUBLISH],
      ["e2", "t1", TraceAction.EXECUTION_STARTED],
      ["e3", "t1", TraceAction.EXECUTION_COMPLETED],
      ["e4", "t1", TraceAction.EXECUTION_FAILED],
      ["e5", "t1", TraceAction.RETRY],
      ["e6", "t1", TraceAction.DLQ_ROUTED],
      ["e7", "t1", TraceAction.REPLAY],
      ["e8", "t1", TraceAction.IDEMPOTENCY_SKIP],
      ["e9", "t1", TraceAction.SCHEDULE],
    ];
    for (const [id, type, action] of actions) {
      service.trace(id, type, action);
    }
    const snap = service.snapshot();
    expect(snap.entries).toHaveLength(9);
  });

  it("records execution completed with duration", () => {
    service.traceExecutionCompleted("evt-001", "test.event", 42);
    const snap = service.snapshot();
    expect(snap.entries[0].durationMs).toBe(42);
  });

  it("records execution failed with error", () => {
    service.traceExecutionFailed("evt-001", "test.event", "Something went wrong");
    const snap = service.snapshot();
    expect(snap.entries[0].error).toBe("Something went wrong");
  });

  it("clear empties buffer", () => {
    service.tracePublish("evt-001", "test.event");
    service.clear();
    expect(service.snapshot().entries).toHaveLength(0);
  });
});
