-- Sprint 9.4.5 (v23.21.5) — Vendor portal redesign: docs + change requests
-- Run AFTER SPRINT_9_4_MIGRATION.sql is already applied.

DO $$ BEGIN
  CREATE TYPE "VendorDocType" AS ENUM (
    'PAN_CARD','GST_CERTIFICATE','MSME_CERTIFICATE','CANCELLED_CHEQUE',
    'BANK_STATEMENT','ADDRESS_PROOF','AADHAAR_SIGNATORY','SIGNATORY_PHOTO',
    'VENDOR_AGREEMENT','INVOICE','GRN_DISPUTE','OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "VendorDocStatus" AS ENUM ('SUBMITTED','APPROVED','REJECTED','SUPERSEDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "VendorChangeRequestStatus" AS ENUM ('PENDING','APPROVED','REJECTED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- VendorChangeRequest first (VendorDocument references it)
CREATE TABLE IF NOT EXISTS "VendorChangeRequest" (
  "id"                 TEXT PRIMARY KEY,
  "vendorId"           TEXT NOT NULL,
  "fieldChanges"       JSONB NOT NULL,
  "reason"             TEXT,
  "status"             "VendorChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedByUserId"  TEXT NOT NULL,
  "requestedOnBehalf"  BOOLEAN NOT NULL DEFAULT false,
  "reviewedByUserId"   TEXT,
  "reviewedAt"         TIMESTAMP(3),
  "reviewNote"         TEXT,
  "appliedAt"          TIMESTAMP(3),
  "cancelledAt"        TIMESTAMP(3),
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VendorChangeRequest_vendorId_fkey" FOREIGN KEY ("vendorId")
    REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "VendorChangeRequest_vendorId_status_idx"
  ON "VendorChangeRequest"("vendorId","status");
CREATE INDEX IF NOT EXISTS "VendorChangeRequest_status_createdAt_idx"
  ON "VendorChangeRequest"("status","createdAt");

CREATE TABLE IF NOT EXISTS "VendorDocument" (
  "id"               TEXT PRIMARY KEY,
  "vendorId"         TEXT NOT NULL,
  "docType"          "VendorDocType" NOT NULL,
  "title"            TEXT,
  "fileName"         TEXT NOT NULL,
  "fileUrl"          TEXT NOT NULL,
  "fileSize"         INTEGER NOT NULL,
  "mimeType"         TEXT NOT NULL,
  "status"           "VendorDocStatus" NOT NULL DEFAULT 'SUBMITTED',
  "uploadedByUserId" TEXT NOT NULL,
  "uploadedOnBehalf" BOOLEAN NOT NULL DEFAULT false,
  "reviewedByUserId" TEXT,
  "reviewedAt"       TIMESTAMP(3),
  "reviewNote"       TEXT,
  "changeRequestId"  TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VendorDocument_vendorId_fkey" FOREIGN KEY ("vendorId")
    REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "VendorDocument_changeRequestId_fkey" FOREIGN KEY ("changeRequestId")
    REFERENCES "VendorChangeRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "VendorDocument_vendorId_docType_idx"
  ON "VendorDocument"("vendorId","docType");
CREATE INDEX IF NOT EXISTS "VendorDocument_status_idx"
  ON "VendorDocument"("status");
CREATE INDEX IF NOT EXISTS "VendorDocument_changeRequestId_idx"
  ON "VendorDocument"("changeRequestId");

CREATE TABLE IF NOT EXISTS "VendorAuditLog" (
  "id"          TEXT PRIMARY KEY,
  "vendorId"    TEXT NOT NULL,
  "actorUserId" TEXT,
  "actorRole"   TEXT,
  "action"      TEXT NOT NULL,
  "details"     JSONB,
  "ipAddress"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VendorAuditLog_vendorId_fkey" FOREIGN KEY ("vendorId")
    REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "VendorAuditLog_vendorId_createdAt_idx"
  ON "VendorAuditLog"("vendorId","createdAt");
CREATE INDEX IF NOT EXISTS "VendorAuditLog_action_createdAt_idx"
  ON "VendorAuditLog"("action","createdAt");
