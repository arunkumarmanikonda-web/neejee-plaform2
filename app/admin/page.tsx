import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { formatPrice } from '@/lib/utils';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type DashboardData = {
  orderCount: number;
  customerCount: number;
  productCount: number;
  recentOrders: Array<{
    orderNumber: string;
    total: number;
    status: string;
    paymentStatus: string;
    createdAt: Date;
    user?: { name: string | null; email: string | null } | null;
    guestName?: string | null;
    guestEmail?: string | null;
  }>;
  lowStockVariants: Array<{
    inventory: number;
    product: { name: string; slug: string; sku: string | null };
  }>;
  totalRevenue: number;
  sevenDayOrders: Array<{
    total: number;
    createdAt: Date;
    paymentStatus: string;
  }>;
  topProducts: Array<{ name: string; qty: number }>;
  error?: string;
  errorCode?: 'POOL_EXHAUSTED' | 'DB_UNAVAILABLE';
};

function getDashboardErrorMeta(message: string | undefined) {
  const text = String(message || '');
  const poolExhausted = /EMAXCONNSESSION|max clients reached in session mode|too many connections/i.test(text);
  if (poolExhausted) {
    return {
      code: 'POOL_EXHAUSTED' as const,
      headline: '⚠️ Database connection pool is saturated.' ,
      hint: 'This is not a missing-env-var issue. The dashboard is opening more database work than the current production pool can handle right now. Retry shortly or open a product page directly while the pool recovers.',
    };
  }

  return {
    code: 'DB_UNAVAILABLE' as const,
    headline: '⚠️ Database is temporarily unavailable.',
    hint: 'The dashboard could not load live data right now. Please retry in a moment and check the deployment logs if it persists.',
  };
}

async function getDashboardData(): Promise<DashboardData> {
  try {
    // Intentionally sequential to reduce concurrent DB pressure in serverless runtime.
    const orderCount = await prisma.order.count();
    const customerCount = await prisma.user.count({ where: { role: 'CUSTOMER' } });
    const productCount = await prisma.product.count({ where: { status: 'ACTIVE' } });

    const recentOrders = await prisma.order.findMany({
      take: 6,
      orderBy: { createdAt: 'desc' },
      select: {
        orderNumber: true,
        total: true,
        status: true,
        paymentStatus: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
        guestName: true,
        guestEmail: true,
      },
    });

    const lowStockVariants = await prisma.variant.findMany({
      where: { inventory: { lte: 3 } },
      take: 8,
      select: {
        inventory: true,
        product: { select: { name: true, slug: true, sku: true } },
      },
    });

    const paidAggregate = await prisma.order.aggregate({
      _sum: { total: true },
      where: { paymentStatus: 'PAID' },
    });

    const sevenDayOrders = await prisma.order.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      select: { total: true, createdAt: true, paymentStatus: true },
    });

    const topItems = await prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    });

    const topProductIds = topItems.map((t: any) => t.productId);
    const topProductsDetail = topProductIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: topProductIds } },
          select: { id: true, name: true },
        })
      : [];

    const topProducts = topItems.map((t: any) => ({
      name: topProductsDetail.find((p: any) => p.id === t.productId)?.name || 'Product',
      qty: t._sum.quantity || 0,
    }));

    return {
      orderCount,
      customerCount,
      productCount,
      recentOrders,
      lowStockVariants,
      totalRevenue: paidAggregate._sum.total || 0,
      sevenDayOrders,
      topProducts,
    };
  } catch (e: any) {
    const meta = getDashboardErrorMeta(e?.message);
    return {
      orderCount: 0,
      customerCount: 0,
      productCount: 0,
      recentOrders: [],
      lowStockVariants: [],
      totalRevenue: 0,
      sevenDayOrders: [],
      topProducts: [],
      error: e?.message || 'Unknown dashboard error',
      errorCode: meta.code,
    };
  }
}

