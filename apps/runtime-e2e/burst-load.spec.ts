import { test, expect } from "@playwright/test";
import { API_URL, EVENTS, makeEventPayload, BURST_SIZE, TIMEOUTS } from "./helpers/config";
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

test.describe("RTE-05: Burst Load (OI-025)", () => {
  test(`dashboard remains responsive after ${BURST_SIZE} rapid publishes`, async ({ request }) => {
    await request.post(`${API_URL}/events/metrics/reset`);

    const publishPromises = Array.from({ length: BURST_SIZE }, () =>
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
    expect(successCount).toBe(BURST_SIZE);

    await waitForCondition(async () => {
      const metricsRes = await request.get(`${API_URL}/events/metrics`);
      if (metricsRes.status() !== 200) return false;
      const metrics = await metricsRes.json();
      return metrics.publishedTotal >= BURST_SIZE;
    }, TIMEOUTS.BURST_WAIT);

    const metricsRes = await request.get(`${API_URL}/events/metrics`);
    const metrics = await metricsRes.json();
    expect(metrics.publishedTotal).toBeGreaterThanOrEqual(BURST_SIZE);

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
