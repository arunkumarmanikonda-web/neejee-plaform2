'use client';
// v23.40.5 — Sales Invoices list + create modal (POS / B2B / BULK / COMMISSION).
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Loader2, Search, Filter, Download, Wallet, FileText, Printer, FileDown, CheckSquare, Square } from 'lucide-react';
import { formatINR } from '@/lib/money';
import NewInvoiceForm from './NewInvoiceForm';

interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceType: string;
  saleChannel: string;
  saleType: string;
  customerName: string;
  customerEmail: string | null;
  issuedOn: string;
  dueOn: string | null;
  totalPaise: number;
  paidPaise: number;
  paymentStatus: string;
  posted: boolean;
  sellerId: string | null;
}

const TYPE_STYLE: Record<string, string> = {
  POS:        'bg-amber-100 text-amber-800',
  B2C:        'bg-blue-100 text-blue-800',
  B2B:        'bg-blue-200 text-blue-900',
  BULK:       'bg-purple-100 text-purple-800',
  COMMISSION: 'bg-emerald-100 text-emerald-800',
};

const STATUS_STYLE: Record<string, string> = {
  UNPAID:         'bg-mitti/10 text-mitti',
  PARTIALLY_PAID: 'bg-banarasi/20 text-banarasi',
  PAID:           'bg-emerald-100 text-emerald-800',
  CANCELLED:      'bg-madder/10 text-madder',
  VOID:           'bg-madder/10 text-madder',
};

