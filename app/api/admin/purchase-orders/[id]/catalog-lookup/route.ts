// /api/admin/purchase-orders/[id]/catalog-lookup
// Returns the vendor's active rate-card items so the PO line editor can
// auto-fill description / unit cost / HSN / GST rate from a vendor SKU.
//
// This is read-only and scoped to the PO's vendor.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ROLES = ['ADMIN', 'SUPER_ADMIN', 'FINANCE'];

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ROLES.includes(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: params.id },
    select: { vendorId: true },
  });
  if (!po) return NextResponse.json({ error: 'PO not found' }, { status: 404 });

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim().toLowerCase();

  const items = await prisma.vendorCatalogItem.findMany({
    where: {
      vendorId: po.vendorId,
      active: true,
      ...(q
        ? {
            OR: [
              { vendorSku: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      vendorSku: true,
      description: true,
      hsnCode: true,
      unitCostPaise: true,
      gstRate: true,
      moq: true,
      leadTimeDays: true,
      productId: true,
    },
    orderBy: { vendorSku: 'asc' },
    take: 200,
  });

  return NextResponse.json({ items });
}
