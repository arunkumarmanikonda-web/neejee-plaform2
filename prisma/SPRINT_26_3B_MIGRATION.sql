-- =====================================================================
-- SPRINT_26_3B_MIGRATION.sql
-- Wave 26.3b — Multi-channel notifications + phone OTP auth + order events
-- Run after SPRINT_26_3A_MIGRATION.sql. Idempotent, additive only.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. User table — phone verification fields
-- ---------------------------------------------------------------------
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "phoneVerified"    BOOLEAN   NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "phoneVerifiedAt"  TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "primaryAuthMethod" TEXT;
  -- primaryAuthMethod: 'email' | 'phone' | 'oauth'  (NULL = legacy users)

CREATE INDEX IF NOT EXISTS "User_phone_idx" ON "User" ("phone") WHERE "phone" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "User_phoneVerified_idx" ON "User" ("phoneVerified");

-- ---------------------------------------------------------------------
-- 2. NotificationDispatch — audit log of every SMS/WA sent
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "NotificationDispatch" (
  "id"               TEXT      PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "channel"          TEXT      NOT NULL,        -- 'sms' | 'whatsapp' | 'email'
  "event"            TEXT      NOT NULL,        -- 'CART_T1H' | 'CART_T24H' | 'OTP' | 'ORDER_PLACED' etc
  "templateName"     TEXT      NOT NULL,
  "recipient"        TEXT      NOT NULL,        -- phone or email
  "userId"           TEXT,
  "orderId"          TEXT,
  "cartId"           TEXT,                       -- AbandonedCart.id
  "providerRequestId" TEXT,                      -- Fast2SMS request_id or AiSensy message_id
  "status"           TEXT      NOT NULL DEFAULT 'queued',
                                                 -- 'queued' | 'sent' | 'delivered' | 'read' | 'failed'
  "errorMessage"     TEXT,
  "attempt"          INTEGER   NOT NULL DEFAULT 1,
  "maxAttempts"      INTEGER   NOT NULL DEFAULT 3,
  "nextRetryAt"      TIMESTAMP,
  "payloadJson"      JSONB,                      -- template variables, for debugging
  "providerResponseJson" JSONB,
  "sentAt"           TIMESTAMP,
  "deliveredAt"      TIMESTAMP,
  "readAt"           TIMESTAMP,
  "createdAt"        TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"        TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "NotificationDispatch_status_idx" ON "NotificationDispatch" ("status", "nextRetryAt");
CREATE INDEX IF NOT EXISTS "NotificationDispatch_channel_event_idx" ON "NotificationDispatch" ("channel", "event");
CREATE INDEX IF NOT EXISTS "NotificationDispatch_userId_idx" ON "NotificationDispatch" ("userId");
CREATE INDEX IF NOT EXISTS "NotificationDispatch_orderId_idx" ON "NotificationDispatch" ("orderId");
CREATE INDEX IF NOT EXISTS "NotificationDispatch_cartId_idx" ON "NotificationDispatch" ("cartId");
CREATE INDEX IF NOT EXISTS "NotificationDispatch_providerReqId_idx" ON "NotificationDispatch" ("providerRequestId") WHERE "providerRequestId" IS NOT NULL;

-- ---------------------------------------------------------------------
-- 3. NotificationTemplate — registry of approved templates per provider
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "NotificationTemplate" (
  "id"            TEXT      PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "key"           TEXT      NOT NULL UNIQUE,    -- 'sms.cart.t1h' etc — code uses this
  "channel"       TEXT      NOT NULL,           -- 'sms' | 'whatsapp'
  "providerTemplateId" TEXT,                     -- DLT 19-digit ID or AiSensy template name
  "providerName"  TEXT      NOT NULL,           -- 'fast2sms' | 'aisensy'
  "displayName"   TEXT      NOT NULL,
  "bodyPreview"   TEXT,
  "variableCount" INTEGER   NOT NULL DEFAULT 0,
  "approvalStatus" TEXT     NOT NULL DEFAULT 'pending',
                                                 -- 'pending' | 'approved' | 'rejected'
  "enabled"       BOOLEAN   NOT NULL DEFAULT TRUE,
  "lastUsedAt"    TIMESTAMP,
  "createdAt"     TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Seed the 17 template stubs so admin UI shows them from day 1
INSERT INTO "NotificationTemplate" ("key", "channel", "providerName", "displayName", "variableCount") VALUES
  ('sms.cart.t1h',         'sms',      'fast2sms', 'Cart recovery — T+1h gentle nudge', 2),
  ('sms.cart.t24h',        'sms',      'fast2sms', 'Cart recovery — T+24h karigar gift', 4),
  ('sms.cart.t72h',        'sms',      'fast2sms', 'Cart recovery — T+72h farewell', 4),
  ('sms.telecaller.alert', 'sms',      'fast2sms', 'Telecaller internal alert', 4),
  ('sms.auth.otp',         'sms',      'fast2sms', 'OTP — login / signup', 1),
  ('sms.order.placed',     'sms',      'fast2sms', 'Order placed', 4),
  ('sms.order.shipped',    'sms',      'fast2sms', 'Order shipped', 5),
  ('sms.order.ofd',        'sms',      'fast2sms', 'Out for delivery', 2),
  ('sms.order.delivered',  'sms',      'fast2sms', 'Order delivered', 2),
  ('sms.order.cancelled',  'sms',      'fast2sms', 'Order cancelled', 3),
  ('wa.cart.t24h',         'whatsapp', 'aisensy',  'Cart recovery — karigar gift', 5),
  ('wa.cart.t72h',         'whatsapp', 'aisensy',  'Cart recovery — farewell', 5),
  ('wa.order.placed',      'whatsapp', 'aisensy',  'Order placed', 6),
  ('wa.order.shipped',     'whatsapp', 'aisensy',  'Order shipped', 6),
  ('wa.order.ofd',         'whatsapp', 'aisensy',  'Out for delivery', 3),
  ('wa.order.delivered',   'whatsapp', 'aisensy',  'Order delivered', 3),
  ('wa.order.cancelled',   'whatsapp', 'aisensy',  'Order cancelled', 6)
ON CONFLICT ("key") DO NOTHING;

-- ---------------------------------------------------------------------
-- 4. AB testing framework — disabled by default, activate later
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "AbTest" (
  "id"          TEXT      PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "key"         TEXT      NOT NULL UNIQUE,       -- 'recovery_t24h_subject'
  "displayName" TEXT      NOT NULL,
  "enabled"     BOOLEAN   NOT NULL DEFAULT FALSE,
  "startedAt"   TIMESTAMP,
  "endedAt"     TIMESTAMP,
  "createdAt"   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "AbVariant" (
  "id"        TEXT      PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "abTestId"  TEXT      NOT NULL REFERENCES "AbTest"("id") ON DELETE CASCADE,
  "key"       TEXT      NOT NULL,                -- 'A' | 'B' | 'control'
  "displayName" TEXT    NOT NULL,
  "payloadJson" JSONB   NOT NULL,                -- variant-specific overrides
  "weight"    INTEGER   NOT NULL DEFAULT 50,     -- 0-100, sum to 100 across variants
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE ("abTestId", "key")
);

CREATE TABLE IF NOT EXISTS "AbAssignment" (
  "id"         TEXT      PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "abTestId"   TEXT      NOT NULL REFERENCES "AbTest"("id") ON DELETE CASCADE,
  "variantId"  TEXT      NOT NULL REFERENCES "AbVariant"("id") ON DELETE CASCADE,
  "subjectKey" TEXT      NOT NULL,                -- e.g. cartId or userId
  "subjectType" TEXT     NOT NULL,                -- 'cart' | 'user' | 'session'
  "exposedAt"  TIMESTAMP NOT NULL DEFAULT NOW(),
  "convertedAt" TIMESTAMP,
  "conversionValuePaise" INTEGER,
  UNIQUE ("abTestId", "subjectKey")
);
CREATE INDEX IF NOT EXISTS "AbAssignment_subject_idx" ON "AbAssignment" ("subjectKey", "subjectType");

-- ---------------------------------------------------------------------
-- 5. RecoverySettings — extend with per-stage channel toggles
-- ---------------------------------------------------------------------
ALTER TABLE "RecoverySettings"
  ADD COLUMN IF NOT EXISTS "channelMatrix" JSONB NOT NULL DEFAULT
    '{"stage1":{"email":true,"sms":false,"whatsapp":false},
      "stage2":{"email":true,"sms":false,"whatsapp":true},
      "stage3":{"email":true,"sms":false,"whatsapp":true},
      "stage4":{"email":true,"sms":true,"whatsapp":false}}'::jsonb;

-- ---------------------------------------------------------------------
-- 6. Verification
-- ---------------------------------------------------------------------
SELECT 'User new cols' AS check,
  COUNT(*) FILTER (WHERE column_name IN ('phoneVerified','phoneVerifiedAt','primaryAuthMethod')) AS n
FROM information_schema.columns WHERE table_name = 'User';

SELECT 'NotificationDispatch exists' AS check, COUNT(*) AS n
FROM information_schema.tables WHERE table_name = 'NotificationDispatch';

SELECT 'NotificationTemplate seed count' AS check, COUNT(*) AS n
FROM "NotificationTemplate";

SELECT 'AbTest tables' AS check, COUNT(*) AS n
FROM information_schema.tables WHERE table_name IN ('AbTest','AbVariant','AbAssignment');

COMMIT;
