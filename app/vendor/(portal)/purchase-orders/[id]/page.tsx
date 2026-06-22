'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ArrowLeft, CheckCircle2, Truck, Upload, FileText, Loader2 as LoaderIcon } from 'lucide-react';
import { formatINR } from '@/lib/money';
import PoChat from '@/components/admin/PoChat';

export default function VendorPoDetail() {
  const params = useParams();
  const id = String((params as any).id);
  const [po, setPo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [dispatchForm, setDispatchForm] = useState({ trackingNumber: '', trackingUrl: '', vendorInvoiceNumber: '', vendorInvoiceUrl: '' });
  const [showDispatch, setShowDispatch] = useState(false);

  const load = async () => {
    const r = await fetch(`/api/vendor/purchase-orders/${id}`, { cache: 'no-store' });
    const d = await r.json();
    if (r.ok) {
      setPo(d.purchaseOrder);
      setDispatchForm({
        trackingNumber: d.purchaseOrder.trackingNumber || '',
        trackingUrl: d.purchaseOrder.trackingUrl || '',
        vendorInvoiceNumber: d.purchaseOrder.vendorInvoiceNumber || '',
        vendorInvoiceUrl: d.purchaseOrder.vendorInvoiceUrl || '',
      });
    }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const transition = async (target: string, extra: any = {}) => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/vendor/purchase-orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transition: target, ...extra }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Action failed');
      setMsg({ kind: 'ok', text: target === 'CONFIRMED' ? 'PO confirmed. NEEJEE has been notified.' : 'Dispatch recorded.' });
      setShowDispatch(false);
      await load();
    } catch (e: any) {
      setMsg({ kind: 'err', text: e.message });
    } finally { setBusy(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-madder" /></div>;
  if (!po) return <div className="p-8 text-sm text-madder">PO not found.</div>;

  const canConfirm  = po.status === 'SENT';
  const canDispatch = po.status === 'CONFIRMED';

  return (
    <div className="min-h-screen bg-beige">
      <header className="bg-ivory border-b border-mitti/15 px-6 py-4">
        <Link href="/vendor/dashboard" className="inline-flex items-center gap-1 text-xs text-mitti hover:text-madder">
          <ArrowLeft className="w-3 h-3" /> Dashboard
        </Link>
      </header>

      <main className="max-w-4xl mx-auto p-6 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-3xl text-kohl">{po.poNumber}</h1>
            <p className="text-sm text-mitti mt-1">Status: <strong>{po.status}</strong></p>
            {po.expectedDate && <p className="text-xs text-mitti">Expected by {new Date(po.expectedDate).toLocaleDateString()}</p>}
          </div>
          <div className="flex gap-2">
            {canConfirm  && <button disabled={busy} onClick={() => transition('CONFIRMED')} className="btn-primary text-xs inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> CONFIRM PO</button>}
            {canDispatch && <button disabled={busy} onClick={() => setShowDispatch(true)} className="btn-primary text-xs inline-flex items-center gap-1"><Truck className="w-3 h-3" /> MARK DISPATCHED</button>}
          </div>
        </div>

        {msg && (
          <div className={`p-3 mb-4 text-sm border ${msg.kind === 'ok' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-madder/5 border-madder/30 text-madder'}`}>
            {msg.text}
          </div>
        )}

        <section className="border border-mitti/15 p-5 bg-ivory">
          <h2 className="font-display text-lg text-kohl mb-4 uppercase tracking-wider">Lines</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-widest text-mitti">
                <tr>
                  <th className="text-left p-2">Description</th>
                  <th className="text-left p-2">SKU</th>
                  <th className="text-right p-2">Qty</th>
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
                      <td className="p-2 text-right font-mono">{formatINR(l.unitCostPaise)}</td>
                      <td className="p-2 text-right">{l.gstRate}%</td>
                      <td className="p-2 text-right font-mono">{formatINR(sub + gst)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="text-sm font-mono">
                <tr className="border-t border-mitti/20"><td colSpan={5} className="p-2 text-right text-mitti">Total</td><td className="p-2 text-right font-display text-madder">{formatINR(po.totalPaise)}</td></tr>
              </tfoot>
            </table>
          </div>
        </section>

        {po.notes && (
          <section className="border border-mitti/15 p-5 bg-ivory mt-4">
            <h2 className="font-display text-lg text-kohl mb-2 uppercase tracking-wider">Notes from NEEJEE</h2>
            <p className="text-sm whitespace-pre-wrap">{po.notes}</p>
          </section>
        )}

        <section className="mt-4">
          <h2 className="font-display text-lg text-kohl mb-3 uppercase tracking-wider">Conversation with NEEJEE</h2>
          <PoChat purchaseOrderId={id} side="vendor" />
        </section>

        {showDispatch && (
          <div className="fixed inset-0 bg-kohl/40 z-50 flex items-center justify-center p-4">
            <div className="bg-ivory max-w-md w-full p-6 space-y-3">
              <h2 className="font-display text-xl text-kohl">Mark dispatched</h2>
              <p className="text-xs text-mitti">Share tracking + your invoice details. This notifies NEEJEE to expect delivery.</p>
              <Input label="Tracking number" value={dispatchForm.trackingNumber} onChange={v => setDispatchForm({ ...dispatchForm, trackingNumber: v })} />
              <Input label="Tracking URL" value={dispatchForm.trackingUrl} onChange={v => setDispatchForm({ ...dispatchForm, trackingUrl: v })} />
              <Input label="Your invoice number" value={dispatchForm.vendorInvoiceNumber} onChange={v => setDispatchForm({ ...dispatchForm, vendorInvoiceNumber: v })} />
              <InvoiceUpload
                poId={id}
                currentUrl={dispatchForm.vendorInvoiceUrl}
                invoiceNumber={dispatchForm.vendorInvoiceNumber}
                onUploaded={(url) => setDispatchForm({ ...dispatchForm, vendorInvoiceUrl: url })}
              />
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowDispatch(false)} className="btn-ghost text-xs">Cancel</button>
                <button disabled={busy} onClick={() => transition('DISPATCHED', dispatchForm)} className="btn-primary text-xs disabled:opacity-50">
                  {busy ? 'Saving…' : 'CONFIRM DISPATCH'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-mitti">{label}</span>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} className="mt-1 w-full p-2 bg-beige border border-mitti/20 text-sm font-ui" />
    </label>
  );
}

// ─────── Invoice drag-drop uploader ───────
function InvoiceUpload({ poId, currentUrl, invoiceNumber, onUploaded }: {
  poId: string; currentUrl: string; invoiceNumber: string; onUploaded: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setErr(''); setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (invoiceNumber) fd.append('invoiceNumber', invoiceNumber);
      const r = await fetch(`/api/vendor/purchase-orders/${poId}/invoice`, { method: 'POST', body: fd, credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Upload failed');
      onUploaded(d.purchaseOrder?.vendorInvoiceUrl || d.document?.fileUrl || '');
    } catch (e: any) {
      setErr(e.message);
    } finally { setUploading(false); }
  };

  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-mitti">Invoice file</span>
      {currentUrl ? (
        <div className="mt-1 flex items-center gap-2 p-2 bg-green-50 border border-green-200">
          <FileText className="w-4 h-4 text-green-700" />
          <a href={currentUrl} target="_blank" rel="noreferrer" className="flex-1 text-xs text-green-800 truncate hover:underline">Invoice uploaded — view</a>
          <button type="button" onClick={() => fileRef.current?.click()} className="text-xs text-mitti hover:text-madder">Replace</button>
        </div>
      ) : (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}
          onClick={() => fileRef.current?.click()}
          className={`mt-1 border-2 border-dashed p-4 text-center cursor-pointer text-xs ${dragging ? 'border-madder bg-haldi/15' : 'border-mitti/30 bg-beige hover:border-madder/60'}`}
        >
          {uploading
            ? <><LoaderIcon className="w-4 h-4 inline animate-spin text-madder" /> Uploading…</>
            : <><Upload className="w-4 h-4 inline text-mitti mr-1" /> Drop invoice here or click to browse (PDF/JPG/PNG, max 15 MB)</>
          }
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }}
      />
      {err && <p className="text-[10px] text-madder mt-1">{err}</p>}
    </label>
  );
}
