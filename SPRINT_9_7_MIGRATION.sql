-- ============================================================================
-- Sprint 9.7 (v23.23.4) — Finance Hardening
-- Bills (AP), recurring expenses, anomaly snapshots
-- ============================================================================

-- ── Enums ───────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "BillStatus" AS ENUM ('DRAFT', 'OPEN', 'OVERDUE', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "RecurringFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Bill ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Bill" (
  "id"                  TEXT PRIMARY KEY,
  "billNumber"          TEXT,
  "description"         TEXT NOT NULL,
  "vendorId"            TEXT,
  "vendorNameSnapshot"  TEXT,
  "categoryId"          TEXT NOT NULL,
  "purchaseOrderId"     TEXT,
  "amountPaise"         INTEGER NOT NULL,
  "gstPaise"            INTEGER NOT NULL DEFAULT 0,
  "totalPaise"          INTEGER NOT NULL,
  "paidPaise"           INTEGER NOT NULL DEFAULT 0,
  "issuedOn"            TIMESTAMP NOT NULL,
  "dueOn"               TIMESTAMP NOT NULL,
  "status"              "BillStatus" NOT NULL DEFAULT 'OPEN',
  "receiptUrl"          TEXT,
  "notes"               TEXT,
  "createdByUserId"     TEXT NOT NULL,
  "createdAt"           TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"           TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "Bill_category_fkey" FOREIGN KEY ("categoryId")
    REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS "Bill_status_dueOn_idx" ON "Bill"("status", "dueOn");
CREATE INDEX IF NOT EXISTS "Bill_vendorId_idx" ON "Bill"("vendorId");
CREATE INDEX IF NOT EXISTS "Bill_purchaseOrderId_idx" ON "Bill"("purchaseOrderId");

-- ── BillPayment ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "BillPayment" (
  "id"              TEXT PRIMARY KEY,
  "billId"          TEXT NOT NULL,
  "amountPaise"     INTEGER NOT NULL,
  "paidOn"          TIMESTAMP NOT NULL,
  "method"          TEXT,
  "reference"       TEXT,
  "notes"           TEXT,
  "expenseId"       TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt"       TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "BillPayment_bill_fkey" FOREIGN KEY ("billId")
    REFERENCES "Bill"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "BillPayment_billId_idx" ON "BillPayment"("billId");
CREATE INDEX IF NOT EXISTS "BillPayment_paidOn_idx" ON "BillPayment"("paidOn");

-- ── RecurringExpense ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "RecurringExpense" (
  "id"                  TEXT PRIMARY KEY,
  "name"                TEXT NOT NULL,
  "categoryId"          TEXT NOT NULL,
  "vendorId"            TEXT,
  "vendorNameSnapshot"  TEXT,
  "amountPaise"         INTEGER NOT NULL,
  "gstPaise"            INTEGER NOT NULL DEFAULT 0,
  "totalPaise"          INTEGER NOT NULL,
  "frequency"           "RecurringFrequency" NOT NULL,
  "dayOfMonth"          INTEGER,
  "dueOffsetDays"       INTEGER NOT NULL DEFAULT 15,
  "active"              BOOLEAN NOT NULL DEFAULT TRUE,
  "lastRunDate"         TIMESTAMP,
  "nextRunDate"         TIMESTAMP NOT NULL,
  "createdByUserId"     TEXT NOT NULL,
  "createdAt"           TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"           TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "RecurringExpense_active_nextRunDate_idx" ON "RecurringExpense"("active", "nextRunDate");

-- ── FinanceAnomalyAlert ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "FinanceAnomalyAlert" (
  "id"             TEXT PRIMARY KEY,
  "categoryId"     TEXT NOT NULL,
  "periodStart"    TIMESTAMP NOT NULL,
  "periodEnd"      TIMESTAMP NOT NULL,
  "actualPaise"    INTEGER NOT NULL,
  "meanPaise"      INTEGER NOT NULL,
  "stdDevPaise"    INTEGER NOT NULL,
  "zScore"         DOUBLE PRECISION NOT NULL,
  "severity"       TEXT NOT NULL,
  "acknowledgedAt" TIMESTAMP,
  "createdAt"      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "FinanceAnomalyAlert_ack_createdAt_idx" ON "FinanceAnomalyAlert"("acknowledgedAt", "createdAt");

-- Done. Verify with:
-- SELECT table_name FROM information_schema.tables WHERE table_name IN ('Bill','BillPayment','RecurringExpense','FinanceAnomalyAlert');
