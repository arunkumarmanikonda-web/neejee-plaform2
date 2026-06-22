// v23.40.1 — Performance pay / incentive plan upsert for an employee.
// GET  /api/admin/payroll/employees/:id/incentive
// PUT  /api/admin/payroll/employees/:id/incentive

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { recordAudit } from '@/lib/finance/audit-log';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const plan = await prisma.incentivePlan.findUnique({ where: { employeeId: params.id } });
  return NextResponse.json({ plan });
}

const FIELDS = [
  'planType', 'fixedIncentivePaise', 'variableBasePaise', 'variableMaxPaise',
  'quarterlyBonusPaise', 'annualBonusPaise',
  'payoutFrequency', 'metric', 'notes', 'active',
];

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.write');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json();
  const before = await prisma.incentivePlan.findUnique({ where: { employeeId: params.id } });

  const data: any = {};
  for (const f of FIELDS) {
    if (body[f] !== undefined) data[f] = body[f];
  }

  const plan = await prisma.incentivePlan.upsert({
    where: { employeeId: params.id },
    update: data,
    create: {
      id: 'incp_' + randomBytes(10).toString('hex'),
      employeeId: params.id,
      ...data,
    },
  });

  await recordAudit({
    action: before ? 'UPDATE' : 'CREATE',
    entityType: 'IncentivePlan',
    entityId: plan.id,
    before, after: plan, session, req,
  });

  return NextResponse.json({ plan });
}
