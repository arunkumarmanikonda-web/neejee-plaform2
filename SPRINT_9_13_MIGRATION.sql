-- Sprint 9.13 (v23.30) — Weekly auto-curated journals
-- Run BEFORE deploying.

-- JournalDraft holds AI-generated journal entries pending review.
-- On approval the draft is materialised into a CmsPage row (pageType='journal').
CREATE TABLE IF NOT EXISTS "JournalDraft" (
  "id"               TEXT PRIMARY KEY,
  "title"            TEXT NOT NULL,
  "excerpt"          TEXT,
  "body"             TEXT NOT NULL,
  "coverImage"       TEXT,
  "coverImagePrompt" TEXT,
  "tags"             TEXT[] NOT NULL DEFAULT '{}',
  "seedTheme"        TEXT,                          -- e.g. "artisan-spotlight", "craft-technique"
  "seedRef"          TEXT,                          -- optional referent (product slug, craft slug, etc.)
  "status"           TEXT NOT NULL DEFAULT 'PENDING_REVIEW',  -- DRAFT | PENDING_REVIEW | APPROVED | REJECTED | PUBLISHED
  "approvalToken"    TEXT UNIQUE,                   -- magic link token
  "reviewerNote"     TEXT,
  "reviewedByUserId" TEXT,
  "reviewedAt"       TIMESTAMPTZ,
  "publishedPageId"  TEXT,                          -- CmsPage.id when status=PUBLISHED
  "createdByCron"    BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "JournalDraft_status_idx" ON "JournalDraft"("status");
CREATE INDEX IF NOT EXISTS "JournalDraft_createdAt_idx" ON "JournalDraft"("createdAt" DESC);

-- Track which seeds we've used recently (to avoid repetition across weeks)
CREATE TABLE IF NOT EXISTS "JournalSeedLog" (
  "id"        TEXT PRIMARY KEY,
  "theme"     TEXT NOT NULL,
  "seedRef"   TEXT,
  "usedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "draftId"   TEXT
);

CREATE INDEX IF NOT EXISTS "JournalSeedLog_usedAt_idx" ON "JournalSeedLog"("usedAt" DESC);
