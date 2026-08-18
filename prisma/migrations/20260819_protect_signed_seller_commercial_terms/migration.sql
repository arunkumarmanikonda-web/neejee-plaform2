CREATE OR REPLACE FUNCTION public.protect_signed_seller_commercial_terms()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  legal_terms record;
BEGIN
  IF NEW."commissionPct" IS NOT DISTINCT FROM OLD."commissionPct"
     AND NEW."qualityScore" IS NOT DISTINCT FROM OLD."qualityScore"
     AND NEW."payoutCycle" IS NOT DISTINCT FROM OLD."payoutCycle"
     AND NEW."isNeejeeSelect" IS NOT DISTINCT FROM OLD."isNeejeeSelect" THEN
    RETURN NEW;
  END IF;

  SELECT i."commissionPct", i."qualityScore", i."payoutCycle", i."isNeejeeSelect"
  INTO legal_terms
  FROM "SellerCommercialInstrument" i
  WHERE i."sellerRef" = OLD."id"
    AND i."instrumentType" <> 'TERMINATION'
    AND i."status" = 'ACTIVE'
    AND i."effectiveFrom" <= NOW()
    AND (i."effectiveTo" IS NULL OR i."effectiveTo" >= NOW())
  ORDER BY i."effectiveFrom" DESC, i."sequence" DESC
  LIMIT 1;

  IF FOUND THEN
    IF NEW."commissionPct" IS DISTINCT FROM legal_terms."commissionPct"
       OR NEW."qualityScore" IS DISTINCT FROM legal_terms."qualityScore"
       OR NEW."payoutCycle" IS DISTINCT FROM legal_terms."payoutCycle"
       OR NEW."isNeejeeSelect" IS DISTINCT FROM legal_terms."isNeejeeSelect" THEN
      RAISE EXCEPTION USING
        MESSAGE = 'Signed commercial terms are immutable. Create an Addendum or Renewal Agreement to change them.',
        ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "ProtectSignedSellerCommercialTerms" ON "Seller";
CREATE TRIGGER "ProtectSignedSellerCommercialTerms"
BEFORE UPDATE OF "commissionPct", "qualityScore", "payoutCycle", "isNeejeeSelect" ON "Seller"
FOR EACH ROW
EXECUTE FUNCTION public.protect_signed_seller_commercial_terms();