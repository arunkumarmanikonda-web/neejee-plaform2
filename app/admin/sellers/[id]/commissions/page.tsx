'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Plus, Trash2, ArrowLeft } from 'lucide-react';

export default function SellerCommissionsPage() {
  const params = useParams();
  const sellerId = params?.id as string;
  const [data, setData] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = async () => {
    setLoading(true);
    const [cR, ctR, prR] = await Promise.all([
      fetch(`/api/admin/sellers/${sellerId}/commissions`),
      fetch('/api/admin/categories').catch(() => null),
      fetch(`/api/admin/products?sellerId=${sellerId}&limit=200`).catch(() => null),
    ]);
    const cJ = await cR.json();
    if (!cR.ok) { setErr(cJ.error); setLoading(false); return; }
    setData(cJ);
    if (ctR) { const j = await ctR.json(); setCategories(j.categories || j || []); }
    if (prR) { const j = await prR.json(); setProducts(j.products || j || []); }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [sellerId]);

  const saveDefault = async (val: string) => {
    setErr(''); setMsg('');
    const r = await fetch(`/api/admin/sellers/${sellerId}/commissions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultCommissionPct: val }),
    });
    const j = await r.json();
    if (!r.ok) { setErr(j.error); return; }
    setMsg('Default commission updated'); load();
  };

  const addOverride = async (type: 'category' | 'product', refId: string, pct: string) => {
    setErr(''); setMsg('');
    if (!refId || !pct) return;
    const r = await fetch(`/api/admin/sellers/${sellerId}/commissions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, refId, commissionPercent: pct }),
    });
    const j = await r.json();
    if (!r.ok) { setErr(j.error); return; }
    setMsg(`${type} override saved`); load();
  };

  const removeOverride = async (type: 'category' | 'product', refId: string) => {
    if (!confirm(`Remove this ${type} override?`)) return;
    const r = await fetch(`/api/admin/sellers/${sellerId}/commissions?type=${type}&refId=${refId}`, {
      method: 'DELETE',
    });
    if (r.ok) { setMsg(`${type} override removed`); load(); }
  };

  if (loading) return <div className="text-mitti py-20 text-center"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>;
  if (!data) return <div className="text-madder">No data</div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <Link href={`/admin/sellers/${sellerId}`} className="text-mitti hover:text-kohl text-xs flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" /> BACK TO SELLER
      </Link>

      <div>
        <h1 className="font-display text-3xl text-kohl">Commissions — {data.seller.businessName}</h1>
        <p className="text-mitti text-sm">Resolution order: product override → category override → seller default</p>
      </div>

      {msg && <div className="bg-emerald-50 border border-emerald-200 p-3 text-sm">{msg}</div>}
      {err && <div className="bg-madder/10 border border-madder p-3 text-madder text-sm">{err}</div>}

      {/* Seller default */}
      <Section title="Studio default commission">
        <DefaultEditor initial={data.seller.commissionPct} onSave={saveDefault} />
      </Section>

      {/* Category overrides */}
      <Section title="Category overrides" subtitle={`${data.categoryCommissions.length} active`}>
        <AddRow label="category" options={categories.map((c: any) => ({ v: c.id, l: c.name }))}
          onAdd={(refId, pct) => addOverride('category', refId, pct)} />
        {data.categoryCommissions.length > 0 && (
          <table className="w-full mt-4 font-ui text-sm">
            <thead className="text-mitti text-xs label">
              <tr className="border-b border-mitti/10">
                <th className="text-left p-2">CATEGORY</th>
                <th className="text-right p-2">COMMISSION %</th>
                <th className="text-right p-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.categoryCommissions.map((c: any) => (
                <tr key={c.id} className="border-b border-mitti/5">
                  <td className="p-2 text-kohl">{c.category?.name || c.categoryId.slice(0, 8)}</td>
                  <td className="p-2 text-right font-medium text-kohl">{c.commissionPercent}%</td>
                  <td className="p-2 text-right">
                    <button onClick={() => removeOverride('category', c.categoryId)} className="text-madder hover:opacity-70">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Product overrides */}
      <Section title="Product overrides" subtitle={`${data.productCommissions.length} active · most specific level`}>
        <AddRow label="product"
          options={products.map((p: any) => ({ v: p.id, l: `${p.name} (${p.sku || p.id.slice(0, 6)})` }))}
          onAdd={(refId, pct) => addOverride('product', refId, pct)} />
        {data.productCommissions.length > 0 && (
          <table className="w-full mt-4 font-ui text-sm">
            <thead className="text-mitti text-xs label">
              <tr className="border-b border-mitti/10">
                <th className="text-left p-2">PRODUCT</th>
                <th className="text-right p-2">COMMISSION %</th>
                <th className="text-right p-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.productCommissions.map((c: any) => (
                <tr key={c.id} className="border-b border-mitti/5">
                  <td className="p-2 text-kohl">{c.product?.name || c.productId.slice(0, 8)}</td>
                  <td className="p-2 text-right font-medium text-kohl">{c.commissionPercent}%</td>
                  <td className="p-2 text-right">
                    <button onClick={() => removeOverride('product', c.productId)} className="text-madder hover:opacity-70">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-ivory border border-mitti/20 p-5 rounded">
      <div className="mb-3">
        <h3 className="font-display text-lg text-kohl">{title}</h3>
        {subtitle && <p className="text-mitti text-xs">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function DefaultEditor({ initial, onSave }: { initial: number; onSave: (v: string) => void }) {
  const [val, setVal] = useState(String(initial));
  return (
    <div className="flex gap-2 items-end">
      <div>
        <p className="label text-banarasi mb-1">COMMISSION %</p>
        <input type="number" step="0.01" min="0" max="100" value={val} onChange={e => setVal(e.target.value)}
          className="border border-mitti/30 px-3 py-2 text-sm w-32" />
      </div>
      <button onClick={() => onSave(val)}
        className="bg-kohl text-ivory px-4 py-2 font-ui text-xs tracking-widest">
        SAVE DEFAULT
      </button>
    </div>
  );
}

function AddRow({ label, options, onAdd }: { label: string; options: { v: string; l: string }[]; onAdd: (refId: string, pct: string) => void }) {
  const [ref, setRef] = useState('');
  const [pct, setPct] = useState('');
  return (
    <div className="flex gap-2 items-end flex-wrap">
      <div className="flex-1 min-w-[200px]">
        <p className="label text-banarasi mb-1 text-[10px]">{label.toUpperCase()}</p>
        <select value={ref} onChange={e => setRef(e.target.value)}
          className="w-full border border-mitti/30 px-3 py-2 text-sm bg-ivory">
          <option value="">Pick…</option>
          {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      </div>
      <div>
        <p className="label text-banarasi mb-1 text-[10px]">%</p>
        <input type="number" step="0.01" min="0" max="100" value={pct} onChange={e => setPct(e.target.value)}
          placeholder="e.g. 15"
          className="border border-mitti/30 px-3 py-2 text-sm w-24" />
      </div>
      <button onClick={() => { onAdd(ref, pct); setRef(''); setPct(''); }}
        disabled={!ref || !pct}
        className="bg-kohl text-ivory px-4 py-2 font-ui text-xs tracking-widest flex items-center gap-1 disabled:opacity-50">
        <Plus className="w-3 h-3" /> ADD
      </button>
    </div>
  );
}
