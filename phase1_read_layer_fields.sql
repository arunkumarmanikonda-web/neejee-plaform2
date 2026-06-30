ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "catalogueFeatured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "catalogueBestseller" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "catalogueEditorial" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "cataloguePinHero" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "catalogueExclude" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "cataloguePreferredImage" TEXT,
  ADD COLUMN IF NOT EXISTS "catalogueAudienceTag" TEXT,
  ADD COLUMN IF NOT EXISTS "catalogueCtaMode" TEXT,
  ADD COLUMN IF NOT EXISTS "catalogueStoryBlock" TEXT,
  ADD COLUMN IF NOT EXISTS "catalogueImageApproved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "catalogueImageQualityScore" INTEGER,
  ADD COLUMN IF NOT EXISTS "catalogueStockVisibility" TEXT NOT NULL DEFAULT 'IN_STOCK_ONLY';

CREATE INDEX IF NOT EXISTS "Product_catalogueFeatured_idx"
  ON "Product" ("catalogueFeatured");

CREATE INDEX IF NOT EXISTS "Product_catalogueBestseller_idx"
  ON "Product" ("catalogueBestseller");

CREATE INDEX IF NOT EXISTS "Product_catalogueEditorial_idx"
  ON "Product" ("catalogueEditorial");

CREATE INDEX IF NOT EXISTS "Product_cataloguePinHero_idx"
  ON "Product" ("cataloguePinHero");

CREATE INDEX IF NOT EXISTS "Product_catalogueExclude_idx"
  ON "Product" ("catalogueExclude");

CREATE INDEX IF NOT EXISTS "Product_catalogueAudienceTag_idx"
  ON "Product" ("catalogueAudienceTag");

DO $$
BEGIN
  ALTER TABLE "Product"
    ADD CONSTRAINT "Product_catalogueStockVisibility_check"
    CHECK (
      "catalogueStockVisibility" IN (
        'IN_STOCK_ONLY',
        'LOW_STOCK_BADGE',
        'SHOW_EXACT',
        'HIDE_STOCK'
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
