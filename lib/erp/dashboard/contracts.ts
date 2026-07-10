export const ERP_DASHBOARD_VERSION = 'erp.dashboard.v1';

export type ErpDashboardRangeDays = 7 | 30 | 90;

export type ErpAttemptStatus =
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

export type ErpDashboardSummary = {
  totalAttempts: number;
  queued: number;
  processing: number;
  succeeded: number;
  failed: number;
  deadLetterAttempts: number;
  openDeadLetters: number;
  retryScheduledDeadLetters: number;
  resolvedDeadLetters: number;
  discardedDeadLetters: number;
};

export type ErpAttemptDailyPoint = {
  date: string;
  total: number;
  queued: number;
  processing: number;
  succeeded: number;
  failed: number;
  deadLetter: number;
};

export type ErpEntityBreakdownItem = {
  entityType: string;
  count: number;
};

export type ErpRecentAttempt = {
  id: string;
  entityType: string;
  entityKey: string;
  adapterKind: string;
  action: string;
  status: ErpAttemptStatus | string;
  attemptNumber: number;
  maxAttempts: number;
  runAfter: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
};

export type ErpRecentDeadLetter = {
  id: string;
  entityType: string;
  entityKey: string;
  status: ErpDeadLetterStatus | string;
  errorCode: string | null;
  errorMessage: string;
  resolutionNote: string | null;
  lastFailedAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  syncAttempt: {
    id: string;
    action: string;
    adapterKind: string;
    attemptNumber: number;
    maxAttempts: number;
    status: string;
    runAfter: string;
  };
};

export type ErpDashboardResponse = {
  version: string;
  rangeDays: ErpDashboardRangeDays;
  summary: ErpDashboardSummary;
  daily: ErpAttemptDailyPoint[];
  byEntity: ErpEntityBreakdownItem[];
  recentAttempts: ErpRecentAttempt[];
  recentDeadLetters: ErpRecentDeadLetter[];
};
