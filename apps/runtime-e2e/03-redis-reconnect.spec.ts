import { test, expect } from "@playwright/test";
import { API_URL, IS_CI, TIMEOUTS } from "./helpers/config";
import { waitForCondition } from "./helpers/wait-until";
import { stopRedis, startRedis, waitUntilRedisHealthy } from "./helpers/redis-control";

test.afterEach(async ({ request }) => {
  const res = await request.get(`${API_URL}/events/health`);
  expect(res.status()).toBe(200);
  const health = await res.json();
  expect(health.status).toBe("healthy");
  expect(health.redis.status).toBe("connected");
  expect(health.workers.status).toBe("running");
  expect(health.idempotency.status).toBe("available");
});

test.describe("RTE-03: Redis Reconnect (OI-023)", () => {
  test("health degrades when Redis stops and recovers when restarted", async ({ request }) => {
    test.skip(IS_CI, "Skipping destructive test in CI — run manually via workflow_dispatch");

    const healthRes = await request.get(`${API_URL}/health`);
    expect(healthRes.status()).toBe(200);
    const preHealth = await healthRes.json();
    expect(preHealth.eventRuntime.redis).toBe("connected");
    expect(preHealth.eventRuntime.status).toBe("healthy");

    stopRedis();

    await waitForCondition(async () => {
      const res = await request.get(`${API_URL}/health`);
      if (res.status() !== 200) return false;
      const body = await res.json();
      return body.eventRuntime?.redis === "disconnected" || body.eventRuntime?.status !== "healthy";
    }, TIMEOUTS.REDIS_RECOVER);

    startRedis();
    await waitUntilRedisHealthy(request, TIMEOUTS.REDIS_RECOVER);
  });
});
