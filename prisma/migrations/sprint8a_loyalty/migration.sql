-- Sprint 8A: Loyalty Program — Found / Known / Personal / Family

-- 1. User loyalty columns (idempotent)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "loyaltyTier" TEXT NOT NULL DEFAULT 'FOUND';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "loyaltyPoints" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lifetimePoints" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lifetimeSpend" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredById" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" ON "User"("referralCode") WHERE "referralCode" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "User_loyaltyTier_idx" ON "User"("loyaltyTier");

-- 2. Order loyalty columns
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "pointsRedeemed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "pointsValue" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "pointsEarned" INTEGER NOT NULL DEFAULT 0;

-- 3. LoyaltyLedger (append-only)
CREATE TABLE IF NOT EXISTS "LoyaltyLedger" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "points" INTEGER NOT NULL,
  "reason" TEXT,
  "orderId" TEXT,
  "referralId" TEXT,
  "expiresAt" TIMESTAMP(3),
  "awardedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoyaltyLedger_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LoyaltyLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "LoyaltyLedger_awardedById_fkey" FOREIGN KEY ("awardedById") REFERENCES "User"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "LoyaltyLedger_userId_createdAt_idx" ON "LoyaltyLedger"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "LoyaltyLedger_orderId_idx" ON "LoyaltyLedger"("orderId");
CREATE INDEX IF NOT EXISTS "LoyaltyLedger_expiresAt_idx" ON "LoyaltyLedger"("expiresAt");

-- 4. Referral
CREATE TABLE IF NOT EXISTS "Referral" (
  "id" TEXT NOT NULL,
  "referrerId" TEXT NOT NULL,
  "refereeId" TEXT,
  "refereeEmail" TEXT,
  "code" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "firstOrderId" TEXT,
  "rewardedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Referral_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "Referral_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "User"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "Referral_referrerId_idx" ON "Referral"("referrerId");
CREATE INDEX IF NOT EXISTS "Referral_refereeId_idx" ON "Referral"("refereeId");
CREATE INDEX IF NOT EXISTS "Referral_code_idx" ON "Referral"("code");

-- 5. LoyaltySettings (singleton row)
CREATE TABLE IF NOT EXISTS "LoyaltySettings" (
  "id" TEXT NOT NULL DEFAULT 'singleton',
  "paisePerPoint" INTEGER NOT NULL DEFAULT 10000,
  "multiplierFound" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "multiplierKnown" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
  "multiplierPersonal" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
  "multiplierFamily" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
  "redemptionValue" INTEGER NOT NULL DEFAULT 100,
  "minRedemption" INTEGER NOT NULL DEFAULT 100,
  "maxRedemptionPct" INTEGER NOT NULL DEFAULT 50,
  "thresholdKnown" INTEGER NOT NULL DEFAULT 2500000,
  "thresholdPersonal" INTEGER NOT NULL DEFAULT 7500000,
  "thresholdFamily" INTEGER NOT NULL DEFAULT 20000000,
  "referralRewardPoints" INTEGER NOT NULL DEFAULT 500,
  "refereeDiscountPct" INTEGER NOT NULL DEFAULT 10,
  "refereeMinOrder" INTEGER NOT NULL DEFAULT 250000,
  "pointsExpireMonths" INTEGER NOT NULL DEFAULT 12,
  "familyNeverExpire" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoyaltySettings_pkey" PRIMARY KEY ("id")
);

-- Seed singleton row
INSERT INTO "LoyaltySettings" ("id") VALUES ('singleton') ON CONFLICT DO NOTHING;
