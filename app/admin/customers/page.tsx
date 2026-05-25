import { formatPrice } from '@/lib/utils';

const customers = [
  { id: 'c1', name: 'Aanya M.', email: 'aanya@example.com', orders: 7, ltv: 18750000, lastOrder: '2026-05-12', tier: 'GOLD' },
  { id: 'c2', name: 'Priya R.', email: 'priya@example.com', orders: 12, ltv: 35400000, lastOrder: '2026-05-20', tier: 'PLATINUM' },
  { id: 'c3', name: 'Mira S.', email: 'mira@example.com', orders: 3, ltv: 4750000, lastOrder: '2026-04-22', tier: 'SILVER' },
  { id: 'c4', name: 'Tara K.', email: 'tara@example.com', orders: 5, ltv: 12200000, lastOrder: '2026-05-15', tier: 'GOLD' },
  { id: 'c5', name: 'Neha G.', email: 'neha@example.com', orders: 2, ltv: 18500000, lastOrder: '2026-05-18', tier: 'GOLD' },
];

export default function AdminCustomers() {
  return (
    <>
      <p className="label text-madder">PEOPLE</p>
      <h1 className="font-display text-4xl text-kohl mt-2">Customers</h1>
      <p className="font-italic italic text-mitti mt-2">{customers.length} active members</p>
      <div className="madder-divider mt-4"></div>

      <div className="grid grid-cols-4 gap-4 mt-8">
        <div className="bg-beige p-5"><p className="label">TOTAL CUSTOMERS</p><p className="font-display text-3xl mt-2">1,247</p></div>
        <div className="bg-beige p-5"><p className="label">NEW THIS MONTH</p><p className="font-display text-3xl mt-2 text-neem">+184</p></div>
        <div className="bg-beige p-5"><p className="label">REPEAT RATE</p><p className="font-display text-3xl mt-2">28%</p></div>
        <div className="bg-beige p-5"><p className="label">AVG LTV</p><p className="font-display text-3xl mt-2">₹14,200</p></div>
      </div>

      <table className="w-full mt-12 bg-beige font-ui text-sm">
        <thead>
          <tr className="border-b border-mitti/20 text-left text-xs tracking-widest text-mitti">
            <th className="p-4">NAME</th><th className="p-4">EMAIL</th><th className="p-4">ORDERS</th>
            <th className="p-4">LIFETIME VALUE</th><th className="p-4">LAST ORDER</th><th className="p-4">TIER</th>
          </tr>
        </thead>
        <tbody>
          {customers.map(c => (
            <tr key={c.id} className="border-b border-mitti/10 hover:bg-ivory/50">
              <td className="p-4 font-medium">{c.name}</td>
              <td className="p-4 text-monsoon">{c.email}</td>
              <td className="p-4">{c.orders}</td>
              <td className="p-4 font-medium">{formatPrice(c.ltv)}</td>
              <td className="p-4 text-xs">{new Date(c.lastOrder).toLocaleDateString('en-IN')}</td>
              <td className="p-4"><span className="badge-founder">{c.tier}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
