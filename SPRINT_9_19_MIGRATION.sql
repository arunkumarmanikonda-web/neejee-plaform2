-- v23.38 — Finance polish: payment receipts + universal audit log
-- Run in Supabase SQL Editor. Safe to re-run (idempotent).

-- 1) BillPayment.receiptUrl — payment receipt attachment
ALTER TABLE "BillPayment" ADD COLUMN IF NOT EXISTS "receiptUrl" TEXT;

-- 2) FinanceAuditLog — universal change tracker
CREATE TABLE IF NOT EXISTS "FinanceAuditLog" (
  "id"           TEXT PRIMARY KEY,
  "action"       TEXT NOT NULL,         -- CREATE | UPDATE | DELETE
  "entityType"   TEXT NOT NULL,         -- Bill | BillPayment | Expense | Employee | Payslip | ...
  "entityId"     TEXT NOT NULL,
  "changesJson"  TEXT,                  -- field-level diff for UPDATE
  "fullSnapshot" TEXT,                  -- full row JSON for CREATE/DELETE
  "userId"       TEXT,
  "userEmail"    TEXT,
  "userRole"     TEXT,
  "ipAddress"    TEXT,
  "userAgent"    TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "FinanceAuditLog_entityType_entityId_idx" ON "FinanceAuditLog"("entityType","entityId");
CREATE INDEX IF NOT EXISTS "FinanceAuditLog_userId_createdAt_idx"   ON "FinanceAuditLog"("userId","createdAt");
CREATE INDEX IF NOT EXISTS "FinanceAuditLog_createdAt_idx"          ON "FinanceAuditLog"("createdAt");
