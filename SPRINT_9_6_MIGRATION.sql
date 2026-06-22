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
