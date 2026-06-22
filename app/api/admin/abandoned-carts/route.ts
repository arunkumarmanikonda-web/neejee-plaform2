// app/api/admin/abandoned-carts/route.ts
// v26.3a — List & inspect abandoned carts.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const stage = url.searchParams.get('stage');     // 0..4
  const status = url.searchParams.get('status');   // active|recovered|opted_out|telecaller
  const search = url.searchParams.get('q') || '';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);

  const where: any = {};

  if (status === 'active') {
    where.recoveredOrderId = null;
    where.optedOut = false;
  } else if (status === 'recovered') {
    where.recoveredOrderId = { not: null };
  } else if (status === 'opted_out') {
    where.optedOut = true;
  } else if (status === 'telecaller') {
    where.recoveryStage = 4;
    where.recoveredOrderId = null;
  } else {
    // default: active
    where.recoveredOrderId = null;
    where.optedOut = false;
  }

  if (stage !== null && stage !== undefined && stage !== '') {
    where.recoveryStage = parseInt(stage);
  }

  if (search) {
    where.OR = [
      { email: { contains: search.toLowerCase() } },
      { customerName: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
    ];
  }

  const carts = await prisma.abandonedCart.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  // Summary counts
  const [active, recovered, optedOut, atHandoff] = await Promise.all([
    prisma.abandonedCart.count({ where: { recoveredOrderId: null, optedOut: false } }),
    prisma.abandonedCart.count({ where: { recoveredOrderId: { not: null } } }),
    prisma.abandonedCart.count({ where: { optedOut: true } }),
    prisma.abandonedCart.count({ where: { recoveryStage: 4, recoveredOrderId: null } }),
  ]);

  return NextResponse.json({
    carts,
    summary: { active, recovered, optedOut, atHandoff },
  });
}
