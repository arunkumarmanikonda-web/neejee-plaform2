// v23.40 — Salary structure templates
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { recordAudit } from '@/lib/finance/audit-log';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const structures = await prisma.salaryStructure.findMany({
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  });
  return NextResponse.json({ structures });
}

export async function POST(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.write');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const body = await req.json();
    const {
      name, description,
      basicPaise = 0, hraPaise = 0, conveyancePaise = 0, medicalPaise = 0,
      specialAllowancePaise = 0, ltaMonthlyPaise = 0, performanceBonusPaise = 0,
    } = body;
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

    const total =
      Number(basicPaise) + Number(hraPaise) + Number(conveyancePaise) +
      Number(medicalPaise) + Number(specialAllowancePaise) +
      Number(ltaMonthlyPaise) + Number(performanceBonusPaise);

    const created = await prisma.salaryStructure.create({
      data: {
        id: 'salstruct_' + randomBytes(10).toString('hex'),
        name: String(name).trim(),
        description: description?.trim() || null,
        basicPaise: Number(basicPaise),
        hraPaise: Number(hraPaise),
        conveyancePaise: Number(conveyancePaise),
        medicalPaise: Number(medicalPaise),
        specialAllowancePaise: Number(specialAllowancePaise),
        ltaMonthlyPaise: Number(ltaMonthlyPaise),
        performanceBonusPaise: Number(performanceBonusPaise),
        monthlyCtcPaise: total,
        active: true,
        createdByUserId: session!.id,
      },
    });
    await recordAudit({
      action: 'CREATE', entityType: 'SalaryStructure', entityId: created.id,
      after: created, session, req,
    });
    return NextResponse.json({ structure: created }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
