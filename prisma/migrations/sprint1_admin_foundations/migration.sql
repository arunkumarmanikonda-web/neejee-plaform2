-- Sprint 1: Admin Foundations migration
-- Adds sale window fields to Product, ensures Coupon table is up to date.
-- Idempotent: safe to run multiple times.

-- Add sale window columns if missing
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "saleStartsAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "saleEndsAt" TIMESTAMP(3);

-- Helpful index on sale window for "currently on sale" queries
CREATE INDEX IF NOT EXISTS "Product_saleEndsAt_idx" ON "Product" ("saleEndsAt");
