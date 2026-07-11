BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'JournalDraftStatus'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."JournalDraftStatus" AS ENUM (
      'DRAFT',
      'PENDING_REVIEW',
      'APPROVED',
      'REJECTED',
      'PUBLISHED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "public"."JournalDraft" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "excerpt" TEXT,
  "body" TEXT NOT NULL,
  "coverImage" TEXT,
  "coverImagePrompt" TEXT,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "seedTheme" TEXT,
  "seedRef" TEXT,
  "status" "public"."JournalDraftStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "approvalToken" TEXT,
  "reviewerNote" TEXT,
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "publishedPageId" TEXT,
  "createdByCron" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JournalDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "JournalDraft_approvalToken_key"
  ON "public"."JournalDraft"("approvalToken");

CREATE INDEX IF NOT EXISTS "JournalDraft_status_idx"
  ON "public"."JournalDraft"("status");

CREATE INDEX IF NOT EXISTS "JournalDraft_createdAt_desc_idx"
  ON "public"."JournalDraft"("createdAt" DESC);

CREATE TABLE IF NOT EXISTS "public"."JournalSeedLog" (
  "id" TEXT NOT NULL,
  "theme" TEXT NOT NULL,
  "seedRef" TEXT,
  "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "draftId" TEXT,
  CONSTRAINT "JournalSeedLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "JournalSeedLog_usedAt_desc_idx"
  ON "public"."JournalSeedLog"("usedAt" DESC);

COMMIT;
