// Seller activity log.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireSellerContext } from '@/lib/seller-auth-helpers';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await getSession();
  const gate = await requireSellerContext(session);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const limit = Math.min(parseInt(new URL(req.url).searchParams.get('limit') || '100'), 500);
    const logs = await prisma.sellerAuditLog.findMany({
      where: { sellerId: gate.ctx.seller.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return NextResponse.json({ logs });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
