import { test, expect } from "@playwright/test";

test.describe("Layout & Navigation", () => {
  test("E2E-09: Unknown routes serve index.html (SPA fallback)", async ({ page }) => {
    const res = await page.goto("/does-not-exist", { waitUntil: "commit" });
    expect(res?.status()).toBe(200);
    await expect(page.locator("h1")).toContainText("Dashboard");
  });

  test("E2E-10: Responsive layout at mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
    const bodyWidth = await page.locator("body").evaluate((el) => el.scrollWidth);
    const viewport = page.viewportSize();
    expect(bodyWidth).toBeLessThanOrEqual(viewport!.width + 1);
  });
});
