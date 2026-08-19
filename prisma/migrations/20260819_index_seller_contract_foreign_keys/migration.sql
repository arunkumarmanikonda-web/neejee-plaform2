-- Cover seller contract foreign keys used by lifecycle, history and cascade checks.
-- This avoids table scans as the commercial-instrument ledger grows.

CREATE INDEX IF NOT EXISTS "SellerCommercialInstrument_sellerId_idx"
ON public."SellerCommercialInstrument" ("sellerId");

CREATE INDEX IF NOT EXISTS "SellerCommercialInstrument_parentInstrumentId_idx"
ON public."SellerCommercialInstrument" ("parentInstrumentId");

CREATE INDEX IF NOT EXISTS "SellerCommercialInstrument_rootInstrumentId_idx"
ON public."SellerCommercialInstrument" ("rootInstrumentId");

CREATE INDEX IF NOT EXISTS "SellerRelationshipEvent_sellerId_idx"
ON public."SellerRelationshipEvent" ("sellerId");
