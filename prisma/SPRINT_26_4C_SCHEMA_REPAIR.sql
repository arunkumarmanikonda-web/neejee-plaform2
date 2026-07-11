@'
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'EditorialBlockStatus'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."EditorialBlockStatus" AS ENUM (
      'DRAFT',
      'PREVIEW',
      'PUBLISHED',
      'ARCHIVED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ErpQueueEntityType'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."ErpQueueEntityType" AS ENUM (
      'PRODUCT',
      'INVENTORY',
      'PRICE',
      'SELLER',
      'ORDER',
      'PURCHASE_ORDER'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ErpSyncAttemptStatus'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."ErpSyncAttemptStatus" AS ENUM (
      'QUEUED',
      'PROCESSING',
      'SUCCEEDED',
      'FAILED',
      'DEAD_LETTER'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ErpDeadLetterStatus'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."ErpDeadLetterStatus" AS ENUM (
      'OPEN',
      'RETRY_SCHEDULED',
      'RESOLVED',
      'DISCARDED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "public"."EditorialBlock" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "blockType" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "subhead" TEXT,
  "kicker" TEXT,
  "audienceTag" TEXT,
  "ctaLabel" TEXT,
  "ctaHref" TEXT,
  "coverImage" TEXT,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "placement" TEXT,
  "status" "public"."EditorialBlockStatus" NOT NULL DEFAULT 'DRAFT',
  "previewToken" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EditorialBlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EditorialBlock_slug_key" ON "public"."EditorialBlock"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "EditorialBlock_previewToken_key" ON "public"."EditorialBlock"("previewToken");
CREATE INDEX IF NOT EXISTS "EditorialBlock_status_updatedAt_idx" ON "public"."EditorialBlock"("status", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "EditorialBlock_placement_idx" ON "public"."EditorialBlock"("placement");
CREATE INDEX IF NOT EXISTS "EditorialBlock_audienceTag_idx" ON "public"."EditorialBlock"("audienceTag");

CREATE TABLE IF NOT EXISTS "public"."ErpSyncAttempt" (
  "id" TEXT NOT NULL,
  "entityType" "public"."ErpQueueEntityType" NOT NULL,
  "entityKey" TEXT NOT NULL,
  "adapterKind" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "status" "public"."ErpSyncAttemptStatus" NOT NULL DEFAULT 'QUEUED',
  "attemptNumber" INTEGER NOT NULL DEFAULT 1,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "runAfter" TIMESTAMP(3) NOT NULL,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "requestPayload" JSONB,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ErpSyncAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ErpSyncAttempt_status_runAfter_idx" ON "public"."ErpSyncAttempt"("status", "runAfter");
CREATE INDEX IF NOT EXISTS "ErpSyncAttempt_entityType_entityKey_idx" ON "public"."ErpSyncAttempt"("entityType", "entityKey");
CREATE INDEX IF NOT EXISTS "ErpSyncAttempt_createdAt_idx" ON "public"."ErpSyncAttempt"("createdAt" DESC);

CREATE TABLE IF NOT EXISTS "public"."ErpDeadLetter" (
  "id" TEXT NOT NULL,
  "syncAttemptId" TEXT NOT NULL,
  "entityType" "public"."ErpQueueEntityType" NOT NULL,
  "entityKey" TEXT NOT NULL,
  "status" "public"."ErpDeadLetterStatus" NOT NULL DEFAULT 'OPEN',
  "errorCode" TEXT,
  "errorMessage" TEXT NOT NULL,
  "resolutionNote" TEXT,
  "lastFailedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ErpDeadLetter_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ErpDeadLetter_syncAttemptId_fkey" FOREIGN KEY ("syncAttemptId") REFERENCES "public"."ErpSyncAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ErpDeadLetter_syncAttemptId_key" ON "public"."ErpDeadLetter"("syncAttemptId");
CREATE INDEX IF NOT EXISTS "ErpDeadLetter_status_updatedAt_idx" ON "public"."ErpDeadLetter"("status", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "ErpDeadLetter_entityType_entityKey_idx" ON "public"."ErpDeadLetter"("entityType", "entityKey");
CREATE INDEX IF NOT EXISTS "ErpDeadLetter_lastFailedAt_idx" ON "public"."ErpDeadLetter"("lastFailedAt" DESC);

COMMIT;
'@ | Set-Content -Path "prisma\SPRINT_26_4C_SCHEMA_REPAIR.sql"
