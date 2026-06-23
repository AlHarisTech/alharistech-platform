import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("E2E-01: Dashboard loads with correct title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Dashboard/i);
  });

  test("E2E-06: Dashboard API returns 200", async ({ request }) => {
    const res = await request.get("http://127.0.0.1:4000/events/dashboard");
    expect(res.status()).toBe(200);
  });
});
