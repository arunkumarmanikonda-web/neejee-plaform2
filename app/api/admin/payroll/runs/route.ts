// v23.40 — Payroll runs
// GET  /api/admin/payroll/runs           — list all
// POST /api/admin/payroll/runs           — create a new run for { month, year }

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { recordAudit } from '@/lib/finance/audit-log';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export async function GET() {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const runs = await prisma.payrollRun.findMany({
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    take: 36,
  });
  return NextResponse.json({ runs });
}

export async function POST(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.write');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const body = await req.json();
    const { month, year, notes } = body;
    if (!month || !year) return NextResponse.json({ error: 'month, year required' }, { status: 400 });
    const m = Number(month), y = Number(year);
    if (m < 1 || m > 12 || y < 2020 || y > 2099) {
      return NextResponse.json({ error: 'Invalid month/year' }, { status: 400 });
    }

    // Check duplicate
    const existing = await prisma.payrollRun.findUnique({
      where: { month_year: { month: m, year: y } },
    });
    if (existing) {
      return NextResponse.json({ error: `Payroll run for ${MONTH_NAMES[m - 1]} ${y} already exists` }, { status: 409 });
    }

    const created = await prisma.payrollRun.create({
      data: {
        id: 'prun_' + randomBytes(10).toString('hex'),
        month: m, year: y,
        label: `${MONTH_NAMES[m - 1]} ${y}`,
        status: 'DRAFT',
        notes: notes || null,
        createdByUserId: session!.id,
      },
    });
    await recordAudit({
      action: 'CREATE', entityType: 'PayrollRun', entityId: created.id,
      after: created, session, req,
    });
    return NextResponse.json({ run: created }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
