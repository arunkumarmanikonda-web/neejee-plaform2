-- Sprint 6: Marketplace + Seller portal

-- Extend Seller with profile, story, KYC-richer fields
ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "userId" TEXT UNIQUE;
ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "slug" TEXT UNIQUE;
ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "story" TEXT;
ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "yearsOfPractice" INTEGER;
ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "logoImage" TEXT;
ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "coverImage" TEXT;
ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "portfolio" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "bankName" TEXT;
ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "rejectionNote" TEXT;
ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- FK from Seller.userId -> User.id (best-effort, ignore if it already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Seller_userId_fkey' AND table_name = 'Seller'
  ) THEN
    ALTER TABLE "Seller"
      ADD CONSTRAINT "Seller_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Payouts ledger
CREATE TABLE IF NOT EXISTS "Payout" (
  "id"              TEXT PRIMARY KEY,
  "sellerId"        TEXT NOT NULL,
  "periodStart"     TIMESTAMP(3) NOT NULL,
  "periodEnd"       TIMESTAMP(3) NOT NULL,
  "grossSales"      INTEGER NOT NULL DEFAULT 0,
  "commissionPaise" INTEGER NOT NULL DEFAULT 0,
  "netPayoutPaise"  INTEGER NOT NULL DEFAULT 0,
  "orderCount"      INTEGER NOT NULL DEFAULT 0,
  "status"          TEXT NOT NULL DEFAULT 'PENDING',
  "utr"             TEXT,
  "paidAt"          TIMESTAMP(3),
  "notes"           TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payout_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "Payout_sellerId_status_idx" ON "Payout"("sellerId", "status");
