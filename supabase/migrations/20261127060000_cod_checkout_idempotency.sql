-- Apply before deploying the generated Prisma client and the checkout handlers.
ALTER TABLE public."Order"
  ADD COLUMN IF NOT EXISTS "codAttemptKey" text,
  ADD COLUMN IF NOT EXISTS "codRequestHash" text;
CREATE UNIQUE INDEX IF NOT EXISTS "Order_codAttemptKey_key" ON public."Order"("codAttemptKey");
