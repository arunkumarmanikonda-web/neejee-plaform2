// Admin reviews — list all (with filter by status)
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(request.url);
  const status = url.searchParams.get('status');

  try {
    const where: any = {};
    if (status && status !== 'ALL') where.status = status;
    const reviews = await prisma.review.findMany({
      where, take: 200, orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        product: { select: { name: true, slug: true, images: true } },
      },
    });
    const counts = await prisma.review.groupBy({
      by: ['status'], _count: { _all: true },
    });
    const statusCounts = counts.reduce((acc: any, c: any) => {
      acc[c.status] = c._count._all;
      return acc;
    }, {} as Record<string, number>);
    return NextResponse.json({ reviews, statusCounts });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, reviews: [], statusCounts: {} }, { status: 500 });
  }
}