export default function SalesInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showNew, setShowNew]   = useState(false);
  const [typeFilter, setTypeFilter]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [q, setQ] = useState('');
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  // v23.40.13 — multi-select for bulk print/export/reprint
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSel = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const toggleAll = () => {
    setSelectedIds(prev => {
      if (prev.size === invoices.length) return new Set();
      return new Set(invoices.map(i => i.id));
    });
  };
  const bulkPrint  = () => {
    if (!selectedIds.size) return;
    window.open(`/api/admin/finance/sales-invoices/bulk-print?ids=${Array.from(selectedIds).join(',')}`, '_blank');
  };
  const bulkExport = () => {
    if (!selectedIds.size) return;
    window.location.href = `/api/admin/finance/sales-invoices/bulk-export?ids=${Array.from(selectedIds).join(',')}`;
  };

  async function load() {
    setLoading(true);
    const url = new URL('/api/admin/finance/sales-invoices', window.location.origin);
    if (typeFilter)   url.searchParams.set('invoiceType', typeFilter);
    if (statusFilter) url.searchParams.set('paymentStatus', statusFilter);
    if (q)            url.searchParams.set('q', q);
    const r = await fetch(url.toString());
    const d = await r.json();
    setInvoices(d.invoices || []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [typeFilter, statusFilter]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-kohl">Sales Invoices</h1>
          <p className="text-mitti text-sm mt-1">
            POS / offline sales, B2B billing, bulk orders, and marketplace commission invoices.
          </p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-1 px-4 py-2 bg-kohl text-ivory text-xs tracking-widest hover:bg-madder">
          <Plus className="w-3 h-3" /> NEW INVOICE
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-ivory border border-mitti/20 p-3 mb-4 flex items-center gap-2 flex-wrap">
        <Search className="w-4 h-4 text-mitti" />
        <input value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') load(); }}
          placeholder="Search by invoice #, customer, email, phone, GSTIN…"
          className="flex-1 min-w-[200px] border border-mitti/30 px-3 py-1.5 bg-ivory text-sm" />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="border border-mitti/30 px-3 py-1.5 bg-ivory text-xs">
          <option value="">All types</option>
          <option value="POS">POS / Offline</option>
          <option value="B2C">B2C</option>
          <option value="B2B">B2B</option>
          <option value="BULK">Bulk</option>
          <option value="COMMISSION">Commission</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-mitti/30 px-3 py-1.5 bg-ivory text-xs">
          <option value="">All statuses</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PARTIALLY_PAID">Partially paid</option>
          <option value="PAID">Paid</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <button onClick={load} className="px-3 py-1.5 bg-kohl text-ivory text-xs tracking-widest">SEARCH</button>
      </div>

      {/* v23.40.13 — Bulk action bar (only when selection exists) */}
      {selectedIds.size > 0 && (
        <div className="bg-banarasi/10 border border-banarasi/30 p-3 mb-4 flex items-center gap-3 flex-wrap">
          <span className="text-xs text-banarasi font-medium">
            {selectedIds.size} invoice{selectedIds.size === 1 ? '' : 's'} selected
          </span>
          <button onClick={bulkPrint}
            className="flex items-center gap-1 px-3 py-1.5 bg-kohl text-ivory text-xs tracking-widest hover:bg-madder">
            <Printer className="w-3 h-3" /> PRINT / SAVE PDF
          </button>
          <button onClick={bulkExport}
            className="flex items-center gap-1 px-3 py-1.5 border border-kohl text-kohl text-xs tracking-widest hover:bg-kohl hover:text-ivory">
            <FileDown className="w-3 h-3" /> EXPORT CSV
          </button>
          <button onClick={() => setSelectedIds(new Set())}
            className="text-xs text-mitti hover:text-madder ml-auto">
            Clear selection
          </button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-mitti">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading invoices…
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-ivory border border-mitti/20 p-12 text-center text-mitti">
          No invoices yet. Click <b>NEW INVOICE</b> to record an offline sale, B2B bill, or commission charge.
        </div>
      ) : (
        <div className="bg-ivory border border-mitti/20 overflow-x-auto">
          <table className="w-full font-ui text-sm min-w-[900px]">
            <thead className="bg-beige/60 text-mitti text-xs label">
              <tr>
                <th className="p-3 w-8">
                  <button onClick={toggleAll} className="text-mitti hover:text-madder" title="Select all">
                    {selectedIds.size === invoices.length && invoices.length > 0
                      ? <CheckSquare className="w-4 h-4" />
                      : <Square className="w-4 h-4" />}
                  </button>
                </th>
                <th className="text-left p-3">INVOICE #</th>
                <th className="text-left p-3">DATE</th>
                <th className="text-left p-3">TYPE</th>
                <th className="text-left p-3">CUSTOMER / PAYEE</th>
                <th className="text-right p-3">TOTAL</th>
                <th className="text-right p-3">PAID</th>
                <th className="text-right p-3">OUTSTANDING</th>
                <th className="text-center p-3">STATUS</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => {
                const outstanding = inv.totalPaise - inv.paidPaise;
                return (
                  <tr key={inv.id} className={`border-t border-mitti/10 hover:bg-beige/30 ${selectedIds.has(inv.id) ? 'bg-banarasi/5' : ''}`}>
                    <td className="p-3">
                      <button onClick={() => toggleSel(inv.id)} className="text-mitti hover:text-madder">
                        {selectedIds.has(inv.id) ? <CheckSquare className="w-4 h-4 text-banarasi" /> : <Square className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="p-3 text-mitti font-mono text-xs">
                      <Link href={`/admin/finance/sales-invoices/${inv.id}`} className="hover:text-madder">
                        {inv.invoiceNumber}
                      </Link>
                      {!inv.posted && <span className="block text-[9px] text-amber-700">Not posted</span>}
                    </td>
                    <td className="p-3 text-mitti whitespace-nowrap">
                      {new Date(inv.issuedOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </td>
                    <td className="p-3">
                      <span className={`inline-block px-2 py-0.5 text-[10px] tracking-widest ${TYPE_STYLE[inv.invoiceType] || 'bg-mitti/10 text-mitti'}`}>
                        {inv.invoiceType}
                      </span>
                      <span className="block text-[10px] text-mitti mt-1">{inv.saleChannel}</span>
                    </td>
                    <td className="p-3 text-kohl">
                      {inv.customerName}
                      {inv.customerEmail && <span className="block text-[10px] text-mitti">{inv.customerEmail}</span>}
                    </td>
                    <td className="p-3 text-right tabular-nums text-kohl">{formatINR(inv.totalPaise)}</td>
                    <td className="p-3 text-right tabular-nums text-emerald-700">{inv.paidPaise ? formatINR(inv.paidPaise) : '—'}</td>
                    <td className={`p-3 text-right tabular-nums font-medium ${outstanding > 0 ? 'text-madder' : 'text-mitti'}`}>
                      {outstanding > 0 ? formatINR(outstanding) : '—'}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] tracking-widest ${STATUS_STYLE[inv.paymentStatus]}`}>
                        {inv.paymentStatus.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex gap-1 justify-end">
                        {outstanding > 0 && inv.paymentStatus !== 'CANCELLED' && (
                          <button onClick={() => setPayingInvoice(inv)}
                            className="px-2 py-1 bg-banarasi text-ivory text-[10px] tracking-widest hover:bg-banarasi/80"
                            title="Record payment">
                            <Wallet className="w-3 h-3 inline" /> PAY
                          </button>
                        )}
                        <a href={`/api/admin/finance/sales-invoices/${inv.id}/print`} target="_blank" rel="noreferrer"
                          className="px-2 py-1 border border-mitti text-mitti text-[10px] tracking-widest hover:bg-mitti hover:text-ivory"
                          title="Print / Save as PDF">
                          <Printer className="w-3 h-3 inline" />
                        </a>
                        <Link href={`/admin/finance/sales-invoices/${inv.id}`}
                          className="px-2 py-1 border border-kohl text-kohl text-[10px] tracking-widest hover:bg-kohl hover:text-ivory">
                          <FileText className="w-3 h-3 inline" /> OPEN
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showNew && <NewInvoiceForm onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />}
      {payingInvoice && <PayInvoiceModal invoice={payingInvoice} onClose={() => setPayingInvoice(null)} onPaid={() => { setPayingInvoice(null); load(); }} />}
    </div>
  );
}

// Inline payment modal
function PayInvoiceModal({ invoice, onClose, onPaid }: { invoice: Invoice; onClose: () => void; onPaid: () => void }) {
  const outstanding = invoice.totalPaise - invoice.paidPaise;
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    amountRupees: (outstanding / 100).toFixed(2),
    paidOn: today,
    method: 'BANK_TRANSFER',
    reference: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    setErr(''); setSaving(true);
    try {
      const amt = Math.round(parseFloat(form.amountRupees) * 100);
      if (amt <= 0 || amt > outstanding) throw new Error('Invalid amount');
      const r = await fetch(`/api/admin/finance/sales-invoices/${invoice.id}/payments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountPaise: amt, paidOn: form.paidOn, method: form.method, reference: form.reference, notes: form.notes }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      onPaid();
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-kohl/50 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-ivory max-w-md w-full my-8 p-6" onClick={e => e.stopPropagation()}>
        <h3 className="font-display text-xl text-kohl mb-1">Record payment</h3>
        <p className="text-xs text-mitti mb-4">{invoice.invoiceNumber} — outstanding {formatINR(outstanding)}</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="label text-banarasi mb-1">AMOUNT (₹)</p>
            <input type="number" step="0.01" value={form.amountRupees} onChange={e => setForm({ ...form, amountRupees: e.target.value })}
              className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
          </div>
          <div>
            <p className="label text-banarasi mb-1">PAID ON</p>
            <input type="date" value={form.paidOn} onChange={e => setForm({ ...form, paidOn: e.target.value })}
              className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
          </div>
          <div>
            <p className="label text-banarasi mb-1">METHOD</p>
            <select value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}
              className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm">
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="CARD">Card</option>
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="RAZORPAY">Razorpay</option>
              <option value="NEFT">NEFT</option>
              <option value="RTGS">RTGS</option>
              <option value="CHEQUE">Cheque</option>
            </select>
          </div>
          <div>
            <p className="label text-banarasi mb-1">REFERENCE</p>
            <input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })}
              placeholder="UTR / Cheque #" className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
          </div>
        </div>
        <div className="mt-3">
          <p className="label text-banarasi mb-1">NOTES</p>
          <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
            className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
        </div>
        {err && <p className="mt-3 text-madder text-xs">{err}</p>}
        <div className="flex gap-2 mt-5">
          <button onClick={submit} disabled={saving}
            className="flex-1 bg-kohl text-ivory px-4 py-2 text-xs tracking-widest disabled:opacity-50">
            {saving ? 'POSTING…' : 'POST PAYMENT'}
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-mitti/30 text-mitti text-xs tracking-widest">CANCEL</button>
        </div>
      </div>
    </div>
  );
}
