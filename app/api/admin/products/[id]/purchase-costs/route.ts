// GET /api/admin/products/[id]/purchase-costs
// Returns recent purchase cost ledger entries for this product, plus a
// weighted-average cost computed across all entries.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN', 'FINANCE'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const costs = await prisma.purchaseCost.findMany({
    where: { productId: params.id },
    orderBy: { receivedAt: 'desc' },
    take: 50,
    include: {
      vendor: { select: { id: true, legalName: true, displayName: true } },
      purchaseOrder: { select: { id: true, poNumber: true } },
    },
  });
  // Weighted-average across all-time entries (paise per unit, integer)
  let totalQty = 0;
  let totalCostPaise = 0;
  for (const c of costs) {
    totalQty += c.quantity;
    totalCostPaise += c.quantity * c.unitCostPaise;
  }
  const weightedAvgPaise = totalQty > 0 ? Math.round(totalCostPaise / totalQty) : null;
  return NextResponse.json({
    costs,
    summary: {
      totalQuantityReceived: totalQty,
      weightedAvgUnitCostPaise: weightedAvgPaise,
      latestUnitCostPaise: costs[0]?.unitCostPaise ?? null,
      latestVendor: costs[0]?.vendor?.displayName || costs[0]?.vendor?.legalName || null,
      latestReceivedAt: costs[0]?.receivedAt ?? null,
    },
  });
}
