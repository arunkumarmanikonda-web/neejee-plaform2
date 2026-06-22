'use client';
// v23.40.3 — General Ledger: unified journal of every financial transaction.
import { useEffect, useState } from 'react';
import { Filter, Download, Loader2, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { formatINR } from '@/lib/money';

interface Entry {
  date: string;
  type: 'BILL' | 'BILL_PAYMENT' | 'EXPENSE' | 'EXPENSE_PAYMENT' | 'BANK_TXN';
  refId: string;
  description: string;
  debitPaise: number;
  creditPaise: number;
  runningBalancePaise: number;
  account?: string | null;
  counterparty?: string | null;
  method?: string | null;
  reference?: string | null;
  receiptUrl?: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  BILL:            'Bill',
  BILL_PAYMENT:    'Bill payment',
  EXPENSE:         'Expense',
  EXPENSE_PAYMENT: 'Expense payment',
  BANK_TXN:        'Bank txn',
};
const TYPE_STYLE: Record<string, string> = {
  BILL:            'bg-madder/10 text-madder',
  BILL_PAYMENT:    'bg-emerald-100 text-emerald-800',
  EXPENSE:         'bg-madder/10 text-madder',
  EXPENSE_PAYMENT: 'bg-emerald-100 text-emerald-800',
  BANK_TXN:        'bg-banarasi/10 text-banarasi',
};

const ALL_TYPES = ['BILL', 'BILL_PAYMENT', 'EXPENSE', 'EXPENSE_PAYMENT', 'BANK_TXN'] as const;

export default function GeneralLedgerPage() {
  const startOfYear = `${new Date().getFullYear()}-01-01`;
  const today = new Date().toISOString().slice(0, 10);

  const [from, setFrom] = useState(startOfYear);
  const [to,   setTo]   = useState(today);
  const [types, setTypes] = useState<string[]>([...ALL_TYPES]);
  const [q, setQ] = useState('');
  const [ledger, setLedger] = useState<Entry[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  async function load() {
    setLoading(true);
    const url = new URL('/api/admin/finance/ledger', window.location.origin);
    url.searchParams.set('from', from);
    url.searchParams.set('to', to);
    if (types.length && types.length < ALL_TYPES.length) url.searchParams.set('accountType', types.join(','));
    if (q) url.searchParams.set('q', q);
    const r = await fetch(url.toString());
    const d = await r.json();
    setLedger(d.ledger || []);
    setSummary(d.summary || null);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  function toggleType(t: string) {
    setTypes(types.includes(t) ? types.filter(x => x !== t) : [...types, t]);
  }

  function exportCsv() {
    const header = ['Date','Type','Description','Account','Counterparty','Method','Reference','Debit','Credit','Running Balance'];
    const lines = [header.join(',')];
    for (const e of ledger) {
      lines.push([
        new Date(e.date).toISOString().slice(0, 10),
        TYPE_LABEL[e.type] || e.type,
        `"${(e.description || '').replace(/"/g, '""')}"`,
        `"${(e.account || '').replace(/"/g, '""')}"`,
        `"${(e.counterparty || '').replace(/"/g, '""')}"`,
        e.method || '',
        e.reference || '',
        (e.debitPaise  / 100).toFixed(2),
        (e.creditPaise / 100).toFixed(2),
        (e.runningBalancePaise / 100).toFixed(2),
      ].join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `general-ledger-${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl text-kohl">General Ledger</h1>
          <p className="text-mitti text-sm mt-1">
            Chronological journal of every booked transaction (Bills, Expenses, Payments, Bank movements).
          </p>
        </div>
        <button onClick={exportCsv} disabled={!ledger.length}
          className="flex items-center gap-1 px-3 py-2 border border-kohl text-kohl text-xs tracking-widest hover:bg-kohl hover:text-ivory disabled:opacity-50">
          <Download className="w-3 h-3" /> EXPORT CSV
        </button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Tile label="Entries"        value={String(summary.entryCount)} />
          <Tile label="Total debits"   value={formatINR(summary.totalDebitsPaise)}  highlight />
          <Tile label="Total credits"  value={formatINR(summary.totalCreditsPaise)} good />
          <Tile label="Net (Dr − Cr)"  value={formatINR(summary.netPaise)} />
        </div>
      )}

      {/* Filters */}
      <div className="bg-ivory border border-mitti/20 mb-4">
        <button onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between p-4 text-mitti hover:bg-beige/30">
          <span className="flex items-center gap-2 text-xs tracking-widest uppercase">
            <Filter className="w-3 h-3" /> Filters
          </span>
          {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showFilters && (
          <div className="p-4 border-t border-mitti/10 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <p className="label text-banarasi mb-1">FROM</p>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                  className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
              </div>
              <div>
                <p className="label text-banarasi mb-1">TO</p>
                <input type="date" value={to} onChange={e => setTo(e.target.value)}
                  className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
              </div>
              <div className="md:col-span-2">
                <p className="label text-banarasi mb-1">SEARCH DESCRIPTION</p>
                <input value={q} onChange={e => setQ(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') load(); }}
                  placeholder="Search by description, vendor name, narration…"
                  className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
              </div>
            </div>
            <div>
              <p className="label text-banarasi mb-1">ENTRY TYPES</p>
              <div className="flex flex-wrap gap-2">
                {ALL_TYPES.map(t => (
                  <button key={t} onClick={() => toggleType(t)}
                    className={`px-3 py-1.5 text-[10px] tracking-widest border ${
                      types.includes(t) ? 'bg-kohl text-ivory border-kohl' : 'bg-ivory text-mitti border-mitti/30'
                    }`}>
                    {TYPE_LABEL[t].toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={load} disabled={loading}
                className="px-4 py-2 bg-kohl text-ivory text-xs tracking-widest disabled:opacity-50">
                {loading ? 'LOADING…' : 'APPLY FILTERS'}
              </button>
              <button onClick={() => { setFrom(startOfYear); setTo(today); setTypes([...ALL_TYPES]); setQ(''); }}
                className="px-4 py-2 border border-mitti/30 text-mitti text-xs tracking-widest">
                RESET
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-mitti">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading ledger…
        </div>
      ) : ledger.length === 0 ? (
        <div className="bg-ivory border border-mitti/20 p-12 text-center text-mitti">
          No entries match the current filters.
        </div>
      ) : (
        <div className="bg-ivory border border-mitti/20 overflow-x-auto">
          <table className="w-full font-ui text-sm min-w-[1100px]">
            <thead className="bg-beige/60 text-mitti text-xs label">
              <tr>
                <th className="text-left p-3">DATE</th>
                <th className="text-left p-3">TYPE</th>
                <th className="text-left p-3">DESCRIPTION</th>
                <th className="text-left p-3">ACCOUNT / CATEGORY</th>
                <th className="text-left p-3">COUNTERPARTY</th>
                <th className="text-right p-3">DEBIT</th>
                <th className="text-right p-3">CREDIT</th>
                <th className="text-right p-3">RUNNING</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {ledger.map(e => (
                <tr key={`${e.type}-${e.refId}`} className="border-t border-mitti/10 hover:bg-beige/30">
                  <td className="p-3 text-mitti whitespace-nowrap">{new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                  <td className="p-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] tracking-widest ${TYPE_STYLE[e.type]}`}>
                      {TYPE_LABEL[e.type]}
                    </span>
                  </td>
                  <td className="p-3 text-kohl">
                    {e.description}
                    {e.reference && <span className="block text-[10px] text-mitti">Ref: {e.reference}</span>}
                    {e.method    && <span className="block text-[10px] text-mitti">via {e.method}</span>}
                  </td>
                  <td className="p-3 text-mitti text-xs">{e.account || '—'}</td>
                  <td className="p-3 text-mitti text-xs">{e.counterparty || '—'}</td>
                  <td className="p-3 text-right tabular-nums text-madder">{e.debitPaise ? formatINR(e.debitPaise) : '—'}</td>
                  <td className="p-3 text-right tabular-nums text-emerald-700">{e.creditPaise ? formatINR(e.creditPaise) : '—'}</td>
                  <td className={`p-3 text-right tabular-nums font-medium ${e.runningBalancePaise > 0 ? 'text-madder' : 'text-mitti'}`}>
                    {formatINR(e.runningBalancePaise)}
                  </td>
                  <td className="p-3">
                    {e.receiptUrl && (
                      <a href={e.receiptUrl} target="_blank" rel="noreferrer"
                        className="inline-flex items-center text-[10px] text-banarasi hover:underline">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
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

function Tile({ label, value, highlight, good }: { label: string; value: string; highlight?: boolean; good?: boolean }) {
  return (
    <div className={`p-4 ${
      highlight ? 'bg-madder/10 border border-madder/30' :
      good      ? 'bg-emerald-50 border border-emerald-200' :
                  'bg-ivory border border-mitti/20'
    }`}>
      <p className="label text-mitti text-[10px]">{label}</p>
      <p className={`font-display text-xl mt-1 ${
        highlight ? 'text-madder' :
        good      ? 'text-emerald-800' :
                    'text-kohl'
      }`}>{value}</p>
    </div>
  );
}
