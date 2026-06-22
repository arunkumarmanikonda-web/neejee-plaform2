// POST /api/admin/seller-change-requests/{id}  body: { action: 'approve' | 'reject', note? }
// Approving applies the field changes to the Seller row.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!requireRole(session, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { action, note } = await req.json();
    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });
    }

    const cr = await prisma.sellerChangeRequest.findUnique({
      where: { id: params.id },
      include: { seller: { select: { id: true, businessName: true, userId: true } } },
    });
    if (!cr) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (cr.status !== 'PENDING') {
      return NextResponse.json({ error: `Already ${cr.status}` }, { status: 400 });
    }

    if (action === 'approve') {
      // Apply field changes: fieldChanges is { fieldKey: { from, to } }
      const changes = cr.fieldChanges as Record<string, { from: any; to: any }>;
      const sellerData: Record<string, any> = {};
      for (const [k, v] of Object.entries(changes)) sellerData[k] = v.to;

      await prisma.seller.update({
        where: { id: cr.sellerId },
        data: sellerData,
      });

      // Also mark supporting docs as APPROVED (they served their purpose)
      const supportingDocs = await prisma.sellerDocument.findMany({
        where: { changeRequestId: cr.id },
        select: { id: true },
      });
      if (supportingDocs.length > 0) {
        await prisma.sellerDocument.updateMany({
          where: { id: { in: supportingDocs.map(d => d.id) } },
          data: { status: 'APPROVED', reviewedByUserId: session!.id, reviewedAt: new Date() },
        });
      }
    }

    const updated = await prisma.sellerChangeRequest.update({
      where: { id: params.id },
      data: {
        status: action === 'approve' ? 'APPROVED' : 'REJECTED',
        reviewedByUserId: session!.id,
        reviewedAt: new Date(),
        reviewNote: note || null,
        appliedAt: action === 'approve' ? new Date() : null,
      },
    });

    await prisma.sellerAuditLog.create({
      data: {
        sellerId: cr.sellerId,
        actorUserId: session!.id,
        actorRole: session!.role,
        action: action === 'approve' ? 'CHANGE_REQUEST_APPROVED' : 'CHANGE_REQUEST_REJECTED',
        details: { changeRequestId: cr.id, fields: Object.keys(cr.fieldChanges as any) } as any,
      },
    }).catch(() => {});

    // Notify seller
    try {
      const { notify } = await import('@/lib/notifications');
      if (cr.seller.userId) {
        notify({
          event: action === 'approve' ? 'SELLER_CHANGE_REQUEST_APPROVED' as any : 'SELLER_CHANGE_REQUEST_REJECTED' as any,
          userId: cr.seller.userId,
          data: {
            fields: Object.keys(cr.fieldChanges as any).join(', '),
            note: note || '',
            reviewerEmail: session!.email,
          },
          context: { type: 'SELLER_CHANGE_REQUEST', id: cr.id },
        }).catch(() => {});
      }
    } catch { /* */ }

    return NextResponse.json({ changeRequest: updated });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
