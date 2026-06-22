// Delete a seller document (only if not yet approved).
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
    const doc = await prisma.sellerDocument.findUnique({ where: { id: params.id } });
    if (!doc || doc.sellerId !== gate.ctx.seller.id) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    if (doc.status === 'APPROVED') {
      return NextResponse.json({
        error: 'Cannot delete an approved document — contact admin to supersede it.',
      }, { status: 400 });
    }
    await prisma.sellerDocument.delete({ where: { id: params.id } });

    await prisma.sellerAuditLog.create({
      data: {
        sellerId: gate.ctx.seller.id,
        actorUserId: session!.id,
        actorRole: gate.ctx.actorRole,
        action: 'DOCUMENT_DELETED',
        details: { docId: doc.id, fileName: doc.fileName } as any,
      },
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
