// v23.40.1 — F&F settlement detail / approve / pay / cancel
// GET    /api/admin/payroll/fnf/:id
// PATCH  /api/admin/payroll/fnf/:id   body: { status?, paidOn?, paymentReference?, notes?, attachments? }

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm, canApproveFinance } from '@/lib/finance/roles';
import { recordAudit } from '@/lib/finance/audit-log';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const settlement = await prisma.fnFSettlement.findUnique({
    where: { id: params.id },
    include: { employee: true },
  });
  if (!settlement) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ settlement });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.write');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const before = await prisma.fnFSettlement.findUnique({ where: { id: params.id } });
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const data: any = {};

  // Status transitions
  if (body.status) {
    const allowed = ['DRAFT', 'APPROVED', 'PAID', 'CANCELLED'];
    if (!allowed.includes(body.status)) {
      return NextResponse.json({ error: 'invalid status' }, { status: 400 });
    }
    if (body.status === 'APPROVED' && !canApproveFinance(session)) {
      return NextResponse.json({ error: 'You do not have permission to approve' }, { status: 403 });
    }
    data.status = body.status;
    if (body.status === 'APPROVED') {
      data.approvedByUserId = session!.id;
      data.approvedAt = new Date();
    }
    if (body.status === 'PAID') {
      data.paidOn = body.paidOn ? new Date(body.paidOn) : new Date();
      data.paymentReference = body.paymentReference || null;
      // On PAID, mark employee as EXITED
      await prisma.employee.update({
        where: { id: before.employeeId },
        data: {
          status: 'EXITED',
          exitDate: data.paidOn,
        },
      });
    }
  }
  if (body.paymentReference !== undefined) data.paymentReference = body.paymentReference;
  if (body.paidOn) data.paidOn = new Date(body.paidOn);
  if (body.notes !== undefined) data.notes = body.notes;
  if (Array.isArray(body.attachments)) data.attachments = body.attachments.filter(Boolean);

  const updated = await prisma.fnFSettlement.update({
    where: { id: params.id },
    data,
  });

  await recordAudit({
    action: 'UPDATE',
    entityType: 'FnFSettlement',
    entityId: params.id,
    before, after: updated, session, req,
  });

  return NextResponse.json({ settlement: updated });
}
