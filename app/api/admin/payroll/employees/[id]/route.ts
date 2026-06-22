// v23.40 — Employee detail / update
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { recordAudit } from '@/lib/finance/audit-log';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const employee = await prisma.employee.findUnique({
    where: { id: params.id },
    include: {
      salaryAssignments: {
        orderBy: { effectiveFrom: 'desc' },
        include: { structure: true },
      },
      payslips: {
        orderBy: { createdAt: 'desc' },
        take: 24,
        include: { payrollRun: { select: { label: true, status: true } } },
      },
      adjustments: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
      attendance: {
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 12,
      },
      // v23.40.1
      reimbursementPolicy: true,
      incentivePlan:       true,
      fnfSettlements:      { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!employee) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ employee });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.write');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const before = await prisma.employee.findUnique({ where: { id: params.id } });
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const allowed = [
    'firstName', 'lastName', 'email', 'phone', 'pan', 'aadhaarLast4',
    'designation', 'department', 'employmentType', 'status', 'exitDate',
    'bankAccountName', 'bankAccountNumber', 'bankIfsc', 'uanNumber', 'esicNumber',
    'taxRegime', 'address', 'emergencyContact', 'notes',
    // v23.40.1 — personal-file + exit
    'documents', 'photoUrl',
    'resignationDate', 'noticePeriodDays', 'lastWorkingDay',
    'exitReason', 'exitType', 'exitNotes',
  ];
  const data: any = {};
  for (const k of allowed) {
    if (body[k] !== undefined) data[k] = body[k];
  }
  if (data.exitDate)         data.exitDate = new Date(data.exitDate);
  if (data.resignationDate)  data.resignationDate = new Date(data.resignationDate);
  if (data.lastWorkingDay)   data.lastWorkingDay = new Date(data.lastWorkingDay);

  const updated = await prisma.employee.update({ where: { id: params.id }, data });
  await recordAudit({
    action: 'UPDATE',
    entityType: 'Employee',
    entityId: params.id,
    before, after: updated, session, req,
  });
  return NextResponse.json({ employee: updated });
}
