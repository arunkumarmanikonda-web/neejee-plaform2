-- Previous releases did not retain Shiprocket IDs until AWB assignment.
-- Review pre-existing open orders once before submitting another booking.
DO $$
DECLARE first_install boolean := NOT EXISTS (
  SELECT 1 FROM information_schema.columns WHERE table_schema='public'
  AND table_name='Order' AND column_name='shiprocketStage'
);
BEGIN
  ALTER TABLE public."Order"
    ADD COLUMN IF NOT EXISTS "shiprocketShipmentId" text,
    ADD COLUMN IF NOT EXISTS "shiprocketOrderId" text,
    ADD COLUMN IF NOT EXISTS "shiprocketPaymentMode" text,
    ADD COLUMN IF NOT EXISTS "shiprocketStage" text,
    ADD COLUMN IF NOT EXISTS "shiprocketClaimedAt" timestamp(3);
  IF first_install THEN
    UPDATE public."Order" SET "shiprocketStage"='CHECK_BOOKING'
    WHERE "status" IN ('PLACED','CONFIRMED','PACKED') AND COALESCE("awbNumber",'')='';
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "Order_shiprocketShipmentId_key" ON public."Order"("shiprocketShipmentId");
