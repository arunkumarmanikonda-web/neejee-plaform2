// Maker-checker review endpoint.
// POST /api/admin/finance/expenses/{id}/review  body: { action: 'approve' | 'reject', note?: string }
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.approve');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const body = await req.json();
    const action = body.action;
    const note = body.note || null;

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });
    }

    const existing = await prisma.expense.findUnique({
      where: { id: params.id },
      include: { category: true },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (existing.status === 'APPROVED' || existing.status === 'REJECTED') {
      return NextResponse.json({
        error: `Already ${existing.status}. Cannot re-review.`,
      }, { status: 400 });
    }

    // Prevent self-approval above threshold (maker ≠ checker hygiene)
    if (action === 'approve' && existing.createdByUserId === session!.id) {
      const t = existing.category.approvalThresholdPaise;
      if (t !== null && existing.amountPaise > t) {
        return NextResponse.json({
          error: 'You created this entry; another reviewer must approve it.',
        }, { status: 403 });
      }
    }

    const updated = await prisma.expense.update({
      where: { id: params.id },
      data: {
        status: action === 'approve' ? 'APPROVED' : 'REJECTED',
        reviewedByUserId: session!.id,
        reviewedAt: new Date(),
        reviewNote: note,
      },
      include: { category: { select: { code: true, label: true } } },
    });

    // Notify maker
    try {
      const { notify } = await import('@/lib/notifications');
      notify({
        event: action === 'approve' ? 'EXPENSE_APPROVED' : 'EXPENSE_REJECTED',
        userId: existing.createdByUserId,
        data: {
          description: updated.description,
          amount: (updated.amountPaise / 100).toLocaleString('en-IN'),
          category: updated.category.label,
          reviewerEmail: session!.email,
          note: note || '',
        },
        context: { type: 'EXPENSE', id: updated.id },
      }).catch(() => {});
    } catch { /* best-effort */ }

    return NextResponse.json({ expense: updated });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
