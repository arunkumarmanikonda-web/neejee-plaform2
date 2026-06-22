-- Sprint 9.10 (v23.26) — AI Photo Studio
-- Run BEFORE deploying.

CREATE TYPE "AiPhotoJobStatus" AS ENUM (
  'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'
);
CREATE TYPE "AiPhotoDecision" AS ENUM (
  'PENDING', 'APPROVED', 'REJECTED', 'ARCHIVED'
);
CREATE TYPE "AiPhotoStrategy" AS ENUM (
  'SAREE_ON_MODEL', 'LEHENGA_ON_MODEL', 'KURTA_ON_MODEL',
  'JEWELLERY_NECKLACE_ON_MODEL', 'JEWELLERY_EARRING_ON_MODEL',
  'JEWELLERY_BANGLE_ON_MODEL', 'JEWELLERY_RING_ON_HAND',
  'FURNITURE_IN_ROOM', 'LAMP_ON_CONSOLE', 'DECOR_ON_SHELF',
  'POTTERY_TABLE_SETTING', 'RUG_FLOOR_TOP_DOWN', 'PAINTING_ON_WALL',
  'GENERIC_LIFESTYLE'
);

CREATE TABLE "AiPhotoJob" (
  "id"                TEXT PRIMARY KEY,
  "productId"         TEXT REFERENCES "Product"(id) ON DELETE SET NULL,
  "categorySlug"      TEXT,
  "strategy"          "AiPhotoStrategy" NOT NULL,
  "sourceImageUrls"   TEXT[] NOT NULL DEFAULT '{}',
  "variantCount"      INTEGER NOT NULL DEFAULT 6,
  "modelArchetype"    TEXT,
  "stylePreset"       TEXT,
  "addScaleShot"      BOOLEAN NOT NULL DEFAULT false,
  "imagePrompt"       TEXT,
  "status"            "AiPhotoJobStatus" NOT NULL DEFAULT 'QUEUED',
  "errorMessage"      TEXT,
  "startedAt"         TIMESTAMP(3),
  "completedAt"       TIMESTAMP(3),
  "requestedByUserId" TEXT NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AiPhotoJob_productId_status_idx"    ON "AiPhotoJob"("productId", "status");
CREATE INDEX "AiPhotoJob_requestedByUserId_createdAt_idx"
  ON "AiPhotoJob"("requestedByUserId", "createdAt");

CREATE TABLE "AiPhotoVariant" (
  "id"                TEXT PRIMARY KEY,
  "jobId"             TEXT NOT NULL REFERENCES "AiPhotoJob"(id) ON DELETE CASCADE,
  "url"               TEXT NOT NULL,
  "sceneType"         TEXT NOT NULL,
  "sceneNote"         TEXT,
  "decision"          "AiPhotoDecision" NOT NULL DEFAULT 'PENDING',
  "decidedAt"         TIMESTAMP(3),
  "decidedByUserId"   TEXT,
  "productImageIndex" INTEGER,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AiPhotoVariant_jobId_decision_idx" ON "AiPhotoVariant"("jobId", "decision");
