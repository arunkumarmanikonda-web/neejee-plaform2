'use client';
// v23.40.11 — Customer ledger index: every customer with AR totals + aging.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, AlertCircle, Users, ChevronRight, Download, UserPlus } from 'lucide-react';
import { formatINR } from '@/lib/money';

interface CustomerRow {
  id: string;
  displayName: string;
  legalName: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  gstin: string | null;
  customerType: string;
  channel: string;
  status: string;
  creditLimitPaise: number;
  creditDays: number;
  totalBilled: number;
  totalReceived: number;
  outstanding: number;
  invoiceCount: number;
  overdueCount: number;
  overduePaise: number;
  bucketCurrent: number;
  bucket1_30: number;
  bucket31_60: number;
  bucket61_90: number;
  bucket90Plus: number;
}

interface Summary {
  customerCount: number;
  totalBilled: number;
  totalReceived: number;
  totalOutstanding: number;
  totalOverdue: number;
  bucketCurrent: number;
  bucket1_30: number;
  bucket31_60: number;
  bucket61_90: number;
  bucket90Plus: number;
}

export default function CustomerLedgerIndexPage() {
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [type, setType] = useState('');

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (type) params.set('type', type);
    const r = await fetch(`/api/admin/finance/customer-ledger?${params}`);
    const d = await r.json();
    setRows(d.customers || []);
    setSummary(d.summary || null);
    setLoading(false);
  };
  useEffect(() => { load(); }, [type]);

  const exportCsv = () => {
    const header = ['Name', 'Type', 'Phone', 'Email', 'GSTIN', 'Invoices', 'Billed', 'Received', 'Outstanding', 'Overdue', 'Current', '1-30', '31-60', '61-90', '90+'];
    const data = rows.map(r => [
      r.displayName, r.customerType, r.primaryPhone || '', r.primaryEmail || '', r.gstin || '',
      r.invoiceCount, r.totalBilled / 100, r.totalReceived / 100, r.outstanding / 100, r.overduePaise / 100,
      r.bucketCurrent / 100, r.bucket1_30 / 100, r.bucket31_60 / 100, r.bucket61_90 / 100, r.bucket90Plus / 100,
    ]);
    const csv = [header, ...data].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `customer-ledger-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-kohl flex items-center gap-2">
            <Users className="w-6 h-6 text-madder" /> Customer ledgers
          </h1>
          <p className="text-mitti text-sm mt-1">
            Every customer with billed, received, outstanding, and AR aging buckets.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/finance/customer-ledger/new"
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-kohl text-ivory text-xs tracking-widest hover:bg-madder">
            <UserPlus className="w-3 h-3" /> NEW CUSTOMER
          </Link>
          <button onClick={exportCsv}
            className="inline-flex items-center gap-1 px-3 py-1.5 border border-kohl text-kohl text-xs tracking-widest hover:bg-kohl hover:text-ivory">
            <Download className="w-3 h-3" /> EXPORT CSV
          </button>
        </div>
      </div>

      {/* Summary tiles */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <Tile label="Customers" value={String(summary.customerCount)} />
          <Tile label="Total billed" value={formatINR(summary.totalBilled)} />
          <Tile label="Received" value={formatINR(summary.totalReceived)} good />
          <Tile label="Outstanding" value={formatINR(summary.totalOutstanding)} highlight={summary.totalOutstanding > 0} />
          <Tile label="Overdue" value={formatINR(summary.totalOverdue)} highlight={summary.totalOverdue > 0} />
        </div>
      )}

      {/* AR Aging tiles */}
      {summary && summary.totalOutstanding > 0 && (
        <div className="bg-ivory border border-mitti/20 p-4 mb-6">
          <p className="label text-banarasi mb-2">AR aging</p>
          <div className="grid grid-cols-5 gap-3">
            <AgingTile label="Current"   value={summary.bucketCurrent} />
            <AgingTile label="1 – 30"    value={summary.bucket1_30}    warn={summary.bucket1_30 > 0} />
            <AgingTile label="31 – 60"   value={summary.bucket31_60}   warn={summary.bucket31_60 > 0} />
            <AgingTile label="61 – 90"   value={summary.bucket61_90}   warn={summary.bucket61_90 > 0} />
            <AgingTile label="90+ days"  value={summary.bucket90Plus}  bad={summary.bucket90Plus > 0} />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-mitti/60" />
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()}
            placeholder="Search by name, phone, email, GSTIN…"
            className="w-full bg-ivory border border-mitti/30 px-7 py-1.5 text-sm focus:border-madder outline-none" />
        </div>
        <select value={type} onChange={e => setType(e.target.value)}
          className="bg-ivory border border-mitti/30 px-3 py-1.5 text-sm">
          <option value="">All types</option>
          <option value="INDIVIDUAL">Individual</option>
          <option value="B2B">B2B</option>
          <option value="WHOLESALE">Wholesale</option>
          <option value="INTERNAL">Internal</option>
        </select>
        <button onClick={load}
          className="px-3 py-1.5 border border-kohl text-kohl text-xs tracking-widest hover:bg-kohl hover:text-ivory">
          SEARCH
        </button>
      </div>

      {loading ? (
        <p className="text-mitti">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-mitti">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No customers match the filter.
        </div>
      ) : (
        <div className="bg-ivory border border-mitti/20 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-beige/30 text-banarasi text-xs">
              <tr>
                <th className="text-left p-3">Customer</th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Contact</th>
                <th className="text-right p-3">Invoices</th>
                <th className="text-right p-3">Billed</th>
                <th className="text-right p-3">Received</th>
                <th className="text-right p-3">Outstanding</th>
                <th className="text-right p-3">Overdue</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-mitti/10 hover:bg-beige/20">
                  <td className="p-3 text-kohl">
                    {r.displayName}
                    {r.gstin && <span className="block text-[10px] text-mitti">{r.gstin}</span>}
                  </td>
                  <td className="p-3 text-xs">
                    <span className="inline-block px-2 py-0.5 bg-mitti/10 text-kohl tracking-widest">
                      {r.customerType}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-mitti">
                    {r.primaryPhone || r.primaryEmail || '—'}
                  </td>
                  <td className="p-3 text-right tabular-nums">{r.invoiceCount}</td>
                  <td className="p-3 text-right tabular-nums text-kohl">{formatINR(r.totalBilled)}</td>
                  <td className="p-3 text-right tabular-nums text-emerald-700">{formatINR(r.totalReceived)}</td>
                  <td className={`p-3 text-right tabular-nums ${r.outstanding > 0 ? 'text-madder font-medium' : 'text-mitti/40'}`}>
                    {formatINR(r.outstanding)}
                  </td>
                  <td className={`p-3 text-right tabular-nums ${r.overduePaise > 0 ? 'text-madder' : 'text-mitti/40'}`}>
                    {formatINR(r.overduePaise)}
                  </td>
                  <td className="p-3 text-right">
                    <Link href={`/admin/finance/customer-ledger/${r.id}`}
                      className="inline-flex items-center gap-1 text-xs text-banarasi hover:text-madder">
                      OPEN <ChevronRight className="w-3 h-3" />
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

function AgingTile({ label, value, warn, bad }: { label: string; value: number; warn?: boolean; bad?: boolean }) {
  return (
    <div className="bg-beige/30 p-2">
      <p className="text-[10px] uppercase tracking-widest text-mitti">{label}</p>
      <p className={`text-base mt-0.5 tabular-nums ${bad ? 'text-madder font-medium' : warn ? 'text-amber-700' : 'text-kohl'}`}>
        {formatINR(value)}
      </p>
    </div>
  );
}
