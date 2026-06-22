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
