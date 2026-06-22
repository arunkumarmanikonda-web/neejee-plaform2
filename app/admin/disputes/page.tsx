'use client';
// Admin Disputes Queue.
// Filters by status / resourceType / severity. Shows SLA breach indicator.

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Row = {
  id: string;
  resourceType: 'ORDER' | 'PURCHASE_ORDER';
  category: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: string;
  title: string;
  raisedByRole: string;
  vendorId: string | null;
  sellerId: string | null;
  customerUserId: string | null;
  dueBy: string | null;
  firstResponseAt: string | null;
  resolutionAmountPaise: number | null;
  createdAt: string;
};

const STATUSES = ['OPEN', 'AWAITING_CUSTOMER', 'AWAITING_VENDOR', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED', 'WITHDRAWN'] as const;

const SEVERITY_STYLE: Record<string, string> = {
  LOW: 'bg-charcoal/10 text-charcoal/60',
  MEDIUM: 'bg-amber-100 text-amber-700',
  HIGH: 'bg-rose-100 text-rose-700',
  CRITICAL: 'bg-red-200 text-red-900',
};

const STATUS_STYLE: Record<string, string> = {
  OPEN: 'bg-amber-100 text-amber-700',
  AWAITING_CUSTOMER: 'bg-blue-100 text-blue-700',
  AWAITING_VENDOR: 'bg-blue-100 text-blue-700',
  UNDER_REVIEW: 'bg-purple-100 text-purple-700',
  RESOLVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-charcoal/20 text-charcoal/60',
  WITHDRAWN: 'bg-charcoal/10 text-charcoal/50',
};

export default function DisputesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [status, setStatus] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (status) qs.set('status', status);
      if (resourceType) qs.set('resourceType', resourceType);
      const res = await fetch(`/api/admin/disputes?${qs.toString()}`);
      const data = await res.json();
      setRows(data.rows || []);
      setCounts(data.counts || {});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [status, resourceType]);

  function isOverdue(r: Row) {
    if (!r.dueBy || ['RESOLVED', 'REJECTED', 'WITHDRAWN'].includes(r.status)) return false;
    return new Date(r.dueBy).getTime() < Date.now();
  }

  function fmtDue(r: Row) {
    if (!r.dueBy) return '—';
    const due = new Date(r.dueBy);
    const diff = due.getTime() - Date.now();
    const hours = Math.round(diff / 36e5);
    if (hours < 0) return `${Math.abs(hours)}h overdue`;
    if (hours < 24) return `due in ${hours}h`;
    return `due in ${Math.round(hours / 24)}d`;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display text-3xl">Disputes</h1>
        <p className="text-sm text-charcoal/60 mt-1">
          Customer order disputes and vendor purchase-order disputes. SLA breach indicators in red.
        </p>
      </header>

      <div className="flex gap-2 mb-4 flex-wrap">
        <span className="text-xs uppercase text-charcoal/50 py-1">Status:</span>
        <button onClick={() => setStatus('')} className={`text-xs px-3 py-1 border ${status === '' ? 'bg-charcoal text-ivory' : 'border-charcoal/20'}`}>ALL</button>
        {STATUSES.map(s => (
          <button key={s} onClick={() => setStatus(s)} className={`text-xs px-3 py-1 border ${status === s ? 'bg-charcoal text-ivory' : 'border-charcoal/20'}`}>
            {s.replace(/_/g, ' ')} {counts[s] != null && `· ${counts[s]}`}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <span className="text-xs uppercase text-charcoal/50 py-1">Type:</span>
        <button onClick={() => setResourceType('')} className={`text-xs px-3 py-1 border ${resourceType === '' ? 'bg-charcoal text-ivory' : 'border-charcoal/20'}`}>ALL</button>
        <button onClick={() => setResourceType('ORDER')} className={`text-xs px-3 py-1 border ${resourceType === 'ORDER' ? 'bg-charcoal text-ivory' : 'border-charcoal/20'}`}>CUSTOMER ORDERS</button>
        <button onClick={() => setResourceType('PURCHASE_ORDER')} className={`text-xs px-3 py-1 border ${resourceType === 'PURCHASE_ORDER' ? 'bg-charcoal text-ivory' : 'border-charcoal/20'}`}>PURCHASE ORDERS</button>
      </div>

      <div className="border border-charcoal/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-beige/40 text-xs uppercase">
            <tr>
              <th className="text-left p-2">Title</th>
              <th className="text-left p-2">Type</th>
              <th className="text-left p-2">Category</th>
              <th className="text-left p-2">Severity</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">SLA</th>
              <th className="text-left p-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="text-center py-8 text-charcoal/50">Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-charcoal/50">No disputes match these filters.</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id} className={`border-t border-charcoal/5 hover:bg-beige/20 ${isOverdue(r) ? 'bg-rose-50' : ''}`}>
                <td className="p-2">
                  <Link href={`/admin/disputes/${r.id}`} className="font-medium underline">
                    {r.title}
                  </Link>
                  <div className="text-xs text-charcoal/50">by {r.raisedByRole}</div>
                </td>
                <td className="p-2 text-xs">
                  {r.resourceType === 'ORDER' ? 'Order' : 'Purchase Order'}
                </td>
                <td className="p-2 text-xs">{r.category.replace(/_/g, ' ')}</td>
                <td className="p-2">
                  <span className={`text-xs px-2 py-1 ${SEVERITY_STYLE[r.severity]}`}>{r.severity}</span>
                </td>
                <td className="p-2">
                  <span className={`text-xs px-2 py-1 ${STATUS_STYLE[r.status]}`}>{r.status.replace(/_/g, ' ')}</span>
                </td>
                <td className={`p-2 text-xs ${isOverdue(r) ? 'text-rose-700 font-medium' : ''}`}>
                  {fmtDue(r)}
                </td>
                <td className="p-2 text-xs">{new Date(r.createdAt).toLocaleDateString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
