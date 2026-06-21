export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  backoffMultiplier: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
};

export function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  return config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
}
