export const ERP_QUEUE_VERSION = 'erp.queue.v1';

export type ErpQueueEntityType =
  | 'PRODUCT'
  | 'INVENTORY'
  | 'PRICE'
  | 'SELLER'
  | 'ORDER'
  | 'PURCHASE_ORDER';

export type ErpSyncAttemptStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'DEAD_LETTER';

export type ErpDeadLetterStatus =
  | 'OPEN'
  | 'RETRY_SCHEDULED'
  | 'RESOLVED'
  | 'DISCARDED';

export type ErpBackoffConfig = {
  baseDelayMs?: number;
  factor?: number;
  maxDelayMs?: number;
};

export type ErpQueueJobInput = {
  attemptNumber: number;
  maxAttempts: number;
};

export type ErpRetryPlan = {
  nextAttemptNumber: number;
  delayMs: number;
  runAfter: string;
  shouldDeadLetter: boolean;
};
