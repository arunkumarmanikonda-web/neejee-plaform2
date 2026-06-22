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
