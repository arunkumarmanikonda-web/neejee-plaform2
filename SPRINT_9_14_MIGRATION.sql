-- Sprint 9.14 (v23.32) — Configurable shipping zones
-- Run BEFORE deploying.

CREATE TABLE IF NOT EXISTS "ShippingZone" (
  "id"                     TEXT PRIMARY KEY,
  "name"                   TEXT NOT NULL,
  "pincodePrefixes"        TEXT[] NOT NULL DEFAULT '{}',
  "pincodeExact"           TEXT[] NOT NULL DEFAULT '{}',
  "states"                 TEXT[] NOT NULL DEFAULT '{}',
  "isDefault"              BOOLEAN NOT NULL DEFAULT FALSE,
  "standardPaise"          INTEGER NOT NULL DEFAULT 15000,
  "expressPaise"           INTEGER NOT NULL DEFAULT 25000,
  "freeAboveSubtotalPaise" INTEGER NOT NULL DEFAULT 250000,
  "inclusive"              BOOLEAN NOT NULL DEFAULT FALSE,
  "priority"               INTEGER NOT NULL DEFAULT 100,
  "active"                 BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ShippingZone_active_priority_idx" ON "ShippingZone"("active", "priority" DESC);
CREATE INDEX IF NOT EXISTS "ShippingZone_isDefault_idx"        ON "ShippingZone"("isDefault");

-- Seed a sensible default zone if no zones exist
INSERT INTO "ShippingZone" (
  "id", "name", "isDefault", "standardPaise", "expressPaise", "freeAboveSubtotalPaise", "inclusive", "priority", "active"
)
SELECT
  'zone_default_rest_of_india',
  'Rest of India (default)',
  TRUE,
  15000,
  25000,
  250000,
  FALSE,
  0,
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM "ShippingZone");