export default async function AdminDashboard() {
  const user = await getSession();
  const data = await getDashboardData();
  const hasError = Boolean(data.error);
  const errorMeta = hasError ? getDashboardErrorMeta(data.error) : null;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();
  const displayName = user?.name || user?.email?.split('@')[0] || 'Admin';

  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return { day: d.toISOString().slice(0, 10), total: 0 };
  });

  if (!hasError && data.sevenDayOrders) {
    for (const o of data.sevenDayOrders) {
      const key = new Date(o.createdAt).toISOString().slice(0, 10);
      const bucket = last30Days.find((b) => b.day === key);
      if (bucket && o.paymentStatus === 'PAID') bucket.total += o.total;
    }
  }

  const maxBucket = Math.max(...last30Days.map((b) => b.total), 1);

  return (
    <>
      <p className="label text-madder">DASHBOARD {!hasError && '· LIVE DATA'}</p>
      <h1 className="font-display text-4xl text-kohl mt-2">{greeting}, {displayName}.</h1>
      <p className="font-italic italic text-mitti text-lg mt-2">
        {hasError
          ? errorMeta?.headline
          : `${data.orderCount} orders · ${data.customerCount} customers · ${data.productCount} active products.`}
      </p>
      <div className="madder-divider mt-4"></div>

      {hasError && (
        <div className="mt-6 space-y-3">
          <p className="font-ui text-sm text-madder bg-madder/10 p-3">
            {errorMeta?.hint}
          </p>
          <p className="font-ui text-xs text-madder bg-madder/5 p-3 break-words">
            DB Error: {data.error}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/products" className="font-ui text-xs text-madder hover:underline">
              OPEN PRODUCTS →
            </Link>
            <Link href="/admin/orders" className="font-ui text-xs text-madder hover:underline">
              OPEN ORDERS →
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
        <Kpi label="TOTAL REVENUE" value={!hasError ? formatPrice(data.totalRevenue) : '—'} />
        <Kpi label="ORDERS" value={!hasError ? data.orderCount.toString() : '—'} />
        <Kpi label="CUSTOMERS" value={!hasError ? data.customerCount.toString() : '—'} />
        <Kpi label="ACTIVE PRODUCTS" value={!hasError ? data.productCount.toString() : '—'} trend="live" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mt-12">
        <div className="lg:col-span-2 bg-beige p-8">
          <p className="label text-madder">REVENUE · LAST 30 DAYS</p>
          <div className="h-64 mt-4 flex items-end gap-1">
            {last30Days.map((b, i) => (
              <div
                key={i}
                className="flex-1 bg-madder/80 hover:bg-madder transition-colors rounded-t"
                style={{ height: `${Math.max((b.total / maxBucket) * 100, 2)}%` }}
                title={`${b.day}: ${formatPrice(b.total)}`}
              />
            ))}
          </div>
          <p className="font-ui text-xs text-mitti mt-2">
            7-day total paid: {!hasError ? formatPrice(last30Days.slice(-7).reduce((s, b) => s + b.total, 0)) : '—'}
          </p>
        </div>
        <div className="bg-beige p-8">
          <p className="label text-madder mb-4">TOP SELLING</p>
          <ul className="space-y-3 font-ui text-sm">
            {!hasError && data.topProducts.length > 0 ? (
              data.topProducts.map((p, i) => (
                <li key={i} className="flex justify-between">
                  <span className="truncate">{p.name}</span>
                  <span className="text-monsoon ml-2">{p.qty}</span>
                </li>
              ))
            ) : (
              <li className="text-mitti italic">No sales data yet.</li>
            )}
          </ul>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        <div className="bg-beige p-8">
          <div className="flex justify-between items-center mb-4">
            <p className="label text-madder">RECENT ORDERS</p>
            <Link href="/admin/orders" className="font-ui text-xs text-madder hover:underline">VIEW ALL →</Link>
          </div>
          <table className="w-full font-ui text-sm">
            <tbody>
              {!hasError && data.recentOrders.length > 0 ? (
                data.recentOrders.map((o) => (
                  <tr key={o.orderNumber} className="border-b border-mitti/10">
                    <td className="py-3 text-mitti text-xs font-mono">
                      <Link href={`/admin/orders/${o.orderNumber}`} className="hover:text-madder">
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="py-3">{o.user?.name || o.guestName || o.user?.email || 'Guest'}</td>
                    <td className="py-3 font-medium">{formatPrice(o.total)}</td>
                    <td className="py-3">
                      <span className="badge-founder">{o.status.replace(/_/g, ' ')}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-mitti italic">No orders yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-beige p-8">
          <p className="label text-madder mb-4">LOW STOCK ALERTS</p>
          <ul className="space-y-3 font-ui text-sm">
            {!hasError && data.lowStockVariants.length > 0 ? (
              data.lowStockVariants.map((v, i) => {
                const color = v.inventory <= 1 ? 'madder' : v.inventory <= 3 ? 'haldi' : 'neem';
                return (
                  <li key={i} className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full bg-${color}`} />
                    <span className="truncate">{v.product.name}</span>
                    <span className="ml-auto text-xs text-mitti font-mono">{v.product.sku}</span>
                    <span className={`text-${color}`}>{v.inventory} left</span>
                  </li>
                );
              })
            ) : (
              <li className="text-mitti italic">All stock levels healthy.</li>
            )}
          </ul>
        </div>
      </div>
    </>
  );
}

function Kpi({ label, value, trend }: { label: string; value: string; trend?: string }) {
  return (
    <div className="bg-beige p-6">
      <p className="label text-monsoon">{label}</p>
      <p className="font-display text-3xl mt-2 text-kohl">{value}</p>
      {trend && <p className="font-ui text-xs text-neem mt-1">{trend}</p>}
    </div>
  );
}
