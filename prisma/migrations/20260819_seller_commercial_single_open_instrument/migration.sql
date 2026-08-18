CREATE UNIQUE INDEX IF NOT EXISTS "SellerCommercialInstrument_one_open_per_relationship"
ON "SellerCommercialInstrument" ("sellerRef")
WHERE "status" IN ('DRAFT','ISSUED','SELLER_SIGNED','COMPANY_SIGNED');
