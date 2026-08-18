-- Align production Seller table with the Prisma model used by seller onboarding.
-- These nullable fields were already present in schema.prisma but missing in the live DB,
-- causing Prisma P2022-style runtime failures on Seller.msmeNumber / Seller.cin.
ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "msmeNumber" TEXT;
ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "cin" TEXT;
ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "applicationSubmittedAt" TIMESTAMP(3);

-- Preserve application data that was temporarily stored in autoKycSummary while
-- the dedicated columns were unavailable.
UPDATE "Seller"
SET
  "msmeNumber" = COALESCE("msmeNumber", NULLIF("autoKycSummary" #>> '{onboarding,msmeNumber}', '')),
  "cin" = COALESCE("cin", NULLIF("autoKycSummary" #>> '{onboarding,cin}', '')),
  "applicationSubmittedAt" = COALESCE(
    "applicationSubmittedAt",
    CASE
      WHEN NULLIF("autoKycSummary" #>> '{onboarding,applicationSubmittedAt}', '') IS NOT NULL
      THEN (("autoKycSummary" #>> '{onboarding,applicationSubmittedAt}')::timestamptz AT TIME ZONE 'UTC')
      ELSE NULL
    END
  )
WHERE "autoKycSummary" IS NOT NULL;
