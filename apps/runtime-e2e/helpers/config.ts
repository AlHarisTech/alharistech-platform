export const API_URL = process.env.API_URL || "http://127.0.0.1:4000";
export const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://127.0.0.1:5173";
export const IS_CI = !!process.env.CI;

export const EVENTS = {
  SIMPLE: { type: "identity.user.verified", version: 1 },
};

export function makeEventPayload(): Record<string, unknown> {
  return {
    userId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
}

export const BURST_SIZE = IS_CI ? 100 : 25;

export const TIMEOUTS = {
  DLQ_WAIT: 45_000,
  IDEMPOTENCY_WAIT: 45_000,
  BURST_WAIT: 10_000,
  REDIS_RECOVER: 15_000,
  POLL_INTERVAL: 500,
};
