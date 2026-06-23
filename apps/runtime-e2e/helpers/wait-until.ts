import { expect } from "@playwright/test";
import { TIMEOUTS } from "./config";

export async function waitForCondition(
  condition: () => Promise<boolean>,
  timeout = TIMEOUTS.POLL_INTERVAL * 60,
  interval = TIMEOUTS.POLL_INTERVAL,
): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await condition()) return;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(`Condition not met within ${timeout}ms`);
}

export async function expectToPass(fn: () => Promise<void>, timeout = 10_000): Promise<void> {
  await expect(async () => await fn()).toPass({ timeout });
}
