'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Loader2 } from 'lucide-react';
import { formatINR } from '@/lib/money';

type Po = {
  id: string;
  poNumber: string;
  status: string;
  totalPaise: number;
  expectedDate: string | null;
  createdAt: string;
  vendor: { id: string; legalName: string; displayName: string | null };
  _count: { lines: number };
};

const STATUS_OPTIONS = ['', 'DRAFT', 'SENT', 'CONFIRMED', 'DISPATCHED', 'RECEIVED', 'CLOSED', 'CANCELLED'];

export default function PurchaseOrdersPage() {
  const [pos, setPos] = useState<Po[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const load = async () => {
    setLoading(true);
    const url = new URL('/api/admin/purchase-orders', window.location.origin);
    if (statusFilter) url.searchParams.set('status', statusFilter);
    const r = await fetch(url.toString(), { cache: 'no-store' });
    const d = await r.json();
    setPos(d.purchaseOrders || []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter]);

  return (
    <div className="max-w-6xl mx-auto p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-kohl">Purchase Orders</h1>
          <p className="text-sm text-mitti mt-1">Orders you raise to vendors. They flow DRAFT → SENT → CONFIRMED → DISPATCHED → RECEIVED → CLOSED.</p>
        </div>
        <Link href="/admin/purchase-orders/new" className="btn-primary inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> NEW PO
        </Link>
      </div>

      <div className="flex gap-2 mb-4">
        {STATUS_OPTIONS.map(s => (
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
      ) : pos.length === 0 ? (
        <p className="text-sm text-mitti italic">No purchase orders yet.</p>
      ) : (
        <div className="overflow-x-auto border border-mitti/15 bg-ivory">
          <table className="w-full text-sm">
            <thead className="bg-beige text-[10px] uppercase tracking-widest text-mitti">
              <tr>
                <th className="text-left p-3">PO #</th>
                <th className="text-left p-3">Vendor</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Lines</th>
                <th className="text-right p-3">Total</th>
                <th className="text-left p-3">Expected</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {pos.map(po => (
                <tr key={po.id} className="border-t border-mitti/10 hover:bg-beige/40">
                  <td className="p-3 font-mono">{po.poNumber}</td>
                  <td className="p-3">{po.vendor.displayName || po.vendor.legalName}</td>
                  <td className="p-3"><StatusPill status={po.status} /></td>
                  <td className="p-3 text-right">{po._count.lines}</td>
                  <td className="p-3 text-right font-mono">{formatINR(po.totalPaise)}</td>
                  <td className="p-3 text-xs">{po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : '—'}</td>
                  <td className="p-3 text-right">
                    <Link href={`/admin/purchase-orders/${po.id}`} className="text-xs uppercase tracking-widest text-madder hover:underline">
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

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT:      'bg-mitti/15 text-mitti',
    SENT:       'bg-haldi/20 text-mitti',
    CONFIRMED:  'bg-blue-100 text-blue-800',
    DISPATCHED: 'bg-indigo-100 text-indigo-800',
    RECEIVED:   'bg-green-100 text-green-800',
    CLOSED:     'bg-mitti/30 text-kohl',
    CANCELLED:  'bg-madder/10 text-madder',
  };
  return <span className={`text-[10px] uppercase tracking-widest px-2 py-1 ${map[status] || ''}`}>{status}</span>;
}
