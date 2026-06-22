-- Sprint 8 / CMS v20: Banner UI + Asset Library

-- 1. Banner additions (idempotent)
ALTER TABLE "Banner" ADD COLUMN IF NOT EXISTS "textColor" TEXT;
ALTER TABLE "Banner" ADD COLUMN IF NOT EXISTS "bgColor" TEXT;
ALTER TABLE "Banner" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Banner" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS "Banner_position_active_idx" ON "Banner"("position", "active");

-- 2. Asset library
CREATE TABLE IF NOT EXISTS "Asset" (
  "id" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "filename" TEXT,
  "folder" TEXT,
  "width" INTEGER,
  "height" INTEGER,
  "size" INTEGER,
  "contentType" TEXT,
  "alt" TEXT,
  "caption" TEXT,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "uploadedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Asset_folder_idx" ON "Asset"("folder");
CREATE INDEX IF NOT EXISTS "Asset_createdAt_idx" ON "Asset"("createdAt");
