'use client';
// v23.40.3 — Vendor ledger index: every vendor with billed/expensed/paid/outstanding totals.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, AlertCircle, FileText, ChevronRight, Download, Wrench } from 'lucide-react';
import { formatINR } from '@/lib/money';

interface Row {
  id: string;
  displayName: string;
  legalName: string;
  contactEmail: string;
  contactPhone: string | null;
  gstin: string | null;
  status: string;
  serviceCategoryGroup: string | null;
  billCount: number;
  expenseCount: number;
  totalBilledPaise: number;
  totalExpensedPaise: number;
  totalPaidPaise: number;
  outstandingPaise: number;
  overdueBills: number;
}

const GROUP_LABEL: Record<string, string> = {
  COGS_DIRECT:        'Product Supplier',
  OPEX_MARKETING:     'Marketing',
  OPEX_COMMUNICATION: 'Communication',
  OPEX_SHIPPING:      'Logistics',
  OPEX_PAYMENT:       'Payment',
  OPEX_PLATFORM:      'Platform / SaaS',
  OPEX_PEOPLE:        'People',
  OPEX_OFFICE:        'Office',
  OPEX_PROFESSIONAL:  'Professional',
  OPEX_TAX_OTHER:     'Tax / Statutory',
  OPEX_OTHER:         'Other',
  WRITE_OFF:          'Write-offs',
  UNCATEGORISED:      'Uncategorised',
};

function labelOf(group: string | null): string {
  if (!group) return GROUP_LABEL.UNCATEGORISED;
  return GROUP_LABEL[group] || group.replace('OPEX_', '').replace('_', ' ');
}

