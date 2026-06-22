// v23.40 — Payroll configuration (singleton)
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { recordAudit } from '@/lib/finance/audit-log';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const config = await prisma.payrollConfig.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton', updatedAt: new Date() },
  });
  return NextResponse.json({ config });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.admin');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const before = await prisma.payrollConfig.findUnique({ where: { id: 'singleton' } });
  const body = await req.json();
  const allowed = [
    'pfEnabled', 'esiEnabled', 'tdsEnabled', 'ptEnabled',
    'pfEmployeeRate', 'pfEmployerRate', 'pfWageCeilingPaise',
    'esiEmployeeRate', 'esiEmployerRate', 'esiGrossCeilingPaise',
    'ptSlabsJson', 'tdsDefaultRate',
    'payCycleDay', 'workingDaysPerMonth', 'notes',
  ];
  const data: any = {};
  for (const k of allowed) if (body[k] !== undefined) data[k] = body[k];

  const updated = await prisma.payrollConfig.upsert({
    where: { id: 'singleton' },
    update: data,
    create: { id: 'singleton', ...data, updatedAt: new Date() },
  });
  await recordAudit({
    action: 'UPDATE', entityType: 'PayrollConfig', entityId: 'singleton',
    before, after: updated, session, req,
  });
  return NextResponse.json({ config: updated });
}
