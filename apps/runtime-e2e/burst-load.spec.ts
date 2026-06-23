import { test, expect } from "@playwright/test";
import { API_URL, EVENTS, makeEventPayload, TIMEOUTS } from "./helpers/config";
import { waitForCondition } from "./helpers/wait-until";

test.describe("RTE-05: Burst Load (OI-025)", () => {
  test("dashboard remains responsive after 100 rapid publishes", async ({ request }) => {
    await request.post(`${API_URL}/events/metrics/reset`);

    const BURST_COUNT = 100;
    const publishPromises = Array.from({ length: BURST_COUNT }, () =>
      request.post(`${API_URL}/events/test/publish`, {
        data: {
          type: EVENTS.SIMPLE.type,
          version: EVENTS.SIMPLE.version,
          payload: makeEventPayload(),
        },
      }),
    );

    const start = Date.now();
    const results = await Promise.all(publishPromises);
    const elapsed = Date.now() - start;

    const successCount = results.filter((r) => r.status() === 201).length;
    expect(successCount).toBe(BURST_COUNT);

    await waitForCondition(async () => {
      const metricsRes = await request.get(`${API_URL}/events/metrics`);
      if (metricsRes.status() !== 200) return false;
      const metrics = await metricsRes.json();
      return metrics.publishedTotal >= BURST_COUNT;
    }, TIMEOUTS.BURST_WAIT);

    const metricsRes = await request.get(`${API_URL}/events/metrics`);
    const metrics = await metricsRes.json();
    expect(metrics.publishedTotal).toBeGreaterThanOrEqual(BURST_COUNT);

    const dashStart = Date.now();
    const dashRes = await request.get(`${API_URL}/events/dashboard`);
    const dashElapsed = Date.now() - dashStart;
    expect(dashRes.status()).toBe(200);
    expect(dashElapsed).toBeLessThan(5000);

    const dash = await dashRes.json();
    expect(dash.metrics).toBeTruthy();
    expect(dash.trace).toBeTruthy();
    expect(dash.health).toBeTruthy();
  });
});
