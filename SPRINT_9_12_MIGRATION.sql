-- Sprint 9.12 (v23.29) — Variant-aware images & per-colour AI photo studio
-- Run BEFORE deploying.

-- Variant gets its own gallery and an optional hex colour for swatch display.
ALTER TABLE "Variant"
  ADD COLUMN IF NOT EXISTS "images"   TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "colorHex" TEXT;

-- AiPhotoJob can now be scoped to a Variant (nullable — products without
-- variants continue to work exactly as before).
ALTER TABLE "AiPhotoJob"
  ADD COLUMN IF NOT EXISTS "variantId" TEXT;

-- Add the FK (SET NULL on variant delete so we don't lose job history)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'AiPhotoJob_variantId_fkey'
      AND table_name = 'AiPhotoJob'
  ) THEN
    ALTER TABLE "AiPhotoJob"
      ADD CONSTRAINT "AiPhotoJob_variantId_fkey"
      FOREIGN KEY ("variantId") REFERENCES "Variant"(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Index for filtering jobs by variant
CREATE INDEX IF NOT EXISTS "AiPhotoJob_variantId_idx" ON "AiPhotoJob"("variantId");
