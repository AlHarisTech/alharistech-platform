import { test, expect } from "@playwright/test";
import { API_URL, EVENTS, makeEventPayload } from "./helpers/config";

test.afterEach(async ({ request }) => {
  const res = await request.get(`${API_URL}/events/health`);
  expect(res.status()).toBe(200);
  const health = await res.json();
  expect(health.status).toBe("healthy");
  expect(health.redis.status).toBe("connected");
  expect(health.workers.status).toBe("running");
  expect(health.idempotency.status).toBe("available");
});

test.describe("RTE-01: Publish → Trace (OI-021)", () => {
  test("published event appears in trace buffer and metrics", async ({ request }) => {
    await request.post(`${API_URL}/events/metrics/reset`);
    await request.post(`${API_URL}/events/trace/clear`);

    const payload = makeEventPayload();
    const publishRes = await request.post(`${API_URL}/events/test/publish`, {
      data: {
        type: EVENTS.SIMPLE.type,
        version: EVENTS.SIMPLE.version,
        payload,
      },
    });
    expect(publishRes.status()).toBe(201);
    const receipt = await publishRes.json();
    expect(receipt.eventId).toBeTruthy();
    expect(receipt.type).toBe(EVENTS.SIMPLE.type);

    const traceRes = await request.get(`${API_URL}/events/trace`);
    expect(traceRes.status()).toBe(200);
    const trace = await traceRes.json();
    const publishEntry = trace.entries?.find(
      (e: { eventId: string; action: string }) =>
        e.eventId === receipt.eventId && e.action === "publish",
    );
    expect(publishEntry).toBeTruthy();

    const metricsRes = await request.get(`${API_URL}/events/metrics`);
    expect(metricsRes.status()).toBe(200);
    const metrics = await metricsRes.json();
    expect(metrics.publishedTotal).toBeGreaterThanOrEqual(1);
    expect(metrics.publishedByType?.[EVENTS.SIMPLE.type]).toBeGreaterThanOrEqual(1);
  });
});
