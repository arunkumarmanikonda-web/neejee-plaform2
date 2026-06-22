'use client';
import { useEffect, useState } from 'react';
import { Banknote } from 'lucide-react';

export const dynamic = 'force-dynamic';

function inr(p: number) { return '₹' + (p / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 }); }

export default function SellerPayouts() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/seller/payouts').then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return <p className="text-mitti">Loading…</p>;

  const s = data?.summary || {};
  const payouts = data?.payouts || [];

  return (
    <>
      <p className="label text-madder">STUDIO</p>
      <h1 className="font-display text-4xl text-kohl mt-2">Payouts</h1>
      <p className="font-italic italic text-mitti mt-2">Your share of every piece sold.</p>
      <div className="madder-divider mt-4"></div>

      <div className="grid md:grid-cols-3 gap-4 mt-8">
        <Kpi label="Outstanding (net)" value={inr(s.outstandingNetPaise || 0)} hint={`After ${s.commissionPct || 20}% commission`} accent />
        <Kpi label="Total paid (net)" value={inr(s.totalPaidNetPaise || 0)} hint="Lifetime" />
        <Kpi label="Delivered gross" value={inr(s.totalDeliveredPaise || 0)} hint="All delivered orders" />
      </div>

      <div className="mt-12">
        <p className="label text-madder mb-3">PAYOUT HISTORY</p>
        {payouts.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-mitti/30">
            <Banknote className="w-10 h-10 text-mitti/40 mx-auto mb-3" />
            <p className="text-mitti">No payouts processed yet. They are created on your cycle (weekly by default).</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-mitti/20 text-left">
                <th className="p-3 label text-mitti">PERIOD</th>
                <th className="p-3 label text-mitti">ORDERS</th>
                <th className="p-3 label text-mitti text-right">GROSS</th>
                <th className="p-3 label text-mitti text-right">COMMISSION</th>
                <th className="p-3 label text-mitti text-right">NET</th>
                <th className="p-3 label text-mitti">STATUS</th>
                <th className="p-3 label text-mitti">UTR</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p: any) => (
                <tr key={p.id} className="border-b border-mitti/10">
                  <td className="p-3 text-sm text-kohl">
                    {new Date(p.periodStart).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – {new Date(p.periodEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="p-3 text-sm text-kohl">{p.orderCount}</td>
                  <td className="p-3 text-sm text-kohl text-right">{inr(p.grossSales)}</td>
                  <td className="p-3 text-sm text-mitti text-right">−{inr(p.commissionPaise)}</td>
                  <td className="p-3 text-sm text-kohl text-right font-medium">{inr(p.netPayoutPaise)}</td>
                  <td className="p-3 text-xs tracking-wider">{p.status}</td>
                  <td className="p-3 text-xs font-mono text-mitti">{p.utr || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function Kpi({ label, value, hint, accent }: any) {
  return (
    <div className={`p-6 ${accent ? 'bg-kohl text-ivory' : 'bg-beige text-kohl'}`}>
      <p className={`label ${accent ? 'text-banarasi' : 'text-mitti'}`}>{label}</p>
      <p className="font-display text-3xl mt-2">{value}</p>
      {hint && <p className={`text-xs mt-1 ${accent ? 'text-ivory/60' : 'text-mitti'}`}>{hint}</p>}
    </div>
  );
}
