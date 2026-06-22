'use client';
import { useEffect, useState } from 'react';
import { formatPrice } from '@/lib/utils';

const TIER_COLOR: Record<string, string> = {
  PLATINUM: 'bg-kohl', GOLD: 'bg-haldi', SILVER: 'bg-monsoon', BRONZE: 'bg-mitti', NEW: 'bg-banarasi',
};

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/admin/customers').then(r => r.json()).then(d => {
      if (d.error) setError(d.error);
      setCustomers(d.customers || []);
      setStats(d.stats || {});
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const filtered = search
    ? customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()))
    : customers;

  return (
    <>
      <p className="label text-madder">PEOPLE</p>
      <h1 className="font-display text-4xl text-kohl mt-2">Customers</h1>
      <p className="font-italic italic text-mitti mt-2">{loading ? 'Loading...' : `${customers.length} members`}</p>
      <div className="madder-divider mt-4"></div>

      {error && <p className="mt-6 font-ui text-sm text-madder bg-madder/10 p-3">{error}</p>}

      <div className="grid grid-cols-4 gap-4 mt-8">
        <Stat label="TOTAL CUSTOMERS" value={stats.totalCustomers ?? '—'} />
        <Stat label="NEW THIS MONTH" value={`+${stats.newThisMonth ?? 0}`} color="text-neem" />
        <Stat label="REPEAT RATE" value={`${stats.repeatRate ?? 0}%`} />
        <Stat label="AVG LTV" value={stats.avgLtv ? formatPrice(stats.avgLtv) : '—'} />
      </div>

      <div className="mt-12 flex items-center justify-between">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..."
          className="w-72 p-3 bg-beige border border-mitti/20 font-ui text-sm" />
        <p className="font-ui text-xs text-mitti">{filtered.length} shown</p>
      </div>

      <table className="w-full mt-4 bg-beige font-ui text-sm">
        <thead>
          <tr className="border-b border-mitti/20 text-left text-xs tracking-widest text-mitti">
            <th className="p-4">NAME</th><th className="p-4">EMAIL</th><th className="p-4">PHONE</th>
            <th className="p-4">ORDERS</th><th className="p-4">LIFETIME VALUE</th>
            <th className="p-4">LAST ORDER</th><th className="p-4">TIER</th>
          </tr>
        </thead>
        <tbody>
          {loading && <tr><td colSpan={7} className="p-8 text-center text-mitti">Loading customers...</td></tr>}
          {!loading && filtered.length === 0 && (
            <tr><td colSpan={7} className="p-8 text-center text-mitti">No customers found</td></tr>
          )}
          {filtered.map(c => (
            <tr key={c.id} className="border-b border-mitti/10 hover:bg-ivory/50">
              <td className="p-4 font-medium">{c.name}</td>
              <td className="p-4 text-monsoon">{c.email}</td>
              <td className="p-4 text-monsoon text-xs">{c.phone || '—'}</td>
              <td className="p-4">{c.orderCount}</td>
              <td className="p-4 font-medium">{formatPrice(c.ltv)}</td>
              <td className="p-4 text-xs">{c.lastOrder ? new Date(c.lastOrder).toLocaleDateString('en-IN') : '—'}</td>
              <td className="p-4"><span className={`badge-founder ${TIER_COLOR[c.tier] || 'bg-mitti'}`}>{c.tier}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Stat({ label, value, color = 'text-kohl' }: any) {
  return (
    <div className="bg-beige p-5">
      <p className="label">{label}</p>
      <p className={`font-display text-3xl mt-2 ${color}`}>{value}</p>
    </div>
  );
}
