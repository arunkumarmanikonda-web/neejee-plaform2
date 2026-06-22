-- Sprint 9.11 (v23.27) — AI Photo Studio polish
-- Adds vendor-side workflow + regeneration feedback.
-- Run BEFORE deploying.

CREATE TYPE "AiPhotoRequestStatus" AS ENUM (
  'SUBMITTED', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED'
);

CREATE TABLE "AiPhotoRequest" (
  "id"                TEXT PRIMARY KEY,
  "vendorId"          TEXT NOT NULL REFERENCES "Vendor"(id) ON DELETE CASCADE,
  "productId"         TEXT REFERENCES "Product"(id) ON DELETE SET NULL,
  "description"       TEXT NOT NULL,
  "proposedCategory"  TEXT,
  "sourceImageUrls"   TEXT[] NOT NULL DEFAULT '{}',
  "status"            "AiPhotoRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
  "resultingJobId"    TEXT,
  "adminNote"         TEXT,
  "reviewedByUserId"  TEXT,
  "reviewedAt"        TIMESTAMP(3),
  "requestedByUserId" TEXT NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AiPhotoRequest_vendorId_status_idx"  ON "AiPhotoRequest"("vendorId", "status");
CREATE INDEX "AiPhotoRequest_status_createdAt_idx" ON "AiPhotoRequest"("status", "createdAt");

-- New columns on AiPhotoJob for regeneration + request linking
ALTER TABLE "AiPhotoJob"
  ADD COLUMN "regenerationFeedback" TEXT,
  ADD COLUMN "triggeredByRequestId" TEXT;
