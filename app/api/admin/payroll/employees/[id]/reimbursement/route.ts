// v23.40.1 — Reimbursement policy upsert for an employee.
// GET  /api/admin/payroll/employees/:id/reimbursement
// PUT  /api/admin/payroll/employees/:id/reimbursement   body: { mobileCapPaise, ... }

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

  const policy = await prisma.reimbursementPolicy.findUnique({ where: { employeeId: params.id } });
  return NextResponse.json({ policy });
}

const FIELDS = [
  'mobileCapPaise', 'conveyanceCapPaise', 'internetCapPaise',
  'foodCapPaise', 'fuelCapPaise', 'bookCapPaise', 'otherCapPaise',
  'autoAddToPayroll', 'notes',
];

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.write');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json();
  const before = await prisma.reimbursementPolicy.findUnique({ where: { employeeId: params.id } });

  const data: any = {};
  for (const f of FIELDS) {
    if (body[f] !== undefined) data[f] = body[f];
  }

  const policy = await prisma.reimbursementPolicy.upsert({
    where: { employeeId: params.id },
    update: data,
    create: {
      id: 'reim_' + randomBytes(10).toString('hex'),
      employeeId: params.id,
      ...data,
    },
  });

  await recordAudit({
    action: before ? 'UPDATE' : 'CREATE',
    entityType: 'ReimbursementPolicy',
    entityId: policy.id,
    before, after: policy, session, req,
  });

  return NextResponse.json({ policy });
}
