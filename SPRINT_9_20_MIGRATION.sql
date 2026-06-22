-- v23.39 — Bank reconciliation tables
-- Run in Supabase SQL Editor. Idempotent.

CREATE TABLE IF NOT EXISTS "BankAccount" (
  "id"                  TEXT PRIMARY KEY,
  "nickname"            TEXT NOT NULL,
  "bankName"            TEXT NOT NULL,
  "accountNumber"       TEXT,
  "ifsc"                TEXT,
  "accountType"         TEXT,
  "active"              BOOLEAN NOT NULL DEFAULT TRUE,
  "currency"            TEXT NOT NULL DEFAULT 'INR',
  "openingBalancePaise" INTEGER NOT NULL DEFAULT 0,
  "openingBalanceDate"  TIMESTAMP(3),
  "lastSyncedAt"        TIMESTAMP(3),
  "lastSyncedSource"    TEXT,
  "rzpxAccountId"       TEXT,
  "createdByUserId"     TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "BankAccount_active_bankName_idx" ON "BankAccount"("active","bankName");

DO $$ BEGIN
  CREATE TYPE "BankTxnStatus" AS ENUM ('UNMATCHED','AUTO_MATCHED','MANUAL_MATCHED','IGNORED','DRAFT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "BankTransaction" (
  "id"                  TEXT PRIMARY KEY,
  "bankAccountId"       TEXT NOT NULL REFERENCES "BankAccount"("id") ON DELETE CASCADE,
  "txnDate"             TIMESTAMP(3) NOT NULL,
  "description"         TEXT NOT NULL,
  "reference"           TEXT,
  "debitPaise"          INTEGER NOT NULL DEFAULT 0,
  "creditPaise"         INTEGER NOT NULL DEFAULT 0,
  "balancePaise"        INTEGER,
  "source"              TEXT NOT NULL,
  "sourceFileUrl"       TEXT,
  "sourceRowHash"       TEXT,
  "status"              "BankTxnStatus" NOT NULL DEFAULT 'UNMATCHED',
  "matchedExpenseId"    TEXT,
  "matchedBillPaymentId" TEXT,
  "matchedRefundId"     TEXT,
  "matchNotes"          TEXT,
  "matchedAt"           TIMESTAMP(3),
  "matchedByUserId"     TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "BankTransaction_bankAccountId_txnDate_idx" ON "BankTransaction"("bankAccountId","txnDate");
CREATE INDEX IF NOT EXISTS "BankTransaction_status_idx"        ON "BankTransaction"("status");
CREATE INDEX IF NOT EXISTS "BankTransaction_sourceRowHash_idx" ON "BankTransaction"("sourceRowHash");
CREATE INDEX IF NOT EXISTS "BankTransaction_reference_idx"     ON "BankTransaction"("reference");
