import { test, expect } from "@playwright/test";
import { API_URL, EVENTS, makeEventPayload, TIMEOUTS } from "./helpers/config";
import { waitForCondition } from "./helpers/wait-until";

test.describe("RTE-04: Idempotency (OI-024)", () => {
  test("duplicate event ID is skipped by idempotency mechanism", async ({ request }) => {
    await request.post(`${API_URL}/events/metrics/reset`);

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
      return metrics.idempotencySkippedTotal > 0;
    }, TIMEOUTS.IDEMPOTENCY_WAIT);

    const metricsRes = await request.get(`${API_URL}/events/metrics`);
    const metrics = await metricsRes.json();
    expect(metrics.idempotencySkippedTotal).toBeGreaterThan(0);
    expect(metrics.executionFailedTotal).toBeGreaterThanOrEqual(1);

    const healthRes = await request.get(`${API_URL}/events/health`);
    const health = await healthRes.json();
    expect(health.idempotency.status).toBe("available");
  });
});
