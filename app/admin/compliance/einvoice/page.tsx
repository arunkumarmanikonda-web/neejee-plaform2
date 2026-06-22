'use client';
// Admin: GST e-Invoice tracking
// Phase 1 = manual IRN entry from CA's accounting system.
// Each row corresponds to one Order. Filters by status.

import { useEffect, useState } from 'react';

type Row = {
  id: string;
  orderId: string;
  irn: string | null;
  ackNo: string | null;
  ackDate: string | null;
  signedQrCode: string | null;
  status: 'PENDING' | 'PROCESSING' | 'ACTIVE' | 'CANCELLED' | 'FAILED' | 'EXEMPT';
  errorCode: string | null;
  errorMessage: string | null;
  isManual: boolean;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  order: {
    id: string;
    orderNumber: string;
    total: number;
    createdAt: string;
    gstinCustomer: string | null;
  } | null;
};

const STATUS_ORDER = ['PENDING', 'PROCESSING', 'ACTIVE', 'FAILED', 'CANCELLED', 'EXEMPT'] as const;

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-rose-100 text-rose-700',
  FAILED: 'bg-red-100 text-red-700',
  EXEMPT: 'bg-charcoal/10 text-charcoal/60',
};

export default function EInvoicePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const qs = status ? `?status=${status}` : '';
      const res = await fetch(`/api/admin/compliance/einvoice${qs}`);
      const data = await res.json();
      setRows(data.rows || []);
      setCounts(data.counts || {});
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [status]);

  async function recordIrn(row: Row) {
    const irn = prompt('IRN (64-char hex from IRP):');
    if (!irn) return;
    const ackNo = prompt('Acknowledgement number (optional):');
    const ackDate = prompt('Acknowledgement date (YYYY-MM-DD, optional):');
    const res = await fetch(`/api/admin/compliance/einvoice/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'RECORD_IRN',
        irn,
        ackNo: ackNo || undefined,
        ackDate: ackDate || undefined,
      }),
    });
    if (!res.ok) {
      alert('Failed');
      return;
    }
    load();
  }

  async function cancelIrn(row: Row) {
    const reason = prompt('Cancellation reason:');
    if (!reason) return;
    const res = await fetch(`/api/admin/compliance/einvoice/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'CANCEL', reason }),
    });
    if (!res.ok) {
      alert('Failed');
      return;
    }
    load();
  }

  async function markExempt(row: Row) {
    if (!confirm('Mark as EXEMPT (no IRN required for this order)?')) return;
    const res = await fetch(`/api/admin/compliance/einvoice/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'MARK_EXEMPT' }),
    });
    if (res.ok) load();
  }

  const inr = (paise: number) =>
    '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display text-3xl">GST e-Invoice Tracking</h1>
        <p className="text-sm text-charcoal/60 mt-1">
          Track IRN (Invoice Reference Number) for B2B orders. Manual entry in Phase 1; auto-IRP submission planned for v23.25.
        </p>
      </header>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setStatus('')}
          className={`text-xs px-3 py-1 border ${status === '' ? 'bg-charcoal text-ivory' : 'border-charcoal/20'}`}
        >
          ALL
        </button>
        {STATUS_ORDER.map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`text-xs px-3 py-1 border ${status === s ? 'bg-charcoal text-ivory' : 'border-charcoal/20'}`}
          >
            {s} {counts[s] != null && `· ${counts[s]}`}
          </button>
        ))}
      </div>

      <div className="border border-charcoal/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-beige/40 text-xs uppercase">
            <tr>
              <th className="text-left p-2">Order #</th>
              <th className="text-left p-2">Date</th>
              <th className="text-right p-2">Amount</th>
              <th className="text-left p-2">Customer GSTIN</th>
              <th className="text-left p-2">IRN</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="text-center py-8 text-charcoal/50">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-8 text-charcoal/50">
                  No e-invoice rows yet. They are auto-created when a B2B order ships.
                </td>
              </tr>
            )}
            {rows.map(r => (
              <tr key={r.id} className="border-t border-charcoal/5 hover:bg-beige/20">
                <td className="p-2 font-mono">{r.order?.orderNumber || '—'}</td>
                <td className="p-2 text-xs">
                  {r.order ? new Date(r.order.createdAt).toLocaleDateString('en-IN') : '—'}
                </td>
                <td className="p-2 text-right">
                  {r.order ? inr(r.order.total) : '—'}
                </td>
                <td className="p-2 font-mono text-xs">{r.order?.gstinCustomer || '—'}</td>
                <td className="p-2 font-mono text-xs break-all max-w-xs">{r.irn || '—'}</td>
                <td className="p-2">
                  <span className={`text-xs px-2 py-1 ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                  {r.isManual && <span className="ml-1 text-xs text-charcoal/40">manual</span>}
                </td>
                <td className="p-2 space-x-2 whitespace-nowrap">
                  {r.status === 'PENDING' && (
                    <>
                      <button onClick={() => recordIrn(r)} className="text-xs underline">
                        RECORD IRN
                      </button>
                      <button onClick={() => markExempt(r)} className="text-xs underline text-charcoal/60">
                        EXEMPT
                      </button>
                    </>
                  )}
                  {r.status === 'ACTIVE' && (
                    <button onClick={() => cancelIrn(r)} className="text-xs underline text-rose-700">
                      CANCEL
                    </button>
                  )}
                  {r.status === 'FAILED' && (
                    <button onClick={() => recordIrn(r)} className="text-xs underline">
                      RECORD IRN
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.some(r => r.errorMessage) && (
        <div className="mt-4 text-xs">
          <strong>Errors:</strong>
          {rows
            .filter(r => r.errorMessage)
            .map(r => (
              <div key={r.id} className="text-rose-700 mt-1">
                {r.order?.orderNumber}: {r.errorMessage}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
