-- v23.40 — Payroll module schema
-- Run in Supabase SQL Editor. Idempotent.

-- Enums
DO $$ BEGIN
  CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE','ON_NOTICE','EXITED','ON_LEAVE','TERMINATED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT','COMPUTED','APPROVED','PAID','LOCKED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Employee
CREATE TABLE IF NOT EXISTS "Employee" (
  "id"               TEXT PRIMARY KEY,
  "employeeCode"     TEXT NOT NULL UNIQUE,
  "firstName"        TEXT NOT NULL,
  "lastName"         TEXT,
  "email"            TEXT UNIQUE,
  "phone"            TEXT,
  "userId"           TEXT UNIQUE,
  "pan"              TEXT UNIQUE,
  "aadhaarLast4"     TEXT,
  "dob"              TIMESTAMP(3),
  "designation"      TEXT,
  "department"       TEXT,
  "joiningDate"      TIMESTAMP(3) NOT NULL,
  "exitDate"         TIMESTAMP(3),
  "employmentType"   TEXT NOT NULL DEFAULT 'FULL_TIME',
  "status"           "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
  "bankAccountName"  TEXT,
  "bankAccountNumber" TEXT,
  "bankIfsc"         TEXT,
  "uanNumber"        TEXT,
  "esicNumber"       TEXT,
  "taxRegime"        TEXT NOT NULL DEFAULT 'NEW',
  "address"          TEXT,
  "emergencyContact" TEXT,
  "notes"            TEXT,
  "createdByUserId"  TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "Employee_status_idx" ON "Employee"("status");
CREATE INDEX IF NOT EXISTS "Employee_department_status_idx" ON "Employee"("department","status");

-- SalaryStructure
CREATE TABLE IF NOT EXISTS "SalaryStructure" (
  "id"                    TEXT PRIMARY KEY,
  "name"                  TEXT NOT NULL,
  "description"           TEXT,
  "basicPaise"            INTEGER NOT NULL,
  "hraPaise"              INTEGER NOT NULL,
  "conveyancePaise"       INTEGER NOT NULL DEFAULT 0,
  "medicalPaise"          INTEGER NOT NULL DEFAULT 0,
  "specialAllowancePaise" INTEGER NOT NULL DEFAULT 0,
  "ltaMonthlyPaise"       INTEGER NOT NULL DEFAULT 0,
  "performanceBonusPaise" INTEGER NOT NULL DEFAULT 0,
  "monthlyCtcPaise"       INTEGER NOT NULL,
  "active"                BOOLEAN NOT NULL DEFAULT TRUE,
  "createdByUserId"       TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "SalaryStructure_active_idx" ON "SalaryStructure"("active");

-- EmployeeSalaryAssignment
CREATE TABLE IF NOT EXISTS "EmployeeSalaryAssignment" (
  "id"                TEXT PRIMARY KEY,
  "employeeId"        TEXT NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE,
  "structureId"       TEXT NOT NULL REFERENCES "SalaryStructure"("id") ON DELETE RESTRICT,
  "effectiveFrom"     TIMESTAMP(3) NOT NULL,
  "effectiveTo"       TIMESTAMP(3),
  "ctcOverridePaise"  INTEGER,
  "notes"             TEXT,
  "createdByUserId"   TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "EmployeeSalaryAssignment_employeeId_effectiveFrom_idx" ON "EmployeeSalaryAssignment"("employeeId","effectiveFrom");
CREATE INDEX IF NOT EXISTS "EmployeeSalaryAssignment_effectiveTo_idx" ON "EmployeeSalaryAssignment"("effectiveTo");

-- PayrollRun
CREATE TABLE IF NOT EXISTS "PayrollRun" (
  "id"                  TEXT PRIMARY KEY,
  "month"               INTEGER NOT NULL,
  "year"                INTEGER NOT NULL,
  "label"               TEXT NOT NULL,
  "status"              "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
  "totalGrossPaise"     INTEGER NOT NULL DEFAULT 0,
  "totalDeductionsPaise" INTEGER NOT NULL DEFAULT 0,
  "totalNetPaise"       INTEGER NOT NULL DEFAULT 0,
  "employeeCount"       INTEGER NOT NULL DEFAULT 0,
  "computedAt"          TIMESTAMP(3),
  "approvedAt"          TIMESTAMP(3),
  "approvedByUserId"    TEXT,
  "paidAt"              TIMESTAMP(3),
  "paidByUserId"        TEXT,
  "notes"               TEXT,
  "createdByUserId"     TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  UNIQUE ("month","year")
);
CREATE INDEX IF NOT EXISTS "PayrollRun_status_year_month_idx" ON "PayrollRun"("status","year","month");

-- Payslip
CREATE TABLE IF NOT EXISTS "Payslip" (
  "id"                    TEXT PRIMARY KEY,
  "payrollRunId"          TEXT NOT NULL REFERENCES "PayrollRun"("id") ON DELETE CASCADE,
  "employeeId"            TEXT NOT NULL REFERENCES "Employee"("id") ON DELETE RESTRICT,
  "daysInMonth"           INTEGER NOT NULL,
  "daysWorked"            INTEGER NOT NULL,
  "leavesPaid"            INTEGER NOT NULL DEFAULT 0,
  "leavesUnpaid"          INTEGER NOT NULL DEFAULT 0,
  "basicPaise"            INTEGER NOT NULL DEFAULT 0,
  "hraPaise"              INTEGER NOT NULL DEFAULT 0,
  "conveyancePaise"       INTEGER NOT NULL DEFAULT 0,
  "medicalPaise"          INTEGER NOT NULL DEFAULT 0,
  "specialAllowancePaise" INTEGER NOT NULL DEFAULT 0,
  "ltaPaise"              INTEGER NOT NULL DEFAULT 0,
  "bonusPaise"            INTEGER NOT NULL DEFAULT 0,
  "incentivePaise"        INTEGER NOT NULL DEFAULT 0,
  "reimbursementPaise"    INTEGER NOT NULL DEFAULT 0,
  "otherEarningsPaise"    INTEGER NOT NULL DEFAULT 0,
  "grossPaise"            INTEGER NOT NULL DEFAULT 0,
  "pfEmployeePaise"       INTEGER NOT NULL DEFAULT 0,
  "pfEmployerPaise"       INTEGER NOT NULL DEFAULT 0,
  "esiEmployeePaise"      INTEGER NOT NULL DEFAULT 0,
  "esiEmployerPaise"      INTEGER NOT NULL DEFAULT 0,
  "tdsPaise"              INTEGER NOT NULL DEFAULT 0,
  "professionalTaxPaise"  INTEGER NOT NULL DEFAULT 0,
  "advanceRecoveryPaise"  INTEGER NOT NULL DEFAULT 0,
  "loanRepaymentPaise"    INTEGER NOT NULL DEFAULT 0,
  "finesPaise"            INTEGER NOT NULL DEFAULT 0,
  "otherDeductionsPaise"  INTEGER NOT NULL DEFAULT 0,
  "totalDeductionsPaise"  INTEGER NOT NULL DEFAULT 0,
  "netPaise"              INTEGER NOT NULL DEFAULT 0,
  "paidOn"                TIMESTAMP(3),
  "paymentMethod"         TEXT,
  "paymentReference"      TEXT,
  "payslipUrl"            TEXT,
  "deliveredEmailAt"      TIMESTAMP(3),
  "deliveredWhatsappAt"   TIMESTAMP(3),
  "deliveredSmsAt"        TIMESTAMP(3),
  "notes"                 TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,
  UNIQUE ("payrollRunId","employeeId")
);
CREATE INDEX IF NOT EXISTS "Payslip_employeeId_payrollRunId_idx" ON "Payslip"("employeeId","payrollRunId");

-- Attendance
CREATE TABLE IF NOT EXISTS "Attendance" (
  "id"              TEXT PRIMARY KEY,
  "employeeId"      TEXT NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE,
  "month"           INTEGER NOT NULL,
  "year"            INTEGER NOT NULL,
  "daysWorked"      INTEGER NOT NULL,
  "leavesPaid"      INTEGER NOT NULL DEFAULT 0,
  "leavesUnpaid"    INTEGER NOT NULL DEFAULT 0,
  "overtimeHours"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes"           TEXT,
  "createdByUserId" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  UNIQUE ("employeeId","month","year")
);
CREATE INDEX IF NOT EXISTS "Attendance_month_year_idx" ON "Attendance"("month","year");

-- EmployeeAdjustment
CREATE TABLE IF NOT EXISTS "EmployeeAdjustment" (
  "id"                  TEXT PRIMARY KEY,
  "employeeId"          TEXT NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE,
  "forMonth"            INTEGER NOT NULL,
  "forYear"             INTEGER NOT NULL,
  "kind"                TEXT NOT NULL,
  "amountPaise"         INTEGER NOT NULL,
  "description"         TEXT NOT NULL,
  "appliedToPayslipId"  TEXT,
  "createdByUserId"     TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "EmployeeAdjustment_employeeId_forYear_forMonth_idx" ON "EmployeeAdjustment"("employeeId","forYear","forMonth");
CREATE INDEX IF NOT EXISTS "EmployeeAdjustment_appliedToPayslipId_idx" ON "EmployeeAdjustment"("appliedToPayslipId");

-- PayrollConfig (singleton)
CREATE TABLE IF NOT EXISTS "PayrollConfig" (
  "id"                   TEXT PRIMARY KEY DEFAULT 'singleton',
  "pfEnabled"            BOOLEAN NOT NULL DEFAULT FALSE,
  "esiEnabled"           BOOLEAN NOT NULL DEFAULT FALSE,
  "tdsEnabled"           BOOLEAN NOT NULL DEFAULT FALSE,
  "ptEnabled"            BOOLEAN NOT NULL DEFAULT FALSE,
  "pfEmployeeRate"       DOUBLE PRECISION NOT NULL DEFAULT 12.0,
  "pfEmployerRate"       DOUBLE PRECISION NOT NULL DEFAULT 12.0,
  "pfWageCeilingPaise"   INTEGER NOT NULL DEFAULT 1500000,
  "esiEmployeeRate"      DOUBLE PRECISION NOT NULL DEFAULT 0.75,
  "esiEmployerRate"      DOUBLE PRECISION NOT NULL DEFAULT 3.25,
  "esiGrossCeilingPaise" INTEGER NOT NULL DEFAULT 2100000,
  "ptSlabsJson"          TEXT NOT NULL DEFAULT '[]',
  "tdsDefaultRate"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "payCycleDay"          INTEGER NOT NULL DEFAULT 1,
  "workingDaysPerMonth"  INTEGER NOT NULL DEFAULT 26,
  "notes"                TEXT,
  "updatedAt"            TIMESTAMP(3) NOT NULL
);

-- Seed singleton row
INSERT INTO "PayrollConfig" ("id", "updatedAt") VALUES ('singleton', NOW()) ON CONFLICT ("id") DO NOTHING;
