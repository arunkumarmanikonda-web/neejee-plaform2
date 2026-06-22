// One-request actions: review / approve / reject / withdraw.
// POST /api/admin/marketing/approvals/{id}  body: { action, note? }
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireMarketingPerm, canApproveMarketing } from '@/lib/marketing/roles';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = requireMarketingPerm(session, 'marketing.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  try {
    const row = await prisma.marketingApprovalRequest.findUnique({ where: { id: params.id } });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ request: row });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { action, note } = await req.json();
    const row = await prisma.marketingApprovalRequest.findUnique({ where: { id: params.id } });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (row.status !== 'PENDING') {
      return NextResponse.json({ error: `Already ${row.status}` }, { status: 400 });
    }

    // Permission per action
    if (action === 'approve' || action === 'reject') {
      if (!canApproveMarketing(session)) {
        return NextResponse.json({ error: 'Only MARKETING_MANAGER and above can approve/reject' }, { status: 403 });
      }
      // Hygiene: makers can't approve their own
      if (action === 'approve' && row.createdByUserId === session.id) {
        return NextResponse.json({
          error: 'You created this request — another reviewer must approve it.',
        }, { status: 403 });
      }
    } else if (action === 'withdraw') {
      // Creator can withdraw their own request
      if (row.createdByUserId !== session.id && !canApproveMarketing(session)) {
        return NextResponse.json({ error: 'Only the creator (or a manager) can withdraw' }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    const newStatus =
      action === 'approve' ? 'APPROVED' :
      action === 'reject'  ? 'REJECTED' :
                              'WITHDRAWN';

    const updated = await prisma.marketingApprovalRequest.update({
      where: { id: params.id },
      data: {
        status: newStatus as any,
        reviewedByUserId: session.id,
        reviewedAt: new Date(),
        reviewNote: note || null,
      },
    });

    // Notify creator
    try {
      const { notify } = await import('@/lib/notifications');
      notify({
        event: action === 'approve' ? 'MARKETING_APPROVED'
             : action === 'reject'  ? 'MARKETING_REJECTED'
             :                          'MARKETING_WITHDRAWN',
        userId: row.createdByUserId,
        data: {
          resourceType: row.resourceType.replace('_', ' '),
          reviewerEmail: session.email,
          note: note || '',
        },
        context: { type: 'MARKETING_APPROVAL', id: row.id },
      }).catch(() => {});
    } catch { /* */ }

    return NextResponse.json({ request: updated });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
