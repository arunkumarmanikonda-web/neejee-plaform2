// v23.40 — One-time employee adjustments (incentive/bonus/advance/loan/fine/etc.)
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { recordAudit } from '@/lib/finance/audit-log';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_KINDS = ['INCENTIVE','BONUS','REIMBURSEMENT','OTHER_EARNING','ADVANCE','LOAN_EMI','FINE','OTHER_DEDUCTION'];

export async function GET(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const url = new URL(req.url);
  const employeeId = url.searchParams.get('employeeId') || undefined;
  const month = url.searchParams.get('month');
  const year = url.searchParams.get('year');

  const where: any = {};
  if (employeeId) where.employeeId = employeeId;
  if (month && year) { where.forMonth = parseInt(month); where.forYear = parseInt(year); }

  const rows = await prisma.employeeAdjustment.findMany({
    where, orderBy: { createdAt: 'desc' }, take: 200,
    include: { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } } },
  });
  return NextResponse.json({ adjustments: rows });
}

export async function POST(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.write');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const body = await req.json();
    const { employeeId, forMonth, forYear, kind, amountPaise, description } = body;
    if (!employeeId || !forMonth || !forYear || !kind || !amountPaise || !description) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    }
    if (!VALID_KINDS.includes(kind)) {
      return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
    }
    const created = await prisma.employeeAdjustment.create({
      data: {
        id: 'empadj_' + randomBytes(10).toString('hex'),
        employeeId,
        forMonth: Number(forMonth),
        forYear: Number(forYear),
        kind,
        amountPaise: Number(amountPaise),
        description: String(description).trim(),
        createdByUserId: session!.id,
      },
    });
    await recordAudit({
      action: 'CREATE', entityType: 'EmployeeAdjustment', entityId: created.id,
      after: created, session, req,
    });
    return NextResponse.json({ adjustment: created }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
