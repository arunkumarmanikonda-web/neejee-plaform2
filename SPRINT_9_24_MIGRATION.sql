-- v23.40.2 — Expense payments + paid-status running totals.
-- Run this in Supabase SQL Editor BEFORE deploying v23.40.2.

------------------------------------------------------------------
-- Expense — add paid running totals
------------------------------------------------------------------
ALTER TABLE "Expense"
  ADD COLUMN IF NOT EXISTS "paidPaise"     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT    NOT NULL DEFAULT 'UNPAID';

-- Backfill: any expense that already has a paidOn becomes fully paid.
UPDATE "Expense"
   SET "paidPaise"     = "totalPaise",
       "paymentStatus" = 'PAID'
 WHERE "paidOn" IS NOT NULL AND "paidPaise" = 0;

------------------------------------------------------------------
-- ExpensePayment
------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ExpensePayment" (
  "id"              TEXT NOT NULL,
  "expenseId"       TEXT NOT NULL,
  "amountPaise"     INTEGER NOT NULL,
  "paidOn"          TIMESTAMP(3) NOT NULL,
  "method"          TEXT,
  "reference"       TEXT,
  "notes"           TEXT,
  "receiptUrl"      TEXT,
  "attachments"     TEXT[] NOT NULL DEFAULT '{}',
  "createdByUserId" TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExpensePayment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ExpensePayment_expenseId_idx" ON "ExpensePayment"("expenseId");
CREATE INDEX IF NOT EXISTS "ExpensePayment_paidOn_idx"    ON "ExpensePayment"("paidOn");
ALTER TABLE "ExpensePayment"
  DROP CONSTRAINT IF EXISTS "ExpensePayment_expenseId_fkey";
ALTER TABLE "ExpensePayment"
  ADD CONSTRAINT "ExpensePayment_expenseId_fkey"
  FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE;
