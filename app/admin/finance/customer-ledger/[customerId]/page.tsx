'use client';
// v23.40.11 — Customer ledger detail page.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Download, FileText, User, Phone, Mail, Building2, Edit2, Save, X } from 'lucide-react';
import { formatINR } from '@/lib/money';

interface LedgerEntry {
  date: string;
  type: 'INVOICE' | 'PAYMENT' | 'REFUND';
  refId: string;
  description: string;
  debitPaise: number;
  creditPaise: number;
  runningBalancePaise: number;
  invoiceNumber?: string | null;
  method?: string | null;
  reference?: string | null;
  paymentStatus?: string | null;
}

interface Customer {
  id: string;
  displayName: string;
  legalName: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  gstin: string | null;
  pan: string | null;
  customerType: string;
  channel: string;
  status: string;
  billingAddress: string | null;
  creditLimitPaise: number;
  creditDays: number;
  notes: string | null;
}

export default function CustomerLedgerDetailPage() {
  const params = useParams();
  const customerId = params.customerId as string;
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});

  const load = async () => {
    setLoading(true);
    const r = await fetch(`/api/admin/finance/customer-ledger/${customerId}`);
    const d = await r.json();
    setCustomer(d.customer);
    setLedger(d.ledger || []);
    setSummary(d.summary);
    setLoading(false);
  };
  useEffect(() => { load(); }, [customerId]);

  const saveEdit = async () => {
    const r = await fetch(`/api/admin/finance/customer-ledger/${customerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    if (r.ok) {
      const d = await r.json();
      setCustomer(d.customer);
      setEditing(false);
    }
  };

  const exportCsv = () => {
    const header = ['Date', 'Type', 'Reference', 'Description', 'Debit (₹)', 'Credit (₹)', 'Balance (₹)'];
    const data = ledger.slice().reverse().map(e => [
      new Date(e.date).toLocaleDateString('en-IN'),
      e.type,
      e.invoiceNumber || e.reference || '',
      e.description,
      e.debitPaise ? (e.debitPaise / 100).toFixed(2) : '',
      e.creditPaise ? (e.creditPaise / 100).toFixed(2) : '',
      (e.runningBalancePaise / 100).toFixed(2),
    ]);
    const csv = [header, ...data].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `customer-${customer?.displayName}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <p className="p-8 text-mitti">Loading…</p>;
  if (!customer) return <p className="p-8 text-madder">Customer not found.</p>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <Link href="/admin/finance/customer-ledger"
        className="inline-flex items-center gap-1 text-xs text-banarasi hover:text-madder mb-3">
        <ArrowLeft className="w-3 h-3" /> Back to customer ledgers
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-kohl flex items-center gap-2">
            <User className="w-6 h-6 text-madder" /> {customer.displayName}
          </h1>
          {customer.legalName && <p className="text-mitti mt-1">{customer.legalName}</p>}
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-mitti">
            {customer.primaryPhone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {customer.primaryPhone}</span>}
            {customer.primaryEmail && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {customer.primaryEmail}</span>}
            {customer.gstin && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {customer.gstin}</span>}
            <span className="inline-block px-2 py-0.5 bg-mitti/10 text-kohl tracking-widest">{customer.customerType}</span>
            <span className="inline-block px-2 py-0.5 bg-banarasi/10 text-banarasi tracking-widest">{customer.channel}</span>
            {customer.creditDays > 0 && <span>Net {customer.creditDays}</span>}
            {customer.creditLimitPaise > 0 && <span>Limit {formatINR(customer.creditLimitPaise)}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {!editing ? (
            <button onClick={() => { setEditForm(customer); setEditing(true); }}
              className="inline-flex items-center gap-1 px-3 py-1.5 border border-kohl text-kohl text-xs tracking-widest hover:bg-kohl hover:text-ivory">
              <Edit2 className="w-3 h-3" /> EDIT
            </button>
          ) : (
            <>
              <button onClick={() => setEditing(false)}
                className="inline-flex items-center gap-1 px-3 py-1.5 border border-mitti text-mitti text-xs tracking-widest hover:bg-mitti hover:text-ivory">
                <X className="w-3 h-3" /> CANCEL
              </button>
              <button onClick={saveEdit}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-kohl text-ivory text-xs tracking-widest hover:bg-madder">
                <Save className="w-3 h-3" /> SAVE
              </button>
            </>
          )}
          <button onClick={exportCsv}
            className="inline-flex items-center gap-1 px-3 py-1.5 border border-kohl text-kohl text-xs tracking-widest hover:bg-kohl hover:text-ivory">
            <Download className="w-3 h-3" /> CSV
          </button>
        </div>
      </div>

      {/* Edit panel */}
      {editing && (
        <div className="bg-ivory border border-mitti/30 p-4 mb-6 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <Field label="DISPLAY NAME" value={editForm.displayName || ''} onChange={v => setEditForm({ ...editForm, displayName: v })} />
          <Field label="LEGAL NAME"   value={editForm.legalName || ''}   onChange={v => setEditForm({ ...editForm, legalName: v })} />
          <Field label="PHONE"        value={editForm.primaryPhone || ''} onChange={v => setEditForm({ ...editForm, primaryPhone: v })} />
          <Field label="EMAIL"        value={editForm.primaryEmail || ''} onChange={v => setEditForm({ ...editForm, primaryEmail: v })} />
          <Field label="GSTIN"        value={editForm.gstin || ''}        onChange={v => setEditForm({ ...editForm, gstin: v.toUpperCase() })} />
          <Field label="PAN"          value={editForm.pan || ''}          onChange={v => setEditForm({ ...editForm, pan: v.toUpperCase() })} />
          <Field label="CREDIT LIMIT (₹)" value={String((editForm.creditLimitPaise || 0) / 100)} onChange={v => setEditForm({ ...editForm, creditLimitPaise: Math.round(parseFloat(v || '0') * 100) })} />
          <Field label="CREDIT DAYS"  value={String(editForm.creditDays || 0)} onChange={v => setEditForm({ ...editForm, creditDays: parseInt(v) || 0 })} />
          <div>
            <p className="label text-banarasi mb-1">TYPE</p>
            <select value={editForm.customerType || 'INDIVIDUAL'} onChange={e => setEditForm({ ...editForm, customerType: e.target.value })}
              className="w-full bg-ivory border border-mitti/30 px-3 py-1.5 text-sm">
              <option value="INDIVIDUAL">Individual</option>
              <option value="B2B">B2B</option>
              <option value="WHOLESALE">Wholesale</option>
              <option value="INTERNAL">Internal</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <p className="label text-banarasi mb-1">BILLING ADDRESS</p>
            <textarea value={editForm.billingAddress || ''} onChange={e => setEditForm({ ...editForm, billingAddress: e.target.value })}
              className="w-full bg-ivory border border-mitti/30 px-3 py-2 text-sm" rows={2} />
          </div>
        </div>
      )}

      {/* Summary tiles */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <Tile label="Invoices"     value={String(summary.invoiceCount)} />
          <Tile label="Total billed" value={formatINR(summary.totalBilled)} />
          <Tile label="Received"     value={formatINR(summary.totalReceived)} good />
          <Tile label="Outstanding"  value={formatINR(summary.outstanding)} highlight={summary.outstanding > 0} />
          <Tile label="90+ overdue"  value={formatINR(summary.bucket90Plus)} highlight={summary.bucket90Plus > 0} />
        </div>
      )}

      {/* Aging breakdown */}
      {summary && summary.outstanding > 0 && (
        <div className="bg-ivory border border-mitti/20 p-4 mb-6">
          <p className="label text-banarasi mb-2">Aging breakdown</p>
          <div className="grid grid-cols-5 gap-3 text-sm">
            <div className="bg-beige/30 p-2"><p className="text-[10px] uppercase text-mitti">Current</p><p className="tabular-nums">{formatINR(summary.bucketCurrent)}</p></div>
            <div className="bg-amber-50 p-2"><p className="text-[10px] uppercase text-mitti">1–30</p><p className="tabular-nums">{formatINR(summary.bucket1_30)}</p></div>
            <div className="bg-amber-100 p-2"><p className="text-[10px] uppercase text-mitti">31–60</p><p className="tabular-nums">{formatINR(summary.bucket31_60)}</p></div>
            <div className="bg-orange-100 p-2"><p className="text-[10px] uppercase text-mitti">61–90</p><p className="tabular-nums">{formatINR(summary.bucket61_90)}</p></div>
            <div className="bg-red-100 p-2"><p className="text-[10px] uppercase text-mitti">90+ days</p><p className="tabular-nums text-madder">{formatINR(summary.bucket90Plus)}</p></div>
          </div>
        </div>
      )}

      {/* Ledger */}
      <h2 className="font-display text-xl text-kohl mb-3">Transaction history</h2>
      {ledger.length === 0 ? (
        <p className="text-mitti text-sm">No invoices or payments yet.</p>
      ) : (
        <div className="bg-ivory border border-mitti/20 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-beige/30 text-banarasi text-xs">
              <tr>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Description</th>
                <th className="text-right p-3">Debit</th>
                <th className="text-right p-3">Credit</th>
                <th className="text-right p-3">Balance</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((e, i) => (
                <tr key={i} className="border-t border-mitti/10 hover:bg-beige/20">
                  <td className="p-3 text-xs whitespace-nowrap">
                    {new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </td>
                  <td className="p-3">
                    <span className={`inline-block px-2 py-0.5 text-[10px] tracking-widest ${
                      e.type === 'INVOICE' ? 'bg-banarasi/15 text-banarasi' :
                      e.type === 'PAYMENT' ? 'bg-emerald-100 text-emerald-800' :
                                             'bg-madder/15 text-madder'}`}>
                      {e.type}
                    </span>
                  </td>
                  <td className="p-3 text-xs">
                    {e.description}
                    {e.method && <span className="block text-[10px] text-mitti">{e.method}{e.reference ? ` · ${e.reference}` : ''}</span>}
                  </td>
                  <td className="p-3 text-right tabular-nums text-kohl">
                    {e.debitPaise > 0 ? formatINR(e.debitPaise) : '—'}
                  </td>
                  <td className="p-3 text-right tabular-nums text-emerald-700">
                    {e.creditPaise > 0 ? formatINR(e.creditPaise) : '—'}
                  </td>
                  <td className={`p-3 text-right tabular-nums ${e.runningBalancePaise > 0 ? 'text-madder' : e.runningBalancePaise < 0 ? 'text-emerald-700' : 'text-mitti/50'}`}>
                    {formatINR(e.runningBalancePaise)}
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

function Tile({ label, value, good, highlight }: { label: string; value: string; good?: boolean; highlight?: boolean }) {
  return (
    <div className="bg-ivory border border-mitti/20 p-3">
      <p className="label text-banarasi">{label}</p>
      <p className={`text-xl mt-1 tabular-nums ${good ? 'text-emerald-700' : highlight ? 'text-madder' : 'text-kohl'}`}>
        {value}
      </p>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="label text-banarasi mb-1">{label}</p>
      <input value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-ivory border border-mitti/30 px-3 py-1.5 text-sm focus:border-madder outline-none" />
    </div>
  );
}
