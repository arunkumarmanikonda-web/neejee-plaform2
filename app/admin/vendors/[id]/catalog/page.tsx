'use client';
// Admin: Vendor rate-card (catalog) editor.
// Use this to maintain the vendor's master SKU list with per-item cost, GST rate,
// HSN code, MOQ, lead time. Each row can optionally link to a Product, so the
// PO line editor can auto-fill from the catalog.

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

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
  active: boolean;
  productId: string | null;
  product: { id: string; name: string; slug: string } | null;
  validFrom: string;
  validUntil: string | null;
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
  active: true,
});

export default function VendorCatalogPage() {
  const params = useParams<{ id: string }>();
  const vendorId = params.id;
  const [items, setItems] = useState<Item[]>([]);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Partial<Item> | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const url = `/api/admin/vendors/${vendorId}/catalog${includeInactive ? '?inactive=1' : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      setItems(data.items || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [includeInactive]);

  async function save() {
    if (!editing) return;
    if (!editing.vendorSku?.trim() || !editing.description?.trim()) {
      alert('SKU and description are required');
      return;
    }
    setSaving(true);
    try {
      const isEdit = !!editing.id;
      const res = await fetch(`/api/admin/vendors/${vendorId}/catalog`, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isEdit ? { itemId: editing.id, ...editing } : editing
        ),
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
    if (!confirm('Mark this catalog item inactive? (PO history is preserved.)')) return;
    const res = await fetch(`/api/admin/vendors/${vendorId}/catalog?itemId=${itemId}`, {
      method: 'DELETE',
    });
    if (res.ok) load();
  }

  const inr = (paise: number) =>
    '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-4 flex justify-between items-end">
        <div>
          <Link href={`/admin/vendors/${vendorId}`} className="text-xs underline text-charcoal/60">
            ← Vendor profile
          </Link>
          <h1 className="font-display text-3xl mt-1">Vendor Catalog</h1>
          <p className="text-sm text-charcoal/60">
            Rate-card master. PO lines can auto-fill from here.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <label className="text-xs flex items-center gap-1">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={e => setIncludeInactive(e.target.checked)}
            />
            Include inactive
          </label>
          <button onClick={() => setEditing(blank())} className="btn-primary">
            NEW ITEM
          </button>
        </div>
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
              <th className="text-left p-2">Linked product</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={10} className="text-center py-8 text-charcoal/50">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-8 text-charcoal/50">
                  No items yet. Click NEW ITEM.
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
                <td className="p-2 text-xs">{it.product?.name || '—'}</td>
                <td className="p-2">
                  <span
                    className={`text-xs px-2 py-1 ${it.active ? 'bg-emerald-100 text-emerald-700' : 'bg-charcoal/10 text-charcoal/60'}`}
                  >
                    {it.active ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </td>
                <td className="p-2 whitespace-nowrap space-x-2">
                  <button onClick={() => setEditing(it)} className="text-xs underline">
                    EDIT
                  </button>
                  {it.active && (
                    <button onClick={() => remove(it.id)} className="text-xs underline text-rose-700">
                      ARCHIVE
                    </button>
                  )}
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
                {editing.id ? 'Edit item' : 'New catalog item'}
              </h2>
              <button onClick={() => setEditing(null)} className="text-xl">
                ×
              </button>
            </div>
            <div className="p-4 grid md:grid-cols-2 gap-3">
              <Field
                label="VENDOR SKU"
                value={editing.vendorSku || ''}
                onChange={v => setEditing({ ...editing, vendorSku: v })}
              />
              <Field
                label="HSN CODE"
                value={editing.hsnCode || ''}
                onChange={v => setEditing({ ...editing, hsnCode: v })}
              />
              <div className="md:col-span-2">
                <Field
                  label="DESCRIPTION"
                  value={editing.description || ''}
                  onChange={v => setEditing({ ...editing, description: v })}
                />
              </div>
              <Field
                label="UNIT COST (₹)"
                value={String((editing.unitCostPaise || 0) / 100)}
                onChange={v =>
                  setEditing({ ...editing, unitCostPaise: Math.round(Number(v) * 100) })
                }
                type="number"
              />
              <Field
                label="GST RATE (%)"
                value={String(editing.gstRate ?? 5)}
                onChange={v => setEditing({ ...editing, gstRate: Number(v) })}
                type="number"
              />
              <Field
                label="MIN ORDER QTY"
                value={String(editing.moq ?? 1)}
                onChange={v => setEditing({ ...editing, moq: Number(v) })}
                type="number"
              />
              <Field
                label="LEAD TIME (days)"
                value={String(editing.leadTimeDays ?? '')}
                onChange={v =>
                  setEditing({ ...editing, leadTimeDays: v ? Number(v) : null })
                }
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
              {editing.id && (
                <label className="text-xs flex items-center gap-2 md:col-span-2">
                  <input
                    type="checkbox"
                    checked={!!editing.active}
                    onChange={e => setEditing({ ...editing, active: e.target.checked })}
                  />
                  Active
                </label>
              )}
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

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="text-xs uppercase block">
      {label}
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        type={type}
        className="w-full border border-charcoal/20 p-2 mt-1 text-sm normal-case"
      />
    </label>
  );
}
