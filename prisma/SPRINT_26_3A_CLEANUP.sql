-- =====================================================================
-- SPRINT_26_3A_CLEANUP.sql
-- Sprint 26.3a — One-time cleanup of pre-payment stray orders
-- Run AFTER SPRINT_26_3A_MIGRATION.sql.
-- Safe to re-run (idempotent).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Preview what will be touched (read-only)
-- ---------------------------------------------------------------------
SELECT 'PREVIEW: bug-strays to be cancelled' AS phase,
  COUNT(*) AS n_orders,
  COALESCE(SUM(total), 0)::INT AS total_paise
FROM "Order"
WHERE "paymentMethod" = 'RAZORPAY'
  AND "paymentStatus" = 'PENDING'
  AND "status" = 'PLACED'
  AND "razorpayPaymentId" IS NULL
  AND "createdAt" < NOW() - INTERVAL '1 hour';

-- ---------------------------------------------------------------------
-- Cancel them. Auditable: cancellationReason + cancelledAt + status flag.
-- ---------------------------------------------------------------------
UPDATE "Order"
SET "status"             = 'CANCELLED_BUG',
    "cancellationReason" = 'auto-cancelled: created in pre-payment phase, NEEJEE-263 (Sprint 26.3a)',
    "cancelledAt"        = NOW(),
    "updatedAt"          = NOW()
WHERE "paymentMethod" = 'RAZORPAY'
  AND "paymentStatus" = 'PENDING'
  AND "status" = 'PLACED'
  AND "razorpayPaymentId" IS NULL
  AND "createdAt" < NOW() - INTERVAL '1 hour';

-- ---------------------------------------------------------------------
-- For each cancelled bug-stray, drop a synthetic AbandonedCart row so the
-- customer still enters the recovery flow (T+1h cadence starts now).
-- Only insert if no AbandonedCart already exists for this email/snapshot.
-- ---------------------------------------------------------------------
INSERT INTO "AbandonedCart" (
  "id", "email", "userId", "phone", "customerName",
  "itemsJson", "subtotal", "itemCount",
  "paymentMethodPicked", "lastSeenStep",
  "recoveryStage", "nextActionAt",
  "createdAt", "updatedAt"
)
SELECT
  'ac_' || substr(md5(o."id" || NOW()::TEXT), 1, 24),
  COALESCE(LOWER(o."guestEmail"), LOWER(u."email")),
  o."userId",
  NULL,                                            -- phone unknown at this point
  COALESCE(o."guestName", u."name"),
  json_build_array(
    json_build_object('orderRef', o."orderNumber", 'subtotal', o."subtotal")
  )::TEXT,
  o."subtotal",
  (SELECT COUNT(*) FROM "OrderItem" oi WHERE oi."orderId" = o."id"),
  'PREPAID',
  'payment',
  0,                                               -- stage 0 → cron will pick at T+1h
  NOW() + INTERVAL '1 hour',
  o."createdAt",
  NOW()
FROM "Order" o
LEFT JOIN "User" u ON u."id" = o."userId"
WHERE o."status" = 'CANCELLED_BUG'
  AND o."cancellationReason" LIKE '%NEEJEE-263%'
  AND COALESCE(o."guestEmail", u."email") IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "AbandonedCart" ac
    WHERE LOWER(ac."email") = COALESCE(LOWER(o."guestEmail"), LOWER(u."email"))
      AND ac."recoveredOrderId" IS NULL
      AND ac."createdAt" >= o."createdAt" - INTERVAL '5 minutes'
  );

-- ---------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------
SELECT 'AFTER: cancelled bug-strays' AS phase, COUNT(*) AS n
FROM "Order" WHERE "status" = 'CANCELLED_BUG';

SELECT 'AFTER: abandoned carts ready for recovery' AS phase, COUNT(*) AS n
FROM "AbandonedCart"
WHERE "recoveryStage" = 0
  AND "recoveredOrderId" IS NULL
  AND "optedOut" = FALSE
  AND "nextActionAt" <= NOW() + INTERVAL '2 hours';

COMMIT;
