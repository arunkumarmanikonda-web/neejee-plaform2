-- Sprint 6b: per-product COD + return policy + accessories category seed

-- Per-product flags
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "codEligible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "returnEligible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "returnPolicy" TEXT;

-- Accessories category (idempotent)
INSERT INTO "Category" ("id", "slug", "name", "description")
VALUES ('cat_accessories', 'accessories', 'Accessories', 'Bags, scarves, stoles, belts, watches, and lifestyle pieces')
ON CONFLICT ("slug") DO NOTHING;
