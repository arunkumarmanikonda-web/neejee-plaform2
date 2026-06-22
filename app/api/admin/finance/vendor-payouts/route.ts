// /api/admin/finance/vendor-payouts
// GET  - list payouts (filter by status, vendorId)
// POST - create a new VendorPayout row (manual or from PO settlement)

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
  const vendorId = url.searchParams.get('vendorId') || undefined;
  const limit    = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);

  const payouts = await prisma.vendorPayout.findMany({
    where: {
      ...(status ? { status: status as any } : {}),
      ...(vendorId ? { vendorId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      vendor: { select: { id: true, legalName: true, displayName: true, contactEmail: true, bankAccountNumber: true, bankIfsc: true, rzpxContactId: true, rzpxFundAccountId: true } },
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
    const vendorId   = String(body.vendorId || '').trim();
    const grossPaise = Math.max(0, parseInt(body.grossPaise) || 0);
    const tdsPaise   = Math.max(0, parseInt(body.tdsPaise) || 0);
    const poIds      = Array.isArray(body.poIds) ? body.poIds.map((s: any) => String(s)) : [];
    const notes      = body.notes ? String(body.notes) : null;

    if (!vendorId) return NextResponse.json({ error: 'vendorId required' }, { status: 400 });
    if (grossPaise <= 0) return NextResponse.json({ error: 'grossPaise must be > 0' }, { status: 400 });
    const netPaise = Math.max(0, grossPaise - tdsPaise);

    const payout = await prisma.vendorPayout.create({
      data: {
        vendorId,
        poIds,
        grossPaise,
        tdsPaise,
        netPaise,
        status: 'SCHEDULED',
        createdByUserId: user?.id || null,
        notes,
      },
    });
    return NextResponse.json({ ok: true, payout });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Create failed' }, { status: 500 });
  }
}
