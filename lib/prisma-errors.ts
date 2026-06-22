// Shared Prisma error translator. Surface "missing table" and "missing column"
// errors (the usual symptom of a release deployed without running the migration
// SQL) with a clear message that points at the fix.
export function prismaErrorToHttp(e: any): { status: number; message: string; code?: string } {
  const code = e?.code as string | undefined;
  const meta = e?.meta;
  const msg = String(e?.message || '');

  if (code === 'P2021' || /does not exist in the current database/i.test(msg) || /relation ".*" does not exist/i.test(msg)) {
    return {
      status: 500,
      code,
      message: 'Database table is missing. Please run the latest migration SQL in Supabase \u2192 SQL Editor.',
    };
  }
  if (code === 'P2022' || /column ".*" (does not exist|of relation)/i.test(msg)) {
    return {
      status: 500,
      code,
      message: `Database column is missing (${meta?.column || 'unknown'}). Re-run the latest migration SQL in Supabase.`,
    };
  }
  if (code === 'P2002') return { status: 409, code, message: 'Duplicate value on a unique field' };
  if (code === 'P2003') return { status: 400, code, message: 'Foreign key constraint failed' };
  if (code === 'P2025') return { status: 404, code, message: 'Record not found' };
  return { status: 500, code, message: msg || 'Server error' };
}
