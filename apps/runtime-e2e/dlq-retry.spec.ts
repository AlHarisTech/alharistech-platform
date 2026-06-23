import { test, expect } from "@playwright/test";
import { API_URL, EVENTS, makeEventPayload, TIMEOUTS } from "./helpers/config";
import { waitForCondition } from "./helpers/wait-until";

test.describe("RTE-02: DLQ Retry (OI-022)", () => {
  test("unhandled event is routed to DLQ after max retries", async ({ request }) => {
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

    await waitForCondition(async () => {
      const healthRes = await request.get(`${API_URL}/events/health`);
      if (healthRes.status() !== 200) return false;
      const health = await healthRes.json();
      return (health.dlq?.totalEntries ?? 0) > 0;
    }, TIMEOUTS.DLQ_WAIT);

    const healthRes = await request.get(`${API_URL}/events/health`);
    const health = await healthRes.json();
    expect(health.dlq.totalEntries).toBeGreaterThan(0);
    expect(health.dlq.queueNames.length).toBeGreaterThan(0);

    const metricsRes = await request.get(`${API_URL}/events/metrics`);
    const metrics = await metricsRes.json();
    expect(metrics.dlqRoutedTotal).toBeGreaterThan(0);

    const traceRes = await request.get(`${API_URL}/events/trace`);
    const trace = await traceRes.json();
    const dlqEntry = trace.entries?.find(
      (e: { eventId: string; action: string }) =>
        e.eventId === receipt.eventId && e.action === "dlq_routed",
    );
    expect(dlqEntry).toBeTruthy();
  });
});
