// Seller's payout history
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApprovedSeller } from '@/lib/seller-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const ctx = await requireApprovedSeller();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  if (!ctx.seller) return NextResponse.json({ payouts: [] });

  const payouts = await prisma.payout.findMany({
    where: { sellerId: ctx.seller.id },
    orderBy: { createdAt: 'desc' },
  });

  // Outstanding = sum of items in delivered orders minus already-paid commission
  const items = await prisma.orderItem.findMany({
    where: {
      product: { sellerId: ctx.seller.id },
      order: { status: 'DELIVERED' },
    },
    select: { total: true },
  });
  const totalDeliveredPaise = items.reduce((s, i) => s + (i.total || 0), 0);
  const totalPaidNetPaise = payouts.filter(p => p.status === 'PAID').reduce((s, p) => s + p.netPayoutPaise, 0);
  const totalPaidGrossPaise = payouts.filter(p => p.status === 'PAID').reduce((s, p) => s + p.grossSales, 0);
  const outstandingGrossPaise = Math.max(0, totalDeliveredPaise - totalPaidGrossPaise);
  const commissionPct = ctx.seller.commissionPct ?? 20;
  const outstandingNetPaise = Math.round(outstandingGrossPaise * (100 - commissionPct) / 100);

  return NextResponse.json({
    payouts,
    summary: {
      totalDeliveredPaise,
      totalPaidNetPaise,
      outstandingGrossPaise,
      outstandingNetPaise,
      commissionPct,
    },
  });
}
