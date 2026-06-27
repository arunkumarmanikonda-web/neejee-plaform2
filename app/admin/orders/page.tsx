'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatPrice, formatDate } from '@/lib/utils';

const STATUS_COLOR: Record<string, string> = {
  PLACED: 'bg-mitti',
  CONFIRMED: 'bg-banarasi',
  PACKED: 'bg-madder',
  SHIPPED: 'bg-ajrakh',
  OUT_FOR_DELIVERY: 'bg-haldi',
  DELIVERED: 'bg-neem',
  CANCELLED: 'bg-monsoon',
  CANCELLED_BUG: 'bg-madder',
};

const FILTERS = ['ALL', 'PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
const BUG_FILTER = 'CANCELLED_BUG';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (status: string) => {
    setLoading(true); setError('');
    try {
      // Default list hides CANCELLED_BUG (server-side). When the user picks
      // the CANCELLED_BUG chip, we explicitly include it via showBug=1 and
      // filter to that exact status.
      let url = '/api/admin/orders';
      if (status === BUG_FILTER) {
        url = '/api/admin/orders?status=ALL&showBug=1';
      } else if (status !== 'ALL') {
        url = `/api/admin/orders?status=${status}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load orders');

      let list = data.orders || [];
      // When viewing the bug chip, narrow the returned ALL list down to
      // just CANCELLED_BUG rows on the client (the API returns everything
      // when showBug=1).
      if (status === BUG_FILTER) {
        list = list.filter((o: any) => o.status === BUG_FILTER);
      }

      setOrders(list);
      setCounts(data.statusCounts || {});
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(filter); }, [filter]);

  // total = sum of all known status counts. We intentionally include
  // CANCELLED_BUG here only when the API returned it (i.e. the user has
  // already opted into seeing them), so the headline number stays honest.
  const visibleCounts = { ...counts };
  if (filter !== BUG_FILTER) {
    delete visibleCounts[BUG_FILTER];
  }
  const total = Object.values(visibleCounts).reduce((s, n) => s + n, 0);

  const bugCount = counts[BUG_FILTER] || 0;

  return (
    <>
      <p className="label text-madder">FULFILLMENT</p>
      <h1 className="font-display text-4xl text-kohl mt-2">Orders</h1>
      <p className="font-italic italic text-mitti mt-2">
        {loading ? 'Loading...' : `${orders.length} of ${total} orders shown`}
      </p>
      <div className="madder-divider mt-4"></div>

      {error && <p className="mt-6 font-ui text-sm text-madder bg-madder/10 p-3">{error}</p>}

      <div className="flex flex-wrap gap-2 mt-8 font-ui text-xs tracking-widest">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 transition-colors ${filter === f ? 'bg-kohl text-ivory' : 'bg-beige text-kohl hover:bg-mitti/20'}`}
          >
            {f.replace(/_/g, ' ')} {f === 'ALL' ? `(${total})` : counts[f] ? `(${counts[f]})` : ''}
          </button>
        ))}

        {bugCount > 0 && (
          <button
            key={BUG_FILTER}
            onClick={() => setFilter(BUG_FILTER)}
            title="Bug-generated cancelled orders. Hidden from the default list. Review and clean up."
            className={`px-4 py-2 transition-colors border ${
              filter === BUG_FILTER
                ? 'bg-madder text-ivory border-madder'
                : 'bg-beige text-madder border-madder/40 hover:bg-madder/10'
            }`}
          >
            CANCELLED BUG ({bugCount})
          </button>
        )}
      </div>

      {filter === BUG_FILTER && (
        <p className="mt-3 font-ui text-xs text-mitti italic">
          These rows are hidden from the default Orders list. They were created by an earlier checkout bug and are kept for audit only.
        </p>
      )}

      <table className="w-full mt-8 font-ui text-sm bg-beige">
        <thead>
          <tr className="border-b border-mitti/20 text-left text-xs tracking-widest text-mitti">
            <th className="p-4">ORDER #</th>
            <th className="p-4">CUSTOMER</th>
            <th className="p-4">DATE</th>
            <th className="p-4">ITEMS</th>
            <th className="p-4">TOTAL</th>
            <th className="p-4">PAYMENT</th>
            <th className="p-4">STATUS</th>
            <th className="p-4"></th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr><td colSpan={8} className="p-8 text-center text-mitti">Loading orders...</td></tr>
          )}
          {!loading && orders.length === 0 && (
            <tr><td colSpan={8} className="p-8 text-center text-mitti">No orders found for filter "{filter}"</td></tr>
          )}
          {orders.map(o => (
            <tr key={o.id} className="border-b border-mitti/10 hover:bg-ivory/50">
              <td className="p-4 text-mitti font-mono text-xs">{o.orderNumber}</td>
              <td className="p-4">
                <p className="font-medium">{o.customer}</p>
                <p className="text-xs text-monsoon">{o.email}</p>
              </td>
              <td className="p-4 text-xs">{formatDate(o.createdAt)}</td>
              <td className="p-4 text-xs text-mitti">{o.itemCount}</td>
              <td className="p-4 font-medium">{formatPrice(o.total)}</td>
              <td className="p-4">
                <span className={`text-xs ${o.paymentStatus === 'PAID' ? 'text-neem' : 'text-haldi'}`}>
                  • {o.paymentStatus}
                </span>
              </td>
              <td className="p-4">
                <span className={`badge-founder ${STATUS_COLOR[o.status] || 'bg-mitti'}`}>
                  {o.status.replace(/_/g, ' ')}
                </span>
              </td>
              <td className="p-4 text-right">
                <Link href={`/admin/orders/${o.orderNumber}`} className="text-madder text-xs hover:underline">
                  VIEW →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
