import type { ErpBackoffConfig, ErpQueueJobInput, ErpRetryPlan } from './contracts';

const DEFAULT_BASE_DELAY_MS = 30_000;
const DEFAULT_FACTOR = 2;
const DEFAULT_MAX_DELAY_MS = 60 * 60 * 1000;

function toPositiveNumber(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return value;
}

export function computeBackoffDelayMs(
  retryOrdinal: number,
  config: ErpBackoffConfig = {}
): number {
  const baseDelayMs = toPositiveNumber(config.baseDelayMs, DEFAULT_BASE_DELAY_MS);
  const factor = toPositiveNumber(config.factor, DEFAULT_FACTOR);
  const maxDelayMs = toPositiveNumber(config.maxDelayMs, DEFAULT_MAX_DELAY_MS);

  const safeRetryOrdinal = Math.max(1, Math.floor(retryOrdinal));
  const rawDelay = baseDelayMs * Math.pow(factor, safeRetryOrdinal - 1);

  return Math.min(maxDelayMs, Math.round(rawDelay));
}

export function shouldMoveToDeadLetter(job: ErpQueueJobInput): boolean {
  return job.attemptNumber >= job.maxAttempts;
}

export function planNextRetry(
  job: ErpQueueJobInput,
  now: Date = new Date(),
  config: ErpBackoffConfig = {}
): ErpRetryPlan {
  if (shouldMoveToDeadLetter(job)) {
    return {
      nextAttemptNumber: job.attemptNumber + 1,
      delayMs: 0,
      runAfter: now.toISOString(),
      shouldDeadLetter: true,
    };
  }

  const delayMs = computeBackoffDelayMs(job.attemptNumber, config);
  const runAfter = new Date(now.getTime() + delayMs).toISOString();

  return {
    nextAttemptNumber: job.attemptNumber + 1,
    delayMs,
    runAfter,
    shouldDeadLetter: false,
  };
}
