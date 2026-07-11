BEGIN;

ALTER TABLE "public"."JournalDraft"
ADD COLUMN IF NOT EXISTS "storyImages" JSONB;

COMMIT;
