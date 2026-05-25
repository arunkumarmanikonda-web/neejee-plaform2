import Link from 'next/link';
import { formatPrice, formatDate } from '@/lib/utils';

async function getOrders() {
  // PRODUCTION: fetch via internal API or direct Prisma query (server component).
  return [
    { id: 'NEE-AB4521', customer: 'Priya R.', email: 'priya@example.com', date: '2026-05-20T08:14:00Z', total: 2450000, items: 1, status: 'PACKED', payment: 'PAID' },
    { id: 'NEE-AB4520', customer: 'Aanya M.', email: 'aanya@example.com', date: '2026-05-20T07:42:00Z', total: 320000, items: 1, status: 'SHIPPED', payment: 'PAID' },
    { id: 'NEE-AB4519', customer: 'Mira S.', email: 'mira@example.com', date: '2026-05-19T18:30:00Z', total: 1875000, items: 2, status: 'DELIVERED', payment: 'PAID' },
    { id: 'NEE-AB4518', customer: 'Tara K.', email: 'tara@example.com', date: '2026-05-19T14:15:00Z', total: 720000, items: 1, status: 'PACKED', payment: 'PAID' },
    { id: 'NEE-AB4517', customer: 'Riya P.', email: 'riya@example.com', date: '2026-05-19T11:00:00Z', total: 180000, items: 1, status: 'CONFIRMED', payment: 'PAID' },
    { id: 'NEE-AB4516', customer: 'Neha G.', email: 'neha@example.com', date: '2026-05-18T22:45:00Z', total: 16800000, items: 1, status: 'PROCESSING', payment: 'PAID' },
  ];
}

const STATUS_COLOR: Record<string, string> = {
  PLACED: 'bg-mitti', CONFIRMED: 'bg-banarasi', PACKED: 'bg-madder', SHIPPED: 'bg-ajrakh',
  DELIVERED: 'bg-neem', CANCELLED: 'bg-monsoon', PROCESSING: 'bg-haldi',
};

export default async function AdminOrders() {
  const orders = await getOrders();
  return (
    <>
      <p className="label text-madder">FULFILLMENT</p>
      <h1 className="font-display text-4xl text-kohl mt-2">Orders</h1>
      <p className="font-italic italic text-mitti mt-2">{orders.length} orders in flight</p>
      <div className="madder-divider mt-4"></div>

      <div className="grid grid-cols-4 gap-3 mt-8 font-ui text-xs tracking-widest">
        {['ALL (47)', 'PLACED (12)', 'PACKED (8)', 'SHIPPED (15)', 'DELIVERED (147)', 'RETURNS (3)'].slice(0,5).map(t => (
          <button key={t} className="px-4 py-2 bg-beige text-kohl hover:bg-mitti/20">{t}</button>
        ))}
      </div>

      <table className="w-full mt-8 font-ui text-sm bg-beige">
        <thead>
          <tr className="border-b border-mitti/20 text-left text-xs tracking-widest text-mitti">
            <th className="p-4">ORDER #</th>
            <th className="p-4">CUSTOMER</th>
            <th className="p-4">DATE</th>
            <th className="p-4">TOTAL</th>
            <th className="p-4">PAYMENT</th>
            <th className="p-4">STATUS</th>
            <th className="p-4"></th>
          </tr>
        </thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.id} className="border-b border-mitti/10 hover:bg-ivory/50">
              <td className="p-4 text-mitti">{o.id}</td>
              <td className="p-4">
                <p className="font-medium">{o.customer}</p>
                <p className="text-xs text-monsoon">{o.email}</p>
              </td>
              <td className="p-4 text-xs">{formatDate(o.date)}</td>
              <td className="p-4 font-medium">{formatPrice(o.total)}</td>
              <td className="p-4"><span className="text-neem text-xs">● {o.payment}</span></td>
              <td className="p-4"><span className={`badge-founder ${STATUS_COLOR[o.status] || 'bg-mitti'}`}>{o.status}</span></td>
              <td className="p-4 text-right"><Link href={`/admin/orders/${o.id}`} className="text-madder text-xs hover:underline">VIEW →</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
