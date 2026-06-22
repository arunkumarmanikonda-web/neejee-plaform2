'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Heart, Crown, AlertTriangle, UserX, Sparkles, Download } from 'lucide-react';
import { formatINR } from '@/lib/money';

export const dynamic = 'force-dynamic';

const SEGMENTS: { key: string; label: string; icon: any; description: string; color: string }[] = [
  { key: 'ALL', label: 'ALL', icon: Users, description: 'Every customer', color: 'text-kohl' },
  { key: 'NEW', label: 'NEW', icon: Sparkles, description: 'Joined in last 30 days, no orders yet', color: 'text-banarasi' },
  { key: 'ACTIVE', label: 'ACTIVE', icon: Users, description: 'Bought in last 60 days', color: 'text-neem' },
  { key: 'VIP', label: 'VIP', icon: Crown, description: '3+ orders OR ₹50k+ lifetime', color: 'text-madder' },
  { key: 'AT_RISK', label: 'AT-RISK', icon: AlertTriangle, description: 'No order in 60–120 days', color: 'text-haldi' },
  { key: 'LAPSED', label: 'LAPSED', icon: UserX, description: 'No order in 120+ days', color: 'text-mitti' },
  { key: 'WISHLIST_ONLY', label: 'WISHLIST ONLY', icon: Heart, description: 'Loved but never bought', color: 'text-madder' },
];

export default function CustomerSegments() {
  const [data, setData] = useState<any>(null);
  const [active, setActive] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/admin/segments', { credentials: 'include', cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d.error) setErr(d.error); else setData(d); setLoading(false); })
      .catch(e => { setErr(e.message); setLoading(false); });
  }, []);

  const exportCsv = (segment: string) => {
    window.open(`/api/admin/segments?segment=${segment}&format=csv`, '_blank');
  };

  if (loading) return <div className="p-12 text-center font-italic italic text-mitti">Gathering souls...</div>;
  if (err) return <div className="p-12 bg-haldi/20 text-haldi">{err}</div>;
  if (!data) return null;

  const rows = data.buckets[active] || [];

  return (
    <div className="space-y-8 p-6">
      <div>
        <p className="label text-madder">PEOPLE</p>
        <h1 className="font-display text-4xl text-kohl">Customer Segments</h1>
        <p className="font-italic italic text-mitti mt-1">Knowing each person, gently.</p>
      </div>

      {/* Segment tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {SEGMENTS.map(s => {
          const Icon = s.icon;
          const count = data.counts[s.key] || 0;
          const isActive = active === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setActive(s.key)}
              className={`p-4 text-left transition-all ${isActive ? 'bg-kohl text-ivory' : 'bg-beige text-kohl hover:bg-beige/60'}`}
              title={s.description}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-banarasi' : s.color}`} />
              <p className={`label mt-2 ${isActive ? 'text-banarasi' : 'text-mitti'}`}>{s.label}</p>
              <p className="font-display text-2xl mt-1">{count}</p>
            </button>
          );
        })}
      </div>

      {/* Description */}
      <div className="bg-beige p-4 flex items-center justify-between">
        <p className="font-italic italic text-mitti">
          {SEGMENTS.find(s => s.key === active)?.description}
          {' · '}{rows.length} people
        </p>
        <button onClick={() => exportCsv(active)} className="btn-outline text-xs flex items-center gap-2">
          <Download className="w-3 h-3" /> EXPORT CSV
        </button>
      </div>

      {/* Table */}
      <section className="bg-beige overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-kohl text-ivory">
            <tr className="text-left text-xs label">
              <th className="p-3">NAME</th>
              <th className="p-3">EMAIL</th>
              <th className="p-3 text-right">ORDERS</th>
              <th className="p-3 text-right">LIFETIME</th>
              <th className="p-3 text-right">LAST</th>
              <th className="p-3 text-right">OPT-INS</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="p-12 text-center font-italic italic text-mitti">No one in this segment yet.</td></tr>
            ) : rows.slice(0, 100).map((c: any) => (
              <tr key={c.id} className="border-b border-mitti/10 hover:bg-ivory/40">
                <td className="p-3 font-ui text-kohl">{c.name || <span className="text-mitti italic">—</span>}</td>
                <td className="p-3 text-mitti text-xs">{c.email}</td>
                <td className="p-3 text-right">{c.orderCount}</td>
                <td className="p-3 text-right">{formatINR(c.lifetime)}</td>
                <td className="p-3 text-right text-xs text-mitti">
                  {c.daysSinceLast !== null ? `${c.daysSinceLast}d ago` : '—'}
                </td>
                <td className="p-3 text-right">
                  <span className="inline-flex gap-1 text-xs">
                    {c.emailOptIn && <span className="px-1.5 bg-neem/20 text-neem">E</span>}
                    {c.whatsappOptIn && <span className="px-1.5 bg-madder/20 text-madder">W</span>}
                    {c.smsOptIn && <span className="px-1.5 bg-haldi/30 text-haldi">S</span>}
                    {c.marketingConsent && <span className="px-1.5 bg-kohl/20 text-kohl">M</span>}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 100 && (
          <p className="p-3 text-xs text-mitti text-center font-italic italic">
            Showing first 100 of {rows.length}. Export CSV for the full list.
          </p>
        )}
      </section>

      <div className="bg-ivory p-4 text-xs text-mitti">
        <p className="label text-madder mb-1">LEGEND</p>
        <p>E = Email opt-in · W = WhatsApp · S = SMS · M = Marketing consent</p>
      </div>
    </div>
  );
}
