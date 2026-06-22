// Idempotent seed of the default Chart of Accounts.
// POST /api/admin/finance/seed-categories  — admin/super_admin/finance only.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { seedExpenseCategories } from '@/lib/finance/seed-categories';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.admin');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const { created, skipped } = await seedExpenseCategories();
    return NextResponse.json({
      ok: true,
      created,
      skipped,
      message: `Seeded ${created} new categories (${skipped} already existed).`,
    });
  } catch (err: any) {
    const mapped = prismaErrorToHttp(err);
    console.error('[finance.seed]', err);
    return NextResponse.json({ error: mapped.message, code: mapped.code }, { status: mapped.status });
  }
}

export async function GET() {
  // Convenience: report seed status without writing.
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const { prisma } = await import('@/lib/prisma');
    const count = await prisma.expenseCategory.count();
    return NextResponse.json({ count });
  } catch (err: any) {
    const mapped = prismaErrorToHttp(err);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
