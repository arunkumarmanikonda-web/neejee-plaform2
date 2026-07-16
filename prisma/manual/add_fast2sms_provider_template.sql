CREATE TABLE IF NOT EXISTS "Fast2SmsProviderTemplate" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "entityId" TEXT,
  "entityName" TEXT,
  "senderId" TEXT,
  "status" TEXT,
  "category" TEXT,
  "language" TEXT,
  "body" TEXT NOT NULL,
  "sourcePage" TEXT,
  "rawMeta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Fast2SmsProviderTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Fast2SmsProviderTemplate_messageId_key"
  ON "Fast2SmsProviderTemplate"("messageId");

CREATE INDEX IF NOT EXISTS "Fast2SmsProviderTemplate_status_idx"
  ON "Fast2SmsProviderTemplate"("status");

CREATE INDEX IF NOT EXISTS "Fast2SmsProviderTemplate_senderId_idx"
  ON "Fast2SmsProviderTemplate"("senderId");

CREATE INDEX IF NOT EXISTS "Fast2SmsProviderTemplate_category_idx"
  ON "Fast2SmsProviderTemplate"("category");