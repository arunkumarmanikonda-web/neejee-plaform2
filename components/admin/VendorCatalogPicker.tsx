'use client';
// VendorCatalogPicker — a small inline picker that lets the PO editor
// auto-fill a line's description / SKU / unit cost / HSN / GST rate from
// the vendor's active rate-card.
//
// Usage:
//   <VendorCatalogPicker vendorId={vendorId} onPick={(item) => updateLine(item)} />

import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';

export type CatalogItem = {
  id: string;
  vendorSku: string;
  description: string;
  hsnCode: string | null;
  unitCostPaise: number;
  gstRate: number;
  moq: number;
  leadTimeDays: number | null;
  productId: string | null;
};

export default function VendorCatalogPicker({
  vendorId,
  onPick,
}: {
  vendorId: string;
  onPick: (item: CatalogItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !vendorId) return;
    const t = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        // Use a generic catalog endpoint that scopes by vendorId.
        // We don't have a PO id yet (this is used in the "new PO" flow), so we
        // hit /api/admin/vendors/[vendorId]/catalog directly.
        const res = await fetch(
          `/api/admin/vendors/${vendorId}/catalog${q ? '' : ''}`,
          { cache: 'no-store' }
        );
        const data = await res.json();
        const all: CatalogItem[] = data.items || [];
        const filtered = q
          ? all.filter(
              i =>
                i.vendorSku.toLowerCase().includes(q.toLowerCase()) ||
                i.description.toLowerCase().includes(q.toLowerCase())
            )
          : all;
        setItems(filtered.slice(0, 50));
      } catch (e: any) {
        setError(e?.message || 'Failed to load catalog');
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [open, q, vendorId]);

  if (!vendorId) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs underline text-mitti hover:text-madder"
      >
        Pick from rate card
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-ivory max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-3 border-b border-charcoal/10">
              <h3 className="font-display text-lg">Vendor rate card</h3>
              <button onClick={() => setOpen(false)} className="p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 border-b border-charcoal/10">
              <div className="flex items-center gap-2 border border-charcoal/20 px-2">
                <Search className="w-3 h-3 text-charcoal/50" />
                <input
                  autoFocus
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Search SKU or description…"
                  className="flex-1 p-2 text-sm focus:outline-none"
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {loading && <div className="p-6 text-center text-sm text-charcoal/50">Loading…</div>}
              {error && <div className="p-6 text-center text-sm text-rose-700">{error}</div>}
              {!loading && items.length === 0 && (
                <div className="p-6 text-center text-sm text-charcoal/50">
                  No items match. Add items in the vendor&apos;s catalog page first.
                </div>
              )}
              <table className="w-full text-sm">
                <tbody>
                  {items.map(it => (
                    <tr
                      key={it.id}
                      className="border-t border-charcoal/5 hover:bg-beige/30 cursor-pointer"
                      onClick={() => {
                        onPick(it);
                        setOpen(false);
                      }}
                    >
                      <td className="p-2 font-mono text-xs">{it.vendorSku}</td>
                      <td className="p-2">{it.description}</td>
                      <td className="p-2 text-xs text-charcoal/60">{it.hsnCode || ''}</td>
                      <td className="p-2 text-right">
                        ₹{(it.unitCostPaise / 100).toLocaleString('en-IN')}
                      </td>
                      <td className="p-2 text-right text-xs">{it.gstRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-2 text-xs text-charcoal/50 border-t border-charcoal/10 text-center">
              Click a row to insert into the PO line.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
