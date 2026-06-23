import { test, expect } from "@playwright/test";

test.describe("Observability Pages", () => {
  test("E2E-03: Health cards render", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#healthCards")).toBeVisible();
    await expect(page.locator("#healthCards .card").first()).toBeVisible();
  });

  test("E2E-04: Metric cards render", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#metricCards")).toBeVisible();
    await expect(page.locator("#metricCards .card").first()).toBeVisible();
  });

  test("E2E-05: Trace list renders", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#traceList")).toBeVisible();
  });

  test("E2E-08: Dashboard composite endpoint returns JSON", async ({ request }) => {
    const res = await request.get("http://127.0.0.1:4000/events/dashboard");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("metrics");
    expect(body).toHaveProperty("trace");
    expect(body).toHaveProperty("health");
  });
});
