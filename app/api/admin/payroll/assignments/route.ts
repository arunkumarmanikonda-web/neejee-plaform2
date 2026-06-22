// v23.40 — Assign salary structure to employee
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { recordAudit } from '@/lib/finance/audit-log';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.write');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const body = await req.json();
    const { employeeId, structureId, effectiveFrom, ctcOverridePaise, notes } = body;
    if (!employeeId || !structureId || !effectiveFrom) {
      return NextResponse.json({
        error: 'employeeId, structureId, effectiveFrom required',
      }, { status: 400 });
    }
    const effFrom = new Date(effectiveFrom);

    // End the current (open-ended) assignment for this employee, if any
    await prisma.employeeSalaryAssignment.updateMany({
      where: { employeeId, effectiveTo: null },
      data: { effectiveTo: new Date(effFrom.getTime() - 86400000) }, // day before new effective
    });

    const created = await prisma.employeeSalaryAssignment.create({
      data: {
        id: 'salasgn_' + randomBytes(10).toString('hex'),
        employeeId,
        structureId,
        effectiveFrom: effFrom,
        ctcOverridePaise: ctcOverridePaise ? Number(ctcOverridePaise) : null,
        notes: notes || null,
        createdByUserId: session!.id,
      },
    });
    await recordAudit({
      action: 'CREATE', entityType: 'EmployeeSalaryAssignment', entityId: created.id,
      after: created, session, req,
    });
    return NextResponse.json({ assignment: created }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
