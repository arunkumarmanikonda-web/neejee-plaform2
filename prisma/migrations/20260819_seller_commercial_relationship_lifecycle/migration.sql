CREATE TABLE IF NOT EXISTS "SellerCommercialInstrument" (
  "id" TEXT PRIMARY KEY,
  "sellerId" TEXT NULL,
  "sellerRef" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "instrumentType" TEXT NOT NULL,
  "instrumentNumber" TEXT NOT NULL UNIQUE,
  "title" TEXT NOT NULL,
  "parentInstrumentId" TEXT NULL,
  "rootInstrumentId" TEXT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "effectiveFrom" TIMESTAMPTZ NOT NULL,
  "effectiveTo" TIMESTAMPTZ NULL,
  "commissionPct" DOUBLE PRECISION NULL,
  "qualityScore" DOUBLE PRECISION NULL,
  "payoutCycle" TEXT NULL,
  "isNeejeeSelect" BOOLEAN NULL,
  "termsSnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "documentSnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "changeReason" TEXT NULL,
  "createdByUserId" TEXT NULL,
  "issuedAt" TIMESTAMPTZ NULL,
  "sellerSignedAt" TIMESTAMPTZ NULL,
  "companySignedAt" TIMESTAMPTZ NULL,
  "closedAt" TIMESTAMPTZ NULL,
  "supersededAt" TIMESTAMPTZ NULL,
  "terminatedAt" TIMESTAMPTZ NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "SellerCommercialInstrument_seller_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE SET NULL,
  CONSTRAINT "SellerCommercialInstrument_parent_fkey" FOREIGN KEY ("parentInstrumentId") REFERENCES "SellerCommercialInstrument"("id") ON DELETE SET NULL,
  CONSTRAINT "SellerCommercialInstrument_root_fkey" FOREIGN KEY ("rootInstrumentId") REFERENCES "SellerCommercialInstrument"("id") ON DELETE SET NULL,
  CONSTRAINT "SellerCommercialInstrument_type_check" CHECK ("instrumentType" IN ('INITIAL','ADDENDUM','RENEWAL','TERMINATION')),
  CONSTRAINT "SellerCommercialInstrument_status_check" CHECK ("status" IN ('DRAFT','ISSUED','SELLER_SIGNED','COMPANY_SIGNED','ACTIVE','EXPIRED','TERMINATED','SUPERSEDED','VOID')),
  CONSTRAINT "SellerCommercialInstrument_dates_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom"),
  CONSTRAINT "SellerCommercialInstrument_seller_sequence_key" UNIQUE ("sellerRef", "sequence")
);

CREATE INDEX IF NOT EXISTS "SellerCommercialInstrument_sellerRef_idx" ON "SellerCommercialInstrument"("sellerRef", "sequence" DESC);
CREATE INDEX IF NOT EXISTS "SellerCommercialInstrument_effective_idx" ON "SellerCommercialInstrument"("sellerRef", "effectiveFrom", "effectiveTo");
CREATE INDEX IF NOT EXISTS "SellerCommercialInstrument_status_idx" ON "SellerCommercialInstrument"("status");

CREATE TABLE IF NOT EXISTS "SellerRelationshipEvent" (
  "id" TEXT PRIMARY KEY,
  "sellerId" TEXT NULL,
  "sellerRef" TEXT NOT NULL,
  "instrumentId" TEXT NULL,
  "eventKey" TEXT NOT NULL UNIQUE,
  "eventType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "details" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "actorUserId" TEXT NULL,
  "occurredAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "SellerRelationshipEvent_seller_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE SET NULL,
  CONSTRAINT "SellerRelationshipEvent_instrument_fkey" FOREIGN KEY ("instrumentId") REFERENCES "SellerCommercialInstrument"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "SellerRelationshipEvent_sellerRef_idx" ON "SellerRelationshipEvent"("sellerRef", "occurredAt" DESC);
CREATE INDEX IF NOT EXISTS "SellerRelationshipEvent_instrument_idx" ON "SellerRelationshipEvent"("instrumentId");

COMMENT ON TABLE "SellerCommercialInstrument" IS 'Immutable commercial/legal instrument ledger for seller relationships: initial agreements, addenda, renewals and termination instruments.';
COMMENT ON TABLE "SellerRelationshipEvent" IS 'Append-only seller commercial relationship timeline retained independently of the current Seller profile.';