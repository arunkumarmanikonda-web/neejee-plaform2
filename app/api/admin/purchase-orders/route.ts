// GET (list) and POST (create draft) purchase orders.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generatePoNumber, computePoTotals } from '@/lib/purchase-orders';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function gate(write = false) {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized', status: 401 };
  const reads = ['ADMIN', 'SUPER_ADMIN', 'FINANCE'];
  const writes = ['ADMIN', 'SUPER_ADMIN'];
  const allowed = write ? writes : reads;
  if (!allowed.includes(session.role)) return { error: 'Forbidden', status: 403 };
  return { session };
}

export async function GET(request: Request) {
  const g = await gate();
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || undefined;
  const vendorId = url.searchParams.get('vendorId') || undefined;

  const where: any = {};
  if (status) where.status = status;
  if (vendorId) where.vendorId = vendorId;

  const pos = await prisma.purchaseOrder.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      vendor: { select: { id: true, legalName: true, displayName: true } },
      _count: { select: { lines: true } },
    },
  });
  return NextResponse.json({ purchaseOrders: pos });
}

export async function POST(request: Request) {
  const g = await gate(true);
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status });
  let body: any = {};
  try { body = await request.json(); } catch {}
  const vendorId = body?.vendorId;
  const lines: any[] = Array.isArray(body?.lines) ? body.lines : [];
  if (!vendorId) return NextResponse.json({ error: 'vendorId is required' }, { status: 400 });
  if (lines.length === 0) return NextResponse.json({ error: 'At least one line is required' }, { status: 400 });

  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
  if (vendor.status !== 'ACTIVE' && vendor.status !== 'PENDING') {
    return NextResponse.json({ error: 'Vendor is not in an orderable state' }, { status: 400 });
  }

  // Validate and normalise lines
  const cleanLines = lines.map((l: any, idx: number) => {
    const orderedQty = Number(l.orderedQty);
    const unitCostPaise = Number(l.unitCostPaise);
    const gstRate = Number(l.gstRate ?? 5);
    if (!l.description) throw new Error(`Line ${idx + 1}: description required`);
    if (!Number.isFinite(orderedQty) || orderedQty <= 0) throw new Error(`Line ${idx + 1}: invalid quantity`);
    if (!Number.isFinite(unitCostPaise) || unitCostPaise < 0) throw new Error(`Line ${idx + 1}: invalid unit cost`);
    return {
      productId: l.productId || null,
      variantId: l.variantId || null,
      description: String(l.description),
      sku: l.sku || null,
      orderedQty,
      unitCostPaise: Math.round(unitCostPaise),
      gstRate,
    };
  });

  try {
    const totals = computePoTotals(cleanLines);
    const poNumber = await generatePoNumber();
    const legalEntity = await prisma.legalEntity.findUnique({ where: { key: 'default' } });
    const shipTo = legalEntity
      ? [legalEntity.addressLine1, legalEntity.addressLine2, legalEntity.city, legalEntity.state, legalEntity.pincode].filter(Boolean).join(', ')
      : null;
    const vendorAddress = [vendor.addressLine1, vendor.addressLine2, vendor.city, vendor.state, vendor.pincode].filter(Boolean).join(', ');

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        vendorId,
        status: 'DRAFT',
        vendorNameSnapshot: vendor.legalName,
        vendorGstinSnapshot: vendor.gstin,
        vendorAddressSnapshot: vendorAddress || null,
        shipToAddress: body.shipToAddress || shipTo,
        ...totals,
        currency: 'INR',
        notes: body.notes || null,
        expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
        createdById: g.session.id,
        lines: { create: cleanLines },
      },
      include: { lines: true, vendor: { select: { id: true, legalName: true } } },
    });
    return NextResponse.json({ purchaseOrder: po }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Create failed' }, { status: 400 });
  }
}
