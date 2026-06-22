'use client';
// Vendor portal: maintain own rate-card.
// Simplified version of the admin catalog UI — no product linking,
// active-only listing.

import { useEffect, useState } from 'react';

type Item = {
  id: string;
  vendorSku: string;
  description: string;
  hsnCode: string | null;
  unitCostPaise: number;
  gstRate: number;
  moq: number;
  leadTimeDays: number | null;
  notes: string | null;
};

const blank = (): Partial<Item> => ({
  vendorSku: '',
  description: '',
  hsnCode: '',
  unitCostPaise: 0,
  gstRate: 5,
  moq: 1,
  leadTimeDays: 14,
  notes: '',
});

export default function VendorCatalogPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Partial<Item> | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/vendor/catalog');
      const data = await res.json();
      setItems(data.items || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!editing) return;
    if (!editing.vendorSku?.trim() || !editing.description?.trim()) {
      alert('SKU and description are required');
      return;
    }
    setSaving(true);
    try {
      const isEdit = !!editing.id;
      const res = await fetch('/api/vendor/catalog', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? { itemId: editing.id, ...editing } : editing),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setEditing(null);
      load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(itemId: string) {
    if (!confirm('Archive this item?')) return;
    const res = await fetch(`/api/vendor/catalog?itemId=${itemId}`, { method: 'DELETE' });
    if (res.ok) load();
  }

  const inr = (paise: number) =>
    '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="flex justify-between items-end mb-4">
        <div>
          <h1 className="font-display text-3xl">Rate Card</h1>
          <p className="text-sm text-charcoal/60 mt-1">
            Your master price-list. NEEJEE&apos;s purchase-orders auto-fill from here.
          </p>
        </div>
        <button onClick={() => setEditing(blank())} className="btn-primary">
          NEW ITEM
        </button>
      </header>

      <div className="border border-charcoal/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-beige/40 text-xs uppercase">
            <tr>
              <th className="text-left p-2">SKU</th>
              <th className="text-left p-2">Description</th>
              <th className="text-left p-2">HSN</th>
              <th className="text-right p-2">Unit cost</th>
              <th className="text-right p-2">GST</th>
              <th className="text-right p-2">MOQ</th>
              <th className="text-right p-2">Lead</th>
              <th className="text-left p-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-charcoal/50">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-charcoal/50">
                  No items yet.
                </td>
              </tr>
            )}
            {items.map(it => (
              <tr key={it.id} className="border-t border-charcoal/5 hover:bg-beige/20">
                <td className="p-2 font-mono">{it.vendorSku}</td>
                <td className="p-2">{it.description}</td>
                <td className="p-2 font-mono text-xs">{it.hsnCode || '—'}</td>
                <td className="p-2 text-right">{inr(it.unitCostPaise)}</td>
                <td className="p-2 text-right">{it.gstRate}%</td>
                <td className="p-2 text-right">{it.moq}</td>
                <td className="p-2 text-right text-xs">{it.leadTimeDays ?? '—'}d</td>
                <td className="p-2 whitespace-nowrap space-x-2">
                  <button onClick={() => setEditing(it)} className="text-xs underline">
                    EDIT
                  </button>
                  <button onClick={() => remove(it.id)} className="text-xs underline text-rose-700">
                    ARCHIVE
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-ivory max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center p-4 border-b border-charcoal/10">
              <h2 className="font-display text-xl">
                {editing.id ? 'Edit item' : 'New item'}
              </h2>
              <button onClick={() => setEditing(null)} className="text-xl">
                ×
              </button>
            </div>
            <div className="p-4 grid md:grid-cols-2 gap-3">
              <F label="VENDOR SKU" v={editing.vendorSku || ''} on={v => setEditing({ ...editing, vendorSku: v })} />
              <F label="HSN CODE" v={editing.hsnCode || ''} on={v => setEditing({ ...editing, hsnCode: v })} />
              <div className="md:col-span-2">
                <F label="DESCRIPTION" v={editing.description || ''} on={v => setEditing({ ...editing, description: v })} />
              </div>
              <F
                label="UNIT COST (₹)"
                v={String((editing.unitCostPaise || 0) / 100)}
                on={v => setEditing({ ...editing, unitCostPaise: Math.round(Number(v) * 100) })}
                type="number"
              />
              <F
                label="GST RATE (%)"
                v={String(editing.gstRate ?? 5)}
                on={v => setEditing({ ...editing, gstRate: Number(v) })}
                type="number"
              />
              <F label="MOQ" v={String(editing.moq ?? 1)} on={v => setEditing({ ...editing, moq: Number(v) })} type="number" />
              <F
                label="LEAD TIME (days)"
                v={String(editing.leadTimeDays ?? '')}
                on={v => setEditing({ ...editing, leadTimeDays: v ? Number(v) : null })}
                type="number"
              />
              <div className="md:col-span-2">
                <label className="text-xs uppercase">NOTES</label>
                <textarea
                  value={editing.notes || ''}
                  onChange={e => setEditing({ ...editing, notes: e.target.value })}
                  rows={2}
                  className="w-full border border-charcoal/20 p-2 mt-1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-charcoal/10">
              <button onClick={() => setEditing(null)} className="btn-outline">
                CANCEL
              </button>
              <button onClick={save} disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : 'SAVE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function F({ label, v, on, type = 'text' }: { label: string; v: string; on: (s: string) => void; type?: string }) {
  return (
    <label className="text-xs uppercase block">
      {label}
      <input
        value={v}
        onChange={e => on(e.target.value)}
        type={type}
        className="w-full border border-charcoal/20 p-2 mt-1 text-sm normal-case"
      />
    </label>
  );
}
