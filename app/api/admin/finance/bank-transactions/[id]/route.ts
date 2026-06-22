// v23.39 — Per-transaction operations
// PATCH /api/admin/finance/bank-transactions/{id}
//   body: { action: 'MATCH' | 'IGNORE' | 'UNMATCH', kind?, targetId?, notes? }

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { recordAudit } from '@/lib/finance/audit-log';
import { findMatchForTxn } from '@/lib/finance/bank-matcher';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.write');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const txn = await prisma.bankTransaction.findUnique({ where: { id: params.id } });
  if (!txn) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });

  const body = await req.json();
  const { action, kind, targetId, notes } = body;

  let updateData: any = {};

  if (action === 'MATCH') {
    if (!kind || !targetId) {
      return NextResponse.json({ error: 'kind and targetId required for MATCH' }, { status: 400 });
    }
    updateData = {
      status: 'MANUAL_MATCHED',
      matchedAt: new Date(),
      matchedByUserId: session!.id,
      matchedBillPaymentId: kind === 'BILL_PAYMENT' ? targetId : null,
      matchedExpenseId: kind === 'EXPENSE' ? targetId : null,
      matchedRefundId: kind === 'ORDER' || kind === 'REFUND' ? targetId : null,
      matchNotes: notes || `Manually matched to ${kind} ${targetId}`,
    };
  } else if (action === 'IGNORE') {
    updateData = {
      status: 'IGNORED',
      matchedAt: new Date(),
      matchedByUserId: session!.id,
      matchNotes: notes || 'Marked as ignored (e.g. internal transfer)',
    };
  } else if (action === 'UNMATCH') {
    updateData = {
      status: 'UNMATCHED',
      matchedAt: null,
      matchedByUserId: null,
      matchedBillPaymentId: null,
      matchedExpenseId: null,
      matchedRefundId: null,
      matchNotes: null,
    };
  } else if (action === 'SUGGEST') {
    // Run matcher again on this single txn
    const result = await findMatchForTxn(params.id);
    return NextResponse.json({ suggestion: result });
  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  const updated = await prisma.bankTransaction.update({
    where: { id: params.id },
    data: updateData,
  });

  await recordAudit({
    action: 'UPDATE',
    entityType: 'BankTransaction',
    entityId: params.id,
    before: txn,
    after: updated,
    session,
    req,
  });

  return NextResponse.json({ transaction: updated });
}
