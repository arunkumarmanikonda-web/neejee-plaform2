// /api/admin/finance/seller-payouts
// GET  - list seller payouts
// POST - create new Payout row

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'FINANCE', 'FINANCE_OPERATOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(req.url);
  const status   = url.searchParams.get('status') || undefined;
  const sellerId = url.searchParams.get('sellerId') || undefined;
  const limit    = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);

  const payouts = await prisma.payout.findMany({
    where: {
      ...(status ? { status: status as any } : {}),
      ...(sellerId ? { sellerId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      seller: { select: { id: true, businessName: true, contactName: true, email: true, bankAccount: true, ifsc: true, rzpxContactId: true, rzpxFundAccountId: true } },
    },
  });
  return NextResponse.json({ payouts });
}

export async function POST(req: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'FINANCE'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const sellerId        = String(body.sellerId || '').trim();
    const grossSales      = Math.max(0, parseInt(body.grossSales)     || 0);
    const commissionPaise = Math.max(0, parseInt(body.commissionPaise) || 0);
    const netPayoutPaise  = Math.max(0, parseInt(body.netPayoutPaise) || (grossSales - commissionPaise));
    const orderCount      = Math.max(0, parseInt(body.orderCount)    || 0);
    const periodStart = new Date(body.periodStart || Date.now());
    const periodEnd   = new Date(body.periodEnd   || Date.now());
    const notes       = body.notes ? String(body.notes) : null;

    if (!sellerId) return NextResponse.json({ error: 'sellerId required' }, { status: 400 });
    if (netPayoutPaise <= 0) return NextResponse.json({ error: 'netPayoutPaise must be > 0' }, { status: 400 });

    const payout = await prisma.payout.create({
      data: {
        sellerId,
        periodStart, periodEnd,
        grossSales, commissionPaise, netPayoutPaise,
        orderCount,
        status: 'PENDING',
        notes,
      },
    });
    return NextResponse.json({ ok: true, payout });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Create failed' }, { status: 500 });
  }
}
