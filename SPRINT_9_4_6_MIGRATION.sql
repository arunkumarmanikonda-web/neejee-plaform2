-- Sprint 9.4.6 (v23.21.6) — Vendor portal: team members, notification prefs, payouts
-- Run AFTER both SPRINT_9_4_MIGRATION.sql and SPRINT_9_4_5_MIGRATION.sql are applied.

-- 1. Extend Role enum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'VENDOR_STAFF';

-- 2. New enums
DO $$ BEGIN
  CREATE TYPE "VendorTeamAccessLevel" AS ENUM ('FULL','FINANCE_ONLY','OPERATIONS_ONLY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "VendorTeamStatus" AS ENUM ('INVITED','ACTIVE','SUSPENDED','REMOVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "VendorPayoutStatus" AS ENUM ('SCHEDULED','PROCESSING','PAID','FAILED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. VendorTeamMember
CREATE TABLE IF NOT EXISTS "VendorTeamMember" (
  "id"              TEXT PRIMARY KEY,
  "vendorId"        TEXT NOT NULL,
  "userId"          TEXT NOT NULL UNIQUE,
  "displayName"     TEXT,
  "email"           TEXT NOT NULL,
  "accessLevel"     "VendorTeamAccessLevel" NOT NULL DEFAULT 'FULL',
  "status"          "VendorTeamStatus" NOT NULL DEFAULT 'INVITED',
  "invitedByUserId" TEXT,
  "invitedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt"      TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VendorTeamMember_vendorId_fkey" FOREIGN KEY ("vendorId")
    REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "VendorTeamMember_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "VendorTeamMember_vendorId_idx" ON "VendorTeamMember"("vendorId");
CREATE INDEX IF NOT EXISTS "VendorTeamMember_email_idx" ON "VendorTeamMember"("email");

-- 4. VendorNotificationPref
CREATE TABLE IF NOT EXISTS "VendorNotificationPref" (
  "id"            TEXT PRIMARY KEY,
  "userId"        TEXT NOT NULL UNIQUE,
  "emailOptIn"    BOOLEAN NOT NULL DEFAULT true,
  "whatsappOptIn" BOOLEAN NOT NULL DEFAULT true,
  "smsOptIn"      BOOLEAN NOT NULL DEFAULT false,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VendorNotificationPref_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 5. VendorPayout
CREATE TABLE IF NOT EXISTS "VendorPayout" (
  "id"              TEXT PRIMARY KEY,
  "vendorId"        TEXT NOT NULL,
  "poIds"           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "grossPaise"      INTEGER NOT NULL,
  "tdsPaise"        INTEGER NOT NULL DEFAULT 0,
  "netPaise"        INTEGER NOT NULL,
  "status"          "VendorPayoutStatus" NOT NULL DEFAULT 'SCHEDULED',
  "paymentMethod"   TEXT,
  "transactionRef"  TEXT,
  "scheduledFor"    TIMESTAMP(3),
  "paidAt"          TIMESTAMP(3),
  "failureReason"   TEXT,
  "createdByUserId" TEXT,
  "notes"           TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VendorPayout_vendorId_fkey" FOREIGN KEY ("vendorId")
    REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "VendorPayout_vendorId_status_idx" ON "VendorPayout"("vendorId","status");
CREATE INDEX IF NOT EXISTS "VendorPayout_status_scheduledFor_idx" ON "VendorPayout"("status","scheduledFor");
