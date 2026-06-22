-- Sprint 7: Marketing & Analytics
-- Adds UTM attribution on Order, AnalyticsEvent table, AbandonedCart table,
-- and EmailCampaign table.

-- 1. UTM / attribution columns on Order (idempotent)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "utmSource" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "utmMedium" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "utmCampaign" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "utmContent" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "utmTerm" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "referrer" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "landingPage" TEXT;
CREATE INDEX IF NOT EXISTS "Order_utmCampaign_idx" ON "Order"("utmCampaign");
CREATE INDEX IF NOT EXISTS "Order_createdAt_idx" ON "Order"("createdAt");

-- 2. AnalyticsEvent
CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT,
  "type" TEXT NOT NULL,
  "path" TEXT,
  "productId" TEXT,
  "value" INTEGER,
  "referrer" TEXT,
  "utmSource" TEXT,
  "utmMedium" TEXT,
  "utmCampaign" TEXT,
  "device" TEXT,
  "country" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_sessionId_idx" ON "AnalyticsEvent"("sessionId");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_type_createdAt_idx" ON "AnalyticsEvent"("type", "createdAt");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_utmCampaign_idx" ON "AnalyticsEvent"("utmCampaign");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_productId_idx" ON "AnalyticsEvent"("productId");

-- 3. AbandonedCart
CREATE TABLE IF NOT EXISTS "AbandonedCart" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "userId" TEXT,
  "itemsJson" TEXT NOT NULL,
  "subtotal" INTEGER NOT NULL,
  "itemCount" INTEGER NOT NULL,
  "remindersSent" INTEGER NOT NULL DEFAULT 0,
  "lastRemindedAt" TIMESTAMP(3),
  "recoveredOrderId" TEXT,
  "recoveredAt" TIMESTAMP(3),
  "optedOut" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AbandonedCart_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AbandonedCart_email_idx" ON "AbandonedCart"("email");
CREATE INDEX IF NOT EXISTS "AbandonedCart_userId_idx" ON "AbandonedCart"("userId");
CREATE INDEX IF NOT EXISTS "AbandonedCart_recoveredOrderId_idx" ON "AbandonedCart"("recoveredOrderId");
CREATE INDEX IF NOT EXISTS "AbandonedCart_createdAt_idx" ON "AbandonedCart"("createdAt");

-- 4. EmailCampaign
CREATE TABLE IF NOT EXISTS "EmailCampaign" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "bodyHtml" TEXT NOT NULL,
  "bodyText" TEXT,
  "segment" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "scheduledFor" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "recipientCount" INTEGER NOT NULL DEFAULT 0,
  "sentCount" INTEGER NOT NULL DEFAULT 0,
  "openCount" INTEGER NOT NULL DEFAULT 0,
  "clickCount" INTEGER NOT NULL DEFAULT 0,
  "bounceCount" INTEGER NOT NULL DEFAULT 0,
  "unsubscribeCount" INTEGER NOT NULL DEFAULT 0,
  "createdBy" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "EmailCampaign_status_idx" ON "EmailCampaign"("status");
CREATE INDEX IF NOT EXISTS "EmailCampaign_sentAt_idx" ON "EmailCampaign"("sentAt");
