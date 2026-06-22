// DELETE /api/seller/change-requests/{id} — seller cancels pending request.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireSellerContext } from '@/lib/seller-auth-helpers';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = await requireSellerContext(session);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const row = await prisma.sellerChangeRequest.findUnique({ where: { id: params.id } });
    if (!row || row.sellerId !== gate.ctx.seller.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (row.status !== 'PENDING') {
      return NextResponse.json({ error: `Cannot cancel a ${row.status} request` }, { status: 400 });
    }

    const updated = await prisma.sellerChangeRequest.update({
      where: { id: params.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    await prisma.sellerAuditLog.create({
      data: {
        sellerId: gate.ctx.seller.id,
        actorUserId: session!.id,
        actorRole: gate.ctx.actorRole,
        action: 'CHANGE_REQUEST_CANCELLED',
        details: { changeRequestId: row.id } as any,
      },
    }).catch(() => {});

    return NextResponse.json({ changeRequest: updated });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
