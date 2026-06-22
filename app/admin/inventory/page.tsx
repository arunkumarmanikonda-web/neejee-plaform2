'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function AdminInventoryPage() {
  const [variants, setVariants] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [filter, setFilter] = useState<'ALL' | 'LOW' | 'OUT'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const q = filter === 'LOW' ? '?filter=low' : filter === 'OUT' ? '?filter=out' : '';
      const res = await fetch(`/api/admin/inventory${q}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setVariants(d.variants || []);
      setStats(d.stats || {});
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filter]);

  const update = async (variantId: string, productId: string, patch: any) => {
    setSavingId(variantId);
    try {
      const res = await fetch(`/api/admin/products/${productId}/variants/${variantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await load();
    } catch (e: any) { alert(e.message); }
    finally { setSavingId(null); }
  };

  return (
    <>
      <p className="label text-madder">STOCK</p>
      <h1 className="font-display text-4xl text-kohl mt-2">Inventory</h1>
      <p className="font-italic italic text-mitti mt-2">
        {loading ? 'Loading...' : `${stats.totalVariants || 0} variants · ${stats.totalUnits || 0} units in stock`}
      </p>
      <div className="madder-divider mt-4"></div>

      {error && <p className="mt-6 font-ui text-sm text-madder bg-madder/10 p-3">{error}</p>}

      <div className="grid grid-cols-3 gap-4 mt-8">
        <Stat label="TOTAL UNITS" value={stats.totalUnits ?? '—'} />
        <Stat label="LOW STOCK" value={stats.lowCount ?? 0} color={stats.lowCount > 0 ? 'text-haldi' : 'text-mitti'} />
        <Stat label="OUT OF STOCK" value={stats.outCount ?? 0} color={stats.outCount > 0 ? 'text-madder' : 'text-mitti'} />
      </div>

      <div className="flex gap-2 mt-8 font-ui text-xs tracking-widest">
        {(['ALL', 'LOW', 'OUT'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 transition-colors ${filter === f ? 'bg-kohl text-ivory' : 'bg-beige text-kohl hover:bg-mitti/20'}`}>
            {f}
          </button>
        ))}
      </div>

      <table className="w-full mt-6 bg-beige font-ui text-sm">
        <thead>
          <tr className="border-b border-mitti/20 text-left text-xs tracking-widest text-mitti">
            <th className="p-3">IMG</th>
            <th className="p-3">PRODUCT</th>
            <th className="p-3">VARIANT SKU</th>
            <th className="p-3">SIZE</th>
            <th className="p-3">COLOR</th>
            <th className="p-3">IN STOCK</th>
            <th className="p-3">LOW @</th>
            <th className="p-3">STATUS</th>
          </tr>
        </thead>
        <tbody>
          {loading && <tr><td colSpan={8} className="p-8 text-center text-mitti">Loading...</td></tr>}
          {!loading && variants.length === 0 && (
            <tr><td colSpan={8} className="p-8 text-center text-mitti italic">No variants found.</td></tr>
          )}
          {variants.map(v => (
            <tr key={v.id} className="border-b border-mitti/10 hover:bg-ivory/50">
              <td className="p-3">
                {v.image ? <img src={v.image} alt="" className="w-10 h-12 object-cover" /> : <div className="w-10 h-12 bg-ivory" />}
              </td>
              <td className="p-3">
                <Link href={`/admin/products/${v.productId}`} className="font-display hover:text-madder">{v.productName}</Link>
                <p className="text-[10px] text-mitti font-mono">{v.productSku}</p>
              </td>
              <td className="p-3 font-mono text-xs">{v.sku}</td>
              <td className="p-3 text-xs">{v.size || '—'}</td>
              <td className="p-3 text-xs">{v.color || '—'}</td>
              <td className="p-3">
                <input type="number" min="0" defaultValue={v.inventory}
                  disabled={savingId === v.id}
                  onBlur={e => {
                    const n = parseInt(e.target.value) || 0;
                    if (n !== v.inventory) update(v.id, v.productId, { inventory: n });
                  }}
                  className={`w-20 p-1 bg-ivory border ${v.isOut ? 'border-madder text-madder' : v.isLow ? 'border-haldi text-haldi' : 'border-mitti/20'}`} />
              </td>
              <td className="p-3">
                <input type="number" min="0" defaultValue={v.lowStockThreshold}
                  disabled={savingId === v.id}
                  onBlur={e => {
                    const n = parseInt(e.target.value) || 0;
                    if (n !== v.lowStockThreshold) update(v.id, v.productId, { lowStockThreshold: n });
                  }}
                  className="w-16 p-1 bg-ivory border border-mitti/20" />
              </td>
              <td className="p-3">
                {v.isOut ? <span className="badge-founder bg-madder">OUT</span>
                  : v.isLow ? <span className="badge-founder bg-haldi">LOW</span>
                  : <span className="badge-founder bg-neem">OK</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="font-italic italic text-mitti text-sm mt-6">
        Edit inventory or low-stock thresholds inline. Changes save when you click away from the field.
      </p>
    </>
  );
}

function Stat({ label, value, color = 'text-kohl' }: any) {
  return (
    <div className="bg-beige p-5">
      <p className="label">{label}</p>
      <p className={`font-display text-3xl mt-2 ${color}`}>{value}</p>
    </div>
  );
}
