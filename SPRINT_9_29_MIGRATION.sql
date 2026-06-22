-- v23.40.20 — Marketing automation drip tracking columns.
-- Run in Supabase SQL Editor BEFORE deploying v23.40.20.

-- 1. Order: track when the 7-day post-purchase follow-up was sent
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "postPurchaseSentAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Order_postPurchaseSentAt_idx"
  ON "Order"("postPurchaseSentAt");

-- 2. User: track win-back cooldown (don't pester twice in 60 days)
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "lastWinBackAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "User_lastWinBackAt_idx"
  ON "User"("lastWinBackAt");
