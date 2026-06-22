// v23.40.6 — Seller view of commission invoices billed by NEEJEE.
// GET /api/seller/commissions
// Returns: { invoices, summary, pendingOrders }

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApprovedSeller } from '@/lib/seller-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const ctx = await requireApprovedSeller();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  if (!ctx.seller) return NextResponse.json({ invoices: [], summary: null, pendingOrders: 0 });

  const sellerId = ctx.seller.id;

  // 1. All COMMISSION invoices billed to this seller
  const invoices = await prisma.salesInvoice.findMany({
    where: { invoiceType: 'COMMISSION', sellerId },
    orderBy: { issuedOn: 'desc' },
    include: {
      lines:    { select: { id: true, description: true, taxableValuePaise: true, totalPaise: true, commissionRatePercent: true, commissionBaseAmountPaise: true } },
      payments: { orderBy: { paidOn: 'desc' } },
    },
  });

  // 2. Summary
  const totalBilled       = invoices.reduce((s, i) => s + i.totalPaise, 0);
  const totalPaid         = invoices.reduce((s, i) => s + i.paidPaise,  0);
  const totalOutstanding  = totalBilled - totalPaid;
  const overdueCount      = invoices.filter(i =>
    i.paymentStatus !== 'PAID' && i.paymentStatus !== 'CANCELLED' &&
    i.dueOn && new Date(i.dueOn) < new Date()
  ).length;

  // 3. Pending orders: marketplace orders delivered & paid but not yet commission-billed
  const recentlyDeliveredItems = await prisma.orderItem.findMany({
    where: {
      product: { sellerId, ownershipModel: 'MARKETPLACE' },
      order:   { status: 'DELIVERED', paymentStatus: 'PAID' },
    },
    select: { id: true, orderId: true, productId: true, total: true,
              order: { select: { orderNumber: true, deliveredAt: true } } },
  });
  // Find which (orderId, productId) pairs already have a COMMISSION invoice line
  const sks = recentlyDeliveredItems.map(it => `COMM-${it.orderId}-${it.productId}`);
  const existing = await prisma.salesInvoiceLine.findMany({
    where: { sku: { in: sks }, invoice: { invoiceType: 'COMMISSION', sellerId } },
    select: { sku: true },
  });
  const billedSet = new Set(existing.map(l => l.sku!).filter(Boolean));
  const pendingItems = recentlyDeliveredItems.filter(it => !billedSet.has(`COMM-${it.orderId}-${it.productId}`));
  const pendingGross = pendingItems.reduce((s, it) => s + it.total, 0);
  const pendingCommissionEst = Math.round(pendingGross * (ctx.seller.commissionPct / 100));

  return NextResponse.json({
    invoices,
    summary: {
      commissionPct:        ctx.seller.commissionPct,
      totalBilledPaise:     totalBilled,
      totalPaidPaise:       totalPaid,
      totalOutstandingPaise:totalOutstanding,
      overdueCount,
      invoiceCount:         invoices.length,
      pendingItems:         pendingItems.length,
      pendingGrossPaise:    pendingGross,
      pendingCommissionEstPaise: pendingCommissionEst,
      nextBillingDate:      nextMonday(),
    },
  });
}

function nextMonday(): string {
  const d = new Date();
  const day = d.getDay(); // 0 Sun, 1 Mon, …
  const daysToMon = (1 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + daysToMon);
  d.setHours(3, 0, 0, 0);
  return d.toISOString();
}
