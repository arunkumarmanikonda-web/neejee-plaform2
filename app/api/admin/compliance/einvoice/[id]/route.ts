// /api/admin/compliance/einvoice/[id]
// PATCH - record manual IRN, mark cancelled, mark failed, etc.
// GET   - detail
//
// In Phase 1 we don't auto-call the NIC IRP. Admin/CA pastes the IRN, AckNo,
// AckDate and QR code from their accounting system. We track the row so it
// shows on the order detail page and is auditable.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const FINANCE_ROLES = ['ADMIN', 'SUPER_ADMIN', 'FINANCE'];

async function gate() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!FINANCE_ROLES.includes(session.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { session };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await gate();
  if (g.error) return g.error;
  const row = await prisma.gstEInvoice.findUnique({ where: { id: params.id } });
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const order = await prisma.order.findUnique({
    where: { id: row.orderId },
    select: { id: true, orderNumber: true, total: true, gstinCustomer: true, createdAt: true },
  });
  return NextResponse.json({ row, order });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await gate();
  if (g.error) return g.error;
  try {
    const body = await req.json();
    const row = await prisma.gstEInvoice.findUnique({ where: { id: params.id } });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const data: any = {};
    if (body.action === 'RECORD_IRN') {
      // Manual IRN entry from CA's accounting system.
      const irn = String(body.irn || '').trim();
      if (!irn) return NextResponse.json({ error: 'IRN required' }, { status: 400 });
      data.irn = irn;
      data.ackNo = body.ackNo ? String(body.ackNo).trim() : null;
      data.ackDate = body.ackDate ? new Date(body.ackDate) : null;
      data.signedQrCode = body.signedQrCode ? String(body.signedQrCode) : null;
      data.status = 'ACTIVE';
      data.isManual = true;
      data.attemptedByUserId = g.session!.id;
      data.errorCode = null;
      data.errorMessage = null;
    } else if (body.action === 'CANCEL') {
      // Cancellation on IRP (within 24h).
      data.status = 'CANCELLED';
      data.cancelledAt = new Date();
      data.cancelReason = String(body.reason || '').trim() || 'No reason given';
    } else if (body.action === 'MARK_FAILED') {
      data.status = 'FAILED';
      data.errorCode = body.errorCode ? String(body.errorCode) : null;
      data.errorMessage = body.errorMessage ? String(body.errorMessage) : 'Marked failed by admin';
    } else if (body.action === 'MARK_EXEMPT') {
      data.status = 'EXEMPT';
    } else if (body.action === 'REQUEUE') {
      data.status = 'PENDING';
      data.errorCode = null;
      data.errorMessage = null;
    }

    const updated = await prisma.gstEInvoice.update({ where: { id: params.id }, data });
    return NextResponse.json({ ok: true, row: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
