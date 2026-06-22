// Admin analytics endpoint — aggregates revenue, funnel, top products,
// channel attribution, and cohorts. Cheap-ish: each query is bounded.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR', 'QC_TEAM'];

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || !ADMIN_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const rangeDays = parseInt(url.searchParams.get('days') || '30');
    const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);
    const sincePrev = new Date(Date.now() - 2 * rangeDays * 24 * 60 * 60 * 1000);

    // Run all queries in parallel for speed
    const [
      orders,
      ordersPrev,
      eventsTotal,
      eventsByType,
      topProductOrders,
      topProductViews,
      channelOrders,
      newCustomers,
      returningCustomersRaw,
      abandonedCarts,
    ] = await Promise.all([
      // Orders this window
      prisma.order.findMany({
        where: { createdAt: { gte: since } },
        select: {
          id: true, total: true, paymentStatus: true, createdAt: true,
          utmSource: true, utmMedium: true, utmCampaign: true, userId: true,
        },
      }),
      // Orders previous window (for growth %)
      prisma.order.findMany({
        where: { createdAt: { gte: sincePrev, lt: since } },
        select: { total: true, paymentStatus: true },
      }),
      // Total event count this window
      prisma.analyticsEvent.count({ where: { createdAt: { gte: since } } }),
      // Funnel counts grouped by type
      prisma.analyticsEvent.groupBy({
        by: ['type'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      // Top products by paid order quantity (this window)
      prisma.orderItem.groupBy({
        by: ['productId'],
        where: { order: { createdAt: { gte: since }, paymentStatus: 'PAID' } },
        _sum: { quantity: true, total: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 10,
      }),
      // Top products by PRODUCT_VIEW events
      prisma.analyticsEvent.groupBy({
        by: ['productId'],
        where: { type: 'PRODUCT_VIEW', createdAt: { gte: since }, productId: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { productId: 'desc' } },
        take: 10,
      }),
      // Channel attribution from orders
      prisma.order.groupBy({
        by: ['utmSource'],
        where: { createdAt: { gte: since }, paymentStatus: 'PAID' },
        _sum: { total: true },
        _count: { _all: true },
      }),
      // New customers this window
      prisma.user.count({
        where: { role: 'CUSTOMER', createdAt: { gte: since } },
      }),
      // Returning customers (users with 2+ paid orders ever)
      prisma.order.groupBy({
        by: ['userId'],
        where: { paymentStatus: 'PAID', userId: { not: null } },
        _count: { _all: true },
      }),
      // Abandoned cart count
      prisma.abandonedCart.count({
        where: { createdAt: { gte: since }, recoveredOrderId: null, optedOut: false },
      }),
    ]);

    // Resolve top product names
    const topIds = Array.from(new Set([
      ...topProductOrders.map(t => t.productId),
      ...topProductViews.map(t => t.productId).filter(Boolean) as string[],
    ]));
    const products = topIds.length
      ? await prisma.product.findMany({
          where: { id: { in: topIds } },
          select: { id: true, name: true, slug: true, sellingPrice: true, images: true },
        })
      : [];
    const productMap = new Map(products.map(p => [p.id, p]));

    // Build daily revenue series
    const daily = new Map<string, { revenue: number; orders: number }>();
    for (let d = 0; d < rangeDays; d++) {
      const day = new Date(since.getTime() + d * 24 * 60 * 60 * 1000);
      const key = day.toISOString().slice(0, 10);
      daily.set(key, { revenue: 0, orders: 0 });
    }
    for (const o of orders) {
      if (o.paymentStatus !== 'PAID') continue;
      const key = o.createdAt.toISOString().slice(0, 10);
      const row = daily.get(key);
      if (row) { row.revenue += o.total; row.orders += 1; }
    }

    const totalRevenue = orders.filter(o => o.paymentStatus === 'PAID').reduce((s, o) => s + o.total, 0);
    const totalRevenuePrev = ordersPrev.filter(o => o.paymentStatus === 'PAID').reduce((s, o) => s + o.total, 0);
    const paidOrders = orders.filter(o => o.paymentStatus === 'PAID').length;
    const aov = paidOrders > 0 ? Math.round(totalRevenue / paidOrders) : 0;

    // Funnel
    const fmap = Object.fromEntries(eventsByType.map(e => [e.type, e._count._all]));
    const funnel = {
      pageViews: fmap['PAGE_VIEW'] || 0,
      productViews: fmap['PRODUCT_VIEW'] || 0,
      addToCart: fmap['ADD_TO_CART'] || 0,
      beginCheckout: fmap['BEGIN_CHECKOUT'] || 0,
      purchase: fmap['PURCHASE'] || paidOrders, // fallback when tracking just rolled out
    };

    // Cohort: returning rate
    const repeatBuyers = returningCustomersRaw.filter(r => r._count._all >= 2).length;
    const oneTimeBuyers = returningCustomersRaw.filter(r => r._count._all === 1).length;

    return NextResponse.json({
      rangeDays,
      kpis: {
        revenue: totalRevenue,
        revenuePrev: totalRevenuePrev,
        revenueGrowthPct: totalRevenuePrev > 0
          ? Math.round(((totalRevenue - totalRevenuePrev) / totalRevenuePrev) * 100)
          : null,
        orders: paidOrders,
        aov,
        eventsTotal,
        newCustomers,
        repeatBuyers,
        oneTimeBuyers,
        abandonedCarts,
      },
      funnel,
      daily: Array.from(daily.entries()).map(([date, v]) => ({ date, ...v })),
      topByRevenue: topProductOrders.map(t => ({
        id: t.productId,
        name: productMap.get(t.productId)?.name || 'Unknown',
        slug: productMap.get(t.productId)?.slug || '',
        image: (productMap.get(t.productId)?.images as string[] | undefined)?.[0] || null,
        qty: t._sum.quantity || 0,
        revenue: t._sum.total || 0,
      })),
      topByViews: topProductViews.map(t => ({
        id: t.productId,
        name: productMap.get(t.productId!)?.name || 'Unknown',
        slug: productMap.get(t.productId!)?.slug || '',
        views: t._count._all,
      })),
      channels: channelOrders.map(c => ({
        source: c.utmSource || 'direct',
        orders: c._count._all,
        revenue: c._sum.total || 0,
      })).sort((a, b) => b.revenue - a.revenue),
    });
  } catch (e: any) {
    console.error('[analytics] error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
