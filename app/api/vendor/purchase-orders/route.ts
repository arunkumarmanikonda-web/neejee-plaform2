import { resolveVendorForSession } from '@/lib/vendor-auth-helpers';
// GET /api/vendor/purchase-orders — list this vendor's POs (vendor-scoped).
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  const scope = await resolveVendorForSession(session);
  if (!scope) return NextResponse.json({ error: 'No active vendor account' }, { status: 403 });

  // Vendors see SENT and beyond — never DRAFT (admin still drafting)
  const pos = await prisma.purchaseOrder.findMany({
    where: { vendorId: scope.vendorId, status: { notIn: ['DRAFT'] } },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true, poNumber: true, status: true, totalPaise: true,
      sentAt: true, confirmedAt: true, dispatchedAt: true, receivedAt: true,
      expectedDate: true, createdAt: true,
      _count: { select: { lines: true } },
    },
  });
  return NextResponse.json({ purchaseOrders: pos });
}
