-- Sprint 9.15 (v23.33) — Craft model + Category admin fields
-- Run BEFORE deploying.

-- ─── Craft model ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Craft" (
  "id"          TEXT PRIMARY KEY,
  "slug"        TEXT UNIQUE NOT NULL,
  "name"        TEXT NOT NULL,
  "region"      TEXT,
  "state"       TEXT,
  "description" TEXT,
  "longStory"   TEXT,
  "image"       TEXT,
  "thumbnail"   TEXT,
  "seoTitle"    TEXT,
  "seoDesc"     TEXT,
  "featured"    BOOLEAN NOT NULL DEFAULT FALSE,
  "active"      BOOLEAN NOT NULL DEFAULT TRUE,
  "order"       INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "Craft_active_order_idx" ON "Craft"("active", "order");
CREATE INDEX IF NOT EXISTS "Craft_featured_idx"      ON "Craft"("featured");

-- ─── Category extensions ──────────────────────────────────────────
ALTER TABLE "Category"
  ADD COLUMN IF NOT EXISTS "active"    BOOLEAN     NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "featured"  BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS "Category_active_order_idx" ON "Category"("active", "order");
CREATE INDEX IF NOT EXISTS "Category_featured_idx"     ON "Category"("featured");

-- ─── Seed crafts from existing distinct Product.craft values ────────
-- Best-effort: copies each unique craft into the new table so admins
-- can curate them. No-op if Craft already populated.
INSERT INTO "Craft" ("id", "slug", "name", "active", "order")
SELECT
  'craft_' || lower(regexp_replace(p.craft, '[^a-zA-Z0-9]+', '_', 'g')),
  lower(regexp_replace(p.craft, '[^a-zA-Z0-9]+', '-', 'g')),
  p.craft,
  TRUE,
  0
FROM (SELECT DISTINCT craft FROM "Product" WHERE craft IS NOT NULL AND craft != '') p
ON CONFLICT (slug) DO NOTHING;
