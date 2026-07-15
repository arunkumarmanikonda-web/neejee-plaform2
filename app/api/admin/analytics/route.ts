// Admin analytics endpoint — aggregates revenue, funnel, top products,
// channel attribution, and cohorts with lower DB pressure and no Prisma groupBy typing issues.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR', 'QC_TEAM'];

function isPoolTimeoutError(e: any) {
  const msg = String(e?.message || '');
  return (
    msg.includes('Timed out fetching a new connection from the connection pool') ||
    msg.includes('connection pool')
  );
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || !ADMIN_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const rawDays = parseInt(url.searchParams.get('days') || '30', 10);
    const rangeDays = [7, 30, 90].includes(rawDays) ? rawDays : 30;

    const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);
    const sincePrev = new Date(Date.now() - 2 * rangeDays * 24 * 60 * 60 * 1000);

    const paidOrders = await prisma.order.findMany({
      where: { createdAt: { gte: since }, paymentStatus: 'PAID' },
      select: {
        id: true,
        total: true,
        createdAt: true,
        utmSource: true,
        userId: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const paidOrdersPrev = await prisma.order.findMany({
      where: { createdAt: { gte: sincePrev, lt: since }, paymentStatus: 'PAID' },
      select: {
        total: true,
      },
    });

    let events: Array<{ type: string; productId: string | null }> = [];
    try {
      events = await prisma.analyticsEvent.findMany({
        where: { createdAt: { gte: since } },
        select: {
          type: true,
          productId: true,
        },
      });
    } catch (e) {
      console.warn('[analytics] events query degraded:', e);
    }

    let revenueItems: Array<{ productId: string; quantity: number; total: number }> = [];
    try {
      revenueItems = await prisma.orderItem.findMany({
        where: {
          order: {
            createdAt: { gte: since },
            paymentStatus: 'PAID',
          },
        },
        select: {
          productId: true,
          quantity: true,
          total: true,
        },
      });
    } catch (e) {
      console.warn('[analytics] order item query degraded:', e);
    }

    let newCustomers = 0;
    try {
      newCustomers = await prisma.user.count({
        where: { role: 'CUSTOMER', createdAt: { gte: since } },
      });
    } catch (e) {
      console.warn('[analytics] new customer count degraded:', e);
    }

    let abandonedCarts = 0;
    try {
      abandonedCarts = await prisma.abandonedCart.count({
        where: {
          createdAt: { gte: since },
          recoveredOrderId: null,
          optedOut: false,
        },
      });
    } catch (e) {
      console.warn('[analytics] abandoned cart count degraded:', e);
    }

    const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total, 0);
    const totalRevenuePrev = paidOrdersPrev.reduce((sum, o) => sum + o.total, 0);
    const paidOrderCount = paidOrders.length;
    const aov = paidOrderCount > 0 ? Math.round(totalRevenue / paidOrderCount) : 0;

    const buyerCounts = new Map<string, number>();
    for (const o of paidOrders) {
      if (!o.userId) continue;
      buyerCounts.set(o.userId, (buyerCounts.get(o.userId) || 0) + 1);
    }
    const repeatBuyers = Array.from(buyerCounts.values()).filter(v => v >= 2).length;
    const oneTimeBuyers = Array.from(buyerCounts.values()).filter(v => v === 1).length;

    const channelMap = new Map<string, { source: string; orders: number; revenue: number }>();
    for (const o of paidOrders) {
      const source = (o.utmSource || '').trim() || 'direct';
      const current = channelMap.get(source) || { source, orders: 0, revenue: 0 };
      current.orders += 1;
      current.revenue += o.total;
      channelMap.set(source, current);
    }
    const channels = Array.from(channelMap.values()).sort((a, b) => b.revenue - a.revenue);

    const funnelCounts: Record<string, number> = {};
    const viewCountsByProduct = new Map<string, number>();

    for (const e of events) {
      const type = String(e.type || '');
      funnelCounts[type] = (funnelCounts[type] || 0) + 1;

      if (type === 'PRODUCT_VIEW' && e.productId) {
        viewCountsByProduct.set(
          e.productId,
          (viewCountsByProduct.get(e.productId) || 0) + 1
        );
      }
    }

    const topProductViews = Array.from(viewCountsByProduct.entries())
      .map(([productId, views]) => ({
        productId,
        _count: { _all: views },
      }))
      .sort((a, b) => b._count._all - a._count._all)
      .slice(0, 10);

    const revenueByProduct = new Map<string, { qty: number; revenue: number }>();
    for (const item of revenueItems) {
      if (!item.productId) continue;
      const current = revenueByProduct.get(item.productId) || { qty: 0, revenue: 0 };
      current.qty += item.quantity || 0;
      current.revenue += item.total || 0;
      revenueByProduct.set(item.productId, current);
    }

    const topProductOrders = Array.from(revenueByProduct.entries())
      .map(([productId, v]) => ({
        productId,
        _sum: {
          quantity: v.qty,
          total: v.revenue,
        },
      }))
      .sort((a, b) => (b._sum.total || 0) - (a._sum.total || 0))
      .slice(0, 10);

    const topIds = Array.from(new Set([
      ...topProductOrders.map(t => t.productId),
      ...topProductViews.map(t => t.productId),
    ]));

    const products = topIds.length
      ? await prisma.product.findMany({
          where: { id: { in: topIds } },
          select: {
            id: true,
            name: true,
            slug: true,
            sellingPrice: true,
            images: true,
          },
        })
      : [];

    const productMap = new Map(products.map((p) => [p.id, p]));

    const daily = new Map<string, { revenue: number; orders: number }>();
    for (let d = 0; d < rangeDays; d++) {
      const day = new Date(since.getTime() + d * 24 * 60 * 60 * 1000);
      const key = day.toISOString().slice(0, 10);
      daily.set(key, { revenue: 0, orders: 0 });
    }

    for (const o of paidOrders) {
      const key = o.createdAt.toISOString().slice(0, 10);
      const row = daily.get(key);
      if (row) {
        row.revenue += o.total;
        row.orders += 1;
      }
    }

    const funnel = {
      pageViews: funnelCounts['PAGE_VIEW'] || 0,
      productViews: funnelCounts['PRODUCT_VIEW'] || 0,
      addToCart: funnelCounts['ADD_TO_CART'] || 0,
      beginCheckout: funnelCounts['BEGIN_CHECKOUT'] || 0,
      purchase: funnelCounts['PURCHASE'] || paidOrderCount,
    };

    return NextResponse.json({
      rangeDays,
      kpis: {
        revenue: totalRevenue,
        revenuePrev: totalRevenuePrev,
        revenueGrowthPct: totalRevenuePrev > 0
          ? Math.round(((totalRevenue - totalRevenuePrev) / totalRevenuePrev) * 100)
          : null,
        orders: paidOrderCount,
        aov,
        eventsTotal: events.length,
        newCustomers,
        repeatBuyers,
        oneTimeBuyers,
        abandonedCarts,
      },
      funnel,
      daily: Array.from(daily.entries()).map(([date, v]) => ({ date, ...v })),
      topByRevenue: topProductOrders.map((t) => ({
        id: t.productId,
        name: productMap.get(t.productId)?.name || 'Unknown',
        slug: productMap.get(t.productId)?.slug || '',
        image: ((productMap.get(t.productId)?.images as unknown as string[] | null | undefined) || [])[0] || null,
        qty: t._sum.quantity || 0,
        revenue: t._sum.total || 0,
      })),
      topByViews: topProductViews.map((t) => ({
        id: t.productId,
        name: productMap.get(t.productId)?.name || 'Unknown',
        slug: productMap.get(t.productId)?.slug || '',
        views: t._count._all || 0,
      })),
      channels,
    });
  } catch (e: any) {
    console.error('[analytics] error:', e);
    const error = isPoolTimeoutError(e)
      ? 'Analytics is temporarily busy. Please retry in a minute.'
      : 'Unable to load analytics right now.';
    return NextResponse.json({ error }, { status: 500 });
  }
}