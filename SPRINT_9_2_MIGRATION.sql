-- Sprint 9.2 — add AR Try-On eligibility flag to Product.
-- Run this once in Supabase SQL Editor before deploying v23.18.
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "arTryOnEligible" BOOLEAN NOT NULL DEFAULT false;
