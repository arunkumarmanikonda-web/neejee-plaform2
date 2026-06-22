'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Store, Check } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Seller {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  craft: string | null;
  region: string | null;
  kycStatus: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  qualityScore: number;
  commissionPct: number;
  isNeejeeSelect: boolean;
  createdAt: string;
  productCount?: number;
}

const STATUS_TABS = ['ALL', 'PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'] as const;

export default function AdminSellersPage() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<typeof STATUS_TABS[number]>('PENDING');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/admin/sellers')
      .then(r => r.json())
      .then(d => { setSellers(d.sellers || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: sellers.length };
    STATUS_TABS.slice(1).forEach(s => { c[s] = sellers.filter(x => x.kycStatus === s).length; });
    return c;
  }, [sellers]);

  const filtered = useMemo(() => {
    let list = filter === 'ALL' ? sellers : sellers.filter(s => s.kycStatus === filter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.businessName.toLowerCase().includes(q) ||
        s.contactName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.craft || '').toLowerCase().includes(q) ||
        (s.region || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [sellers, filter, search]);

  return (
    <>
      <p className="label text-madder">MARKETPLACE</p>
      <h1 className="font-display text-4xl text-kohl mt-2">Sellers</h1>
      <p className="font-italic italic text-mitti mt-2">Applications, KYC, and the artisans in our circle.</p>
      <div className="madder-divider mt-4"></div>

      <div className="flex items-center gap-3 mt-8 flex-wrap">
        {STATUS_TABS.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-xs tracking-wider px-3 py-1.5 ${filter === s ? 'bg-kohl text-ivory' : 'bg-beige text-kohl hover:bg-mitti/10'}`}
          >
            {s.replace(/_/g, ' ')} ({counts[s] || 0})
          </button>
        ))}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search…"
          className="ml-auto p-2 bg-beige border border-mitti/20 text-sm w-64"
        />
      </div>

      <div className="mt-6">
        {loading ? (
          <p className="text-mitti">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-mitti/30">
            <Store className="w-10 h-10 text-mitti/40 mx-auto mb-4" />
            <p className="font-display text-2xl text-kohl">No sellers in this view</p>
            {filter === 'PENDING' && <p className="text-mitti mt-2 text-sm">When artisans apply, they appear here for KYC review.</p>}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-mitti/20 text-left">
                <th className="p-3 label text-mitti">BUSINESS</th>
                <th className="p-3 label text-mitti">CRAFT · REGION</th>
                <th className="p-3 label text-mitti">CONTACT</th>
                <th className="p-3 label text-mitti">STATUS</th>
                <th className="p-3 label text-mitti">COMM.</th>
                <th className="p-3 label text-mitti">APPLIED</th>
                <th className="p-3 text-right label text-mitti">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="border-b border-mitti/10 hover:bg-beige/30">
                  <td className="p-3">
                    <p className="font-display text-kohl">{s.businessName}</p>
                    <p className="text-xs text-mitti">{s.contactName}</p>
                  </td>
                  <td className="p-3 text-sm text-kohl">
                    {s.craft || '—'}<br />
                    <span className="text-xs text-mitti">{s.region || ''}</span>
                  </td>
                  <td className="p-3 text-sm text-mitti">
                    {s.email}<br />
                    <span className="text-xs">{s.phone}</span>
                  </td>
                  <td className="p-3">
                    <StatusBadge status={s.kycStatus} />
                    {s.isNeejeeSelect && (
                      <p className="text-[10px] mt-1 inline-flex items-center gap-1 text-madder">
                        <Check className="w-3 h-3" /> NEEJEE SELECT
                      </p>
                    )}
                  </td>
                  <td className="p-3 text-sm text-kohl">{s.commissionPct}%</td>
                  <td className="p-3 text-xs text-mitti">{new Date(s.createdAt).toLocaleDateString('en-IN')}</td>
                  <td className="p-3 text-right">
                    <Link href={`/admin/sellers/${s.id}`} className="text-madder hover:text-kohl text-sm">REVIEW →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: 'bg-haldi/20 text-mitti',
    UNDER_REVIEW: 'bg-banarasi/20 text-mitti',
    APPROVED: 'bg-neem/20 text-neem',
    REJECTED: 'bg-madder/20 text-madder',
    SUSPENDED: 'bg-mitti/20 text-mitti',
  };
  return <span className={`text-[10px] tracking-wider px-2 py-1 ${map[status] || 'bg-beige text-mitti'}`}>{status.replace(/_/g, ' ')}</span>;
}
