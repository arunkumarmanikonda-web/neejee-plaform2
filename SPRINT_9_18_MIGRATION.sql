-- v23.36 — Update SMS template bodies to use NEEJEY sender (NEEJEE was unavailable in TRAI registry)
-- Run AFTER SPRINT_9_17_MIGRATION.sql. Safe to run multiple times (idempotent).

-- Update bodies for all 10 events to reference NEEJEY brand
UPDATE "SmsTemplate" SET "body" = '{#var#} is your NEEJEY login OTP. Valid for 5 minutes. Do not share with anyone.',
    "updatedAt" = NOW()
  WHERE "event" = 'otp_login';

UPDATE "SmsTemplate" SET "body" = 'NEEJEY: Order {#var#} received. Total Rs.{#var#}. Track at neejee.com/account',
    "updatedAt" = NOW()
  WHERE "event" = 'order_placed';

UPDATE "SmsTemplate" SET "body" = 'NEEJEY: Payment confirmed for order {#var#}. Preparing for dispatch.',
    "updatedAt" = NOW()
  WHERE "event" = 'payment_confirmed';

UPDATE "SmsTemplate" SET "body" = 'NEEJEY: Order {#var#} shipped via {#var#}. Track: {#var#}',
    "updatedAt" = NOW()
  WHERE "event" = 'order_shipped';

UPDATE "SmsTemplate" SET "body" = 'NEEJEY: Order {#var#} has been delivered. Welcome home.',
    "updatedAt" = NOW()
  WHERE "event" = 'order_delivered';

UPDATE "SmsTemplate" SET "body" = 'NEEJEY: Order {#var#} has been cancelled. Refund (if applicable) initiated.',
    "updatedAt" = NOW()
  WHERE "event" = 'order_cancelled';

UPDATE "SmsTemplate" SET "body" = 'NEEJEY: Refund of Rs.{#var#} initiated for order {#var#}. Reflects in 5-7 working days.',
    "updatedAt" = NOW()
  WHERE "event" = 'refund_initiated';

UPDATE "SmsTemplate" SET "body" = 'NEEJEY: You left something behind. Complete your order at neejee.com/cart before it sells out.',
    "updatedAt" = NOW()
  WHERE "event" = 'abandoned_cart';

UPDATE "SmsTemplate" SET "body" = 'NEEJEY: Payout of Rs.{#var#} credited to your account. UTR: {#var#}',
    "updatedAt" = NOW()
  WHERE "event" = 'seller_payout';

UPDATE "SmsTemplate" SET "body" = 'NEEJEY: Payout of Rs.{#var#} processed for invoice {#var#}. UTR: {#var#}',
    "updatedAt" = NOW()
  WHERE "event" = 'vendor_payout';

-- Verify
SELECT "event", "label", LEFT("body", 60) AS body_preview, "templateId", "active"
  FROM "SmsTemplate"
  ORDER BY "event";
