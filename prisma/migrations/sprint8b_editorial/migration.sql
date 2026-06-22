-- Sprint 8B: Editorial Hub — journal, lookbook, tagging

ALTER TABLE "CmsPage" ADD COLUMN IF NOT EXISTS "pageType" TEXT NOT NULL DEFAULT 'page';
ALTER TABLE "CmsPage" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "CmsPage" ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CmsPage" ADD COLUMN IF NOT EXISTS "excerpt" TEXT;
ALTER TABLE "CmsPage" ADD COLUMN IF NOT EXISTS "coverImage" TEXT;
ALTER TABLE "CmsPage" ADD COLUMN IF NOT EXISTS "author" TEXT;

CREATE INDEX IF NOT EXISTS "CmsPage_pageType_status_idx" ON "CmsPage"("pageType", "status");
CREATE INDEX IF NOT EXISTS "CmsPage_featured_idx" ON "CmsPage"("featured");
