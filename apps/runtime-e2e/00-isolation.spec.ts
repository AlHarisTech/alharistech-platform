import { test, expect } from "@playwright/test";
import { API_URL } from "./helpers/config";

test.describe("G-06: Runtime Isolation Gate", () => {
  test.describe.configure({ retries: 0 });
  test("system starts in clean state — no residual state from prior runs", async ({ request }) => {
    const healthRes = await request.get(`${API_URL}/events/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health.status).toBe("healthy");
    expect(health.redis.status).toBe("connected");
    expect(health.workers.status).toBe("running");
    expect(health.idempotency.status).toBe("available");
    expect(health.dlq.totalEntries).toBe(0);

    const metricsRes = await request.get(`${API_URL}/events/metrics`);
    expect(metricsRes.status()).toBe(200);
    const metrics = await metricsRes.json();
    expect(metrics.publishedTotal).toBe(0);
    expect(metrics.dlqRoutedTotal).toBe(0);
    expect(metrics.idempotencySkippedTotal).toBe(0);
    expect(metrics.executionFailedTotal).toBe(0);

    expect(health.workers.activeCount).toBeGreaterThan(0);
  });
});
