// app/api/admin/orders/route.ts
// v26.3a — Excludes CANCELLED_BUG from default view (showBug=true override).
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const showBug = url.searchParams.get('showBug') === '1';

  try {
    const where: any = {};
    if (status && status !== 'ALL') {
      where.status = status;
    } else if (!showBug) {
      // v26.3a — hide bug-cancelled orders unless explicitly requested
      where.status = { not: 'CANCELLED_BUG' };
    }

    const orders = await prisma.order.findMany({
      where, take: 100, orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, name: true } },
        items: { select: { id: true } },
      },
    });
    const counts = await prisma.order.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const statusCounts = counts.reduce((acc: any, c: any) => {
      acc[c.status] = c._count._all;
      return acc;
    }, {} as Record<string, number>);
    return NextResponse.json({
      orders: orders.map((o: any) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customer: o.user?.name || o.guestName || 'Guest',
        email: o.user?.email || o.guestEmail || '',
        createdAt: o.createdAt,
        total: o.total,
        itemCount: o.items.length,
        status: o.status,
        paymentStatus: o.paymentStatus,
        cancellationReason: o.cancellationReason || null,
      })),
      statusCounts,
      total: orders.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, orders: [], statusCounts: {} }, { status: 500 });
  }
}
