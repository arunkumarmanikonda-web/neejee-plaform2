// DELETE /api/vendor/change-requests/[id] — vendor cancels a pending request
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== 'VENDOR') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const vendor = await prisma.vendor.findUnique({ where: { userId: session.id } });
  if (!vendor) return NextResponse.json({ error: 'No vendor profile' }, { status: 404 });

  const cr = await prisma.vendorChangeRequest.findFirst({
    where: { id: params.id, vendorId: vendor.id },
  });
  if (!cr) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (cr.status !== 'PENDING') {
    return NextResponse.json({ error: 'Only pending requests can be cancelled' }, { status: 400 });
  }
  await prisma.vendorChangeRequest.update({
    where: { id: cr.id },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
  });
  await prisma.vendorAuditLog.create({
    data: {
      vendorId: vendor.id,
      actorUserId: session.id,
      actorRole: 'VENDOR',
      action: 'CHANGE_CANCELLED',
      details: { changeRequestId: cr.id },
    },
  });
  return NextResponse.json({ ok: true });
}
