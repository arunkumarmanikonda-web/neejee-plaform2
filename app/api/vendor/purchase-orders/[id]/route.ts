// GET / PATCH vendor-side PO. Vendor can: CONFIRM (SENT→CONFIRMED),
// DISPATCH with tracking (CONFIRMED→DISPATCHED), upload invoice, update notes.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canTransitionPoStatus } from '@/lib/purchase-orders';
import { notify } from '@/lib/notifications';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function vendorGate() {
  const session = await getSession();
  if (!session || session.role !== 'VENDOR') return { error: 'Unauthorized', status: 401 };
  const vendor = await prisma.vendor.findUnique({ where: { userId: session.id } });
  if (!vendor) return { error: 'No vendor profile', status: 404 };
  return { session, vendor };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await vendorGate();
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: params.id, vendorId: g.vendor.id, status: { notIn: ['DRAFT'] } },
    include: { lines: { orderBy: { createdAt: 'asc' } } },
  });
  if (!po) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ purchaseOrder: po });
}

// PATCH body modes (vendor):
//   { transition: 'CONFIRMED' }
//   { transition: 'DISPATCHED', trackingNumber, trackingUrl, vendorInvoiceNumber, vendorInvoiceUrl }
//   { vendorInvoiceUrl, vendorInvoiceNumber, trackingNumber, trackingUrl } — update only
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const g = await vendorGate();
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: params.id, vendorId: g.vendor.id, status: { notIn: ['DRAFT'] } },
  });
  if (!po) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: any = {};
  try { body = await request.json(); } catch {}

  // Field-only updates
  const fieldData: Record<string, any> = {};
  for (const k of ['trackingNumber','trackingUrl','vendorInvoiceNumber','vendorInvoiceUrl','notes']) {
    if (k in body && !body.transition) fieldData[k] = body[k] === '' ? null : body[k];
  }

  if (!body.transition && Object.keys(fieldData).length > 0) {
    const updated = await prisma.purchaseOrder.update({ where: { id: po.id }, data: fieldData });
    return NextResponse.json({ purchaseOrder: updated });
  }

  const target = body.transition as string;
  if (target !== 'CONFIRMED' && target !== 'DISPATCHED') {
    return NextResponse.json({ error: 'Vendors can only confirm or mark dispatched' }, { status: 403 });
  }
  if (!canTransitionPoStatus(po.status, target)) {
    return NextResponse.json({ error: `Cannot transition from ${po.status} to ${target}` }, { status: 400 });
  }

  if (target === 'CONFIRMED') {
    const updated = await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: { status: 'CONFIRMED', confirmedAt: new Date() },
    });
    // Notify all admins that the vendor has confirmed
    notify({
      event: 'PO_CONFIRMED',
      toAdmins: true,
      data: { poId: po.id, poNumber: po.poNumber, vendorName: g.vendor.displayName || g.vendor.legalName },
      context: { type: 'PURCHASE_ORDER', id: po.id },
    }).catch(e => console.warn('[notify PO_CONFIRMED]', e));
    return NextResponse.json({ purchaseOrder: updated });
  }

  if (target === 'DISPATCHED') {
    const updated = await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: {
        status: 'DISPATCHED',
        dispatchedAt: new Date(),
        trackingNumber: body.trackingNumber ?? po.trackingNumber,
        trackingUrl: body.trackingUrl ?? po.trackingUrl,
        vendorInvoiceNumber: body.vendorInvoiceNumber ?? po.vendorInvoiceNumber,
        vendorInvoiceUrl: body.vendorInvoiceUrl ?? po.vendorInvoiceUrl,
      },
    });
    notify({
      event: 'PO_DISPATCHED',
      toAdmins: true,
      data: {
        poId: po.id, poNumber: po.poNumber,
        vendorName: g.vendor.displayName || g.vendor.legalName,
        trackingNumber: updated.trackingNumber,
        vendorInvoiceUrl: updated.vendorInvoiceUrl,
      },
      context: { type: 'PURCHASE_ORDER', id: po.id },
    }).catch(e => console.warn('[notify PO_DISPATCHED]', e));
    return NextResponse.json({ purchaseOrder: updated });
  }

  return NextResponse.json({ error: 'Unknown transition' }, { status: 400 });
}
