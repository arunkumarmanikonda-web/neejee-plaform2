// GET /api/vendor/payouts
// Returns: payout history + outstanding balance computation.
// Outstanding = sum of (PO totals where status in RECEIVED|CLOSED and not yet
//                       paid via a VendorPayout that's in PAID status).
// Since payouts are admin-manual for now, we compute outstanding by looking at
// RECEIVED+CLOSED POs and subtracting any totals already covered by PAID payouts.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolveVendorForSession } from '@/lib/vendor-auth-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  const v = await resolveVendorForSession(session);
  if (!v) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [pos, payouts] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { vendorId: v.vendorId, status: { in: ['RECEIVED', 'CLOSED'] } },
      select: { id: true, poNumber: true, totalPaise: true, status: true, receivedAt: true, closedAt: true },
    }),
    prisma.vendorPayout.findMany({
      where: { vendorId: v.vendorId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);

  const paidPoIds = new Set<string>();
  for (const p of payouts) {
    if (p.status === 'PAID') {
      for (const id of (p.poIds || [])) paidPoIds.add(id);
    }
  }

  let outstandingPaise = 0;
  const outstandingPos: { id: string; poNumber: string; totalPaise: number }[] = [];
  for (const po of pos) {
    if (!paidPoIds.has(po.id)) {
      outstandingPaise += po.totalPaise;
      outstandingPos.push({ id: po.id, poNumber: po.poNumber, totalPaise: po.totalPaise });
    }
  }

  return NextResponse.json({
    payouts,
    outstanding: {
      totalPaise: outstandingPaise,
      poCount: outstandingPos.length,
      pos: outstandingPos.slice(0, 10),
    },
  });
}
