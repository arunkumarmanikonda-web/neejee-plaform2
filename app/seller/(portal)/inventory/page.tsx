'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus, Eye, X } from 'lucide-react';

const STATUS: Record<string, { l: string; cls: string }> = {
  SUBMITTED:    { l: 'Submitted',     cls: 'bg-banarasi/20 text-banarasi' },
  UNDER_REVIEW: { l: 'Under review',  cls: 'bg-banarasi/30 text-kohl' },
  NEEDS_INFO:   { l: 'Needs info',    cls: 'bg-madder/20 text-madder' },
  APPROVED:     { l: 'Approved',      cls: 'bg-emerald-100 text-emerald-800' },
  PUBLISHED:    { l: 'Live',          cls: 'bg-emerald-200 text-emerald-900' },
  REJECTED:     { l: 'Rejected',      cls: 'bg-madder/10 text-madder' },
  WITHDRAWN:    { l: 'Withdrawn',     cls: 'bg-mitti/10 text-mitti' },
};

export default function InventoryPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter) params.set('status', filter);
    const r = await fetch(`/api/seller/inventory-submissions?${params}`);
    const j = await r.json();
    setRows(j.submissions || []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const withdraw = async (id: string) => {
    if (!confirm('Withdraw this submission?')) return;
    await fetch(`/api/seller/inventory-submissions/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-kohl">Inventory</h1>
          <p className="text-mitti text-sm">Your product submissions and their status</p>
        </div>
        <Link href="/seller/inventory/submit"
          className="bg-kohl text-ivory px-4 py-2 font-ui text-xs tracking-widest flex items-center gap-2">
          <Plus className="w-3 h-3" /> SUBMIT NEW
        </Link>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          { v: '', l: 'All' },
          { v: 'SUBMITTED', l: 'Submitted' },
          { v: 'UNDER_REVIEW', l: 'Under review' },
          { v: 'NEEDS_INFO', l: 'Needs info' },
          { v: 'APPROVED', l: 'Approved' },
          { v: 'PUBLISHED', l: 'Live' },
          { v: 'REJECTED', l: 'Rejected' },
        ].map(f => (
          <button key={f.v} onClick={() => setFilter(f.v)}
            className={`px-3 py-1.5 font-ui text-xs tracking-widest uppercase ${
              filter === f.v ? 'bg-kohl text-ivory' : 'bg-ivory border border-mitti/30 text-mitti'
            }`}>{f.l}</button>
        ))}
      </div>

      {loading ? (
        <div className="text-mitti py-20 text-center"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>
      ) : rows.length === 0 ? (
        <div className="bg-ivory border border-mitti/20 p-12 text-center text-mitti font-italic italic">
          {filter ? 'No submissions with this status.' : 'No submissions yet. Click "Submit new" to get started.'}
        </div>
      ) : (
        <div className="bg-ivory border border-mitti/20 rounded overflow-hidden">
          <table className="w-full font-ui text-sm">
            <thead className="bg-beige/50 text-mitti text-xs label">
              <tr>
                <th className="text-left p-3">SUBMITTED</th>
                <th className="text-left p-3">TYPE</th>
                <th className="text-left p-3">PRODUCT</th>
                <th className="text-center p-3">STATUS</th>
                <th className="text-left p-3">ADMIN NOTE</th>
                <th className="text-right p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(s => {
                const stat = STATUS[s.status] || { l: s.status, cls: 'bg-mitti/10 text-mitti' };
                const productName = s.product?.name || s.proposedData?.name || 'Untitled';
                return (
                  <tr key={s.id} className="border-t border-mitti/10">
                    <td className="p-3 text-mitti text-xs whitespace-nowrap">
                      {new Date(s.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="p-3 text-mitti text-xs">{s.submissionType.replace(/_/g, ' ')}</td>
                    <td className="p-3 text-kohl">{productName}</td>
                    <td className="p-3 text-center">
                      <span className={`text-[10px] tracking-widest px-2 py-0.5 rounded ${stat.cls}`}>{stat.l}</span>
                    </td>
                    <td className="p-3 text-mitti text-xs max-w-xs">{s.reviewNote || '—'}</td>
                    <td className="p-3 text-right">
                      {['SUBMITTED', 'NEEDS_INFO'].includes(s.status) && (
                        <button onClick={() => withdraw(s.id)} className="text-madder hover:opacity-70 text-xs">
                          <X className="w-3 h-3 inline" /> withdraw
                        </button>
                      )}
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
