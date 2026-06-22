'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react';
import { formatINR } from '@/lib/money';
import VendorCatalogPicker from '@/components/admin/VendorCatalogPicker';

type Vendor = { id: string; legalName: string; displayName: string | null; defaultLeadTimeDays: number; status: string };
type Line = {
  productId?: string | null;
  variantId?: string | null;
  sku?: string;
  description: string;
  orderedQty: number;
  unitCostPaise: number;
  gstRate: number;
};

export default function NewPoPage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [lines, setLines] = useState<Line[]>([{ description: '', orderedQty: 1, unitCostPaise: 0, gstRate: 5 }]);
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/admin/vendors?status=ACTIVE', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { vendors: [] })
      .then(d => {
        const eligible = (d.vendors || []).filter((v: Vendor) => ['ACTIVE', 'PENDING'].includes(v.status));
        setVendors(eligible);
      });
  }, []);

  const totals = lines.reduce(
    (acc, l) => {
      const sub = l.orderedQty * l.unitCostPaise;
      const gst = Math.round(sub * (l.gstRate / 100));
      return { sub: acc.sub + sub, gst: acc.gst + gst };
    },
    { sub: 0, gst: 0 },
  );
  const total = totals.sub + totals.gst;

  const submit = async () => {
    setErr(''); setSubmitting(true);
    try {
      if (!vendorId) throw new Error('Pick a vendor');
      if (lines.length === 0) throw new Error('Add at least one line');
      const r = await fetch('/api/admin/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId,
          lines,
          expectedDate: expectedDate || null,
          notes: notes || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Create failed');
      router.push(`/admin/purchase-orders/${d.purchaseOrder.id}`);
    } catch (e: any) {
      setErr(e.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 lg:p-8">
      <Link href="/admin/purchase-orders" className="inline-flex items-center gap-1 text-xs text-mitti hover:text-madder mb-4">
        <ArrowLeft className="w-3 h-3" /> All POs
      </Link>
      <h1 className="font-display text-3xl text-kohl mb-6">New Purchase Order</h1>

      <div className="space-y-6">
        <section className="border border-mitti/15 p-5 bg-ivory">
          <h2 className="font-display text-lg text-kohl mb-4 uppercase tracking-wider">Vendor</h2>
          <select value={vendorId} onChange={e => setVendorId(e.target.value)} className="w-full p-2 bg-beige border border-mitti/20 text-sm font-ui">
            <option value="">Select a vendor…</option>
            {vendors.map(v => (
              <option key={v.id} value={v.id}>
                {v.displayName || v.legalName} {v.status === 'PENDING' ? '(pending)' : ''}
              </option>
            ))}
          </select>
          {vendors.length === 0 && (
            <p className="text-xs text-mitti italic mt-2">
              No active vendors yet. <Link href="/admin/vendors" className="text-madder underline">Add one.</Link>
            </p>
          )}
        </section>

        <section className="border border-mitti/15 p-5 bg-ivory">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg text-kohl uppercase tracking-wider">Lines</h2>
            <button
              type="button"
              onClick={() => setLines([...lines, { description: '', orderedQty: 1, unitCostPaise: 0, gstRate: 5 }])}
              className="btn-ghost text-xs inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> ADD LINE
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-widest text-mitti">
                <tr>
                  <th className="text-left p-2">Description</th>
                  <th className="text-left p-2">SKU</th>
                  <th className="text-right p-2 w-20">Qty</th>
                  <th className="text-right p-2 w-32">Unit cost (₹)</th>
                  <th className="text-right p-2 w-20">GST %</th>
                  <th className="text-right p-2 w-32">Line total</th>
                  <th className="p-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, idx) => {
                  const sub = l.orderedQty * l.unitCostPaise;
                  const gst = Math.round(sub * (l.gstRate / 100));
                  return (
                    <tr key={idx} className="border-t border-mitti/10">
                      <td className="p-2">
                        <input
                          type="text"
                          value={l.description}
                          onChange={e => setLines(lines.map((ll, i) => i === idx ? { ...ll, description: e.target.value } : ll))}
                          placeholder="Product description"
                          className="w-full p-2 bg-beige border border-mitti/20 text-sm font-ui"
                        />
                        {vendorId && (
                          <div className="mt-1">
                            <VendorCatalogPicker
                              vendorId={vendorId}
                              onPick={(item) =>
                                setLines(lines.map((ll, i) =>
                                  i === idx
                                    ? {
                                        ...ll,
                                        description: item.description,
                                        sku: item.vendorSku,
                                        unitCostPaise: item.unitCostPaise,
                                        gstRate: item.gstRate,
                                        orderedQty: Math.max(ll.orderedQty, item.moq),
                                      }
                                    : ll))
                              }
                            />
                          </div>
                        )}
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={l.sku || ''}
                          onChange={e => setLines(lines.map((ll, i) => i === idx ? { ...ll, sku: e.target.value } : ll))}
                          placeholder="Optional"
                          className="w-full p-2 bg-beige border border-mitti/20 text-sm font-mono"
                        />
                      </td>
                      <td className="p-2 text-right">
                        <input type="number" min={1} value={l.orderedQty} onChange={e => setLines(lines.map((ll, i) => i === idx ? { ...ll, orderedQty: Math.max(1, Number(e.target.value)) } : ll))} className="w-full p-2 bg-beige border border-mitti/20 text-sm font-mono text-right" />
                      </td>
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={l.unitCostPaise / 100}
                          onChange={e => setLines(lines.map((ll, i) => i === idx ? { ...ll, unitCostPaise: Math.round(Number(e.target.value) * 100) } : ll))}
                          className="w-full p-2 bg-beige border border-mitti/20 text-sm font-mono text-right"
                        />
                      </td>
                      <td className="p-2 text-right">
                        <input type="number" min={0} max={28} step={0.5} value={l.gstRate} onChange={e => setLines(lines.map((ll, i) => i === idx ? { ...ll, gstRate: Number(e.target.value) } : ll))} className="w-full p-2 bg-beige border border-mitti/20 text-sm font-mono text-right" />
                      </td>
                      <td className="p-2 text-right font-mono">{formatINR(sub + gst)}</td>
                      <td className="p-2">
                        <button type="button" onClick={() => setLines(lines.filter((_, i) => i !== idx))} className="text-mitti hover:text-madder">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="text-sm font-mono">
                <tr className="border-t border-mitti/20"><td colSpan={5} className="p-2 text-right text-mitti">Subtotal</td><td className="p-2 text-right">{formatINR(totals.sub)}</td><td /></tr>
                <tr><td colSpan={5} className="p-2 text-right text-mitti">GST</td><td className="p-2 text-right">{formatINR(totals.gst)}</td><td /></tr>
                <tr className="border-t border-mitti/20"><td colSpan={5} className="p-2 text-right font-display text-kohl">Total</td><td className="p-2 text-right font-display text-madder">{formatINR(total)}</td><td /></tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section className="border border-mitti/15 p-5 bg-ivory space-y-3">
          <h2 className="font-display text-lg text-kohl uppercase tracking-wider">Details</h2>
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-mitti">Expected delivery date</span>
            <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} className="mt-1 w-full p-2 bg-beige border border-mitti/20 text-sm font-ui" />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-mitti">Notes</span>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="mt-1 w-full p-2 bg-beige border border-mitti/20 text-sm font-ui" />
          </label>
        </section>

        {err && <p className="text-xs text-madder">{err}</p>}

        <button onClick={submit} disabled={submitting || !vendorId || lines.length === 0} className="btn-primary inline-flex items-center gap-2 disabled:opacity-50">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          CREATE DRAFT
        </button>
      </div>
    </div>
  );
}
