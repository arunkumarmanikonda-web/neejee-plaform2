-- Trigger functions must not be exposed as callable Data API RPC endpoints.
-- They remain SECURITY DEFINER because the trigger workflow needs controlled
-- access to related seller commercial-instrument tables, but execution is
-- restricted to privileged database roles only.

REVOKE EXECUTE ON FUNCTION public.protect_signed_seller_commercial_terms()
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.sync_seller_commercial_instrument_workflow()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.protect_signed_seller_commercial_terms()
TO service_role;

GRANT EXECUTE ON FUNCTION public.sync_seller_commercial_instrument_workflow()
TO service_role;
