'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Users, ShoppingBag, Eye, IndianRupee, Repeat, ShoppingCart, AlertCircle } from 'lucide-react';
import { formatINR } from '@/lib/money';

export const dynamic = 'force-dynamic';

interface Data {
  rangeDays: number;
  kpis: any;
  funnel: any;
  daily: { date: string; revenue: number; orders: number }[];
  topByRevenue: any[];
  topByViews: any[];
  channels: any[];
}

export default function AdminAnalytics() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/analytics?days=${days}`, { credentials: 'include', cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.error) setErr(d.error);
        else setData(d);
        setLoading(false);
      })
      .catch(e => { setErr(e.message); setLoading(false); });
  }, [days]);

  if (loading) {
    return <div className="p-12 text-center text-mitti font-italic italic">Reading the tea leaves...</div>;
  }

  if (err) {
    return <div className="p-12 bg-haldi/20 text-haldi rounded">{err}</div>;
  }

  if (!data) return null;

  const k = data.kpis;
  const f = data.funnel;
  // Conversion rates
  const cvrViewToATC = f.productViews > 0 ? ((f.addToCart / f.productViews) * 100).toFixed(1) : '—';
  const cvrATCtoCheckout = f.addToCart > 0 ? ((f.beginCheckout / f.addToCart) * 100).toFixed(1) : '—';
  const cvrCheckoutToPurchase = f.beginCheckout > 0 ? ((f.purchase / f.beginCheckout) * 100).toFixed(1) : '—';
  const cvrOverall = f.pageViews > 0 ? ((f.purchase / f.pageViews) * 100).toFixed(2) : '—';

  // Sparkline max for scaling
  const maxRevenue = Math.max(1, ...data.daily.map(d => d.revenue));

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="label text-madder">PERSONAL METRICS</p>
          <h1 className="font-display text-4xl text-kohl">Analytics</h1>
          <p className="font-italic italic text-mitti mt-1">Quietly counting what matters.</p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-4 py-2 text-xs tracking-wider font-ui ${days === d ? 'bg-kohl text-ivory' : 'bg-beige text-kohl hover:bg-beige/60'}`}
            >
              {d} DAYS
            </button>
          ))}
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          label="REVENUE"
          value={formatINR(k.revenue)}
          icon={<IndianRupee className="w-4 h-4" />}
          growth={k.revenueGrowthPct}
          accent
        />
        <Kpi
          label="PAID ORDERS"
          value={k.orders.toString()}
          icon={<ShoppingBag className="w-4 h-4" />}
        />
        <Kpi
          label="AOV"
          value={formatINR(k.aov)}
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <Kpi
          label="NEW CUSTOMERS"
          value={k.newCustomers.toString()}
          icon={<Users className="w-4 h-4" />}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          label="PAGE VIEWS"
          value={f.pageViews.toLocaleString('en-IN')}
          icon={<Eye className="w-4 h-4" />}
          hint={`${cvrOverall}% to purchase`}
        />
        <Kpi
          label="ADD TO CART"
          value={f.addToCart.toLocaleString('en-IN')}
          icon={<ShoppingCart className="w-4 h-4" />}
          hint={`${cvrViewToATC}% from PDP`}
        />
        <Kpi
          label="REPEAT BUYERS"
          value={k.repeatBuyers.toString()}
          icon={<Repeat className="w-4 h-4" />}
          hint={`${k.oneTimeBuyers} one-timers`}
        />
        <Kpi
          label="ABANDONED CARTS"
          value={k.abandonedCarts.toString()}
          icon={<AlertCircle className="w-4 h-4" />}
          hint="Awaiting recovery"
        />
      </div>

      {/* Revenue sparkline */}
      <section className="bg-beige p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="label text-madder">REVENUE OVER TIME</p>
            <p className="font-display text-2xl text-kohl mt-1">{formatINR(k.revenue)}</p>
          </div>
          <p className="font-italic italic text-mitti text-sm">{days} days</p>
        </div>
        <div className="h-32 flex items-end gap-px">
          {data.daily.map((d, i) => (
            <div
              key={i}
              className="flex-1 bg-madder/70 hover:bg-madder transition-colors relative group"
              style={{ height: `${(d.revenue / maxRevenue) * 100}%`, minHeight: d.revenue > 0 ? '2px' : '0' }}
              title={`${d.date}: ${formatINR(d.revenue)} (${d.orders} orders)`}
            >
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-kohl text-ivory text-xs px-2 py-1 opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-10">
                {d.date.slice(5)}: {formatINR(d.revenue)}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-mitti">
          <span>{data.daily[0]?.date}</span>
          <span>{data.daily[data.daily.length - 1]?.date}</span>
        </div>
      </section>

      {/* Funnel */}
      <section className="bg-beige p-6">
        <p className="label text-madder mb-4">CONVERSION FUNNEL</p>
        <div className="space-y-3">
          <FunnelStep label="Page views" value={f.pageViews} total={f.pageViews} />
          <FunnelStep label="Product views" value={f.productViews} total={f.pageViews} cvr={f.pageViews > 0 ? `${((f.productViews/f.pageViews)*100).toFixed(1)}%` : '—'} />
          <FunnelStep label="Added to trunk" value={f.addToCart} total={f.pageViews} cvr={`${cvrViewToATC}%`} />
          <FunnelStep label="Began checkout" value={f.beginCheckout} total={f.pageViews} cvr={`${cvrATCtoCheckout}% from ATC`} />
          <FunnelStep label="Purchased" value={f.purchase} total={f.pageViews} cvr={`${cvrCheckoutToPurchase}% from checkout`} highlight />
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top by revenue */}
        <section className="bg-beige p-6">
          <p className="label text-madder mb-4">TOP BY REVENUE</p>
          {data.topByRevenue.length === 0 ? (
            <p className="font-italic italic text-mitti text-sm">No paid orders yet in this window.</p>
          ) : (
            <ul className="space-y-3">
              {data.topByRevenue.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 text-sm">
                  <span className="font-display text-mitti w-6">{i + 1}.</span>
                  <Link href={`/products/${p.slug}`} className="flex-1 text-kohl hover:text-madder truncate">{p.name}</Link>
                  <span className="text-mitti text-xs">{p.qty} sold</span>
                  <span className="font-ui text-kohl font-medium ml-3">{formatINR(p.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Top by views */}
        <section className="bg-beige p-6">
          <p className="label text-madder mb-4">TOP BY VIEWS</p>
          {data.topByViews.length === 0 ? (
            <p className="font-italic italic text-mitti text-sm">No product views tracked yet.</p>
          ) : (
            <ul className="space-y-3">
              {data.topByViews.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 text-sm">
                  <span className="font-display text-mitti w-6">{i + 1}.</span>
                  <Link href={`/products/${p.slug}`} className="flex-1 text-kohl hover:text-madder truncate">{p.name}</Link>
                  <span className="font-ui text-kohl font-medium">{p.views.toLocaleString('en-IN')}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Channel attribution */}
      <section className="bg-beige p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="label text-madder">CHANNEL ATTRIBUTION</p>
          <p className="font-italic italic text-mitti text-xs">Where buyers come from (UTM source)</p>
        </div>
        {data.channels.length === 0 ? (
          <p className="font-italic italic text-mitti text-sm">All orders attributed to direct traffic. Use UTM tags on campaigns to break this down.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs label text-mitti border-b border-mitti/20">
                <th className="pb-2">SOURCE</th>
                <th className="pb-2 text-right">ORDERS</th>
                <th className="pb-2 text-right">REVENUE</th>
                <th className="pb-2 text-right">SHARE</th>
              </tr>
            </thead>
            <tbody>
              {data.channels.map((c, i) => {
                const totalRev = data.channels.reduce((s, x) => s + x.revenue, 0);
                const share = totalRev > 0 ? ((c.revenue / totalRev) * 100).toFixed(1) : '0';
                return (
                  <tr key={i} className="border-b border-mitti/10">
                    <td className="py-3 font-ui text-kohl">{c.source}</td>
                    <td className="py-3 text-right">{c.orders}</td>
                    <td className="py-3 text-right">{formatINR(c.revenue)}</td>
                    <td className="py-3 text-right text-mitti">{share}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <p className="font-italic italic text-mitti text-center text-sm pt-4">
        Numbers are quiet servants, not the story. — NEEJEE
      </p>
    </div>
  );
}

function Kpi({ label, value, icon, hint, growth, accent }: any) {
  return (
    <div className={`p-5 ${accent ? 'bg-kohl text-ivory' : 'bg-beige text-kohl'}`}>
      <div className="flex items-center justify-between">
        <p className={`label ${accent ? 'text-banarasi' : 'text-mitti'}`}>{label}</p>
        <span className={accent ? 'text-banarasi' : 'text-madder'}>{icon}</span>
      </div>
      <p className="font-display text-3xl mt-2">{value}</p>
      {hint && <p className={`text-xs mt-1 ${accent ? 'text-ivory/60' : 'text-mitti'}`}>{hint}</p>}
      {growth !== undefined && growth !== null && (
        <div className={`flex items-center gap-1 mt-2 text-xs ${growth >= 0 ? (accent ? 'text-banarasi' : 'text-neem') : 'text-madder'}`}>
          {growth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {growth >= 0 ? '+' : ''}{growth}% vs prev period
        </div>
      )}
    </div>
  );
}

function FunnelStep({ label, value, total, cvr, highlight }: any) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className={highlight ? 'font-display text-madder' : 'text-kohl'}>{label}</span>
        <span className="flex items-center gap-3">
          <span className="text-mitti text-xs">{cvr}</span>
          <span className="font-ui font-medium">{value.toLocaleString('en-IN')}</span>
        </span>
      </div>
      <div className="h-2 bg-mitti/10 overflow-hidden">
        <div
          className={`h-full ${highlight ? 'bg-madder' : 'bg-kohl/70'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
