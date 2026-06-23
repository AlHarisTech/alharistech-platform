import { test, expect } from "@playwright/test";

test.describe("Health & Status", () => {
  test("E2E-02: Health indicator shows LIVE", async ({ page }) => {
    await page.goto("/");
    const dot = page.locator("#liveDot");
    await expect(dot).toBeVisible();
    const label = page.locator("#liveLabel");
    await expect(label).toHaveText("LIVE");
  });

  test("E2E-07: Events health endpoint returns healthy", async ({ request }) => {
    const res = await request.get("http://127.0.0.1:4000/events/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("healthy");
  });
});
