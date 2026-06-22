// POST /api/admin/vendor-change-requests/[id]
// Body: { action: 'APPROVE' | 'REJECT', note?: string }
// Approve → applies fieldChanges atomically to Vendor + marks docs APPROVED.
// Reject → marks request REJECTED, does NOT touch Vendor.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { prismaErrorToHttp } from '@/lib/prisma-errors';
import { notify } from '@/lib/notifications';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
    return NextResponse.json({ error: 'Only ADMIN or SUPER_ADMIN can review change requests' }, { status: 403 });
  }
  let body: any = {};
  try { body = await request.json(); } catch {}
  const action = String(body?.action || '').toUpperCase();
  const note = body?.note ? String(body.note).slice(0, 1000) : null;
  if (action !== 'APPROVE' && action !== 'REJECT') {
    return NextResponse.json({ error: 'action must be APPROVE or REJECT' }, { status: 400 });
  }

  try {
    const cr = await prisma.vendorChangeRequest.findUnique({
      where: { id: params.id },
      include: { supportingDocs: true },
    });
    if (!cr) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (cr.status !== 'PENDING') {
      return NextResponse.json({ error: `Already ${cr.status.toLowerCase()}` }, { status: 400 });
    }

    if (action === 'REJECT') {
      await prisma.$transaction([
        prisma.vendorChangeRequest.update({
          where: { id: cr.id },
          data: {
            status: 'REJECTED',
            reviewedByUserId: session.id,
            reviewedAt: new Date(),
            reviewNote: note,
          },
        }),
        prisma.vendorDocument.updateMany({
          where: { changeRequestId: cr.id, status: 'SUBMITTED' },
          data: { status: 'REJECTED', reviewedByUserId: session.id, reviewedAt: new Date(), reviewNote: note },
        }),
        prisma.vendorAuditLog.create({
          data: {
            vendorId: cr.vendorId,
            actorUserId: session.id,
            actorRole: session.role,
            action: 'CHANGE_REJECTED',
            details: { changeRequestId: cr.id, note },
          },
        }),
      ]);
      // Notify vendor (owner)
      const vendor = await prisma.vendor.findUnique({ where: { id: cr.vendorId }, select: { userId: true } });
      if (vendor?.userId) {
        const fieldChanges: any[] = Array.isArray(cr.fieldChanges) ? (cr.fieldChanges as any) : [];
        notify({
          event: 'CHANGE_REQUEST_REJECTED',
          userId: vendor.userId,
          data: { fields: fieldChanges.map(c => c.field), note },
          context: { type: 'VENDOR_CHANGE_REQUEST', id: cr.id },
        }).catch(e => console.warn('[notify CHANGE_REQUEST_REJECTED]', e));
      }
      return NextResponse.json({ ok: true, status: 'REJECTED' });
    }

    // APPROVE — apply each field change to Vendor
    const fieldChanges: Array<{ field: string; oldValue: any; newValue: any }> =
      Array.isArray(cr.fieldChanges) ? (cr.fieldChanges as any) : [];
    const updateData: Record<string, any> = {};
    for (const c of fieldChanges) {
      updateData[c.field] = c.newValue;
    }

    await prisma.$transaction([
      prisma.vendor.update({ where: { id: cr.vendorId }, data: updateData }),
      prisma.vendorChangeRequest.update({
        where: { id: cr.id },
        data: {
          status: 'APPROVED',
          reviewedByUserId: session.id,
          reviewedAt: new Date(),
          reviewNote: note,
          appliedAt: new Date(),
        },
      }),
      prisma.vendorDocument.updateMany({
        where: { changeRequestId: cr.id, status: 'SUBMITTED' },
        data: { status: 'APPROVED', reviewedByUserId: session.id, reviewedAt: new Date(), reviewNote: note },
      }),
      prisma.vendorAuditLog.create({
        data: {
          vendorId: cr.vendorId,
          actorUserId: session.id,
          actorRole: session.role,
          action: 'CHANGE_APPROVED',
          details: { changeRequestId: cr.id, fields: fieldChanges.map(c => c.field), note },
        },
      }),
    ]);

    // Notify vendor (owner)
    const vendor = await prisma.vendor.findUnique({ where: { id: cr.vendorId }, select: { userId: true } });
    if (vendor?.userId) {
      notify({
        event: 'CHANGE_REQUEST_APPROVED',
        userId: vendor.userId,
        data: { fields: fieldChanges.map(c => c.field), note },
        context: { type: 'VENDOR_CHANGE_REQUEST', id: cr.id },
      }).catch(e => console.warn('[notify CHANGE_REQUEST_APPROVED]', e));
    }

    return NextResponse.json({ ok: true, status: 'APPROVED' });
  } catch (e: any) {
    console.error('[admin change-request review]', e);
    const { status, message, code } = prismaErrorToHttp(e);
    return NextResponse.json({ error: message, code }, { status });
  }
}
