'use client';
// app/admin/abandoned-carts/page.tsx
// v26.3a — Admin list of abandoned carts (recovery state machine view).

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Cart {
  id: string;
  email: string;
  customerName: string | null;
  phone: string | null;
  subtotal: number;
  itemCount: number;
  recoveryStage: number;
  nextActionAt: string | null;
  lastRemindedAt: string | null;
  remindersSent: number;
  paymentMethodPicked: string | null;
  lastSeenStep: string | null;
  discountCode: string | null;
  discountPercent: number | null;
  telecallerStatus: string | null;
  recoveredOrderId: string | null;
  optedOut: boolean;
  createdAt: string;
}

const STAGE_LABEL: Record<number, string> = {
  0: 'New',
  1: 'T+1h sent',
  2: 'T+24h sent',
  3: 'T+72h sent',
  4: 'Telecaller queue',
};

export default function AbandonedCartsPage() {
  const [carts, setCarts] = useState<Cart[]>([]);
  const [summary, setSummary] = useState({ active: 0, recovered: 0, optedOut: 0, atHandoff: 0 });
  const [filter, setFilter] = useState<'active' | 'recovered' | 'opted_out' | 'telecaller'>('active');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const url = `/api/admin/abandoned-carts?status=${filter}${search ? `&q=${encodeURIComponent(search)}` : ''}`;
    const res = await fetch(url);
    const d = await res.json();
    setCarts(d.carts || []);
    setSummary(d.summary || summary);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const onResend = async (id: string) => {
    if (!confirm('Resend the next stage email now?')) return;
    await fetch(`/api/admin/abandoned-carts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resend_now' }),
    });
    await load();
  };

  const onOptOut = async (id: string) => {
    if (!confirm('Opt this customer out of all recovery emails?')) return;
    await fetch(`/api/admin/abandoned-carts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optedOut: true }),
    });
    await load();
  };

  return (
    <main className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl text-kohl">Abandoned trunks</h1>
        <Link href="/admin/recovery-settings" className="text-sm text-mitti underline">Recovery settings</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Active" n={summary.active} />
        <StatCard label="Recovered" n={summary.recovered} />
        <StatCard label="Telecaller queue" n={summary.atHandoff} />
        <StatCard label="Opted out" n={summary.optedOut} />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(['active', 'telecaller', 'recovered', 'opted_out'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm border ${filter === f ? 'bg-kohl text-ivory border-kohl' : 'border-mitti/30 text-mitti'}`}
          >{f.replace('_', ' ')}</button>
        ))}
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex-1 max-w-md ml-auto">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search email, name, phone…"
            className="w-full border border-mitti/30 px-3 py-2 text-sm"
          />
        </form>
      </div>

      {loading ? (
        <p className="text-mitti italic">Loading…</p>
      ) : carts.length === 0 ? (
        <p className="text-mitti italic">No trunks match this filter.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-mitti/30 text-left text-xs uppercase tracking-widest text-mitti">
                <th className="py-3">Customer</th>
                <th className="py-3">Items</th>
                <th className="py-3">Value</th>
                <th className="py-3">Stage</th>
                <th className="py-3">Next action</th>
                <th className="py-3">Discount</th>
                <th className="py-3">Method</th>
                <th className="py-3"></th>
              </tr>
            </thead>
            <tbody>
              {carts.map(c => (
                <tr key={c.id} className="border-b border-mitti/10">
                  <td className="py-3">
                    <div className="font-medium text-kohl">{c.customerName || '—'}</div>
                    <div className="text-xs text-mitti">{c.email}</div>
                    {c.phone && <div className="text-xs text-mitti">{c.phone}</div>}
                  </td>
                  <td className="py-3">{c.itemCount}</td>
                  <td className="py-3">₹{(c.subtotal / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  <td className="py-3">
                    <span className="px-2 py-1 text-xs bg-beige text-kohl">{STAGE_LABEL[c.recoveryStage] || c.recoveryStage}</span>
                  </td>
                  <td className="py-3 text-xs text-mitti">
                    {c.nextActionAt ? new Date(c.nextActionAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                  </td>
                  <td className="py-3 text-xs">
                    {c.discountCode ? <span className="font-mono">{c.discountCode} · {c.discountPercent}%</span> : '—'}
                  </td>
                  <td className="py-3 text-xs">{c.paymentMethodPicked || '—'}</td>
                  <td className="py-3">
                    {!c.recoveredOrderId && !c.optedOut && (
                      <div className="flex gap-2">
                        <button onClick={() => onResend(c.id)} className="text-xs text-madder underline">Resend</button>
                        <button onClick={() => onOptOut(c.id)} className="text-xs text-mitti underline">Opt out</button>
                      </div>
                    )}
                    {c.recoveredOrderId && <span className="text-xs text-green-700">✓ recovered</span>}
                    {c.optedOut && <span className="text-xs text-mitti italic">opted out</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function StatCard({ label, n }: { label: string; n: number }) {
  return (
    <div className="border border-mitti/30 p-4">
      <div className="text-xs uppercase tracking-widest text-mitti">{label}</div>
      <div className="font-display text-3xl text-kohl mt-1">{n}</div>
    </div>
  );
}
