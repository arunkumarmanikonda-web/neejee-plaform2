// /api/admin/compliance/einvoice
// GET  - list e-invoice rows with status filters
// POST - create/queue an e-invoice row for an order (idempotent via @unique orderId)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const FINANCE_ROLES = ['ADMIN', 'SUPER_ADMIN', 'FINANCE'];
const WRITE_ROLES = ['ADMIN', 'SUPER_ADMIN', 'FINANCE'];

async function gate(write = false) {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const allowed = write ? WRITE_ROLES : FINANCE_ROLES;
  if (!allowed.includes(session.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { session };
}

export async function GET(req: NextRequest) {
  const g = await gate(false);
  if (g.error) return g.error;
  const url = new URL(req.url);
  const status = url.searchParams.get('status') || undefined;
  const orderId = url.searchParams.get('orderId') || undefined;

  const where: any = {};
  if (status) where.status = status;
  if (orderId) where.orderId = orderId;

  const rows = await prisma.gstEInvoice.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  // Join in basic order info for the table.
  const orderIds = rows.map(r => r.orderId);
  const orders = orderIds.length
    ? await prisma.order.findMany({
        where: { id: { in: orderIds } },
        select: {
          id: true,
          orderNumber: true,
          total: true,
          createdAt: true,
          gstinCustomer: true,
        },
      })
    : [];
  const orderMap = new Map(orders.map(o => [o.id, o]));

  const enriched = rows.map(r => ({ ...r, order: orderMap.get(r.orderId) || null }));

  // Status counts for filter chips.
  const counts: Record<string, number> = {};
  rows.forEach(r => {
    counts[r.status] = (counts[r.status] || 0) + 1;
  });

  return NextResponse.json({ rows: enriched, counts });
}

export async function POST(req: NextRequest) {
  const g = await gate(true);
  if (g.error) return g.error;
  try {
    const body = await req.json();
    const orderId = String(body.orderId || '').trim();
    if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 });

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, total: true, gstinCustomer: true, status: true },
    });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    // Determine if this is required at all. e-invoice only required for B2B
    // (customer GSTIN present) and turnover ≥ ₹5 cr. We mark non-B2B as EXEMPT.
    const isB2B = !!order.gstinCustomer;

    const existing = await prisma.gstEInvoice.findUnique({ where: { orderId } });
    if (existing) {
      // Idempotent — return the existing row.
      return NextResponse.json({ ok: true, row: existing, alreadyExists: true });
    }

    const row = await prisma.gstEInvoice.create({
      data: {
        orderId,
        status: isB2B ? 'PENDING' : 'EXEMPT',
        attemptedByUserId: g.session!.id,
        payload: { queued: true, queuedAt: new Date().toISOString() },
      },
    });

    return NextResponse.json({ ok: true, row });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
