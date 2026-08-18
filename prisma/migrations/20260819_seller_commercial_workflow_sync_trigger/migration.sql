CREATE OR REPLACE FUNCTION public.sync_seller_commercial_instrument_workflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wf jsonb;
  instrument_id text;
  workflow_status text;
  mapped_status text;
  instrument_type text;
  event_type text;
  event_title text;
BEGIN
  wf := COALESCE(NEW."autoKycSummary"->'agreementWorkflow', '{}'::jsonb);
  instrument_id := NULLIF(BTRIM(COALESCE(wf->>'instrumentId', '')), '');
  workflow_status := UPPER(NULLIF(BTRIM(COALESCE(wf->>'status', '')), ''));

  IF instrument_id IS NULL OR workflow_status IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT "instrumentType" INTO instrument_type
  FROM "SellerCommercialInstrument"
  WHERE "id" = instrument_id;

  IF instrument_type IS NULL THEN
    RETURN NEW;
  END IF;

  mapped_status := CASE workflow_status
    WHEN 'DRAFT' THEN 'DRAFT'
    WHEN 'INTERNAL_REVIEW' THEN 'DRAFT'
    WHEN 'SELLER_REVIEW' THEN 'DRAFT'
    WHEN 'READY_TO_LOCK' THEN 'DRAFT'
    WHEN 'LOCKED' THEN 'DRAFT'
    WHEN 'SENT_FOR_SIGNATURE' THEN 'ISSUED'
    WHEN 'SENT_FOR_SELLER_SIGNATURE' THEN 'ISSUED'
    WHEN 'SELLER_SIGNED' THEN 'SELLER_SIGNED'
    WHEN 'SELLER_SIGNED_PENDING_COMPANY' THEN 'SELLER_SIGNED'
    WHEN 'COMPANY_SIGNED' THEN 'COMPANY_SIGNED'
    WHEN 'CLOSED' THEN CASE WHEN instrument_type = 'TERMINATION' THEN 'TERMINATED' ELSE 'ACTIVE' END
    WHEN 'VOID' THEN 'VOID'
    ELSE NULL
  END;

  IF mapped_status IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE "SellerCommercialInstrument"
  SET
    "status" = mapped_status,
    "issuedAt" = CASE WHEN mapped_status IN ('ISSUED','SELLER_SIGNED','COMPANY_SIGNED','ACTIVE','TERMINATED') THEN COALESCE("issuedAt", NULLIF(wf->>'sentForSignatureAt','')::timestamptz, NOW()) ELSE "issuedAt" END,
    "sellerSignedAt" = CASE WHEN mapped_status IN ('SELLER_SIGNED','COMPANY_SIGNED','ACTIVE','TERMINATED') THEN COALESCE("sellerSignedAt", NULLIF(wf->>'sellerSignedAt','')::timestamptz) ELSE "sellerSignedAt" END,
    "companySignedAt" = CASE WHEN mapped_status IN ('COMPANY_SIGNED','ACTIVE','TERMINATED') THEN COALESCE("companySignedAt", NULLIF(wf->>'companySignedAt','')::timestamptz) ELSE "companySignedAt" END,
    "closedAt" = CASE WHEN mapped_status IN ('ACTIVE','TERMINATED') THEN COALESCE("closedAt", NULLIF(wf->>'closedAt','')::timestamptz, NOW()) ELSE "closedAt" END,
    "terminatedAt" = CASE WHEN mapped_status = 'TERMINATED' THEN COALESCE("terminatedAt", "effectiveFrom", NOW()) ELSE "terminatedAt" END,
    "updatedAt" = NOW()
  WHERE "id" = instrument_id;

  event_type := CASE mapped_status
    WHEN 'ISSUED' THEN 'INSTRUMENT_ISSUED'
    WHEN 'SELLER_SIGNED' THEN 'SELLER_SIGNED_INSTRUMENT'
    WHEN 'COMPANY_SIGNED' THEN 'COMPANY_SIGNED_INSTRUMENT'
    WHEN 'ACTIVE' THEN 'INSTRUMENT_ACTIVATED'
    WHEN 'TERMINATED' THEN 'RELATIONSHIP_TERMINATED'
    WHEN 'VOID' THEN 'INSTRUMENT_VOIDED'
    ELSE NULL
  END;

  IF event_type IS NOT NULL THEN
    event_title := CASE mapped_status
      WHEN 'ISSUED' THEN 'Legal instrument issued to seller'
      WHEN 'SELLER_SIGNED' THEN 'Seller signed legal instrument'
      WHEN 'COMPANY_SIGNED' THEN 'NEEJEE countersigned legal instrument'
      WHEN 'ACTIVE' THEN 'Commercial instrument closed and activated'
      WHEN 'TERMINATED' THEN 'Seller relationship termination completed'
      WHEN 'VOID' THEN 'Legal instrument voided'
      ELSE event_type
    END;

    INSERT INTO "SellerRelationshipEvent" (
      "id", "sellerId", "sellerRef", "instrumentId", "eventKey", "eventType", "title", "details", "occurredAt", "createdAt"
    )
    SELECT
      gen_random_uuid()::text,
      NEW."id",
      NEW."id",
      instrument_id,
      'workflow:' || instrument_id || ':' || mapped_status,
      event_type,
      event_title,
      jsonb_build_object('workflowStatus', workflow_status, 'instrumentStatus', mapped_status),
      NOW(),
      NOW()
    ON CONFLICT ("eventKey") DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "SellerCommercialInstrumentWorkflowSync" ON "Seller";
CREATE TRIGGER "SellerCommercialInstrumentWorkflowSync"
AFTER UPDATE OF "autoKycSummary" ON "Seller"
FOR EACH ROW
EXECUTE FUNCTION public.sync_seller_commercial_instrument_workflow();