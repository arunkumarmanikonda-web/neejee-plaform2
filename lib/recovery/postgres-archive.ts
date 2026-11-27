import { execFile } from 'node:child_process';
import { chmod, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { rootCertificates } from 'node:tls';
import { promisify } from 'node:util';
import { readCredential } from '../payments/razorpay-credentials';

const execute = promisify(execFile);
export const appSchemas = ['public','private','supabase_migrations'];
const maxBytes = 32 * 1024 * 1024;

export async function dumpDatabase(dir: string) {
  const ca = join(dir,'trusted-ca.pem');
  await writeFile(ca,rootCertificates.join('\n'),{mode:0o600});
  const candidates = [...new Set([process.env.DIRECT_URL, process.env.DATABASE_URL].map(readCredential).filter(Boolean))];
  let failure = 'No database connection is configured';
  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      const passwordFile = join(dir,'pgpass');
      const field = (s:string) => s.replace(/\\/g,'\\\\').replace(/:/g,'\\:');
      // libpq matches the specific host/user. Avoid putting credentials in process arguments.
      await writeFile(passwordFile, [url.hostname,url.port || '5432',decodeURIComponent(url.pathname.slice(1) || 'postgres'),decodeURIComponent(url.username),decodeURIComponent(url.password)].map(field).join(':')+'\n',{mode:0o600});
      await chmod(passwordFile,0o600);
      const local = ['localhost','127.0.0.1'].includes(url.hostname) && process.env.VERCEL_ENV !== 'production';
      const pgEnv = {PGHOST:url.hostname, PGPORT:url.port || '5432', PGUSER:decodeURIComponent(url.username),
        PGDATABASE:decodeURIComponent(url.pathname.slice(1) || 'postgres'), PGPASSFILE:passwordFile, PGCONNECT_TIMEOUT:'7',
        PGAPPNAME:'neejee_readonly_recovery',
        PGSSLMODE:local ? 'disable' : 'verify-full', PGSSLROOTCERT:ca};
      const binary = await pgTool('pg_dump',['--no-password','--format=custom','--inserts','--compress=gzip:6',
        '--lock-wait-timeout=5s',...appSchemas.map(x=>'--schema='+x)], pgEnv);
      if (!binary.subarray(0,5).equals(Buffer.from('PGDMP'))) throw new Error('Invalid archive signature');
      return binary;
    } catch (error) {
      // Do not propagate command lines, host names, connection parameters, SQL or source rows.
      const detail = String((error as {stderr?: unknown})?.stderr || '');
      failure = /certificate|SSL error/i.test(detail) ? 'Database TLS verification failed'
        : /permission denied/i.test(detail) ? 'Database backup permission denied'
        : /password authentication|no password supplied/i.test(detail) ? 'Database login rejected'
        : /connection|resolve|translate host/i.test(detail) ? 'Database connection unavailable'
        : 'Database dump failed';
    }
  }
  throw new Error(failure);
}

async function pgTool(name: string, args: string[], pgEnv: Record<string,string> = {}) {
  const dir = join(process.cwd(),'.neejee-postgres');
  const {stdout} = await execute(join(dir,'ld-musl-x86_64.so.1'),['--library-path',dir,join(dir,name),...args],
    {env:{NODE_ENV:process.env.NODE_ENV,LANG:'C',TZ:'UTC',...pgEnv}, encoding:'buffer', maxBuffer:maxBytes, timeout:55000});
  return stdout;
}

export async function rehearseDatabase(archive: Buffer, dir: string) {
  const path = join(dir,'application.dump');
  await writeFile(path,archive,{mode:0o600});
  const schemaArgs = ['--no-owner','--no-privileges','--no-tablespaces','--file=-',path];
  let sql = (await pgTool('pg_restore',schemaArgs)).toString('utf8');
  // pg_restore emits two psql client commands outside the SQL stream.
  const guard = sql.match(/^\\restrict ([A-Za-z0-9]+)$/m)?.[1];
  if (guard) sql = sql.replace('\\restrict '+guard+'\n','').replace('\\unrestrict '+guard+'\n','');
  sql = sql.replace(/^CREATE SCHEMA public;$/m,'CREATE SCHEMA IF NOT EXISTS public;');
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE ROLE service_role; CREATE ROLE supabase_admin; CREATE ROLE authenticator;
      CREATE SCHEMA auth; CREATE SCHEMA extensions; CREATE SCHEMA storage;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT NULL::uuid';
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS 'SELECT NULL::jsonb';
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS 'SELECT NULL::text';`);
    await db.exec(sql);
    const result = await db.query<{tables:number;secured:number;orders:number;users:number;models:number}>(`
      SELECT (SELECT count(*)::int FROM pg_tables WHERE schemaname='public') tables,
      (SELECT count(*)::int FROM pg_tables WHERE schemaname='public' AND rowsecurity) secured,
      (SELECT count(*)::int FROM public."Order") orders, (SELECT count(*)::int FROM public."User") users,
      (SELECT count(*)::int FROM pg_tables WHERE schemaname='private') models`);
    const counts = result.rows[0];
    if (!counts.tables || !counts.models || counts.secured !== counts.tables) throw new Error(`Restored access control check failed (public tables ${counts.tables}, secured ${counts.secured}, private tables ${counts.models})`);
    return counts;
  } finally { await db.close(); }
}
