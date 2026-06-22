// Admin customers list endpoint
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const customers = await prisma.user.findMany({
      where: { role: 'CUSTOMER' },
      take: 200,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        createdAt: true,
        orders: {
          select: { id: true, total: true, status: true, paymentStatus: true, createdAt: true },
        },
      },
    });
    const mapped = customers.map((c: any) => {
      const paidOrders = c.orders.filter((o: any) => o.paymentStatus === 'PAID');
      const ltv = paidOrders.reduce((s: number, o: any) => s + (o.total || 0), 0);
      const lastOrder = c.orders.length > 0
        ? c.orders.reduce((max: any, o: any) => o.createdAt > max ? o.createdAt : max, c.orders[0].createdAt)
        : null;
      let tier = 'NEW';
      if (ltv >= 5000000) tier = 'PLATINUM';
      else if (ltv >= 2000000) tier = 'GOLD';
      else if (ltv >= 500000) tier = 'SILVER';
      else if (c.orders.length > 0) tier = 'BRONZE';
      return {
        id: c.id,
        name: c.name || c.email.split('@')[0],
        email: c.email,
        phone: c.phone,
        orderCount: c.orders.length,
        ltv,
        lastOrder,
        tier,
        joined: c.createdAt,
      };
    });
    // Stats
    const totalCustomers = await prisma.user.count({ where: { role: 'CUSTOMER' } });
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const newThisMonth = await prisma.user.count({
      where: { role: 'CUSTOMER', createdAt: { gte: thirtyDaysAgo } },
    });
    const repeatBuyers = mapped.filter((c: any) => c.orderCount > 1).length;
    const repeatRate = totalCustomers > 0 ? Math.round((repeatBuyers / totalCustomers) * 100) : 0;
    const totalLtv = mapped.reduce((s: number, c: any) => s + c.ltv, 0);
    const avgLtv = mapped.length > 0 ? Math.round(totalLtv / mapped.length) : 0;
    return NextResponse.json({
      customers: mapped,
      stats: { totalCustomers, newThisMonth, repeatRate, avgLtv },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, customers: [], stats: {} }, { status: 500 });
  }
}
