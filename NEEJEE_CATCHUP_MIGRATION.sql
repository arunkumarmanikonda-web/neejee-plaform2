-- ════════════════════════════════════════════════════════════════════════════
-- NEEJEE CATCH-UP MIGRATION (Sprint 9.2 → 9.29)
--
-- Idempotent. Safe to run on ANY production DB regardless of prior migrations.
-- Each statement is guarded with IF NOT EXISTS or wrapped in a DO block that
-- traps duplicate_object / duplicate_table / duplicate_column errors.
--
-- HOW TO RUN:
--   1. Open Supabase SQL Editor (Project → SQL Editor → New query)
--   2. Paste this ENTIRE file
--   3. Click RUN
--   4. Wait ~30 seconds. Should complete with NO errors.
--
-- WHAT IT FIXES:
--   • "Product not found" error (missing Category.active column)
--   • All schema columns required by current Prisma schema
--   • Adds missing indexes, foreign keys, defaults
--
-- AFTER RUNNING:
--   Refresh https://www.neejee.com/admin/products → click EDIT → should work.
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- SPRINT_9_2_MIGRATION.sql
-- ════════════════════════════════════════════════════════════════════════════

-- Sprint 9.2 — add AR Try-On eligibility flag to Product.
-- Run this once in Supabase SQL Editor before deploying v23.18.
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "arTryOnEligible" BOOLEAN NOT NULL DEFAULT false;

-- ════════════════════════════════════════════════════════════════════════════
-- SPRINT_9_3_MIGRATION.sql
-- ════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  -- Sprint 9.3 — Pre-orders & Limited Drops migration.
-- Run this once in Supabase SQL Editor before deploying v23.19.

-- 1. Enums
CREATE TYPE "FulfilmentMode" AS ENUM ('IN_STOCK', 'PREORDER', 'LIMITED_DROP');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "DropStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'LIVE', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "PreorderBalanceStatus" AS ENUM ('PENDING', 'AWAITING_PAYMENT', 'PAID', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Product additions
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "fulfilmentMode" "FulfilmentMode" NOT NULL DEFAULT 'IN_STOCK',
  ADD COLUMN IF NOT EXISTS "depositPercent" INTEGER,
  ADD COLUMN IF NOT EXISTS "releaseDate"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "editionSize"    INTEGER,
  ADD COLUMN IF NOT EXISTS "editionSold"    INTEGER NOT NULL DEFAULT 0;

