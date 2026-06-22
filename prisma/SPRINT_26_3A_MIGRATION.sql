-- =====================================================================
-- SPRINT_26_3A_MIGRATION.sql
-- Sprint 26.3a — Checkout correctness + Abandoned cart recovery
-- Run order: 1) this migration, 2) SPRINT_26_3A_CLEANUP.sql
-- Idempotent: safe to re-run.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- N1. Extend AbandonedCart with recovery state machine fields
-- ---------------------------------------------------------------------
ALTER TABLE "AbandonedCart"
  ADD COLUMN IF NOT EXISTS "phone"               TEXT,
  ADD COLUMN IF NOT EXISTS "customerName"        TEXT,
  ADD COLUMN IF NOT EXISTS "recoveryStage"       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "nextActionAt"        TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "discountCode"        TEXT,
  ADD COLUMN IF NOT EXISTS "discountPercent"     INTEGER,
  ADD COLUMN IF NOT EXISTS "aiCopyJson"          JSONB,
  ADD COLUMN IF NOT EXISTS "cartSnapshotHtml"    TEXT,
  ADD COLUMN IF NOT EXISTS "paymentMethodPicked" TEXT,            -- NULL | COD | PREPAID
  ADD COLUMN IF NOT EXISTS "lastSeenStep"        TEXT,            -- cart | address | payment
  ADD COLUMN IF NOT EXISTS "razorpayOrderId"     TEXT,
  ADD COLUMN IF NOT EXISTS "telecallerStatus"    TEXT,            -- NULL|CONNECTED|NO_PICK|CALLBACK|CONVERTED|LOST
  ADD COLUMN IF NOT EXISTS "telecallerNotes"     TEXT,
  ADD COLUMN IF NOT EXISTS "telecallerCalledAt"  TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "telecallerCallbackAt" TIMESTAMP;

CREATE INDEX IF NOT EXISTS "AbandonedCart_nextActionAt_idx"
  ON "AbandonedCart" ("nextActionAt")
  WHERE "recoveredOrderId" IS NULL AND "optedOut" = FALSE;

CREATE INDEX IF NOT EXISTS "AbandonedCart_recoveryStage_idx"
  ON "AbandonedCart" ("recoveryStage", "nextActionAt");

CREATE INDEX IF NOT EXISTS "AbandonedCart_telecallerStatus_idx"
  ON "AbandonedCart" ("telecallerStatus") WHERE "telecallerStatus" IS NOT NULL;

-- ---------------------------------------------------------------------
-- N2. Add CANCELLED_BUG to OrderStatus enum (so we can flag bug-strays
--     separately from legitimate customer cancellations).
-- ---------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'CANCELLED_BUG'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'OrderStatus')
  ) THEN
    ALTER TYPE "OrderStatus" ADD VALUE 'CANCELLED_BUG';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- N3. Add audit columns to Order
-- ---------------------------------------------------------------------
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT,
  ADD COLUMN IF NOT EXISTS "cancelledAt"        TIMESTAMP;

-- ---------------------------------------------------------------------
-- N4. RecoverySettings singleton (id = 'default')
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "RecoverySettings" (
  "id"                       TEXT     PRIMARY KEY DEFAULT 'default',
  "cadenceHours"             JSONB    NOT NULL DEFAULT '{"stage1":1,"stage2":24,"stage3":72,"stage4":168}'::jsonb,
  "discountPercents"         JSONB    NOT NULL DEFAULT '{"stage2":10,"stage3":15}'::jsonb,
  "aiEnabled"                BOOLEAN  NOT NULL DEFAULT TRUE,
  "telecallerHandoffEnabled" BOOLEAN  NOT NULL DEFAULT TRUE,
  "abandonGraceMinutes"      INTEGER  NOT NULL DEFAULT 30,
  "updatedAt"                TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO "RecoverySettings" ("id") VALUES ('default')
ON CONFLICT ("id") DO NOTHING;

-- ---------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------
SELECT 'AbandonedCart cols added' AS check,
  COUNT(*) FILTER (WHERE column_name IN (
    'phone','customerName','recoveryStage','nextActionAt','discountCode',
    'discountPercent','aiCopyJson','cartSnapshotHtml','paymentMethodPicked',
    'lastSeenStep','razorpayOrderId','telecallerStatus','telecallerNotes',
    'telecallerCalledAt','telecallerCallbackAt'
  )) AS n
FROM information_schema.columns WHERE table_name = 'AbandonedCart';

SELECT 'Order cols added' AS check,
  COUNT(*) FILTER (WHERE column_name IN ('cancellationReason','cancelledAt')) AS n
FROM information_schema.columns WHERE table_name = 'Order';

SELECT 'RecoverySettings ready' AS check, COUNT(*) AS n FROM "RecoverySettings";

COMMIT;