export default function VendorLedgerIndexPage() {
  const [vendors, setVendors] = useState<Row[]>([]);
  const [totals, setTotals] = useState<any>(null);
  const [byCategory, setByCategory] = useState<Record<string, any>>({});
  const [q, setQ] = useState('');
  const [onlyOutstanding, setOnlyOutstanding] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const url = new URL('/api/admin/finance/vendor-ledger', window.location.origin);
    if (q)               url.searchParams.set('q', q);
    if (onlyOutstanding) url.searchParams.set('outstanding', '1');
    if (categoryFilter)  url.searchParams.set('categoryGroup', categoryFilter);
    const r = await fetch(url.toString());
    const d = await r.json();
    setVendors(d.vendors || []);
    setTotals(d.totals || null);
    setByCategory(d.byCategory || {});
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [onlyOutstanding, categoryFilter]);

  function exportCsv() {
    const header = ['Vendor','GSTIN','Status','Bills','Expenses','Total Billed','Total Expensed','Total Paid','Outstanding','Overdue Bills'];
    const lines = [header.join(',')];
    for (const v of vendors) {
      lines.push([
        `"${v.displayName.replace(/"/g, '""')}"`,
        v.gstin || '',
        v.status,
        v.billCount,
        v.expenseCount,
        (v.totalBilledPaise / 100).toFixed(2),
        (v.totalExpensedPaise / 100).toFixed(2),
        (v.totalPaidPaise / 100).toFixed(2),
        (v.outstandingPaise / 100).toFixed(2),
        v.overdueBills,
      ].join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `vendor-ledgers-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl text-kohl">Vendor Ledgers</h1>
          <p className="text-mitti text-sm mt-1">
            Counterparty-wise outstanding across Bills (AP), Expenses, and their payments.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/finance/backfill"
            className="flex items-center gap-1 px-3 py-2 border border-amber-700 text-amber-700 text-xs tracking-widest hover:bg-amber-700 hover:text-ivory"
            title="Link legacy expenses/bills that have a vendor name but no vendor ID">
            <Wrench className="w-3 h-3" /> BACKFILL ORPHANS
          </Link>
          <button onClick={exportCsv}
            className="flex items-center gap-1 px-3 py-2 border border-kohl text-kohl text-xs tracking-widest hover:bg-kohl hover:text-ivory">
            <Download className="w-3 h-3" /> EXPORT CSV
          </button>
        </div>
      </div>

      {/* Summary tiles */}
      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Tile label="Vendors" value={String(totals.vendorCount)} />
          <Tile label="Total billed"   value={formatINR(totals.totalBilledPaise)} />
          <Tile label="Total expensed" value={formatINR(totals.totalExpensedPaise)} />
          <Tile label="Outstanding"    value={formatINR(totals.outstandingPaise)}
            highlight={totals.outstandingPaise > 0} />
        </div>
      )}

      {/* Category breakdown chips */}
      {Object.keys(byCategory).length > 0 && (
        <div className="bg-ivory border border-mitti/20 p-4 mb-4">
          <p className="label text-mitti text-[10px] mb-2">VENDORS BY SERVICE CATEGORY</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setCategoryFilter('')}
              className={`px-3 py-1.5 text-[10px] tracking-widest border ${categoryFilter === '' ? 'bg-kohl text-ivory border-kohl' : 'bg-ivory text-mitti border-mitti/30'}`}>
              ALL ({totals?.vendorCount || 0})
            </button>
            {Object.entries(byCategory).sort((a: any, b: any) => b[1].spentPaise - a[1].spentPaise).map(([g, s]: any) => (
              <button key={g} onClick={() => setCategoryFilter(g === 'UNCATEGORISED' ? 'UNCATEGORISED' : g)}
                className={`px-3 py-1.5 text-[10px] tracking-widest border ${categoryFilter === g ? 'bg-kohl text-ivory border-kohl' : 'bg-ivory text-mitti border-mitti/30'}`}>
                {labelOf(g).toUpperCase()} ({s.count})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search + filter */}
      <div className="bg-ivory border border-mitti/20 p-4 mb-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-mitti mr-2" />
          <input value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') load(); }}
            placeholder="Search by vendor name, email, or GSTIN…"
            className="flex-1 border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
          <button onClick={load} className="ml-2 px-3 py-2 bg-kohl text-ivory text-xs tracking-widest">SEARCH</button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyOutstanding} onChange={e => setOnlyOutstanding(e.target.checked)} />
          <span>Outstanding only</span>
        </label>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-mitti italic">Loading…</p>
      ) : vendors.length === 0 ? (
        <div className="bg-ivory border border-mitti/20 p-12 text-center text-mitti">
          No vendors {onlyOutstanding ? 'with outstanding amounts' : 'found'}.
        </div>
      ) : (
        <div className="bg-ivory border border-mitti/20 overflow-hidden">
          <table className="w-full font-ui text-sm">
            <thead className="bg-beige/60 text-mitti text-xs label">
              <tr>
                <th className="text-left p-3">VENDOR</th>
                <th className="text-left p-3">CATEGORY</th>
                <th className="text-left p-3">GSTIN</th>
                <th className="text-right p-3">BILLS / EXP</th>
                <th className="text-right p-3">BILLED</th>
                <th className="text-right p-3">EXPENSED</th>
                <th className="text-right p-3">PAID</th>
                <th className="text-right p-3">OUTSTANDING</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {vendors.map(v => (
                <tr key={v.id} className="border-t border-mitti/10 hover:bg-beige/30">
                  <td className="p-3">
                    <Link href={`/admin/finance/vendor-ledger/${v.id}`} className="text-kohl hover:text-madder font-medium">
                      {v.displayName}
                    </Link>
                    {v.contactEmail && <p className="text-[10px] text-mitti">{v.contactEmail}</p>}
                    {v.overdueBills > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-madder mt-1">
                        <AlertCircle className="w-3 h-3" /> {v.overdueBills} overdue
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    {v.serviceCategoryGroup ? (
                      <span className="inline-block px-2 py-0.5 text-[10px] tracking-widest bg-beige text-mitti">
                        {labelOf(v.serviceCategoryGroup)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-mitti/60 italic">Uncategorised</span>
                    )}
                  </td>
                  <td className="p-3 text-mitti font-mono text-xs">{v.gstin || '—'}</td>
                  <td className="p-3 text-right text-mitti text-xs">
                    {v.billCount} / {v.expenseCount}
                  </td>
                  <td className="p-3 text-right tabular-nums">{v.totalBilledPaise ? formatINR(v.totalBilledPaise) : '—'}</td>
                  <td className="p-3 text-right tabular-nums">{v.totalExpensedPaise ? formatINR(v.totalExpensedPaise) : '—'}</td>
                  <td className="p-3 text-right tabular-nums text-emerald-700">{v.totalPaidPaise ? formatINR(v.totalPaidPaise) : '—'}</td>
                  <td className={`p-3 text-right tabular-nums font-medium ${v.outstandingPaise > 0 ? 'text-madder' : 'text-mitti'}`}>
                    {v.outstandingPaise !== 0 ? formatINR(v.outstandingPaise) : '—'}
                  </td>
                  <td className="p-3 text-right">
                    <Link href={`/admin/finance/vendor-ledger/${v.id}`} className="text-madder hover:underline inline-flex items-center text-xs">
                      LEDGER <ChevronRight className="w-3 h-3" />
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

function Tile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-4 ${highlight ? 'bg-madder/10 border border-madder/30' : 'bg-ivory border border-mitti/20'}`}>
      <p className="label text-mitti text-[10px]">{label}</p>
      <p className={`font-display text-xl mt-1 ${highlight ? 'text-madder' : 'text-kohl'}`}>{value}</p>
    </div>
  );
}
