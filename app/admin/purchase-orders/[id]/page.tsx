'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Send, PackageCheck, CheckCircle2, XCircle, Truck } from 'lucide-react';
import { formatINR } from '@/lib/money';
import PoChat from '@/components/admin/PoChat';

export default function PoDetailPage() {
  const params = useParams();
  const id = String((params as any).id);
  const [po, setPo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [showReceive, setShowReceive] = useState(false);
  const [grnLines, setGrnLines] = useState<Record<string, { receivedQty: number; receivedUnitCostPaise: number }>>({});

  const load = async () => {
    const r = await fetch(`/api/admin/purchase-orders/${id}`, { cache: 'no-store' });
    const d = await r.json();
    if (r.ok) {
      setPo(d.purchaseOrder);
      // Seed GRN overrides with PO defaults (admin can edit before confirming)
      const seed: typeof grnLines = {};
      for (const l of d.purchaseOrder.lines) {
        seed[l.id] = {
          receivedQty: l.receivedQty ?? l.orderedQty,
          receivedUnitCostPaise: l.receivedUnitCostPaise ?? l.unitCostPaise,
        };
      }
      setGrnLines(seed);
    }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const transition = async (target: string, extra: any = {}) => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/admin/purchase-orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transition: target, ...extra }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Action failed');
      setPo(d.purchaseOrder);
      setMsg({ kind: 'ok', text: `Status: ${target}` });
      if (target === 'RECEIVED') setShowReceive(false);
      await load();
    } catch (e: any) {
      setMsg({ kind: 'err', text: e.message });
    } finally { setBusy(false); }
  };

  if (loading) return <div className="p-8"><Loader2 className="w-5 h-5 animate-spin text-madder" /></div>;
  if (!po) return <div className="p-8 text-sm text-madder">PO not found.</div>;

  const canSend       = po.status === 'DRAFT';
  const canDispatch   = po.status === 'CONFIRMED';
  const canReceive    = po.status === 'DISPATCHED';
  const canClose      = po.status === 'RECEIVED';
  const canCancel     = !['CLOSED', 'CANCELLED', 'RECEIVED'].includes(po.status);

  return (
    <div className="max-w-5xl mx-auto p-6 lg:p-8">
      <Link href="/admin/purchase-orders" className="inline-flex items-center gap-1 text-xs text-mitti hover:text-madder mb-4">
        <ArrowLeft className="w-3 h-3" /> All POs
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl text-kohl">{po.poNumber}</h1>
          <p className="text-sm text-mitti mt-1">
            Vendor: <strong>{po.vendor.legalName}</strong> · Status: <strong>{po.status}</strong>
          </p>
          {po.expectedDate && <p className="text-xs text-mitti">Expected by {new Date(po.expectedDate).toLocaleDateString()}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {canSend     && <button disabled={busy} onClick={() => transition('SENT')} className="btn-primary text-xs inline-flex items-center gap-1"><Send className="w-3 h-3" /> SEND TO VENDOR</button>}
          {canDispatch && <button disabled={busy} onClick={() => transition('DISPATCHED')} className="btn-primary text-xs inline-flex items-center gap-1"><Truck className="w-3 h-3" /> MARK DISPATCHED</button>}
          {canReceive  && <button disabled={busy} onClick={() => setShowReceive(true)} className="btn-primary text-xs inline-flex items-center gap-1"><PackageCheck className="w-3 h-3" /> RECEIVE (GRN)</button>}
          {canClose    && <button disabled={busy} onClick={() => transition('CLOSED')} className="btn-ghost text-xs inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> MARK PAID / CLOSE</button>}
          {canCancel   && <button disabled={busy} onClick={() => { if (confirm('Cancel this PO?')) transition('CANCELLED'); }} className="btn-ghost text-xs text-madder inline-flex items-center gap-1"><XCircle className="w-3 h-3" /> CANCEL</button>}
        </div>
      </div>

      {msg && (
        <div className={`p-3 mb-4 text-sm border ${msg.kind === 'ok' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-madder/5 border-madder/30 text-madder'}`}>
          {msg.text}
        </div>
      )}

      <Timeline po={po} />

      <section className="border border-mitti/15 p-5 bg-ivory mt-6">
        <h2 className="font-display text-lg text-kohl mb-4 uppercase tracking-wider">Lines</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-mitti">
              <tr>
                <th className="text-left p-2">Description</th>
                <th className="text-left p-2">SKU</th>
                <th className="text-right p-2">Ordered</th>
                <th className="text-right p-2">Received</th>
                <th className="text-right p-2">Unit cost</th>
                <th className="text-right p-2">GST %</th>
                <th className="text-right p-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {po.lines.map((l: any) => {
                const sub = l.orderedQty * l.unitCostPaise;
                const gst = Math.round(sub * (l.gstRate / 100));
                return (
                  <tr key={l.id} className="border-t border-mitti/10">
                    <td className="p-2">{l.description}</td>
                    <td className="p-2 font-mono text-xs">{l.sku || '—'}</td>
                    <td className="p-2 text-right font-mono">{l.orderedQty}</td>
                    <td className="p-2 text-right font-mono">{l.receivedQty ?? '—'}</td>
                    <td className="p-2 text-right font-mono">{formatINR(l.unitCostPaise)}</td>
                    <td className="p-2 text-right">{l.gstRate}%</td>
                    <td className="p-2 text-right font-mono">{formatINR(sub + gst)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="text-sm font-mono">
              <tr className="border-t border-mitti/20"><td colSpan={6} className="p-2 text-right text-mitti">Subtotal</td><td className="p-2 text-right">{formatINR(po.subtotalPaise)}</td></tr>
              <tr><td colSpan={6} className="p-2 text-right text-mitti">GST</td><td className="p-2 text-right">{formatINR(po.gstPaise)}</td></tr>
              <tr className="border-t border-mitti/20"><td colSpan={6} className="p-2 text-right font-display text-kohl">Total</td><td className="p-2 text-right font-display text-madder">{formatINR(po.totalPaise)}</td></tr>
            </tfoot>
          </table>
        </div>
      </section>

      {po.notes && (
        <section className="border border-mitti/15 p-5 bg-ivory mt-4">
          <h2 className="font-display text-lg text-kohl mb-2 uppercase tracking-wider">Notes</h2>
          <p className="text-sm text-kohl whitespace-pre-wrap">{po.notes}</p>
        </section>
      )}

      <section className="mt-4">
        <h2 className="font-display text-lg text-kohl mb-3 uppercase tracking-wider">Vendor conversation</h2>
        <PoChat purchaseOrderId={id} side="admin" />
      </section>

      {showReceive && (
        <div className="fixed inset-0 bg-kohl/40 z-50 flex items-center justify-center p-4">
          <div className="bg-ivory max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="font-display text-2xl text-kohl mb-1">Goods Received Note (GRN)</h2>
            <p className="text-xs text-mitti mb-4">Defaults to ordered quantities &amp; costs. Edit any line before confirming — inventory will be incremented and a cost ledger row written for each line.</p>
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-widest text-mitti">
                <tr><th className="text-left p-2">Line</th><th className="text-right p-2">Ordered</th><th className="text-right p-2 w-28">Received qty</th><th className="text-right p-2 w-36">Received unit cost (₹)</th></tr>
              </thead>
              <tbody>
                {po.lines.map((l: any) => (
                  <tr key={l.id} className="border-t border-mitti/10">
                    <td className="p-2"><div>{l.description}</div><div className="text-xs text-mitti font-mono">{l.sku}</div></td>
                    <td className="p-2 text-right font-mono">{l.orderedQty}</td>
                    <td className="p-2"><input type="number" min={0} value={grnLines[l.id]?.receivedQty ?? l.orderedQty} onChange={e => setGrnLines({ ...grnLines, [l.id]: { ...grnLines[l.id], receivedQty: Math.max(0, Number(e.target.value)) } })} className="w-full p-2 bg-beige border border-mitti/20 text-sm font-mono text-right" /></td>
                    <td className="p-2"><input type="number" min={0} step={0.01} value={(grnLines[l.id]?.receivedUnitCostPaise ?? l.unitCostPaise) / 100} onChange={e => setGrnLines({ ...grnLines, [l.id]: { ...grnLines[l.id], receivedUnitCostPaise: Math.round(Number(e.target.value) * 100) } })} className="w-full p-2 bg-beige border border-mitti/20 text-sm font-mono text-right" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end gap-2 pt-4">
              <button onClick={() => setShowReceive(false)} className="btn-ghost text-xs">Cancel</button>
              <button
                disabled={busy}
                onClick={() => transition('RECEIVED', {
                  lineUpdates: Object.entries(grnLines).map(([lineId, v]) => ({ lineId, ...v })),
                })}
                className="btn-primary text-xs inline-flex items-center gap-2 disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <PackageCheck className="w-3 h-3" />}
                CONFIRM RECEIPT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Timeline({ po }: { po: any }) {
  const steps = [
    { key: 'DRAFT',      label: 'Drafted',    at: po.createdAt },
    { key: 'SENT',       label: 'Sent',       at: po.sentAt },
    { key: 'CONFIRMED',  label: 'Confirmed',  at: po.confirmedAt },
    { key: 'DISPATCHED', label: 'Dispatched', at: po.dispatchedAt },
    { key: 'RECEIVED',   label: 'Received',   at: po.receivedAt },
    { key: 'CLOSED',     label: 'Closed',     at: po.closedAt },
  ];
  return (
    <ol className="flex flex-wrap gap-3 text-xs">
      {steps.map(s => (
        <li key={s.key} className={`px-3 py-2 border ${s.at ? 'bg-green-50 border-green-200 text-green-800' : 'bg-beige border-mitti/20 text-mitti'}`}>
          <span className="font-display uppercase tracking-widest">{s.label}</span>
          {s.at && <span className="block text-[10px] mt-1">{new Date(s.at).toLocaleString()}</span>}
        </li>
      ))}
    </ol>
  );
}
