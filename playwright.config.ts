import { defineConfig } from "@playwright/test";

export default defineConfig({
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,

  use: {
    baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: process.env.CI ? "retain-on-failure" : "off",
  },

  reporter: [
    ["html", { outputFolder: "e2e-report" }],
    ["github"],
    ["list"],
  ],

  projects: [
    {
      name: "chromium",
      testDir: "./apps/dashboard/e2e",
      timeout: 30_000,
      use: { browserName: "chromium" },
    },
    {
      name: "runtime-e2e",
      testDir: "./apps/runtime-e2e",
      timeout: 120_000,
      fullyParallel: false,
      workers: 1,
      use: { browserName: "chromium" },
    },
  ],

  webServer: [
    {
      command: "pnpm --filter @aht/api start",
      port: 4000,
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: "pnpm --filter @aht/dashboard dev",
      port: 5173,
      reuseExistingServer: true,
      timeout: 15_000,
    },
  ],
});
