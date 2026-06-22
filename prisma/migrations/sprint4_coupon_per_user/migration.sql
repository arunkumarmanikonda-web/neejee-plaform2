-- Bind coupons to specific users + add per-user redemption ledger
ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "perUserOnce" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "Coupon_userId_idx" ON "Coupon"("userId");

CREATE TABLE IF NOT EXISTS "CouponRedemption" (
  "id"          TEXT PRIMARY KEY,
  "couponId"    TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "orderId"     TEXT,
  "redeemedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE,
  CONSTRAINT "CouponRedemption_couponId_userId_key" UNIQUE ("couponId", "userId")
);
CREATE INDEX IF NOT EXISTS "CouponRedemption_userId_idx" ON "CouponRedemption"("userId");
