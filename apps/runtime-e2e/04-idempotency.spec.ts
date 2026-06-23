import { test, expect } from "@playwright/test";
import { API_URL, EVENTS, makeEventPayload, TIMEOUTS } from "./helpers/config";
import { waitForCondition } from "./helpers/wait-until";

test.afterEach(async ({ request }) => {
  const res = await request.get(`${API_URL}/events/health`);
  expect(res.status()).toBe(200);
  const health = await res.json();
  expect(health.status).toBe("healthy");
  expect(health.redis.status).toBe("connected");
  expect(health.workers.status).toBe("running");
  expect(health.idempotency.status).toBe("available");
});

test.describe("RTE-04: Idempotency / OI-027", () => {
  test("duplicate event ID produces exactly one side effect", async ({ request }) => {
    await request.post(`${API_URL}/events/metrics/reset`);
    await request.post(`${API_URL}/events/trace/clear`);

    const eventId = crypto.randomUUID();
    const payload = makeEventPayload();

    const res1 = await request.post(`${API_URL}/events/test/publish`, {
      data: {
        id: eventId,
        type: EVENTS.SIMPLE.type,
        version: EVENTS.SIMPLE.version,
        payload,
      },
    });
    expect(res1.status()).toBe(201);

    const res2 = await request.post(`${API_URL}/events/test/publish`, {
      data: {
        id: eventId,
        type: EVENTS.SIMPLE.type,
        version: EVENTS.SIMPLE.version,
        payload,
      },
    });
    expect(res2.status()).toBe(201);

    await waitForCondition(async () => {
      const metricsRes = await request.get(`${API_URL}/events/metrics`);
      if (metricsRes.status() !== 200) return false;
      const metrics = await metricsRes.json();
      return metrics.idempotencySkippedTotal === 1;
    }, TIMEOUTS.IDEMPOTENCY_WAIT);

    const metricsRes = await request.get(`${API_URL}/events/metrics`);
    const metrics = await metricsRes.json();
    expect(metrics.publishedTotal).toBe(2);
    expect(metrics.publishedByType?.[EVENTS.SIMPLE.type]).toBe(2);
    expect(metrics.idempotencySkippedTotal).toBe(1);
    expect(metrics.executionFailedTotal).toBe(1);

    const traceRes = await request.get(`${API_URL}/events/trace`);
    const trace = await traceRes.json();
    const idempotencySkips = trace.entries?.filter(
      (e: { eventId: string; action: string }) =>
        e.eventId === eventId && e.action === "idempotency_skip",
    );
    expect(idempotencySkips).toHaveLength(1);

    const healthRes = await request.get(`${API_URL}/events/health`);
    const health = await healthRes.json();
    expect(health.idempotency.status).toBe("available");
  });
});
