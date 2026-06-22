'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, ExternalLink, FileSpreadsheet, Image as ImageIcon } from 'lucide-react';
import { formatINR } from '@/lib/money';

const STATUS: Record<string, { l: string; cls: string }> = {
  SUBMITTED:    { l: 'Submitted',     cls: 'bg-banarasi/20 text-banarasi' },
  UNDER_REVIEW: { l: 'Under review',  cls: 'bg-banarasi/30 text-kohl' },
  NEEDS_INFO:   { l: 'Needs info',    cls: 'bg-madder/20 text-madder' },
  APPROVED:     { l: 'Approved',      cls: 'bg-emerald-100 text-emerald-800' },
  PUBLISHED:    { l: 'Published',     cls: 'bg-emerald-200 text-emerald-900' },
  REJECTED:     { l: 'Rejected',      cls: 'bg-madder/10 text-madder' },
  WITHDRAWN:    { l: 'Withdrawn',     cls: 'bg-mitti/10 text-mitti' },
};

export default function SellerInventoryAdminPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [counts, setCounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('SUBMITTED');

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter) params.set('status', filter);
    const r = await fetch(`/api/admin/seller-inventory?${params}`);
    const j = await r.json();
    setRows(j.submissions || []);
    setCounts(j.counts || []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const countOf = (s: string) => counts.find(c => c.status === s)?._count._all || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-kohl">Seller Inventory Queue</h1>
        <p className="text-mitti text-sm">Review, polish, and publish seller submissions</p>
      </div>

      {/* Status filters with counts */}
      <div className="flex gap-2 flex-wrap">
        {['SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFO', 'APPROVED', 'PUBLISHED', 'REJECTED', ''].map(s => (
          <button key={s || 'all'} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 font-ui text-xs tracking-widest uppercase flex items-center gap-2 ${
              filter === s ? 'bg-kohl text-ivory' : 'bg-ivory border border-mitti/30 text-mitti'
            }`}>
            {s ? STATUS[s].l : 'All'}
            {s && <span className="bg-banarasi/30 text-kohl text-[10px] px-1.5 py-0.5 rounded">{countOf(s)}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-mitti py-20 text-center"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>
      ) : rows.length === 0 ? (
        <div className="bg-ivory border border-mitti/20 p-12 text-center text-mitti font-italic italic">
          Empty queue.
        </div>
      ) : (
        <div className="bg-ivory border border-mitti/20 rounded overflow-hidden">
          <table className="w-full font-ui text-sm">
            <thead className="bg-beige/50 text-mitti text-xs label">
              <tr>
                <th className="text-left p-3">SUBMITTED</th>
                <th className="text-left p-3">SELLER</th>
                <th className="text-left p-3">TYPE</th>
                <th className="text-left p-3">PRODUCT</th>
                <th className="text-right p-3">PRICE</th>
                <th className="text-left p-3">SOURCE</th>
                <th className="text-center p-3">STATUS</th>
                <th className="text-right p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(s => {
                const stat = STATUS[s.status] || { l: s.status, cls: 'bg-mitti/10 text-mitti' };
                const data = s.proposedData || {};
                const productName = s.product?.name || data.name || 'Untitled';
                const sellingPrice = data.sellingPrice ? data.sellingPrice / 100 : null;
                return (
                  <tr key={s.id} className="border-t border-mitti/10 hover:bg-beige/20">
                    <td className="p-3 text-mitti text-xs whitespace-nowrap">
                      {new Date(s.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="p-3 text-kohl">
                      <Link href={`/admin/sellers/${s.seller.id}`} className="hover:underline">{s.seller.businessName}</Link>
                    </td>
                    <td className="p-3 text-mitti text-xs">{s.submissionType.replace(/_/g, ' ')}</td>
                    <td className="p-3 text-kohl flex items-center gap-2">
                      {data.images?.[0] && <img src={data.images[0]} alt="" className="w-8 h-8 object-cover rounded" />}
                      {productName}
                    </td>
                    <td className="p-3 text-right tabular-nums text-kohl">
                      {sellingPrice ? `₹${sellingPrice.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="p-3 text-mitti text-xs">
                      {s.sourceFileUrl ? (
                        <a href={s.sourceFileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline">
                          <FileSpreadsheet className="w-3 h-3" /> Excel
                        </a>
                      ) : data.images?.length ? (
                        <span className="flex items-center gap-1"><ImageIcon className="w-3 h-3" /> {data.images.length} img</span>
                      ) : '—'}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`text-[10px] tracking-widest px-2 py-0.5 rounded ${stat.cls}`}>{stat.l}</span>
                    </td>
                    <td className="p-3 text-right">
                      <Link href={`/admin/seller-inventory/${s.id}`}
                        className="text-kohl hover:underline text-xs flex items-center gap-1 justify-end">
                        OPEN <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
