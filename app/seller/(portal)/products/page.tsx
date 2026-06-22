'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Plus, Package } from 'lucide-react';

export const dynamic = 'force-dynamic';

const STATUS_TABS = ['ALL', 'ACTIVE', 'PENDING_QC', 'DRAFT', 'REJECTED'] as const;

function inr(paise: number) {
  return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export default function SellerProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<typeof STATUS_TABS[number]>('ALL');

  useEffect(() => {
    fetch('/api/seller/products').then(r => r.json()).then(d => { setProducts(d.products || []); setLoading(false); });
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: products.length };
    STATUS_TABS.slice(1).forEach(s => { c[s] = products.filter(p => p.status === s).length; });
    return c;
  }, [products]);

  const filtered = filter === 'ALL' ? products : products.filter(p => p.status === filter);

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <p className="label text-madder">STUDIO</p>
          <h1 className="font-display text-4xl text-kohl mt-2">Your pieces</h1>
        </div>
        <Link href="/seller/products/new" className="btn-primary text-xs inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> ADD PIECE
        </Link>
      </div>
      <div className="madder-divider mt-4"></div>

      <div className="flex items-center gap-3 mt-6 flex-wrap">
        {STATUS_TABS.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-xs tracking-wider px-3 py-1.5 ${filter === s ? 'bg-kohl text-ivory' : 'bg-beige text-kohl hover:bg-mitti/10'}`}
          >
            {s.replace(/_/g, ' ')} ({counts[s] || 0})
          </button>
        ))}
      </div>

      <div className="mt-6">
        {loading ? (
          <p className="text-mitti">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-mitti/30">
            <Package className="w-10 h-10 text-mitti/40 mx-auto mb-4" />
            <p className="font-display text-2xl text-kohl">{filter === 'ALL' ? 'Your studio is empty' : 'Nothing here yet'}</p>
            {filter === 'ALL' && (
              <Link href="/seller/products/new" className="btn-primary mt-6 inline-block text-xs">ADD YOUR FIRST PIECE</Link>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-mitti/20 text-left">
                <th className="p-3 label text-mitti">IMAGE</th>
                <th className="p-3 label text-mitti">NAME</th>
                <th className="p-3 label text-mitti">SKU</th>
                <th className="p-3 label text-mitti">PRICE</th>
                <th className="p-3 label text-mitti">STATUS</th>
                <th className="p-3 text-right label text-mitti"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b border-mitti/10 hover:bg-beige/30">
                  <td className="p-3 w-16">
                    {p.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.images[0]} alt="" className="w-12 h-12 object-cover border border-mitti/20" />
                    ) : <div className="w-12 h-12 bg-beige" />}
                  </td>
                  <td className="p-3">
                    <p className="font-display text-kohl">{p.name}</p>
                    <p className="text-xs text-mitti">{p.craft} {p.region && `· ${p.region}`}</p>
                  </td>
                  <td className="p-3 font-mono text-xs text-mitti">{p.sku}</td>
                  <td className="p-3 text-sm text-kohl">{inr(p.salePrice || p.sellingPrice)}</td>
                  <td className="p-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="p-3 text-right">
                    <Link href={`/seller/products/${p.id}`} className="text-madder hover:text-kohl text-sm">EDIT →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: 'bg-mitti/20 text-mitti',
    PENDING_QC: 'bg-haldi/20 text-mitti',
    ACTIVE: 'bg-neem/20 text-neem',
    ARCHIVED: 'bg-mitti/10 text-mitti',
    REJECTED: 'bg-madder/20 text-madder',
  };
  return <span className={`text-[10px] tracking-wider px-2 py-1 ${map[status] || 'bg-beige text-mitti'}`}>{status.replace(/_/g, ' ')}</span>;
}
