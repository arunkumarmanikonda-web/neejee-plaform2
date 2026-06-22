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
