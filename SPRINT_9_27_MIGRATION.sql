-- v23.40.10 — Bill ↔ Expense one-to-one linkage.
-- Run in Supabase SQL Editor BEFORE deploying v23.40.10.

-- 1. Add expenseId column on Bill
ALTER TABLE "Bill"
  ADD COLUMN IF NOT EXISTS "expenseId" TEXT;

-- 2. Add unique index on expenseId (one Bill ↔ one Expense)
CREATE UNIQUE INDEX IF NOT EXISTS "Bill_expenseId_key" ON "Bill"("expenseId")
  WHERE "expenseId" IS NOT NULL;

-- 3. Extend ExpenseSource enum with 'BILL' (Postgres enum ADD VALUE)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'ExpenseSource' AND e.enumlabel = 'BILL'
  ) THEN
    ALTER TYPE "ExpenseSource" ADD VALUE 'BILL';
  END IF;
END $$;

-- 4. Reconciliation: where the legacy autoExpense flow had already created an
--    Expense row linked to a BillPayment, point the Bill back to that Expense.
--    (BillPayment.expenseId existed; this is just back-filling the reverse link.)
UPDATE "Bill" b
   SET "expenseId" = bp."expenseId"
  FROM "BillPayment" bp
 WHERE bp."billId" = b."id"
   AND bp."expenseId" IS NOT NULL
   AND b."expenseId" IS NULL;

-- 5. Mark those backfilled expenses as source=BILL for clarity
UPDATE "Expense" e
   SET "source" = 'BILL'
  FROM "Bill" b
 WHERE b."expenseId" = e."id"
   AND e."source" = 'MANUAL';
