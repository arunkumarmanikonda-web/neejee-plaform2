-- v23.40.23 — Banner link target columns.
-- Lets a banner point at a specific product / category / collection / drop / CMS page
-- instead of just a free-text ctaUrl. Safe to run multiple times (idempotent).

ALTER TABLE "Banner"
  ADD COLUMN IF NOT EXISTS "linkType"          TEXT,
  ADD COLUMN IF NOT EXISTS "linkProductId"     TEXT,
  ADD COLUMN IF NOT EXISTS "linkCategoryId"    TEXT,
  ADD COLUMN IF NOT EXISTS "linkCollectionTag" TEXT,
  ADD COLUMN IF NOT EXISTS "linkDropSlug"      TEXT,
  ADD COLUMN IF NOT EXISTS "linkPageSlug"      TEXT;

CREATE INDEX IF NOT EXISTS "Banner_linkProductId_idx"  ON "Banner"("linkProductId");
CREATE INDEX IF NOT EXISTS "Banner_linkCategoryId_idx" ON "Banner"("linkCategoryId");
