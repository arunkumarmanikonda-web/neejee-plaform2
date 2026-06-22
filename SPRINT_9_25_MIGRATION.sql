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
ALTER TABLE "SalesInvoiceLine"
  ADD CONSTRAINT "SalesInvoiceLine_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "SalesInvoice"("id") ON DELETE CASCADE;

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
ALTER TABLE "SalesInvoicePayment"
  ADD CONSTRAINT "SalesInvoicePayment_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "SalesInvoice"("id") ON DELETE CASCADE;

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