-- 3. Drop model
CREATE TABLE IF NOT EXISTS "Drop" (
  "id"          TEXT NOT NULL,
  "slug"        TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "subtitle"    TEXT,
  "description" TEXT,
  "coverImage"  TEXT,
  "startsAt"    TIMESTAMP(3) NOT NULL,
  "endsAt"      TIMESTAMP(3),
  "productIds"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status"      "DropStatus" NOT NULL DEFAULT 'DRAFT',
  "founderNote" TEXT,
  "seoTitle"    TEXT,
  "seoDesc"     TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Drop_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Drop_slug_key" ON "Drop"("slug");

CREATE INDEX IF NOT EXISTS "Drop_status_startsAt_idx" ON "Drop"("status", "startsAt");

-- 4. Waitlist
CREATE TABLE IF NOT EXISTS "Waitlist" (
  "id"        TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "email"     TEXT NOT NULL,
  "whatsapp"  TEXT,
  "name"      TEXT,
  "source"    TEXT,
  "notified"  BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Waitlist_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Waitlist_productId_email_key" ON "Waitlist"("productId", "email");

CREATE INDEX IF NOT EXISTS "Waitlist_productId_createdAt_idx" ON "Waitlist"("productId", "createdAt");

-- 5. PreorderBalance
CREATE TABLE IF NOT EXISTS "PreorderBalance" (
  "id"             TEXT NOT NULL,
  "orderId"        TEXT NOT NULL,
  "productId"      TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "depositPaise"   INTEGER NOT NULL,
  "balancePaise"   INTEGER NOT NULL,
  "status"         "PreorderBalanceStatus" NOT NULL DEFAULT 'PENDING',
  "dueAt"          TIMESTAMP(3),
  "paidAt"         TIMESTAMP(3),
  "balanceOrderId" TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PreorderBalance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PreorderBalance_userId_status_idx" ON "PreorderBalance"("userId", "status");

CREATE INDEX IF NOT EXISTS "PreorderBalance_productId_status_idx" ON "PreorderBalance"("productId", "status");

-- ════════════════════════════════════════════════════════════════════════════
-- SPRINT_9_3_2_MIGRATION.sql
-- ════════════════════════════════════════════════════════════════════════════

-- v23.20 — OTP + Social Login migration.
-- Run once in Supabase SQL Editor before deploying.

CREATE TABLE IF NOT EXISTS "OtpToken" (
  "id"          TEXT NOT NULL,
  "phone"       TEXT NOT NULL,
  "codeHash"    TEXT NOT NULL,
  "attempts"    INTEGER NOT NULL DEFAULT 0,
  "expiresAt"   TIMESTAMP(3) NOT NULL,
  "consumedAt"  TIMESTAMP(3),
  "ipAddress"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OtpToken_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OtpToken_phone_createdAt_idx" ON "OtpToken"("phone", "createdAt");

CREATE INDEX IF NOT EXISTS "OtpToken_expiresAt_idx" ON "OtpToken"("expiresAt");

-- ════════════════════════════════════════════════════════════════════════════
-- SPRINT_9_4_MIGRATION.sql
-- ════════════════════════════════════════════════════════════════════════════

-- Sprint 9.4 (v23.21) — Vendor, Purchase Orders, COGS, LegalEntity
-- Run this on Supabase BEFORE deploying v23.21.

-- 1. Extend Role enum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'VENDOR';

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'FINANCE';

-- 2. New enums
DO $$ BEGIN
  CREATE TYPE "VendorStatus" AS ENUM ('PENDING','ACTIVE','SUSPENDED','ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PurchaseOrderStatus" AS ENUM
    ('DRAFT','SENT','CONFIRMED','DISPATCHED','RECEIVED','CLOSED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. LegalEntity (single-row settings)
CREATE TABLE IF NOT EXISTS "LegalEntity" (
  "id"                  TEXT PRIMARY KEY,
  "key"                 TEXT NOT NULL UNIQUE DEFAULT 'default',
  "legalName"           TEXT NOT NULL,
  "brandName"           TEXT NOT NULL DEFAULT 'NEEJEE',
  "gstin"               TEXT,
  "pan"                 TEXT,
  "cinNumber"           TEXT,
  "msmeNumber"          TEXT,
  "addressLine1"        TEXT,
  "addressLine2"        TEXT,
  "city"                TEXT,
  "state"               TEXT,
  "pincode"             TEXT,
  "country"             TEXT NOT NULL DEFAULT 'India',
  "bankAccountName"     TEXT,
  "bankAccountNumber"   TEXT,
  "bankIfsc"            TEXT,
  "bankName"            TEXT,
  "bankBranch"          TEXT,
  "contactEmail"        TEXT,
  "contactPhone"        TEXT,
  "authorisedSignatory" TEXT,
  "signatoryTitle"      TEXT,
  "logoUrl"             TEXT,
  "signatureUrl"        TEXT,
  "gstEnabled"          BOOLEAN NOT NULL DEFAULT true,
  "defaultGstRate"      DOUBLE PRECISION NOT NULL DEFAULT 5.0,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Vendor
CREATE TABLE IF NOT EXISTS "Vendor" (
  "id"                  TEXT PRIMARY KEY,
  "userId"              TEXT UNIQUE,
  "legalName"           TEXT NOT NULL,
  "displayName"         TEXT,
  "contactPerson"       TEXT,
  "contactEmail"        TEXT NOT NULL UNIQUE,
  "contactPhone"        TEXT,
  "gstin"               TEXT,
  "pan"                 TEXT,
  "msmeNumber"          TEXT,
  "addressLine1"        TEXT,
  "addressLine2"        TEXT,
  "city"                TEXT,
  "state"               TEXT,
  "pincode"             TEXT,
  "country"             TEXT NOT NULL DEFAULT 'India',
  "bankAccountName"     TEXT,
  "bankAccountNumber"   TEXT,
  "bankIfsc"            TEXT,
  "bankName"            TEXT,
  "paymentTermsDays"    INTEGER NOT NULL DEFAULT 30,
  "defaultLeadTimeDays" INTEGER NOT NULL DEFAULT 14,
  "status"              "VendorStatus" NOT NULL DEFAULT 'PENDING',
  "notes"               TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Vendor_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Vendor_status_idx" ON "Vendor"("status");

CREATE INDEX IF NOT EXISTS "Vendor_contactEmail_idx" ON "Vendor"("contactEmail");

-- 5. VendorMagicToken
CREATE TABLE IF NOT EXISTS "VendorMagicToken" (
  "id"         TEXT PRIMARY KEY,
  "vendorId"   TEXT NOT NULL,
  "tokenHash"  TEXT NOT NULL,
  "purpose"    TEXT NOT NULL DEFAULT 'LOGIN',
  "expiresAt"  TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VendorMagicToken_vendorId_fkey" FOREIGN KEY ("vendorId")
    REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "VendorMagicToken_vendorId_createdAt_idx"
  ON "VendorMagicToken"("vendorId","createdAt");

CREATE INDEX IF NOT EXISTS "VendorMagicToken_expiresAt_idx"
  ON "VendorMagicToken"("expiresAt");

-- 6. PurchaseOrder
CREATE TABLE IF NOT EXISTS "PurchaseOrder" (
  "id"                    TEXT PRIMARY KEY,
  "poNumber"              TEXT NOT NULL UNIQUE,
  "vendorId"              TEXT NOT NULL,
  "status"                "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "vendorNameSnapshot"    TEXT NOT NULL,
  "vendorGstinSnapshot"   TEXT,
  "vendorAddressSnapshot" TEXT,
  "shipToAddress"         TEXT,
  "subtotalPaise"         INTEGER NOT NULL DEFAULT 0,
  "gstPaise"              INTEGER NOT NULL DEFAULT 0,
  "totalPaise"            INTEGER NOT NULL DEFAULT 0,
  "currency"              TEXT NOT NULL DEFAULT 'INR',
  "sentAt"                TIMESTAMP(3),
  "confirmedAt"           TIMESTAMP(3),
  "dispatchedAt"          TIMESTAMP(3),
  "receivedAt"            TIMESTAMP(3),
  "closedAt"              TIMESTAMP(3),
  "cancelledAt"           TIMESTAMP(3),
  "vendorInvoiceNumber"   TEXT,
  "vendorInvoiceUrl"      TEXT,
  "trackingNumber"        TEXT,
  "trackingUrl"           TEXT,
  "expectedDate"          TIMESTAMP(3),
  "notes"                 TEXT,
  "createdById"           TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseOrder_vendorId_fkey" FOREIGN KEY ("vendorId")
    REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PurchaseOrder_vendorId_status_idx"
  ON "PurchaseOrder"("vendorId","status");

CREATE INDEX IF NOT EXISTS "PurchaseOrder_status_createdAt_idx"
  ON "PurchaseOrder"("status","createdAt");

-- 7. PurchaseOrderLine
CREATE TABLE IF NOT EXISTS "PurchaseOrderLine" (
  "id"                    TEXT PRIMARY KEY,
  "purchaseOrderId"       TEXT NOT NULL,
  "productId"             TEXT,
  "variantId"             TEXT,
  "description"           TEXT NOT NULL,
  "sku"                   TEXT,
  "orderedQty"            INTEGER NOT NULL,
  "confirmedQty"          INTEGER,
  "dispatchedQty"         INTEGER,
  "receivedQty"           INTEGER,
  "unitCostPaise"         INTEGER NOT NULL,
  "receivedUnitCostPaise" INTEGER,
  "gstRate"               DOUBLE PRECISION NOT NULL DEFAULT 5.0,
  "notes"                 TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseOrderLine_purchaseOrderId_fkey"
    FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PurchaseOrderLine_purchaseOrderId_idx"
  ON "PurchaseOrderLine"("purchaseOrderId");

CREATE INDEX IF NOT EXISTS "PurchaseOrderLine_productId_idx"
  ON "PurchaseOrderLine"("productId");

-- 8. PurchaseCost (COGS ledger)
CREATE TABLE IF NOT EXISTS "PurchaseCost" (
  "id"              TEXT PRIMARY KEY,
  "productId"       TEXT NOT NULL,
  "variantId"       TEXT,
  "vendorId"        TEXT NOT NULL,
  "purchaseOrderId" TEXT,
  "quantity"        INTEGER NOT NULL,
  "unitCostPaise"   INTEGER NOT NULL,
  "gstRate"         DOUBLE PRECISION NOT NULL DEFAULT 5.0,
  "receivedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes"           TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseCost_vendorId_fkey" FOREIGN KEY ("vendorId")
    REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PurchaseCost_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId")
    REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PurchaseCost_productId_receivedAt_idx"
  ON "PurchaseCost"("productId","receivedAt");

CREATE INDEX IF NOT EXISTS "PurchaseCost_vendorId_receivedAt_idx"
  ON "PurchaseCost"("vendorId","receivedAt");

CREATE INDEX IF NOT EXISTS "PurchaseCost_purchaseOrderId_idx"
  ON "PurchaseCost"("purchaseOrderId");

-- ════════════════════════════════════════════════════════════════════════════
-- SPRINT_9_4_5_MIGRATION.sql
-- ════════════════════════════════════════════════════════════════════════════

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

-- ════════════════════════════════════════════════════════════════════════════
-- SPRINT_9_4_6_MIGRATION.sql
-- ════════════════════════════════════════════════════════════════════════════

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

-- ════════════════════════════════════════════════════════════════════════════
-- SPRINT_9_5_MIGRATION.sql
-- ════════════════════════════════════════════════════════════════════════════

-- Sprint 9.5 (v23.22) — Notification Engine
-- Run AFTER all prior sprint migrations.

DO $$ BEGIN
  CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL','WHATSAPP','SMS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED','SENT','DELIVERED','FAILED','SKIPPED','BOUNCED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "NotificationLog" (
  "id"            TEXT PRIMARY KEY,
  "userId"        TEXT,
  "event"         TEXT NOT NULL,
  "channel"       "NotificationChannel" NOT NULL,
  "recipient"     TEXT NOT NULL,
  "subject"       TEXT,
  "bodySnippet"   TEXT,
  "status"        "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
  "providerId"    TEXT,
  "errorMessage"  TEXT,
  "contextType"   TEXT,
  "contextId"     TEXT,
  "attemptedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt"   TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "NotificationLog_userId_createdAt_idx"
  ON "NotificationLog"("userId","createdAt");

CREATE INDEX IF NOT EXISTS "NotificationLog_event_createdAt_idx"
  ON "NotificationLog"("event","createdAt");

CREATE INDEX IF NOT EXISTS "NotificationLog_status_createdAt_idx"
  ON "NotificationLog"("status","createdAt");

CREATE INDEX IF NOT EXISTS "NotificationLog_contextType_contextId_idx"
  ON "NotificationLog"("contextType","contextId");

-- ════════════════════════════════════════════════════════════════════════════
-- SPRINT_9_6_MIGRATION.sql
-- ════════════════════════════════════════════════════════════════════════════

-- Sprint 9.6 (v23.23) — Finance + Seller + Marketing maker-checker
-- Run AFTER all prior migrations.

-- 1. Role enum extensions
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SELLER_STAFF';

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'FINANCE_OPERATOR';

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MARKETING_OPERATOR';

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MARKETING_MANAGER';

-- 2. New enums (idempotent)
DO $$ BEGIN
  CREATE TYPE "ProductOwnership" AS ENUM ('OWNED','MARKETPLACE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ExpenseGroup" AS ENUM (
    'COGS_DIRECT','OPEX_MARKETING','OPEX_COMMUNICATION','OPEX_SHIPPING',
    'OPEX_PAYMENT','OPEX_PLATFORM','OPEX_PEOPLE','OPEX_OFFICE',
    'OPEX_PROFESSIONAL','OPEX_TAX_OTHER','OPEX_OTHER','WRITE_OFF'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT','PENDING','APPROVED','REJECTED','VOIDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ExpenseSource" AS ENUM (
    'MANUAL','RAZORPAY_WEBHOOK','FAST2SMS_AUTO','RESEND_AUTO','SHIPROCKET_AUTO','IMPORT'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MarketingResourceType" AS ENUM ('CAMPAIGN','EMAIL_BROADCAST','COUPON','BANNER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MarketingApprovalStatus" AS ENUM ('PENDING','APPROVED','REJECTED','WITHDRAWN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SellerDocType" AS ENUM (
    'PAN_CARD','GST_CERTIFICATE','MSME_CERTIFICATE','CANCELLED_CHEQUE',
    'BANK_STATEMENT','ADDRESS_PROOF','AADHAAR_SIGNATORY','SIGNATORY_PHOTO',
    'SELLER_AGREEMENT','PRODUCT_CATALOG','CERTIFICATION','OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SellerDocStatus" AS ENUM ('SUBMITTED','APPROVED','REJECTED','SUPERSEDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SellerChangeRequestStatus" AS ENUM ('PENDING','APPROVED','REJECTED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SellerTeamAccessLevel" AS ENUM ('FULL','INVENTORY_ONLY','FINANCE_ONLY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SellerTeamStatus" AS ENUM ('INVITED','ACTIVE','SUSPENDED','REMOVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "InventorySubmissionType" AS ENUM (
    'NEW_PRODUCT','EDIT_EXISTING','PRICE_UPDATE','INVENTORY_UPDATE','TAKEDOWN_REQUEST'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "InventorySubmissionStatus" AS ENUM (
    'SUBMITTED','UNDER_REVIEW','NEEDS_INFO','APPROVED','PUBLISHED','REJECTED','WITHDRAWN'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Product additions: ownership + takedown
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "ownershipModel"   "ProductOwnership" NOT NULL DEFAULT 'OWNED';

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "takedownAt"       TIMESTAMP(3);

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "takedownReason"   TEXT;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "takedownByUserId" TEXT;

CREATE INDEX IF NOT EXISTS "Product_ownershipModel_idx" ON "Product"("ownershipModel");

CREATE INDEX IF NOT EXISTS "Product_takedownAt_idx" ON "Product"("takedownAt");

-- 4. Finance: ExpenseCategory
CREATE TABLE IF NOT EXISTS "ExpenseCategory" (
  "id"                     TEXT PRIMARY KEY,
  "code"                   TEXT NOT NULL UNIQUE,
  "label"                  TEXT NOT NULL,
  "group"                  "ExpenseGroup" NOT NULL,
  "parentCategoryId"       TEXT,
  "approvalThresholdPaise" INTEGER,
  "isMarketingChannel"     BOOLEAN NOT NULL DEFAULT false,
  "gstInputClaimable"      BOOLEAN NOT NULL DEFAULT true,
  "isActive"               BOOLEAN NOT NULL DEFAULT true,
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExpenseCategory_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId")
    REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ExpenseCategory_group_isActive_idx" ON "ExpenseCategory"("group","isActive");

-- 5. Finance: Expense
CREATE TABLE IF NOT EXISTS "Expense" (
  "id"                 TEXT PRIMARY KEY,
  "categoryId"         TEXT NOT NULL,
  "description"        TEXT NOT NULL,
  "amountPaise"        INTEGER NOT NULL,
  "gstPaise"           INTEGER NOT NULL DEFAULT 0,
  "totalPaise"         INTEGER NOT NULL,
  "incurredOn"         TIMESTAMP(3) NOT NULL,
  "paidOn"             TIMESTAMP(3),
  "vendorId"           TEXT,
  "vendorNameSnapshot" TEXT,
  "invoiceNumber"      TEXT,
  "receiptUrl"         TEXT,
  "status"             "ExpenseStatus" NOT NULL DEFAULT 'DRAFT',
  "createdByUserId"    TEXT NOT NULL,
  "reviewedByUserId"   TEXT,
  "reviewedAt"         TIMESTAMP(3),
  "reviewNote"         TEXT,
  "source"             "ExpenseSource" NOT NULL DEFAULT 'MANUAL',
  "sourceRef"          TEXT,
  "orderId"            TEXT,
  "notes"              TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId")
    REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Expense_categoryId_incurredOn_idx" ON "Expense"("categoryId","incurredOn");

CREATE INDEX IF NOT EXISTS "Expense_status_createdAt_idx" ON "Expense"("status","createdAt");

CREATE INDEX IF NOT EXISTS "Expense_source_sourceRef_idx" ON "Expense"("source","sourceRef");

CREATE INDEX IF NOT EXISTS "Expense_incurredOn_idx" ON "Expense"("incurredOn");

CREATE INDEX IF NOT EXISTS "Expense_paidOn_idx" ON "Expense"("paidOn");

CREATE INDEX IF NOT EXISTS "Expense_orderId_idx" ON "Expense"("orderId");

-- 6. Finance: ReturnEntry
CREATE TABLE IF NOT EXISTS "ReturnEntry" (
  "id"                   TEXT PRIMARY KEY,
  "orderId"              TEXT NOT NULL,
  "orderNumber"          TEXT NOT NULL,
  "returnedOn"           TIMESTAMP(3) NOT NULL,
  "refundedOn"           TIMESTAMP(3),
  "refundedAmountPaise"  INTEGER NOT NULL,
  "reverseShippingPaise" INTEGER NOT NULL DEFAULT 0,
  "damagedValuePaise"    INTEGER NOT NULL DEFAULT 0,
  "restockedValuePaise"  INTEGER NOT NULL DEFAULT 0,
  "lineBreakdown"        JSONB NOT NULL,
  "reason"               TEXT,
  "notes"                TEXT,
  "createdByUserId"      TEXT,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ReturnEntry_returnedOn_idx" ON "ReturnEntry"("returnedOn");

CREATE INDEX IF NOT EXISTS "ReturnEntry_orderId_idx" ON "ReturnEntry"("orderId");

-- 7. Finance: report caches
CREATE TABLE IF NOT EXISTS "FinanceReportCache" (
  "id"          TEXT PRIMARY KEY,
  "reportKey"   TEXT NOT NULL UNIQUE,
  "reportType"  TEXT NOT NULL,
  "method"      TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd"   TIMESTAMP(3) NOT NULL,
  "payload"     JSONB NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"   TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS "FinanceReportCache_reportType_periodStart_idx" ON "FinanceReportCache"("reportType","periodStart");

CREATE TABLE IF NOT EXISTS "FinanceAiSummary" (
  "id"              TEXT PRIMARY KEY,
  "periodStart"     TIMESTAMP(3) NOT NULL,
  "periodEnd"       TIMESTAMP(3) NOT NULL,
  "headlineMetrics" JSONB NOT NULL,
  "narrative"       TEXT NOT NULL,
  "generatedBy"     TEXT,
  "generatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinanceAiSummary_periodStart_periodEnd_key" UNIQUE ("periodStart","periodEnd")
);

CREATE INDEX IF NOT EXISTS "FinanceAiSummary_generatedAt_idx" ON "FinanceAiSummary"("generatedAt");

-- 8. Marketing
CREATE TABLE IF NOT EXISTS "MarketingChannelMap" (
  "id"                TEXT PRIMARY KEY,
  "couponId"          TEXT NOT NULL UNIQUE,
  "expenseCategoryId" TEXT NOT NULL,
  "notes"             TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "MarketingBudget" (
  "id"                TEXT PRIMARY KEY,
  "expenseCategoryId" TEXT NOT NULL,
  "periodYear"        INTEGER NOT NULL,
  "periodMonth"       INTEGER NOT NULL,
  "budgetPaise"       INTEGER NOT NULL,
  "notes"             TEXT,
  "createdByUserId"   TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketingBudget_cat_period_key" UNIQUE ("expenseCategoryId","periodYear","periodMonth")
);

CREATE INDEX IF NOT EXISTS "MarketingBudget_period_idx" ON "MarketingBudget"("periodYear","periodMonth");

CREATE TABLE IF NOT EXISTS "MarketingApprovalRequest" (
  "id"               TEXT PRIMARY KEY,
  "resourceType"     "MarketingResourceType" NOT NULL,
  "resourceId"       TEXT NOT NULL,
  "proposedPayload"  JSONB NOT NULL,
  "status"           "MarketingApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "createdByUserId"  TEXT NOT NULL,
  "reviewedByUserId" TEXT,
  "reviewedAt"       TIMESTAMP(3),
  "reviewNote"       TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "MarketingApprovalRequest_status_createdAt_idx" ON "MarketingApprovalRequest"("status","createdAt");

CREATE INDEX IF NOT EXISTS "MarketingApprovalRequest_resource_idx" ON "MarketingApprovalRequest"("resourceType","resourceId");

-- 9. Seller portal mirror tables
CREATE TABLE IF NOT EXISTS "SellerChangeRequest" (
  "id"                TEXT PRIMARY KEY,
  "sellerId"          TEXT NOT NULL,
  "fieldChanges"      JSONB NOT NULL,
  "reason"            TEXT,
  "status"            "SellerChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedByUserId" TEXT NOT NULL,
  "requestedOnBehalf" BOOLEAN NOT NULL DEFAULT false,
  "reviewedByUserId"  TEXT,
  "reviewedAt"        TIMESTAMP(3),
  "reviewNote"        TEXT,
  "appliedAt"         TIMESTAMP(3),
  "cancelledAt"       TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SellerChangeRequest_sellerId_fkey" FOREIGN KEY ("sellerId")
    REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SellerChangeRequest_sellerId_status_idx" ON "SellerChangeRequest"("sellerId","status");

CREATE TABLE IF NOT EXISTS "SellerDocument" (
  "id"               TEXT PRIMARY KEY,
  "sellerId"         TEXT NOT NULL,
  "docType"          "SellerDocType" NOT NULL,
  "title"            TEXT,
  "fileName"         TEXT NOT NULL,
  "fileUrl"          TEXT NOT NULL,
  "fileSize"         INTEGER NOT NULL,
  "mimeType"         TEXT NOT NULL,
  "status"           "SellerDocStatus" NOT NULL DEFAULT 'SUBMITTED',
  "uploadedByUserId" TEXT NOT NULL,
  "uploadedOnBehalf" BOOLEAN NOT NULL DEFAULT false,
  "reviewedByUserId" TEXT,
  "reviewedAt"       TIMESTAMP(3),
  "reviewNote"       TEXT,
  "changeRequestId"  TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SellerDocument_sellerId_fkey" FOREIGN KEY ("sellerId")
    REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SellerDocument_changeRequestId_fkey" FOREIGN KEY ("changeRequestId")
    REFERENCES "SellerChangeRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SellerDocument_sellerId_docType_idx" ON "SellerDocument"("sellerId","docType");

CREATE INDEX IF NOT EXISTS "SellerDocument_status_idx" ON "SellerDocument"("status");

CREATE TABLE IF NOT EXISTS "SellerAuditLog" (
  "id"          TEXT PRIMARY KEY,
  "sellerId"    TEXT NOT NULL,
  "actorUserId" TEXT,
  "actorRole"   TEXT,
  "action"      TEXT NOT NULL,
  "details"     JSONB,
  "ipAddress"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SellerAuditLog_sellerId_fkey" FOREIGN KEY ("sellerId")
    REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SellerAuditLog_sellerId_createdAt_idx" ON "SellerAuditLog"("sellerId","createdAt");

CREATE TABLE IF NOT EXISTS "SellerMagicToken" (
  "id"         TEXT PRIMARY KEY,
  "sellerId"   TEXT NOT NULL,
  "tokenHash"  TEXT NOT NULL,
  "purpose"    TEXT NOT NULL DEFAULT 'LOGIN',
  "expiresAt"  TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SellerMagicToken_sellerId_fkey" FOREIGN KEY ("sellerId")
    REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SellerMagicToken_sellerId_createdAt_idx" ON "SellerMagicToken"("sellerId","createdAt");

CREATE TABLE IF NOT EXISTS "SellerTeamMember" (
  "id"              TEXT PRIMARY KEY,
  "sellerId"        TEXT NOT NULL,
  "userId"          TEXT NOT NULL UNIQUE,
  "displayName"     TEXT,
  "email"           TEXT NOT NULL,
  "accessLevel"     "SellerTeamAccessLevel" NOT NULL DEFAULT 'FULL',
  "status"          "SellerTeamStatus" NOT NULL DEFAULT 'INVITED',
  "invitedByUserId" TEXT,
  "invitedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt"      TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SellerTeamMember_sellerId_fkey" FOREIGN KEY ("sellerId")
    REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SellerTeamMember_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SellerTeamMember_sellerId_idx" ON "SellerTeamMember"("sellerId");

CREATE INDEX IF NOT EXISTS "SellerTeamMember_email_idx" ON "SellerTeamMember"("email");

CREATE TABLE IF NOT EXISTS "SellerInventorySubmission" (
  "id"               TEXT PRIMARY KEY,
  "sellerId"         TEXT NOT NULL,
  "submissionType"   "InventorySubmissionType" NOT NULL,
  "proposedData"     JSONB NOT NULL,
  "productId"        TEXT,
  "status"           "InventorySubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
  "createdByUserId"  TEXT NOT NULL,
  "reviewedByUserId" TEXT,
  "reviewedAt"       TIMESTAMP(3),
  "reviewNote"       TEXT,
  "publishedAt"      TIMESTAMP(3),
  "sourceFileUrl"    TEXT,
  "sourceFileName"   TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SellerInventorySubmission_sellerId_fkey" FOREIGN KEY ("sellerId")
    REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SellerInventorySubmission_productId_fkey" FOREIGN KEY ("productId")
    REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SellerInventorySubmission_sellerId_status_idx" ON "SellerInventorySubmission"("sellerId","status");

CREATE INDEX IF NOT EXISTS "SellerInventorySubmission_status_createdAt_idx" ON "SellerInventorySubmission"("status","createdAt");

CREATE TABLE IF NOT EXISTS "SellerCategoryCommission" (
  "id"                TEXT PRIMARY KEY,
  "sellerId"          TEXT NOT NULL,
  "categoryId"        TEXT NOT NULL,
  "commissionPercent" DOUBLE PRECISION NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SellerCategoryCommission_unique" UNIQUE ("sellerId","categoryId")
);

CREATE TABLE IF NOT EXISTS "SellerProductCommission" (
  "id"                TEXT PRIMARY KEY,
  "sellerId"          TEXT NOT NULL,
  "productId"         TEXT NOT NULL,
  "commissionPercent" DOUBLE PRECISION NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SellerProductCommission_unique" UNIQUE ("sellerId","productId")
);

CREATE TABLE IF NOT EXISTS "SellerOrderRelease" (
  "id"               TEXT PRIMARY KEY,
  "orderId"          TEXT NOT NULL,
  "sellerId"         TEXT NOT NULL,
  "productIds"       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "releasedAt"       TIMESTAMP(3),
  "releasedByUserId" TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SellerOrderRelease_orderId_sellerId_key" UNIQUE ("orderId","sellerId")
);

CREATE INDEX IF NOT EXISTS "SellerOrderRelease_sellerId_releasedAt_idx" ON "SellerOrderRelease"("sellerId","releasedAt");

-- ════════════════════════════════════════════════════════════════════════════
-- SPRINT_9_7_MIGRATION.sql
-- ════════════════════════════════════════════════════════════════════════════

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

-- ════════════════════════════════════════════════════════════════════════════
-- SPRINT_9_8_MIGRATION.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- Sprint 9.8 (v23.24) — Compliance
-- TDS certificates, GST e-invoice (IRN), Vendor catalog rates
-- ============================================================================

-- ── Enum ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "EInvoiceStatus" AS ENUM ('PENDING', 'PROCESSING', 'ACTIVE', 'CANCELLED', 'FAILED', 'EXEMPT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── TdsCertificate ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "TdsCertificate" (
  "id"                     TEXT PRIMARY KEY,
  "vendorId"               TEXT NOT NULL,
  "vendorNameSnapshot"     TEXT NOT NULL,
  "vendorPanSnapshot"      TEXT,
  "vendorAddressSnapshot"  TEXT,
  "financialYear"          TEXT NOT NULL,
  "quarter"                INTEGER NOT NULL,
  "periodStart"            TIMESTAMP NOT NULL,
  "periodEnd"              TIMESTAMP NOT NULL,
  "grossPaymentsPaise"     INTEGER NOT NULL DEFAULT 0,
  "tdsDeductedPaise"       INTEGER NOT NULL DEFAULT 0,
  "tdsRate"                DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "section"                TEXT NOT NULL DEFAULT '194Q',
  "certificateNumber"      TEXT UNIQUE,
  "pdfUrl"                 TEXT,
  "issuedAt"               TIMESTAMP,
  "issuedByUserId"         TEXT,
  "tracesReceiptNo"        TEXT,
  "tracesFilingDate"       TIMESTAMP,
  "coveredPayoutIds"       TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt"              TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"              TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "TdsCertificate_vendor_fkey" FOREIGN KEY ("vendorId")
    REFERENCES "Vendor"("id") ON DELETE RESTRICT,
  CONSTRAINT "TdsCertificate_quarter_unique" UNIQUE ("vendorId", "financialYear", "quarter")
);

CREATE INDEX IF NOT EXISTS "TdsCertificate_fy_q_idx" ON "TdsCertificate"("financialYear", "quarter");

-- ── GstEInvoice ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "GstEInvoice" (
  "id"                TEXT PRIMARY KEY,
  "orderId"           TEXT NOT NULL UNIQUE,
  "irn"               TEXT UNIQUE,
  "ackNo"             TEXT,
  "ackDate"           TIMESTAMP,
  "signedQrCode"      TEXT,
  "signedInvoice"     TEXT,
  "status"            "EInvoiceStatus" NOT NULL DEFAULT 'PENDING',
  "errorCode"         TEXT,
  "errorMessage"      TEXT,
  "payload"           JSONB,
  "isManual"          BOOLEAN NOT NULL DEFAULT FALSE,
  "cancelledAt"       TIMESTAMP,
  "cancelReason"      TEXT,
  "createdAt"         TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"         TIMESTAMP NOT NULL DEFAULT NOW(),
  "attemptedByUserId" TEXT
);

CREATE INDEX IF NOT EXISTS "GstEInvoice_status_idx" ON "GstEInvoice"("status");

CREATE INDEX IF NOT EXISTS "GstEInvoice_createdAt_idx" ON "GstEInvoice"("createdAt");

-- ── VendorCatalogItem ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "VendorCatalogItem" (
  "id"                  TEXT PRIMARY KEY,
  "vendorId"            TEXT NOT NULL,
  "vendorSku"           TEXT NOT NULL,
  "description"         TEXT NOT NULL,
  "hsnCode"             TEXT,
  "productId"           TEXT,
  "unitCostPaise"       INTEGER NOT NULL,
  "currency"            TEXT NOT NULL DEFAULT 'INR',
  "gstRate"             DOUBLE PRECISION NOT NULL DEFAULT 5.0,
  "moq"                 INTEGER NOT NULL DEFAULT 1,
  "leadTimeDays"        INTEGER,
  "tieredPricing"       JSONB,
  "validFrom"           TIMESTAMP NOT NULL DEFAULT NOW(),
  "validUntil"          TIMESTAMP,
  "active"              BOOLEAN NOT NULL DEFAULT TRUE,
  "imageUrl"            TEXT,
  "notes"               TEXT,
  "createdByUserId"     TEXT NOT NULL,
  "lastUpdatedByUserId" TEXT,
  "createdAt"           TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"           TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "VendorCatalogItem_vendor_fkey" FOREIGN KEY ("vendorId")
    REFERENCES "Vendor"("id") ON DELETE CASCADE,
  CONSTRAINT "VendorCatalogItem_product_fkey" FOREIGN KEY ("productId")
    REFERENCES "Product"("id") ON DELETE SET NULL,
  CONSTRAINT "VendorCatalogItem_sku_unique" UNIQUE ("vendorId", "vendorSku")
);

CREATE INDEX IF NOT EXISTS "VendorCatalogItem_vendor_active_idx" ON "VendorCatalogItem"("vendorId", "active");

CREATE INDEX IF NOT EXISTS "VendorCatalogItem_product_idx" ON "VendorCatalogItem"("productId");

-- Verify with:
-- SELECT table_name FROM information_schema.tables WHERE table_name IN ('TdsCertificate','GstEInvoice','VendorCatalogItem');

-- ════════════════════════════════════════════════════════════════════════════
-- SPRINT_9_9_MIGRATION.sql
-- ════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  -- Sprint 9.9 (v23.25) — PO chat, disputes, demand forecast
-- Run this in Supabase SQL editor BEFORE deploying the new code.

-- ─────────────────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────────────────
CREATE TYPE "DisputeResourceType" AS ENUM ('ORDER', 'PURCHASE_ORDER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "DisputeCategory" AS ENUM (
  'WRONG_ITEM', 'DAMAGED', 'NOT_RECEIVED', 'QUALITY_ISSUE',
  'SHORT_SHIPMENT', 'LATE_DELIVERY', 'PAYMENT_ISSUE', 'OTHER'
);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "DisputeSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "DisputeStatus" AS ENUM (
  'OPEN', 'AWAITING_CUSTOMER', 'AWAITING_VENDOR', 'UNDER_REVIEW',
  'RESOLVED', 'REJECTED', 'WITHDRAWN'
);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "DisputeEventType" AS ENUM (
  'CREATED', 'COMMENT', 'STATUS_CHANGED', 'EVIDENCE_ADDED',
  'RESOLUTION_PROPOSED', 'RESOLVED'
);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ForecastScope" AS ENUM ('GLOBAL', 'CATEGORY', 'PRODUCT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- PoMessage
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PoMessage" (
  "id"              TEXT PRIMARY KEY,
  "purchaseOrderId" TEXT NOT NULL REFERENCES "PurchaseOrder"(id) ON DELETE CASCADE,
  "authorUserId"    TEXT NOT NULL,
  "authorRole"      TEXT NOT NULL,
  "authorName"      TEXT NOT NULL,
  "body"            TEXT NOT NULL,
  "attachments"     TEXT[] NOT NULL DEFAULT '{}',
  "readByVendorAt"  TIMESTAMP(3),
  "readByAdminAt"   TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PoMessage_purchaseOrderId_createdAt_idx"
  ON "PoMessage"("purchaseOrderId", "createdAt");

-- ─────────────────────────────────────────────────────────────────────────
-- Dispute + DisputeEvent
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Dispute" (
  "id"                   TEXT PRIMARY KEY,
  "resourceType"         "DisputeResourceType" NOT NULL,
  "orderId"              TEXT REFERENCES "Order"(id) ON DELETE CASCADE,
  "purchaseOrderId"      TEXT REFERENCES "PurchaseOrder"(id) ON DELETE CASCADE,
  "vendorId"             TEXT,
  "sellerId"             TEXT,
  "customerUserId"       TEXT,
  "raisedByUserId"       TEXT NOT NULL,
  "raisedByRole"         TEXT NOT NULL,
  "category"             "DisputeCategory" NOT NULL,
  "severity"             "DisputeSeverity" NOT NULL DEFAULT 'MEDIUM',
  "status"               "DisputeStatus" NOT NULL DEFAULT 'OPEN',
  "title"                TEXT NOT NULL,
  "description"          TEXT NOT NULL,
  "evidenceUrls"         TEXT[] NOT NULL DEFAULT '{}',
  "resolutionNote"       TEXT,
  "resolutionAmountPaise" INTEGER,
  "resolvedAt"           TIMESTAMP(3),
  "resolvedByUserId"     TEXT,
  "dueBy"                TIMESTAMP(3),
  "firstResponseAt"      TIMESTAMP(3),
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Dispute_resourceType_status_idx"     ON "Dispute"("resourceType", "status");

CREATE INDEX IF NOT EXISTS "Dispute_vendorId_status_idx"         ON "Dispute"("vendorId", "status");

CREATE INDEX IF NOT EXISTS "Dispute_sellerId_status_idx"         ON "Dispute"("sellerId", "status");

CREATE INDEX IF NOT EXISTS "Dispute_customerUserId_status_idx"   ON "Dispute"("customerUserId", "status");

CREATE INDEX IF NOT EXISTS "Dispute_createdAt_idx"               ON "Dispute"("createdAt");

CREATE TABLE IF NOT EXISTS "DisputeEvent" (
  "id"          TEXT PRIMARY KEY,
  "disputeId"   TEXT NOT NULL REFERENCES "Dispute"(id) ON DELETE CASCADE,
  "actorUserId" TEXT,
  "actorRole"   TEXT,
  "type"        "DisputeEventType" NOT NULL,
  "body"        TEXT,
  "fromStatus"  "DisputeStatus",
  "toStatus"    "DisputeStatus",
  "attachments" TEXT[] NOT NULL DEFAULT '{}',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "DisputeEvent_disputeId_createdAt_idx"
  ON "DisputeEvent"("disputeId", "createdAt");

-- ─────────────────────────────────────────────────────────────────────────
-- ForecastSnapshot
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ForecastSnapshot" (
  "id"                TEXT PRIMARY KEY,
  "scope"             "ForecastScope" NOT NULL,
  "productId"         TEXT,
  "categoryId"        TEXT,
  "windowStartDate"   TIMESTAMP(3) NOT NULL,
  "windowEndDate"     TIMESTAMP(3) NOT NULL,
  "horizonDays"       INTEGER NOT NULL DEFAULT 90,
  "series"            JSONB NOT NULL,
  "diagnostics"       JSONB NOT NULL,
  "reorderHint"       TEXT,
  "daysUntilStockout" INTEGER,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"         TIMESTAMP(3) NOT NULL
);

-- Composite unique with NULLS NOT DISTINCT so (GLOBAL, null, null) is unique
CREATE UNIQUE INDEX IF NOT EXISTS "ForecastSnapshot_scope_productId_categoryId_key"
  ON "ForecastSnapshot"("scope", COALESCE("productId", ''), COALESCE("categoryId", ''));

CREATE INDEX IF NOT EXISTS "ForecastSnapshot_scope_expiresAt_idx"
  ON "ForecastSnapshot"("scope", "expiresAt");

-- ════════════════════════════════════════════════════════════════════════════
-- SPRINT_9_10_MIGRATION.sql
-- ════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  -- Sprint 9.10 (v23.26) — AI Photo Studio
-- Run BEFORE deploying.

CREATE TYPE "AiPhotoJobStatus" AS ENUM (
  'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'
);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "AiPhotoDecision" AS ENUM (
  'PENDING', 'APPROVED', 'REJECTED', 'ARCHIVED'
);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "AiPhotoStrategy" AS ENUM (
  'SAREE_ON_MODEL', 'LEHENGA_ON_MODEL', 'KURTA_ON_MODEL',
  'JEWELLERY_NECKLACE_ON_MODEL', 'JEWELLERY_EARRING_ON_MODEL',
  'JEWELLERY_BANGLE_ON_MODEL', 'JEWELLERY_RING_ON_HAND',
  'FURNITURE_IN_ROOM', 'LAMP_ON_CONSOLE', 'DECOR_ON_SHELF',
  'POTTERY_TABLE_SETTING', 'RUG_FLOOR_TOP_DOWN', 'PAINTING_ON_WALL',
  'GENERIC_LIFESTYLE'
);
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "AiPhotoJob" (
  "id"                TEXT PRIMARY KEY,
  "productId"         TEXT REFERENCES "Product"(id) ON DELETE SET NULL,
  "categorySlug"      TEXT,
  "strategy"          "AiPhotoStrategy" NOT NULL,
  "sourceImageUrls"   TEXT[] NOT NULL DEFAULT '{}',
  "variantCount"      INTEGER NOT NULL DEFAULT 6,
  "modelArchetype"    TEXT,
  "stylePreset"       TEXT,
  "addScaleShot"      BOOLEAN NOT NULL DEFAULT false,
  "imagePrompt"       TEXT,
  "status"            "AiPhotoJobStatus" NOT NULL DEFAULT 'QUEUED',
  "errorMessage"      TEXT,
  "startedAt"         TIMESTAMP(3),
  "completedAt"       TIMESTAMP(3),
  "requestedByUserId" TEXT NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AiPhotoJob_productId_status_idx"    ON "AiPhotoJob"("productId", "status");

CREATE INDEX IF NOT EXISTS "AiPhotoJob_requestedByUserId_createdAt_idx"
  ON "AiPhotoJob"("requestedByUserId", "createdAt");

CREATE TABLE IF NOT EXISTS "AiPhotoVariant" (
  "id"                TEXT PRIMARY KEY,
  "jobId"             TEXT NOT NULL REFERENCES "AiPhotoJob"(id) ON DELETE CASCADE,
  "url"               TEXT NOT NULL,
  "sceneType"         TEXT NOT NULL,
  "sceneNote"         TEXT,
  "decision"          "AiPhotoDecision" NOT NULL DEFAULT 'PENDING',
  "decidedAt"         TIMESTAMP(3),
  "decidedByUserId"   TEXT,
  "productImageIndex" INTEGER,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AiPhotoVariant_jobId_decision_idx" ON "AiPhotoVariant"("jobId", "decision");

-- ════════════════════════════════════════════════════════════════════════════
-- SPRINT_9_11_MIGRATION.sql
-- ════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  -- Sprint 9.11 (v23.27) — AI Photo Studio polish
-- Adds vendor-side workflow + regeneration feedback.
-- Run BEFORE deploying.

CREATE TYPE "AiPhotoRequestStatus" AS ENUM (
  'SUBMITTED', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED'
);
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "AiPhotoRequest" (
  "id"                TEXT PRIMARY KEY,
  "vendorId"          TEXT NOT NULL REFERENCES "Vendor"(id) ON DELETE CASCADE,
  "productId"         TEXT REFERENCES "Product"(id) ON DELETE SET NULL,
  "description"       TEXT NOT NULL,
  "proposedCategory"  TEXT,
  "sourceImageUrls"   TEXT[] NOT NULL DEFAULT '{}',
  "status"            "AiPhotoRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
  "resultingJobId"    TEXT,
  "adminNote"         TEXT,
  "reviewedByUserId"  TEXT,
  "reviewedAt"        TIMESTAMP(3),
  "requestedByUserId" TEXT NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AiPhotoRequest_vendorId_status_idx"  ON "AiPhotoRequest"("vendorId", "status");

CREATE INDEX IF NOT EXISTS "AiPhotoRequest_status_createdAt_idx" ON "AiPhotoRequest"("status", "createdAt");

-- New columns on AiPhotoJob for regeneration + request linking
ALTER TABLE "AiPhotoJob"
  ADD COLUMN IF NOT EXISTS "regenerationFeedback" TEXT,
  ADD COLUMN IF NOT EXISTS "triggeredByRequestId" TEXT;

-- ════════════════════════════════════════════════════════════════════════════
-- SPRINT_9_12_MIGRATION.sql
-- ════════════════════════════════════════════════════════════════════════════

-- Sprint 9.12 (v23.29) — Variant-aware images & per-colour AI photo studio
-- Run BEFORE deploying.

-- Variant gets its own gallery and an optional hex colour for swatch display.
ALTER TABLE "Variant"
  ADD COLUMN IF NOT EXISTS "images"   TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "colorHex" TEXT;

-- AiPhotoJob can now be scoped to a Variant (nullable — products without
-- variants continue to work exactly as before).
ALTER TABLE "AiPhotoJob"
  ADD COLUMN IF NOT EXISTS "variantId" TEXT;

-- Add the FK (SET NULL on variant delete so we don't lose job history)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'AiPhotoJob_variantId_fkey'
      AND table_name = 'AiPhotoJob'
  ) THEN
    ALTER TABLE "AiPhotoJob"
      ADD CONSTRAINT "AiPhotoJob_variantId_fkey"
      FOREIGN KEY ("variantId") REFERENCES "Variant"(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Index for filtering jobs by variant
CREATE INDEX IF NOT EXISTS "AiPhotoJob_variantId_idx" ON "AiPhotoJob"("variantId");

-- ════════════════════════════════════════════════════════════════════════════
-- SPRINT_9_13_MIGRATION.sql
-- ════════════════════════════════════════════════════════════════════════════

-- Sprint 9.13 (v23.30) — Weekly auto-curated journals
-- Run BEFORE deploying.

-- JournalDraft holds AI-generated journal entries pending review.
-- On approval the draft is materialised into a CmsPage row (pageType='journal').
CREATE TABLE IF NOT EXISTS "JournalDraft" (
  "id"               TEXT PRIMARY KEY,
  "title"            TEXT NOT NULL,
  "excerpt"          TEXT,
  "body"             TEXT NOT NULL,
  "coverImage"       TEXT,
  "coverImagePrompt" TEXT,
  "tags"             TEXT[] NOT NULL DEFAULT '{}',
  "seedTheme"        TEXT,                          -- e.g. "artisan-spotlight", "craft-technique"
  "seedRef"          TEXT,                          -- optional referent (product slug, craft slug, etc.)
  "status"           TEXT NOT NULL DEFAULT 'PENDING_REVIEW',  -- DRAFT | PENDING_REVIEW | APPROVED | REJECTED | PUBLISHED
  "approvalToken"    TEXT UNIQUE,                   -- magic link token
  "reviewerNote"     TEXT,
  "reviewedByUserId" TEXT,
  "reviewedAt"       TIMESTAMPTZ,
  "publishedPageId"  TEXT,                          -- CmsPage.id when status=PUBLISHED
  "createdByCron"    BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "JournalDraft_status_idx" ON "JournalDraft"("status");

CREATE INDEX IF NOT EXISTS "JournalDraft_createdAt_idx" ON "JournalDraft"("createdAt" DESC);

-- Track which seeds we've used recently (to avoid repetition across weeks)
CREATE TABLE IF NOT EXISTS "JournalSeedLog" (
  "id"        TEXT PRIMARY KEY,
  "theme"     TEXT NOT NULL,
  "seedRef"   TEXT,
  "usedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "draftId"   TEXT
);

CREATE INDEX IF NOT EXISTS "JournalSeedLog_usedAt_idx" ON "JournalSeedLog"("usedAt" DESC);

-- ════════════════════════════════════════════════════════════════════════════
-- SPRINT_9_14_MIGRATION.sql
-- ════════════════════════════════════════════════════════════════════════════

-- Sprint 9.14 (v23.32) — Configurable shipping zones
-- Run BEFORE deploying.

CREATE TABLE IF NOT EXISTS "ShippingZone" (
  "id"                     TEXT PRIMARY KEY,
  "name"                   TEXT NOT NULL,
  "pincodePrefixes"        TEXT[] NOT NULL DEFAULT '{}',
  "pincodeExact"           TEXT[] NOT NULL DEFAULT '{}',
  "states"                 TEXT[] NOT NULL DEFAULT '{}',
  "isDefault"              BOOLEAN NOT NULL DEFAULT FALSE,
  "standardPaise"          INTEGER NOT NULL DEFAULT 15000,
  "expressPaise"           INTEGER NOT NULL DEFAULT 25000,
  "freeAboveSubtotalPaise" INTEGER NOT NULL DEFAULT 250000,
  "inclusive"              BOOLEAN NOT NULL DEFAULT FALSE,
  "priority"               INTEGER NOT NULL DEFAULT 100,
  "active"                 BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ShippingZone_active_priority_idx" ON "ShippingZone"("active", "priority" DESC);

CREATE INDEX IF NOT EXISTS "ShippingZone_isDefault_idx"        ON "ShippingZone"("isDefault");

-- Seed a sensible default zone if no zones exist
INSERT INTO "ShippingZone" (
  "id", "name", "isDefault", "standardPaise", "expressPaise", "freeAboveSubtotalPaise", "inclusive", "priority", "active"
)
SELECT
  'zone_default_rest_of_india',
  'Rest of India (default)',
  TRUE,
  15000,
  25000,
  250000,
  FALSE,
  0,
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM "ShippingZone");

-- ════════════════════════════════════════════════════════════════════════════
-- SPRINT_9_15_MIGRATION.sql
-- ════════════════════════════════════════════════════════════════════════════

-- Sprint 9.15 (v23.33) — Craft model + Category admin fields
-- Run BEFORE deploying.

-- ─── Craft model ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Craft" (
  "id"          TEXT PRIMARY KEY,
  "slug"        TEXT UNIQUE NOT NULL,
  "name"        TEXT NOT NULL,
  "region"      TEXT,
  "state"       TEXT,
  "description" TEXT,
  "longStory"   TEXT,
  "image"       TEXT,
  "thumbnail"   TEXT,
  "seoTitle"    TEXT,
  "seoDesc"     TEXT,
  "featured"    BOOLEAN NOT NULL DEFAULT FALSE,
  "active"      BOOLEAN NOT NULL DEFAULT TRUE,
  "order"       INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "Craft_active_order_idx" ON "Craft"("active", "order");

CREATE INDEX IF NOT EXISTS "Craft_featured_idx"      ON "Craft"("featured");

-- ─── Category extensions ──────────────────────────────────────────
ALTER TABLE "Category"
  ADD COLUMN IF NOT EXISTS "active"    BOOLEAN     NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "featured"  BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS "Category_active_order_idx" ON "Category"("active", "order");

CREATE INDEX IF NOT EXISTS "Category_featured_idx"     ON "Category"("featured");

-- ─── Seed crafts from existing distinct Product.craft values ────────
-- Best-effort: copies each unique craft into the new table so admins
-- can curate them. No-op if Craft already populated.
INSERT INTO "Craft" ("id", "slug", "name", "active", "order")
SELECT
  'craft_' || lower(regexp_replace(p.craft, '[^a-zA-Z0-9]+', '_', 'g')),
  lower(regexp_replace(p.craft, '[^a-zA-Z0-9]+', '-', 'g')),
  p.craft,
  TRUE,
  0
FROM (SELECT DISTINCT craft FROM "Product" WHERE craft IS NOT NULL AND craft != '') p
ON CONFLICT (slug) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- SPRINT_9_16_MIGRATION.sql
-- ════════════════════════════════════════════════════════════════════════════

-- Sprint 9.16 (v23.34) — RazorpayX payouts integration
-- Run BEFORE deploying.

-- ─── Vendor: cache RazorpayX contact + fund_account ids ──────────
ALTER TABLE "Vendor"
  ADD COLUMN IF NOT EXISTS "rzpxContactId"     TEXT,
  ADD COLUMN IF NOT EXISTS "rzpxFundAccountId" TEXT;

-- ─── Seller: cache RazorpayX references ──────────────────────────
ALTER TABLE "Seller"
  ADD COLUMN IF NOT EXISTS "rzpxContactId"     TEXT,
  ADD COLUMN IF NOT EXISTS "rzpxFundAccountId" TEXT;

-- ─── Payout (seller): RazorpayX trace fields ─────────────────────
ALTER TABLE "Payout"
  ADD COLUMN IF NOT EXISTS "rzpxPayoutId"     TEXT,
  ADD COLUMN IF NOT EXISTS "rzpxStatus"       TEXT,
  ADD COLUMN IF NOT EXISTS "rzpxFailReason"   TEXT,
  ADD COLUMN IF NOT EXISTS "initiatedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "initiatedAt"      TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "Payout_rzpxPayoutId_idx" ON "Payout"("rzpxPayoutId");

-- ─── VendorPayout: RazorpayX trace fields ────────────────────────
ALTER TABLE "VendorPayout"
  ADD COLUMN IF NOT EXISTS "rzpxPayoutId"     TEXT,
  ADD COLUMN IF NOT EXISTS "rzpxStatus"       TEXT,
  ADD COLUMN IF NOT EXISTS "rzpxFailReason"   TEXT,
  ADD COLUMN IF NOT EXISTS "initiatedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "initiatedAt"      TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "VendorPayout_rzpxPayoutId_idx" ON "VendorPayout"("rzpxPayoutId");

-- ════════════════════════════════════════════════════════════════════════════
-- SPRINT_9_17_MIGRATION.sql
-- ════════════════════════════════════════════════════════════════════════════

-- v23.35 SMS + OTP migration
-- Run in Supabase SQL editor before deploy.

CREATE TABLE IF NOT EXISTS "SmsTemplate" (
  "id"          TEXT PRIMARY KEY,
  "event"       TEXT NOT NULL UNIQUE,
  "label"       TEXT NOT NULL,
  "templateId"  TEXT NOT NULL,
  "body"        TEXT NOT NULL,
  "varOrder"    TEXT[] NOT NULL DEFAULT '{}',
  "category"    TEXT NOT NULL DEFAULT 'transactional',
  "active"      BOOLEAN NOT NULL DEFAULT TRUE,
  "notes"       TEXT,
  "lastUsedAt"  TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL
);

CREATE INDEX IF NOT EXISTS "SmsTemplate_event_active_idx" ON "SmsTemplate"("event","active");

CREATE TABLE IF NOT EXISTS "OtpCode" (
  "id"          TEXT PRIMARY KEY,
  "phone"       TEXT NOT NULL,
  "codeHash"    TEXT NOT NULL,
  "purpose"     TEXT NOT NULL,
  "attempts"    INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "expiresAt"   TIMESTAMP(3) NOT NULL,
  "consumedAt"  TIMESTAMP(3),
  "ipAddress"   TEXT,
  "userAgent"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "OtpCode_phone_purpose_consumedAt_idx" ON "OtpCode"("phone","purpose","consumedAt");

CREATE INDEX IF NOT EXISTS "OtpCode_expiresAt_idx" ON "OtpCode"("expiresAt");

-- Seed empty rows for the 10 approved events. Paste real templateId via /admin/settings/sms.
INSERT INTO "SmsTemplate" ("id","event","label","templateId","body","varOrder","category","updatedAt") VALUES
  ('seed_otp',       'otp_login',        'OTP Login',                    'PASTE_DLT_ID', '{#var#} is your NEEJEE login OTP. Valid for 5 minutes. Do not share with anyone.', ARRAY['otp'],                              'transactional',   NOW()),
  ('seed_op',        'order_placed',     'Order Placed',                 'PASTE_DLT_ID', 'NEEJEE: Order {#var#} received. Total Rs.{#var#}. Track at neejee.com/account',     ARRAY['orderNumber','total'],              'transactional',   NOW()),
  ('seed_pc',        'payment_confirmed','Payment Confirmed',            'PASTE_DLT_ID', 'NEEJEE: Payment confirmed for order {#var#}. Preparing for dispatch.',              ARRAY['orderNumber'],                      'transactional',   NOW()),
  ('seed_sh',        'order_shipped',    'Order Shipped',                'PASTE_DLT_ID', 'NEEJEE: Order {#var#} shipped via {#var#}. Track: {#var#}',                          ARRAY['orderNumber','courier','tracking'], 'service_implicit',NOW()),
  ('seed_dl',        'order_delivered',  'Order Delivered',              'PASTE_DLT_ID', 'NEEJEE: Order {#var#} has been delivered. Welcome home.',                            ARRAY['orderNumber'],                      'service_implicit',NOW()),
  ('seed_cn',        'order_cancelled',  'Order Cancelled',              'PASTE_DLT_ID', 'NEEJEE: Order {#var#} has been cancelled. Refund (if applicable) initiated.',       ARRAY['orderNumber'],                      'service_implicit',NOW()),
  ('seed_rf',        'refund_initiated', 'Refund Initiated',             'PASTE_DLT_ID', 'NEEJEE: Refund of Rs.{#var#} initiated for order {#var#}. Reflects in 5-7 working days.', ARRAY['amount','orderNumber'],         'transactional',   NOW()),
  ('seed_ab',        'abandoned_cart',   'Abandoned Cart Nudge',         'PASTE_DLT_ID', 'NEEJEE: You left something behind. Complete your order at neejee.com/cart before it sells out.', ARRAY[]::TEXT[],            'service_explicit',NOW()),
  ('seed_sp',        'seller_payout',    'Seller Payout Paid',           'PASTE_DLT_ID', 'NEEJEE: Payout of Rs.{#var#} credited to your account. UTR: {#var#}',               ARRAY['amount','utr'],                     'transactional',   NOW()),
  ('seed_vp',        'vendor_payout',    'Vendor Payout Paid',           'PASTE_DLT_ID', 'NEEJEE: Payout of Rs.{#var#} processed for invoice {#var#}. UTR: {#var#}',           ARRAY['amount','invoice','utr'],           'transactional',   NOW())
ON CONFLICT ("event") DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- SPRINT_9_18_MIGRATION.sql
-- ════════════════════════════════════════════════════════════════════════════

-- v23.36 — Update SMS template bodies to use NEEJEY sender (NEEJEE was unavailable in TRAI registry)
-- Run AFTER SPRINT_9_17_MIGRATION.sql. Safe to run multiple times (idempotent).

-- Update bodies for all 10 events to reference NEEJEY brand
UPDATE "SmsTemplate" SET "body" = '{#var#} is your NEEJEY login OTP. Valid for 5 minutes. Do not share with anyone.',
    "updatedAt" = NOW()
  WHERE "event" = 'otp_login';

UPDATE "SmsTemplate" SET "body" = 'NEEJEY: Order {#var#} received. Total Rs.{#var#}. Track at neejee.com/account',
    "updatedAt" = NOW()
  WHERE "event" = 'order_placed';

UPDATE "SmsTemplate" SET "body" = 'NEEJEY: Payment confirmed for order {#var#}. Preparing for dispatch.',
    "updatedAt" = NOW()
  WHERE "event" = 'payment_confirmed';

UPDATE "SmsTemplate" SET "body" = 'NEEJEY: Order {#var#} shipped via {#var#}. Track: {#var#}',
    "updatedAt" = NOW()
  WHERE "event" = 'order_shipped';

UPDATE "SmsTemplate" SET "body" = 'NEEJEY: Order {#var#} has been delivered. Welcome home.',
    "updatedAt" = NOW()
  WHERE "event" = 'order_delivered';

UPDATE "SmsTemplate" SET "body" = 'NEEJEY: Order {#var#} has been cancelled. Refund (if applicable) initiated.',
    "updatedAt" = NOW()
  WHERE "event" = 'order_cancelled';

UPDATE "SmsTemplate" SET "body" = 'NEEJEY: Refund of Rs.{#var#} initiated for order {#var#}. Reflects in 5-7 working days.',
    "updatedAt" = NOW()
  WHERE "event" = 'refund_initiated';

UPDATE "SmsTemplate" SET "body" = 'NEEJEY: You left something behind. Complete your order at neejee.com/cart before it sells out.',
    "updatedAt" = NOW()
  WHERE "event" = 'abandoned_cart';

UPDATE "SmsTemplate" SET "body" = 'NEEJEY: Payout of Rs.{#var#} credited to your account. UTR: {#var#}',
    "updatedAt" = NOW()
  WHERE "event" = 'seller_payout';

UPDATE "SmsTemplate" SET "body" = 'NEEJEY: Payout of Rs.{#var#} processed for invoice {#var#}. UTR: {#var#}',
    "updatedAt" = NOW()
  WHERE "event" = 'vendor_payout';

-- Verify
SELECT "event", "label", LEFT("body", 60) AS body_preview, "templateId", "active"
  FROM "SmsTemplate"
  ORDER BY "event";

-- ════════════════════════════════════════════════════════════════════════════
-- SPRINT_9_19_MIGRATION.sql
-- ════════════════════════════════════════════════════════════════════════════

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

-- ════════════════════════════════════════════════════════════════════════════
-- SPRINT_9_20_MIGRATION.sql
-- ════════════════════════════════════════════════════════════════════════════

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

-- ════════════════════════════════════════════════════════════════════════════
-- SPRINT_9_21_MIGRATION.sql
-- ════════════════════════════════════════════════════════════════════════════

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

-- ════════════════════════════════════════════════════════════════════════════
-- SPRINT_9_22_MIGRATION.sql
-- ════════════════════════════════════════════════════════════════════════════

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

-- ════════════════════════════════════════════════════════════════════════════
-- SPRINT_9_23_MIGRATION.sql
-- ════════════════════════════════════════════════════════════════════════════

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

DO $$ BEGIN
  ALTER TABLE "ReimbursementPolicy"
  ADD CONSTRAINT "ReimbursementPolicy_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

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

DO $$ BEGIN
  ALTER TABLE "IncentivePlan"
  ADD CONSTRAINT "IncentivePlan_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

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

DO $$ BEGIN
  ALTER TABLE "FnFSettlement"
  ADD CONSTRAINT "FnFSettlement_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- SPRINT_9_24_MIGRATION.sql
-- ════════════════════════════════════════════════════════════════════════════

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

DO $$ BEGIN
  ALTER TABLE "ExpensePayment"
  ADD CONSTRAINT "ExpensePayment_expenseId_fkey"
  FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- SPRINT_9_25_MIGRATION.sql
-- ════════════════════════════════════════════════════════════════════════════

-- v23.40.5 — Revenue & Sales Ledger layer.
-- Run this in Supabase SQL Editor BEFORE deploying v23.40.5.

------------------------------------------------------------------
-- RevenueEntry
------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "RevenueEntry" (
  "id"             TEXT NOT NULL,
  "orderId"        TEXT,
  "orderItemId"    TEXT,
  "invoiceId"      TEXT,
  "invoiceLineId"  TEXT,
  "type"           TEXT NOT NULL,
  "channel"        TEXT NOT NULL,
  "saleType"       TEXT NOT NULL,
  "amountPaise"    INTEGER NOT NULL,
  "gstRatePercent" DOUBLE PRECISION,
  "cgstPaise"      INTEGER NOT NULL DEFAULT 0,
  "sgstPaise"      INTEGER NOT NULL DEFAULT 0,
  "igstPaise"      INTEGER NOT NULL DEFAULT 0,
  "hsnSac"         TEXT,
  "customerUserId" TEXT,
  "customerName"   TEXT,
  "sellerId"       TEXT,
  "productId"      TEXT,
  "variantId"      TEXT,
  "status"         TEXT NOT NULL DEFAULT 'ACCRUED',
  "realizedOn"     TIMESTAMP(3),
  "paymentRef"     TEXT,
  "txnDate"        TIMESTAMP(3) NOT NULL,
  "monthBucket"    TEXT NOT NULL,
  "sourceHash"     TEXT NOT NULL,
  "postedByUserId" TEXT,
  "notes"          TEXT,
  "reversedById"   TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RevenueEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RevenueEntry_sourceHash_key" ON "RevenueEntry"("sourceHash");

CREATE INDEX IF NOT EXISTS "RevenueEntry_orderId_idx"               ON "RevenueEntry"("orderId");

CREATE INDEX IF NOT EXISTS "RevenueEntry_invoiceId_idx"             ON "RevenueEntry"("invoiceId");

CREATE INDEX IF NOT EXISTS "RevenueEntry_type_monthBucket_idx"      ON "RevenueEntry"("type", "monthBucket");

CREATE INDEX IF NOT EXISTS "RevenueEntry_channel_monthBucket_idx"   ON "RevenueEntry"("channel", "monthBucket");

CREATE INDEX IF NOT EXISTS "RevenueEntry_saleType_monthBucket_idx"  ON "RevenueEntry"("saleType", "monthBucket");

CREATE INDEX IF NOT EXISTS "RevenueEntry_sellerId_monthBucket_idx"  ON "RevenueEntry"("sellerId", "monthBucket");

CREATE INDEX IF NOT EXISTS "RevenueEntry_customerUserId_idx"        ON "RevenueEntry"("customerUserId");

CREATE INDEX IF NOT EXISTS "RevenueEntry_status_txnDate_idx"        ON "RevenueEntry"("status", "txnDate");

------------------------------------------------------------------
-- SalesInvoice
------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "SalesInvoice" (
  "id"                  TEXT NOT NULL,
  "invoiceNumber"       TEXT NOT NULL,
  "invoiceType"         TEXT NOT NULL,
  "saleChannel"         TEXT NOT NULL,
  "saleType"            TEXT NOT NULL DEFAULT 'DIRECT',
  "customerUserId"      TEXT,
  "customerName"        TEXT NOT NULL,
  "customerEmail"       TEXT,
  "customerPhone"       TEXT,
  "customerGstin"       TEXT,
  "billingAddress"      TEXT,
  "shippingAddress"     TEXT,
  "sellerId"            TEXT,
  "orderId"             TEXT,
  "issuedOn"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueOn"               TIMESTAMP(3),
  "placeOfSupply"       TEXT,
  "subtotalPaise"       INTEGER NOT NULL DEFAULT 0,
  "discountPaise"       INTEGER NOT NULL DEFAULT 0,
  "taxableValuePaise"   INTEGER NOT NULL DEFAULT 0,
  "cgstPaise"           INTEGER NOT NULL DEFAULT 0,
  "sgstPaise"           INTEGER NOT NULL DEFAULT 0,
  "igstPaise"           INTEGER NOT NULL DEFAULT 0,
  "shippingPaise"       INTEGER NOT NULL DEFAULT 0,
  "shippingTaxPaise"    INTEGER NOT NULL DEFAULT 0,
  "roundOffPaise"       INTEGER NOT NULL DEFAULT 0,
  "totalPaise"          INTEGER NOT NULL DEFAULT 0,
  "paidPaise"           INTEGER NOT NULL DEFAULT 0,
  "paymentStatus"       TEXT NOT NULL DEFAULT 'UNPAID',
  "posted"              BOOLEAN NOT NULL DEFAULT false,
  "postedAt"            TIMESTAMP(3),
  "pdfUrl"              TEXT,
  "attachments"         TEXT[] NOT NULL DEFAULT '{}',
  "notes"               TEXT,
  "createdByUserId"     TEXT NOT NULL,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalesInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SalesInvoice_invoiceNumber_key"  ON "SalesInvoice"("invoiceNumber");

CREATE UNIQUE INDEX IF NOT EXISTS "SalesInvoice_orderId_key"        ON "SalesInvoice"("orderId");

CREATE INDEX        IF NOT EXISTS "SalesInvoice_invoiceType_idx"    ON "SalesInvoice"("invoiceType", "issuedOn");

CREATE INDEX        IF NOT EXISTS "SalesInvoice_sellerId_idx"       ON "SalesInvoice"("sellerId");

CREATE INDEX        IF NOT EXISTS "SalesInvoice_customer_idx"       ON "SalesInvoice"("customerUserId");

CREATE INDEX        IF NOT EXISTS "SalesInvoice_paymentStatus_idx"  ON "SalesInvoice"("paymentStatus", "dueOn");

------------------------------------------------------------------
-- SalesInvoiceLine
------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "SalesInvoiceLine" (
  "id"                  TEXT NOT NULL,
  "invoiceId"           TEXT NOT NULL,
  "productId"           TEXT,
  "variantId"           TEXT,
  "sku"                 TEXT,
  "description"         TEXT NOT NULL,
  "hsnSac"              TEXT,
  "quantity"            DOUBLE PRECISION NOT NULL DEFAULT 1,
  "unitPricePaise"      INTEGER NOT NULL,
  "discountPaise"       INTEGER NOT NULL DEFAULT 0,
  "taxableValuePaise"   INTEGER NOT NULL,
  "gstRatePercent"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "cgstPaise"           INTEGER NOT NULL DEFAULT 0,
  "sgstPaise"           INTEGER NOT NULL DEFAULT 0,
  "igstPaise"           INTEGER NOT NULL DEFAULT 0,
  "totalPaise"          INTEGER NOT NULL,
  "unitCostPaise"       INTEGER,
  "cogsPaise"           INTEGER,
  "saleType"            TEXT NOT NULL DEFAULT 'DIRECT',
  "sellerId"            TEXT,
  "commissionRatePercent"     DOUBLE PRECISION,
  "commissionBaseAmountPaise" INTEGER,
  CONSTRAINT "SalesInvoiceLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SalesInvoiceLine_invoiceId_idx"  ON "SalesInvoiceLine"("invoiceId");

CREATE INDEX IF NOT EXISTS "SalesInvoiceLine_productId_idx"  ON "SalesInvoiceLine"("productId");

CREATE INDEX IF NOT EXISTS "SalesInvoiceLine_sellerId_idx"   ON "SalesInvoiceLine"("sellerId");

ALTER TABLE "SalesInvoiceLine"
  DROP CONSTRAINT IF EXISTS "SalesInvoiceLine_invoiceId_fkey";

DO $$ BEGIN
  ALTER TABLE "SalesInvoiceLine"
  ADD CONSTRAINT "SalesInvoiceLine_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "SalesInvoice"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

------------------------------------------------------------------
-- SalesInvoicePayment
------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "SalesInvoicePayment" (
  "id"              TEXT NOT NULL,
  "invoiceId"       TEXT NOT NULL,
  "amountPaise"     INTEGER NOT NULL,
  "paidOn"          TIMESTAMP(3) NOT NULL,
  "method"          TEXT,
  "reference"       TEXT,
  "notes"           TEXT,
  "receiptUrl"      TEXT,
  "attachments"     TEXT[] NOT NULL DEFAULT '{}',
  "createdByUserId" TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalesInvoicePayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SalesInvoicePayment_invoiceId_idx" ON "SalesInvoicePayment"("invoiceId");

CREATE INDEX IF NOT EXISTS "SalesInvoicePayment_paidOn_idx"    ON "SalesInvoicePayment"("paidOn");

ALTER TABLE "SalesInvoicePayment"
  DROP CONSTRAINT IF EXISTS "SalesInvoicePayment_invoiceId_fkey";

DO $$ BEGIN
  ALTER TABLE "SalesInvoicePayment"
  ADD CONSTRAINT "SalesInvoicePayment_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "SalesInvoice"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

------------------------------------------------------------------
-- PeriodLock
------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "PeriodLock" (
  "id"             TEXT NOT NULL,
  "monthBucket"    TEXT NOT NULL,
  "lockedByUserId" TEXT NOT NULL,
  "lockedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes"          TEXT,
  CONSTRAINT "PeriodLock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PeriodLock_monthBucket_key" ON "PeriodLock"("monthBucket");

------------------------------------------------------------------
-- InvoiceNumberCounter
------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "InvoiceNumberCounter" (
  "id"         TEXT NOT NULL,
  "prefix"     TEXT NOT NULL,
  "yearMonth"  TEXT NOT NULL,
  "lastValue"  INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "InvoiceNumberCounter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InvoiceNumberCounter_prefix_yearMonth_key"
  ON "InvoiceNumberCounter"("prefix", "yearMonth");

------------------------------------------------------------------
-- Cleanup: legacy Expense "PAID" rows without ExpensePayment.
-- v23.40.2 SQL set paymentStatus=PAID for any expense with paidOn IS NOT NULL,
-- but no ExpensePayment record exists. Mark them UNPAID so they show the
-- "PAY" button again. Affected rows are now visible & actionable.
------------------------------------------------------------------
UPDATE "Expense" e
   SET "paymentStatus" = 'UNPAID',
       "paidPaise"     = 0
 WHERE e."paymentStatus" = 'PAID'
   AND NOT EXISTS (SELECT 1 FROM "ExpensePayment" p WHERE p."expenseId" = e."id");

-- ════════════════════════════════════════════════════════════════════════════
-- SPRINT_9_26_MIGRATION.sql
-- ════════════════════════════════════════════════════════════════════════════

-- v23.40.8 — Vendor service categorisation.
-- Run in Supabase SQL Editor BEFORE deploying v23.40.8.

ALTER TABLE "Vendor"
  ADD COLUMN IF NOT EXISTS "serviceCategoryGroup"     TEXT,
  ADD COLUMN IF NOT EXISTS "defaultExpenseCategoryId" TEXT;

-- Optional: auto-categorise existing vendors based on their most-frequent expense category.
-- For each vendor that has at least one expense or bill, find the most-used category group
-- and stamp it as the serviceCategoryGroup.
WITH vendor_top_group AS (
  SELECT
    v."id" AS vendor_id,
    cat."group" AS grp,
    COUNT(*) AS hits,
    ROW_NUMBER() OVER (PARTITION BY v."id" ORDER BY COUNT(*) DESC) AS rnk
  FROM "Vendor" v
  JOIN (
    SELECT "vendorId", "categoryId" FROM "Expense" WHERE "vendorId" IS NOT NULL
    UNION ALL
    SELECT "vendorId", "categoryId" FROM "Bill"    WHERE "vendorId" IS NOT NULL
  ) src ON src."vendorId" = v."id"
  JOIN "ExpenseCategory" cat ON cat."id" = src."categoryId"
  GROUP BY v."id", cat."group"
)
UPDATE "Vendor" v
   SET "serviceCategoryGroup" = vtg.grp
  FROM vendor_top_group vtg
 WHERE vtg.vendor_id = v."id"
   AND vtg.rnk = 1
   AND v."serviceCategoryGroup" IS NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- SPRINT_9_27_MIGRATION.sql
-- ════════════════════════════════════════════════════════════════════════════

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

-- ════════════════════════════════════════════════════════════════════════════
-- SPRINT_9_28_MIGRATION.sql
-- ════════════════════════════════════════════════════════════════════════════

-- v23.40.11 — Customer Profile + AR Ledger
-- Run in Supabase SQL Editor BEFORE deploying v23.40.11.

-- 1. Create Customer table
CREATE TABLE IF NOT EXISTS "Customer" (
  "id"                  TEXT PRIMARY KEY,
  "displayName"         TEXT NOT NULL,
  "legalName"           TEXT,
  "primaryEmail"        TEXT UNIQUE,
  "primaryPhone"        TEXT UNIQUE,
  "gstin"               TEXT,
  "pan"                 TEXT,
  "placeOfSupply"       TEXT,
  "billingAddress"      TEXT,
  "shippingAddress"     TEXT,
  "customerType"        TEXT NOT NULL DEFAULT 'INDIVIDUAL',
  "channel"             TEXT NOT NULL DEFAULT 'WEBSITE',
  "userId"              TEXT UNIQUE,
  "creditLimitPaise"    INTEGER NOT NULL DEFAULT 0,
  "creditDays"          INTEGER NOT NULL DEFAULT 0,
  "status"              TEXT NOT NULL DEFAULT 'ACTIVE',
  "notes"               TEXT,
  "source"              TEXT NOT NULL DEFAULT 'MANUAL',
  "createdByUserId"     TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "Customer_displayName_idx"  ON "Customer"("displayName");

CREATE INDEX IF NOT EXISTS "Customer_customerType_idx" ON "Customer"("customerType");

CREATE INDEX IF NOT EXISTS "Customer_status_idx"       ON "Customer"("status");

CREATE INDEX IF NOT EXISTS "Customer_gstin_idx"        ON "Customer"("gstin");

-- 2. Add customerId to SalesInvoice
ALTER TABLE "SalesInvoice"
  ADD COLUMN IF NOT EXISTS "customerId" TEXT;

CREATE INDEX IF NOT EXISTS "SalesInvoice_customerId_idx" ON "SalesInvoice"("customerId");

-- 3. Auto-updated timestamp trigger (Postgres doesn't auto-update like @updatedAt)
CREATE OR REPLACE FUNCTION update_customer_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS customer_updated_at_trigger ON "Customer";

CREATE TRIGGER customer_updated_at_trigger
  BEFORE UPDATE ON "Customer"
  FOR EACH ROW EXECUTE FUNCTION update_customer_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- SPRINT_9_29_MIGRATION.sql
-- ════════════════════════════════════════════════════════════════════════════

-- v23.40.20 — Marketing automation drip tracking columns.
-- Run in Supabase SQL Editor BEFORE deploying v23.40.20.

-- 1. Order: track when the 7-day post-purchase follow-up was sent
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "postPurchaseSentAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Order_postPurchaseSentAt_idx"
  ON "Order"("postPurchaseSentAt");

-- 2. User: track win-back cooldown (don't pester twice in 60 days)
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "lastWinBackAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "User_lastWinBackAt_idx"
  ON "User"("lastWinBackAt");



-- ════════════════════════════════════════════════════════════════════════════
-- SPRINT_9_30_MIGRATION.sql
-- ════════════════════════════════════════════════════════════════════════════
-- v23.40.23 — Banner link target columns (product / category / collection / drop / page).
ALTER TABLE "Banner"
  ADD COLUMN IF NOT EXISTS "linkType"          TEXT,
  ADD COLUMN IF NOT EXISTS "linkProductId"     TEXT,
  ADD COLUMN IF NOT EXISTS "linkCategoryId"    TEXT,
  ADD COLUMN IF NOT EXISTS "linkCollectionTag" TEXT,
  ADD COLUMN IF NOT EXISTS "linkDropSlug"      TEXT,
  ADD COLUMN IF NOT EXISTS "linkPageSlug"      TEXT;

CREATE INDEX IF NOT EXISTS "Banner_linkProductId_idx"  ON "Banner"("linkProductId");
CREATE INDEX IF NOT EXISTS "Banner_linkCategoryId_idx" ON "Banner"("linkCategoryId");


-- ════════════════════════════════════════════════════════════════════════════
-- SPRINT_9_31_MIGRATION.sql
-- ════════════════════════════════════════════════════════════════════════════
-- v23.40.25.2 — Separate public website contact from authorised-signatory contact.
ALTER TABLE "LegalEntity"
  ADD COLUMN IF NOT EXISTS "publicEmail"       TEXT,
  ADD COLUMN IF NOT EXISTS "publicPhone"       TEXT,
  ADD COLUMN IF NOT EXISTS "publicWhatsapp"    TEXT,
  ADD COLUMN IF NOT EXISTS "publicAddressLine" TEXT,
  ADD COLUMN IF NOT EXISTS "socialInstagram"   TEXT;
