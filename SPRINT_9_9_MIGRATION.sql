-- Sprint 9.9 (v23.25) — PO chat, disputes, demand forecast
-- Run this in Supabase SQL editor BEFORE deploying the new code.

-- ─────────────────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────────────────
CREATE TYPE "DisputeResourceType" AS ENUM ('ORDER', 'PURCHASE_ORDER');
CREATE TYPE "DisputeCategory" AS ENUM (
  'WRONG_ITEM', 'DAMAGED', 'NOT_RECEIVED', 'QUALITY_ISSUE',
  'SHORT_SHIPMENT', 'LATE_DELIVERY', 'PAYMENT_ISSUE', 'OTHER'
);
CREATE TYPE "DisputeSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "DisputeStatus" AS ENUM (
  'OPEN', 'AWAITING_CUSTOMER', 'AWAITING_VENDOR', 'UNDER_REVIEW',
  'RESOLVED', 'REJECTED', 'WITHDRAWN'
);
CREATE TYPE "DisputeEventType" AS ENUM (
  'CREATED', 'COMMENT', 'STATUS_CHANGED', 'EVIDENCE_ADDED',
  'RESOLUTION_PROPOSED', 'RESOLVED'
);
CREATE TYPE "ForecastScope" AS ENUM ('GLOBAL', 'CATEGORY', 'PRODUCT');

-- ─────────────────────────────────────────────────────────────────────────
-- PoMessage
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE "PoMessage" (
  "id"              TEXT PRIMARY KEY,
  "purchaseOrderId" TEXT NOT NULL REFERENCES "PurchaseOrder"(id) ON DELETE CASCADE,
  "authorUserId"    TEXT NOT NULL,
  "authorRole"      TEXT NOT NULL,
  "authorName"      TEXT NOT NULL,
  "body"            TEXT NOT NULL,
  "attachments"     TEXT[] NOT NULL DEFAULT '{}',
  "readByVendorAt"  TIMESTAMP(3),
  "readByAdminAt"   TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PoMessage_purchaseOrderId_createdAt_idx"
  ON "PoMessage"("purchaseOrderId", "createdAt");

-- ─────────────────────────────────────────────────────────────────────────
-- Dispute + DisputeEvent
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE "Dispute" (
  "id"                   TEXT PRIMARY KEY,
  "resourceType"         "DisputeResourceType" NOT NULL,
  "orderId"              TEXT REFERENCES "Order"(id) ON DELETE CASCADE,
  "purchaseOrderId"      TEXT REFERENCES "PurchaseOrder"(id) ON DELETE CASCADE,
  "vendorId"             TEXT,
  "sellerId"             TEXT,
  "customerUserId"       TEXT,
  "raisedByUserId"       TEXT NOT NULL,
  "raisedByRole"         TEXT NOT NULL,
  "category"             "DisputeCategory" NOT NULL,
  "severity"             "DisputeSeverity" NOT NULL DEFAULT 'MEDIUM',
  "status"               "DisputeStatus" NOT NULL DEFAULT 'OPEN',
  "title"                TEXT NOT NULL,
  "description"          TEXT NOT NULL,
  "evidenceUrls"         TEXT[] NOT NULL DEFAULT '{}',
  "resolutionNote"       TEXT,
  "resolutionAmountPaise" INTEGER,
  "resolvedAt"           TIMESTAMP(3),
  "resolvedByUserId"     TEXT,
  "dueBy"                TIMESTAMP(3),
  "firstResponseAt"      TIMESTAMP(3),
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Dispute_resourceType_status_idx"     ON "Dispute"("resourceType", "status");
CREATE INDEX "Dispute_vendorId_status_idx"         ON "Dispute"("vendorId", "status");
CREATE INDEX "Dispute_sellerId_status_idx"         ON "Dispute"("sellerId", "status");
CREATE INDEX "Dispute_customerUserId_status_idx"   ON "Dispute"("customerUserId", "status");
CREATE INDEX "Dispute_createdAt_idx"               ON "Dispute"("createdAt");

CREATE TABLE "DisputeEvent" (
  "id"          TEXT PRIMARY KEY,
  "disputeId"   TEXT NOT NULL REFERENCES "Dispute"(id) ON DELETE CASCADE,
  "actorUserId" TEXT,
  "actorRole"   TEXT,
  "type"        "DisputeEventType" NOT NULL,
  "body"        TEXT,
  "fromStatus"  "DisputeStatus",
  "toStatus"    "DisputeStatus",
  "attachments" TEXT[] NOT NULL DEFAULT '{}',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "DisputeEvent_disputeId_createdAt_idx"
  ON "DisputeEvent"("disputeId", "createdAt");

-- ─────────────────────────────────────────────────────────────────────────
-- ForecastSnapshot
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE "ForecastSnapshot" (
  "id"                TEXT PRIMARY KEY,
  "scope"             "ForecastScope" NOT NULL,
  "productId"         TEXT,
  "categoryId"        TEXT,
  "windowStartDate"   TIMESTAMP(3) NOT NULL,
  "windowEndDate"     TIMESTAMP(3) NOT NULL,
  "horizonDays"       INTEGER NOT NULL DEFAULT 90,
  "series"            JSONB NOT NULL,
  "diagnostics"       JSONB NOT NULL,
  "reorderHint"       TEXT,
  "daysUntilStockout" INTEGER,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"         TIMESTAMP(3) NOT NULL
);
-- Composite unique with NULLS NOT DISTINCT so (GLOBAL, null, null) is unique
CREATE UNIQUE INDEX "ForecastSnapshot_scope_productId_categoryId_key"
  ON "ForecastSnapshot"("scope", COALESCE("productId", ''), COALESCE("categoryId", ''));
CREATE INDEX "ForecastSnapshot_scope_expiresAt_idx"
  ON "ForecastSnapshot"("scope", "expiresAt");
