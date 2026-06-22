// v23.40 — Attendance entry (monthly per employee)
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { recordAudit } from '@/lib/finance/audit-log';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const url = new URL(req.url);
  const month = url.searchParams.get('month');
  const year = url.searchParams.get('year');
  const where: any = {};
  if (month && year) { where.month = parseInt(month); where.year = parseInt(year); }

  const rows = await prisma.attendance.findMany({
    where,
    include: { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } } },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });
  return NextResponse.json({ attendance: rows });
}

export async function POST(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.write');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const body = await req.json();
    const { employeeId, month, year, daysWorked, leavesPaid = 0, leavesUnpaid = 0, overtimeHours = 0, notes } = body;
    if (!employeeId || !month || !year || daysWorked == null) {
      return NextResponse.json({ error: 'employeeId, month, year, daysWorked required' }, { status: 400 });
    }

    const upserted = await prisma.attendance.upsert({
      where: { employeeId_month_year: { employeeId, month: Number(month), year: Number(year) } },
      create: {
        id: 'att_' + randomBytes(10).toString('hex'),
        employeeId,
        month: Number(month), year: Number(year),
        daysWorked: Number(daysWorked),
        leavesPaid: Number(leavesPaid),
        leavesUnpaid: Number(leavesUnpaid),
        overtimeHours: Number(overtimeHours),
        notes: notes || null,
        createdByUserId: session!.id,
      },
      update: {
        daysWorked: Number(daysWorked),
        leavesPaid: Number(leavesPaid),
        leavesUnpaid: Number(leavesUnpaid),
        overtimeHours: Number(overtimeHours),
        notes: notes || null,
      },
    });
    await recordAudit({
      action: 'UPDATE', entityType: 'Attendance', entityId: upserted.id,
      after: upserted, session, req,
    });
    return NextResponse.json({ attendance: upserted }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
