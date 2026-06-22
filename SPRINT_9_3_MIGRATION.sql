-- Sprint 9.3 — Pre-orders & Limited Drops migration.
-- Run this once in Supabase SQL Editor before deploying v23.19.

-- 1. Enums
CREATE TYPE "FulfilmentMode" AS ENUM ('IN_STOCK', 'PREORDER', 'LIMITED_DROP');
CREATE TYPE "DropStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'LIVE', 'CLOSED');
CREATE TYPE "PreorderBalanceStatus" AS ENUM ('PENDING', 'AWAITING_PAYMENT', 'PAID', 'CANCELLED');

-- 2. Product additions
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "fulfilmentMode" "FulfilmentMode" NOT NULL DEFAULT 'IN_STOCK',
  ADD COLUMN IF NOT EXISTS "depositPercent" INTEGER,
  ADD COLUMN IF NOT EXISTS "releaseDate"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "editionSize"    INTEGER,
  ADD COLUMN IF NOT EXISTS "editionSold"    INTEGER NOT NULL DEFAULT 0;

-- 3. Drop model
CREATE TABLE IF NOT EXISTS "Drop" (
  "id"          TEXT NOT NULL,
  "slug"        TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "subtitle"    TEXT,
  "description" TEXT,
  "coverImage"  TEXT,
  "startsAt"    TIMESTAMP(3) NOT NULL,
  "endsAt"      TIMESTAMP(3),
  "productIds"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status"      "DropStatus" NOT NULL DEFAULT 'DRAFT',
  "founderNote" TEXT,
  "seoTitle"    TEXT,
  "seoDesc"     TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Drop_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Drop_slug_key" ON "Drop"("slug");
CREATE INDEX IF NOT EXISTS "Drop_status_startsAt_idx" ON "Drop"("status", "startsAt");

-- 4. Waitlist
CREATE TABLE IF NOT EXISTS "Waitlist" (
  "id"        TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "email"     TEXT NOT NULL,
  "whatsapp"  TEXT,
  "name"      TEXT,
  "source"    TEXT,
  "notified"  BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Waitlist_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Waitlist_productId_email_key" ON "Waitlist"("productId", "email");
CREATE INDEX IF NOT EXISTS "Waitlist_productId_createdAt_idx" ON "Waitlist"("productId", "createdAt");

-- 5. PreorderBalance
CREATE TABLE IF NOT EXISTS "PreorderBalance" (
  "id"             TEXT NOT NULL,
  "orderId"        TEXT NOT NULL,
  "productId"      TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "depositPaise"   INTEGER NOT NULL,
  "balancePaise"   INTEGER NOT NULL,
  "status"         "PreorderBalanceStatus" NOT NULL DEFAULT 'PENDING',
  "dueAt"          TIMESTAMP(3),
  "paidAt"         TIMESTAMP(3),
  "balanceOrderId" TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PreorderBalance_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PreorderBalance_userId_status_idx" ON "PreorderBalance"("userId", "status");
CREATE INDEX IF NOT EXISTS "PreorderBalance_productId_status_idx" ON "PreorderBalance"("productId", "status");
