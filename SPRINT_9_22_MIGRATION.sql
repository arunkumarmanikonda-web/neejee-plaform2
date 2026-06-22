-- v23.39.4 — Add multi-file attachments to Bill, BillPayment, Expense.
-- Run this in Supabase SQL Editor BEFORE deploying v23.39.4.

ALTER TABLE "Bill"
  ADD COLUMN IF NOT EXISTS "attachments" TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE "BillPayment"
  ADD COLUMN IF NOT EXISTS "attachments" TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE "Expense"
  ADD COLUMN IF NOT EXISTS "attachments" TEXT[] NOT NULL DEFAULT '{}';

-- Backfill: copy single receiptUrl into the new array so existing data shows up.
UPDATE "Bill"
  SET "attachments" = ARRAY["receiptUrl"]
  WHERE "receiptUrl" IS NOT NULL AND array_length("attachments", 1) IS NULL;

UPDATE "BillPayment"
  SET "attachments" = ARRAY["receiptUrl"]
  WHERE "receiptUrl" IS NOT NULL AND array_length("attachments", 1) IS NULL;

UPDATE "Expense"
  SET "attachments" = ARRAY["receiptUrl"]
  WHERE "receiptUrl" IS NOT NULL AND array_length("attachments", 1) IS NULL;
