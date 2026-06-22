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
