-- v23.35 SMS + OTP migration
-- Run in Supabase SQL editor before deploy.

CREATE TABLE IF NOT EXISTS "SmsTemplate" (
  "id"          TEXT PRIMARY KEY,
  "event"       TEXT NOT NULL UNIQUE,
  "label"       TEXT NOT NULL,
  "templateId"  TEXT NOT NULL,
  "body"        TEXT NOT NULL,
  "varOrder"    TEXT[] NOT NULL DEFAULT '{}',
  "category"    TEXT NOT NULL DEFAULT 'transactional',
  "active"      BOOLEAN NOT NULL DEFAULT TRUE,
  "notes"       TEXT,
  "lastUsedAt"  TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "SmsTemplate_event_active_idx" ON "SmsTemplate"("event","active");

CREATE TABLE IF NOT EXISTS "OtpCode" (
  "id"          TEXT PRIMARY KEY,
  "phone"       TEXT NOT NULL,
  "codeHash"    TEXT NOT NULL,
  "purpose"     TEXT NOT NULL,
  "attempts"    INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "expiresAt"   TIMESTAMP(3) NOT NULL,
  "consumedAt"  TIMESTAMP(3),
  "ipAddress"   TEXT,
  "userAgent"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "OtpCode_phone_purpose_consumedAt_idx" ON "OtpCode"("phone","purpose","consumedAt");
CREATE INDEX IF NOT EXISTS "OtpCode_expiresAt_idx" ON "OtpCode"("expiresAt");

-- Seed empty rows for the 10 approved events. Paste real templateId via /admin/settings/sms.
INSERT INTO "SmsTemplate" ("id","event","label","templateId","body","varOrder","category","updatedAt") VALUES
  ('seed_otp',       'otp_login',        'OTP Login',                    'PASTE_DLT_ID', '{#var#} is your NEEJEE login OTP. Valid for 5 minutes. Do not share with anyone.', ARRAY['otp'],                              'transactional',   NOW()),
  ('seed_op',        'order_placed',     'Order Placed',                 'PASTE_DLT_ID', 'NEEJEE: Order {#var#} received. Total Rs.{#var#}. Track at neejee.com/account',     ARRAY['orderNumber','total'],              'transactional',   NOW()),
  ('seed_pc',        'payment_confirmed','Payment Confirmed',            'PASTE_DLT_ID', 'NEEJEE: Payment confirmed for order {#var#}. Preparing for dispatch.',              ARRAY['orderNumber'],                      'transactional',   NOW()),
  ('seed_sh',        'order_shipped',    'Order Shipped',                'PASTE_DLT_ID', 'NEEJEE: Order {#var#} shipped via {#var#}. Track: {#var#}',                          ARRAY['orderNumber','courier','tracking'], 'service_implicit',NOW()),
  ('seed_dl',        'order_delivered',  'Order Delivered',              'PASTE_DLT_ID', 'NEEJEE: Order {#var#} has been delivered. Welcome home.',                            ARRAY['orderNumber'],                      'service_implicit',NOW()),
  ('seed_cn',        'order_cancelled',  'Order Cancelled',              'PASTE_DLT_ID', 'NEEJEE: Order {#var#} has been cancelled. Refund (if applicable) initiated.',       ARRAY['orderNumber'],                      'service_implicit',NOW()),
  ('seed_rf',        'refund_initiated', 'Refund Initiated',             'PASTE_DLT_ID', 'NEEJEE: Refund of Rs.{#var#} initiated for order {#var#}. Reflects in 5-7 working days.', ARRAY['amount','orderNumber'],         'transactional',   NOW()),
  ('seed_ab',        'abandoned_cart',   'Abandoned Cart Nudge',         'PASTE_DLT_ID', 'NEEJEE: You left something behind. Complete your order at neejee.com/cart before it sells out.', ARRAY[]::TEXT[],            'service_explicit',NOW()),
  ('seed_sp',        'seller_payout',    'Seller Payout Paid',           'PASTE_DLT_ID', 'NEEJEE: Payout of Rs.{#var#} credited to your account. UTR: {#var#}',               ARRAY['amount','utr'],                     'transactional',   NOW()),
  ('seed_vp',        'vendor_payout',    'Vendor Payout Paid',           'PASTE_DLT_ID', 'NEEJEE: Payout of Rs.{#var#} processed for invoice {#var#}. UTR: {#var#}',           ARRAY['amount','invoice','utr'],           'transactional',   NOW())
ON CONFLICT ("event") DO NOTHING;
