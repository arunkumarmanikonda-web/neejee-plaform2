// DELETE /api/vendor/documents/[id] — remove an uploaded doc that hasn't been
// approved yet, OR is not linked to a still-pending change request.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== 'VENDOR') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const vendor = await prisma.vendor.findUnique({ where: { userId: session.id } });
  if (!vendor) return NextResponse.json({ error: 'No vendor profile' }, { status: 404 });
  try {
    const doc = await prisma.vendorDocument.findFirst({
      where: { id: params.id, vendorId: vendor.id },
      include: { changeRequest: true },
    });
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (doc.status === 'APPROVED') {
      return NextResponse.json({ error: 'Approved documents cannot be deleted. Upload a new version to supersede.' }, { status: 400 });
    }
    if (doc.changeRequest && doc.changeRequest.status === 'PENDING') {
      return NextResponse.json({ error: 'This document supports a pending change request. Cancel the request first.' }, { status: 400 });
    }
    await prisma.vendorDocument.delete({ where: { id: doc.id } });
    await prisma.vendorAuditLog.create({
      data: {
        vendorId: vendor.id,
        actorUserId: session.id,
        actorRole: 'VENDOR',
        action: 'DOC_DELETED',
        details: { documentId: doc.id, docType: doc.docType },
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const { status, message, code } = prismaErrorToHttp(e);
    return NextResponse.json({ error: message, code }, { status });
  }
}
