-- The shop uses a server database connection. Public API roles do not maintain its tables.
-- Scope the change to app-owned tables. Supabase platform roles keep their own defaults.
DO $$
DECLARE
  item record;
  privileges text := 'TRUNCATE, REFERENCES, TRIGGER';
BEGIN
  IF current_setting('server_version_num')::int >= 170000 THEN
    privileges := privileges || ', MAINTAIN';
  END IF;
  FOR item IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relowner = 'postgres'::regrole AND c.relkind IN ('r','p')
  LOOP
    EXECUTE format('REVOKE %s ON TABLE public.%I FROM anon, authenticated, PUBLIC', privileges, item.relname);
  END LOOP;
END $$;

-- New app tables must explicitly grant the access their Data API policies require.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated, PUBLIC;
