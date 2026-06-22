-- v23.40.1 — Employee personal-file + exit workflow + reimbursement / incentive config + F&F.
-- Run this in Supabase SQL Editor BEFORE deploying v23.40.1.

------------------------------------------------------------------
-- Employee — add exit / resignation fields + supporting documents
------------------------------------------------------------------
ALTER TABLE "Employee"
  ADD COLUMN IF NOT EXISTS "resignationDate"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "noticePeriodDays" INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "lastWorkingDay"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "exitReason"       TEXT,
  ADD COLUMN IF NOT EXISTS "exitType"         TEXT,
  ADD COLUMN IF NOT EXISTS "exitNotes"        TEXT,
  ADD COLUMN IF NOT EXISTS "documents"        TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "photoUrl"         TEXT;

------------------------------------------------------------------
-- ReimbursementPolicy
------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ReimbursementPolicy" (
  "id"                  TEXT NOT NULL,
  "employeeId"          TEXT NOT NULL,
  "mobileCapPaise"      INTEGER NOT NULL DEFAULT 0,
  "conveyanceCapPaise"  INTEGER NOT NULL DEFAULT 0,
  "internetCapPaise"    INTEGER NOT NULL DEFAULT 0,
  "foodCapPaise"        INTEGER NOT NULL DEFAULT 0,
  "fuelCapPaise"        INTEGER NOT NULL DEFAULT 0,
  "bookCapPaise"        INTEGER NOT NULL DEFAULT 0,
  "otherCapPaise"       INTEGER NOT NULL DEFAULT 0,
  "autoAddToPayroll"    BOOLEAN NOT NULL DEFAULT true,
  "notes"               TEXT,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReimbursementPolicy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ReimbursementPolicy_employeeId_key"
  ON "ReimbursementPolicy"("employeeId");
ALTER TABLE "ReimbursementPolicy"
  DROP CONSTRAINT IF EXISTS "ReimbursementPolicy_employeeId_fkey";
ALTER TABLE "ReimbursementPolicy"
  ADD CONSTRAINT "ReimbursementPolicy_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE;

------------------------------------------------------------------
-- IncentivePlan
------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "IncentivePlan" (
  "id"                  TEXT NOT NULL,
  "employeeId"          TEXT NOT NULL,
  "planType"            TEXT NOT NULL DEFAULT 'FIXED',
  "fixedIncentivePaise" INTEGER NOT NULL DEFAULT 0,
  "variableBasePaise"   INTEGER NOT NULL DEFAULT 0,
  "variableMaxPaise"    INTEGER NOT NULL DEFAULT 0,
  "quarterlyBonusPaise" INTEGER NOT NULL DEFAULT 0,
  "annualBonusPaise"    INTEGER NOT NULL DEFAULT 0,
  "payoutFrequency"     TEXT NOT NULL DEFAULT 'MONTHLY',
  "metric"              TEXT,
  "notes"               TEXT,
  "active"              BOOLEAN NOT NULL DEFAULT true,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IncentivePlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IncentivePlan_employeeId_key"
  ON "IncentivePlan"("employeeId");
ALTER TABLE "IncentivePlan"
  DROP CONSTRAINT IF EXISTS "IncentivePlan_employeeId_fkey";
ALTER TABLE "IncentivePlan"
  ADD CONSTRAINT "IncentivePlan_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE;

------------------------------------------------------------------
-- FnFSettlement
------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "FnFSettlement" (
  "id"                       TEXT NOT NULL,
  "employeeId"               TEXT NOT NULL,
  "resignationDate"          TIMESTAMP(3),
  "lastWorkingDay"           TIMESTAMP(3) NOT NULL,
  "noticePeriodDays"         INTEGER NOT NULL DEFAULT 30,
  "noticeShortfallDays"      INTEGER NOT NULL DEFAULT 0,
  "exitReason"               TEXT,
  "pendingSalaryPaise"       INTEGER NOT NULL DEFAULT 0,
  "pendingDaysWorked"        INTEGER NOT NULL DEFAULT 0,
  "leaveBalanceDays"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "leaveEncashmentPaise"     INTEGER NOT NULL DEFAULT 0,
  "bonusDuePaise"            INTEGER NOT NULL DEFAULT 0,
  "incentiveDuePaise"        INTEGER NOT NULL DEFAULT 0,
  "reimbursementDuePaise"    INTEGER NOT NULL DEFAULT 0,
  "gratuityPaise"            INTEGER NOT NULL DEFAULT 0,
  "gratuityEligible"         BOOLEAN NOT NULL DEFAULT false,
  "noticeRecoveryPaise"      INTEGER NOT NULL DEFAULT 0,
  "loanRecoveryPaise"        INTEGER NOT NULL DEFAULT 0,
  "advanceRecoveryPaise"     INTEGER NOT NULL DEFAULT 0,
  "otherRecoveryPaise"       INTEGER NOT NULL DEFAULT 0,
  "tdsPaise"                 INTEGER NOT NULL DEFAULT 0,
  "pfFinalPaise"             INTEGER NOT NULL DEFAULT 0,
  "esiFinalPaise"            INTEGER NOT NULL DEFAULT 0,
  "totalEarningsPaise"       INTEGER NOT NULL DEFAULT 0,
  "totalDeductionsPaise"     INTEGER NOT NULL DEFAULT 0,
  "netPayablePaise"          INTEGER NOT NULL DEFAULT 0,
  "status"                   TEXT NOT NULL DEFAULT 'DRAFT',
  "approvedByUserId"         TEXT,
  "approvedAt"               TIMESTAMP(3),
  "paidOn"                   TIMESTAMP(3),
  "paymentReference"         TEXT,
  "attachments"              TEXT[] NOT NULL DEFAULT '{}',
  "notes"                    TEXT,
  "createdByUserId"          TEXT NOT NULL,
  "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FnFSettlement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FnFSettlement_employeeId_idx" ON "FnFSettlement"("employeeId");
CREATE INDEX IF NOT EXISTS "FnFSettlement_status_idx" ON "FnFSettlement"("status");
ALTER TABLE "FnFSettlement"
  DROP CONSTRAINT IF EXISTS "FnFSettlement_employeeId_fkey";
ALTER TABLE "FnFSettlement"
  ADD CONSTRAINT "FnFSettlement_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE;
