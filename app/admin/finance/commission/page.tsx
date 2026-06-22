'use client';
// v23.40.6 — Admin: manual commission billing trigger + preview.
import { useState } from 'react';
import Link from 'next/link';
import { Loader2, AlertTriangle, CheckCircle2, Play, Eye } from 'lucide-react';
import { formatINR } from '@/lib/money';

export default function CommissionRunPage() {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(weekAgo);
  const [to,   setTo]   = useState(today);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState('');

  async function trigger(dryRun: boolean) {
    setErr(''); setResult(null); setBusy(true);
    try {
      const r = await fetch('/api/admin/finance/commission/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromDate: from, toDate: to, dryRun }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Run failed');
      setResult(d.result);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="font-display text-3xl text-kohl">Commission Billing</h1>
      <p className="text-mitti text-sm mt-1">
        Auto-runs every Monday 03:00 IST. Use this page to trigger manually or preview a run.
      </p>

      <div className="bg-amber-50 border border-amber-200 p-4 mt-4 text-sm text-amber-900 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">How it works</p>
          <ul className="list-disc list-inside mt-1 text-xs space-y-0.5">
            <li>Scans <b>DELIVERED</b> + <b>PAID</b> orders containing <b>MARKETPLACE</b> items in the chosen window.</li>
            <li>Creates one consolidated commission invoice <b>per seller</b> with one line per (order × product).</li>
            <li>Idempotent: re-running on the same window won&apos;t create duplicate lines (uses orderId × productId as key).</li>
            <li>Commission = seller&apos;s <code>commissionPct</code> on item total + 18% GST (SAC 9961 / online intermediary services).</li>
          </ul>
        </div>
      </div>

      <div className="bg-ivory border border-mitti/20 p-6 mt-4">
        <h3 className="label text-banarasi mb-3">RUN PARAMETERS</h3>
        <div className="grid grid-cols-2 gap-3 mb-4 max-w-md">
          <div>
            <p className="label text-banarasi mb-1">FROM</p>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
          </div>
          <div>
            <p className="label text-banarasi mb-1">TO</p>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => trigger(true)} disabled={busy}
            className="flex items-center gap-1 px-4 py-2 border border-kohl text-kohl text-xs tracking-widest hover:bg-kohl hover:text-ivory disabled:opacity-50">
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
            PREVIEW (DRY RUN)
          </button>
          <button onClick={() => { if (confirm('Generate commission invoices for this window? This writes to the database.')) trigger(false); }} disabled={busy}
            className="flex items-center gap-1 px-4 py-2 bg-kohl text-ivory text-xs tracking-widest hover:bg-madder disabled:opacity-50">
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            RUN BILLING NOW
          </button>
        </div>
        {err && <p className="mt-3 text-madder text-xs bg-madder/10 border border-madder/30 p-2">{err}</p>}
      </div>

      {result && (
        <div className="bg-ivory border border-mitti/20 p-6 mt-4">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-700" />
            <h3 className="font-display text-xl text-kohl">Run result</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Tile label="Sellers processed" value={String(result.sellersProcessed)} />
            <Tile label="Invoices created"  value={String(result.invoicesCreated)} />
            <Tile label="Orders billed"     value={String(result.ordersBilled)} />
            <Tile label="Total commission + GST" value={formatINR(result.totalCommissionPaise + result.totalGstPaise)} />
          </div>

          {result.invoices.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-beige/60 text-mitti text-xs label">
                  <tr>
                    <th className="text-left p-2">INVOICE #</th>
                    <th className="text-left p-2">SELLER</th>
                    <th className="text-right p-2">ORDERS</th>
                    <th className="text-right p-2">TOTAL</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {result.invoices.map((inv: any) => (
                    <tr key={inv.id} className="border-t border-mitti/10">
                      <td className="p-2 font-mono text-xs text-kohl">{inv.invoiceNumber}</td>
                      <td className="p-2 text-mitti text-xs">{inv.sellerId}</td>
                      <td className="p-2 text-right">{inv.ordersCount}</td>
                      <td className="p-2 text-right tabular-nums">{formatINR(inv.totalPaise)}</td>
                      <td className="p-2 text-right">
                        {!inv.id.startsWith('dry_') && (
                          <Link href={`/admin/finance/sales-invoices/${inv.id}`} className="text-xs text-madder hover:underline">OPEN →</Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result.skippedReasons?.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-mitti text-xs">Skipped ({result.skippedReasons.length})</summary>
              <ul className="text-xs text-mitti mt-2 space-y-1">
                {result.skippedReasons.slice(0, 50).map((s: any, i: number) => (
                  <li key={i}>{s.orderId} — {s.reason}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-beige/40">
      <p className="label text-mitti text-[10px]">{label}</p>
      <p className="font-display text-lg text-kohl mt-1">{value}</p>
    </div>
  );
}
