// Admin inventory submission queue.
// GET /api/admin/seller-inventory?status=SUBMITTED — list pending/under-review submissions across all sellers.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await getSession();
  if (!requireRole(session, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR', 'QC_TEAM'])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status') || '';
    const sellerId = url.searchParams.get('sellerId');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);

    const where: any = {};
    if (status) where.status = status;
    if (sellerId) where.sellerId = sellerId;

    const rows = await prisma.sellerInventorySubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        seller: { select: { id: true, businessName: true, slug: true } },
        product: { select: { id: true, name: true, sku: true, status: true } },
      },
    });

    // Group counts
    const counts = await prisma.sellerInventorySubmission.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    return NextResponse.json({ submissions: rows, counts });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
