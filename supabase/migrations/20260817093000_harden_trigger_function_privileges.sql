-- Applied to production Supabase as: harden_trigger_function_privileges
-- Preserve the RLS auto-enable event trigger while removing direct web-role execution.

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

alter function public.update_customer_updated_at()
  set search_path = pg_catalog;

revoke execute on function public.update_customer_updated_at() from public, anon, authenticated;
