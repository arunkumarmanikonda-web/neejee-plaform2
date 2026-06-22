// v23.40 — Payroll run detail + state transitions
// GET   /api/admin/payroll/runs/{id}                    — get run + payslips
// PATCH /api/admin/payroll/runs/{id}  { action: 'COMPUTE'|'APPROVE'|'MARK_PAID'|'REOPEN' }

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { recordAudit } from '@/lib/finance/audit-log';
import { computePayrollRun } from '@/lib/payroll/compute';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const run = await prisma.payrollRun.findUnique({
    where: { id: params.id },
    include: {
      payslips: {
        include: {
          employee: {
            select: {
              id: true, employeeCode: true, firstName: true, lastName: true,
              designation: true, department: true, bankAccountNumber: true,
            },
          },
        },
        orderBy: { employee: { employeeCode: 'asc' } },
      },
    },
  });
  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ run });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.write');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const run = await prisma.payrollRun.findUnique({ where: { id: params.id } });
  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { action } = body;

  if (action === 'COMPUTE') {
    if (run.status !== 'DRAFT' && run.status !== 'COMPUTED') {
      return NextResponse.json({ error: `Cannot compute in ${run.status}` }, { status: 400 });
    }
    const summary = await computePayrollRun(run.id);
    const updated = await prisma.payrollRun.findUnique({ where: { id: run.id } });
    await recordAudit({
      action: 'UPDATE', entityType: 'PayrollRun', entityId: run.id,
      before: run, after: { ...updated, summary }, session, req,
    });
    return NextResponse.json({ run: updated, summary });
  }

  if (action === 'APPROVE') {
    if (run.status !== 'COMPUTED') {
      return NextResponse.json({ error: 'Must be COMPUTED before approval' }, { status: 400 });
    }
    const checkerGate = requireFinancePerm(session, 'finance.approve');
    if (!checkerGate.ok) return NextResponse.json({ error: 'You lack approval permission' }, { status: 403 });
    const updated = await prisma.payrollRun.update({
      where: { id: run.id },
      data: { status: 'APPROVED', approvedAt: new Date(), approvedByUserId: session!.id },
    });
    await recordAudit({ action: 'UPDATE', entityType: 'PayrollRun', entityId: run.id, before: run, after: updated, session, req });
    return NextResponse.json({ run: updated });
  }

  if (action === 'MARK_PAID') {
    if (run.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Must be APPROVED before marking paid' }, { status: 400 });
    }
    const updated = await prisma.payrollRun.update({
      where: { id: run.id },
      data: { status: 'PAID', paidAt: new Date(), paidByUserId: session!.id },
    });
    // Mark all payslips as paid on the same date
    await prisma.payslip.updateMany({
      where: { payrollRunId: run.id, paidOn: null },
      data: { paidOn: new Date() },
    });
    await recordAudit({ action: 'UPDATE', entityType: 'PayrollRun', entityId: run.id, before: run, after: updated, session, req });
    return NextResponse.json({ run: updated });
  }

  if (action === 'REOPEN') {
    if (run.status === 'PAID' || run.status === 'LOCKED') {
      return NextResponse.json({ error: `Cannot reopen ${run.status}` }, { status: 400 });
    }
    const updated = await prisma.payrollRun.update({
      where: { id: run.id },
      data: { status: 'DRAFT', computedAt: null, approvedAt: null, approvedByUserId: null },
    });
    await recordAudit({ action: 'UPDATE', entityType: 'PayrollRun', entityId: run.id, before: run, after: updated, session, req });
    return NextResponse.json({ run: updated });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
