'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Package } from 'lucide-react';
import { formatINR } from '@/lib/money';

const STATUS_FILTERS = ['', 'SENT', 'CONFIRMED', 'DISPATCHED', 'RECEIVED', 'CLOSED'];

export default function VendorPoListPage() {
  const [pos, setPos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetch('/api/vendor/purchase-orders', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { purchaseOrders: [] })
      .then(d => { setPos(d.purchaseOrders || []); setLoading(false); });
  }, []);

  const filtered = statusFilter ? pos.filter(p => p.status === statusFilter) : pos;

  return (
    <div className="max-w-5xl mx-auto p-6 lg:p-8 space-y-4">
      <h1 className="font-display text-3xl text-kohl">Purchase Orders</h1>
      <p className="text-sm text-mitti">All POs raised to you by the NEEJEE team.</p>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 text-[10px] uppercase tracking-widest border ${statusFilter === s ? 'bg-madder text-ivory border-madder' : 'bg-beige border-mitti/20 text-mitti'}`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin text-madder" />
      ) : filtered.length === 0 ? (
        <div className="bg-ivory border border-mitti/15 p-10 text-center">
          <Package className="w-10 h-10 mx-auto text-mitti/40 mb-3" />
          <p className="font-display text-lg text-kohl">No purchase orders {statusFilter ? `in ${statusFilter}` : 'yet'}</p>
          <p className="text-xs text-mitti mt-2">When NEEJEE raises a PO with you, it'll show up here.</p>
        </div>
      ) : (
        <div className="bg-ivory border border-mitti/15">
          <table className="w-full text-sm">
            <thead className="bg-beige text-[10px] uppercase tracking-widest text-mitti">
              <tr>
                <th className="text-left p-3">PO #</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Lines</th>
                <th className="text-right p-3">Total</th>
                <th className="text-left p-3">Expected</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-t border-mitti/10 hover:bg-beige/40">
                  <td className="p-3 font-mono">{p.poNumber}</td>
                  <td className="p-3 text-xs">{p.status}</td>
                  <td className="p-3 text-right">{p._count.lines}</td>
                  <td className="p-3 text-right font-mono">{formatINR(p.totalPaise)}</td>
                  <td className="p-3 text-xs">{p.expectedDate ? new Date(p.expectedDate).toLocaleDateString() : '—'}</td>
                  <td className="p-3 text-right">
                    <Link href={`/vendor/purchase-orders/${p.id}`} className="text-xs uppercase tracking-widest text-madder hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
