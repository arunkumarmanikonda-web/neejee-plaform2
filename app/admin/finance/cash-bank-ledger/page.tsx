// v23.40.21 — Cash / Bank Ledger: running balance per bank account.
// Reuses existing BankAccount + BankTransaction tables. Read-only view; for
// matching txns to bills/invoices use /admin/finance/bank-reconciliation.
'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Loader2, Download, Banknote, RefreshCw, Building, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { formatINR } from '@/lib/money';

interface BankAccount {
  id: string;
  nickname: string;
  bankName: string;
  accountNumber?: string | null;
  accountType?: string | null;
  active: boolean;
  openingBalancePaise: number;
  openingBalanceDate?: string | null;
  lastSyncedAt?: string | null;
}

interface BankTxn {
  id: string;
  txnDate: string;
  description: string;
  reference?: string | null;
  debitPaise: number;
  creditPaise: number;
  balancePaise?: number | null;
  status: string;
  source: string;
}

const STATUS_LABEL: Record<string, string> = {
  UNMATCHED: 'Unmatched',
  AUTO_MATCHED: 'Auto-matched',
  MANUAL_MATCHED: 'Matched',
  IGNORED: 'Ignored',
  DRAFT: 'Draft',
};

const STATUS_CLR: Record<string, string> = {
  UNMATCHED: 'bg-haldi/15 text-mitti',
  AUTO_MATCHED: 'bg-neem/15 text-neem',
  MANUAL_MATCHED: 'bg-neem/15 text-neem',
  IGNORED: 'bg-mitti/10 text-mitti',
  DRAFT: 'bg-mitti/10 text-mitti',
};

export default function CashBankLedgerPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [txns, setTxns] = useState<BankTxn[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingTxns, setLoadingTxns] = useState(false);
  const [error, setError] = useState('');

  const today = new Date().toISOString().slice(0, 10);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(ninetyDaysAgo);
  const [to, setTo] = useState(today);

  // Load accounts
  useEffect(() => {
    fetch('/api/admin/finance/bank-accounts')
      .then(r => r.json())
      .then(d => {
        const list = (d.accounts || []) as BankAccount[];
        setAccounts(list);
        if (list.length > 0 && !selectedId) setSelectedId(list[0].id);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoadingAccounts(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load txns for selected account
  useEffect(() => {
    if (!selectedId) return;
    setLoadingTxns(true); setError('');
    fetch(`/api/admin/finance/bank-accounts/${selectedId}/transactions?limit=1000`)
      .then(r => r.json())
      .then(d => setTxns(d.transactions || []))
      .catch(e => setError(e.message))
      .finally(() => setLoadingTxns(false));
  }, [selectedId]);

  const account = accounts.find(a => a.id === selectedId);

  // Filter by date range + sort ascending for running balance calc
  const filtered = useMemo(() => {
    const fromMs = from ? new Date(from).getTime() : 0;
    const toMs = to ? new Date(to + 'T23:59:59').getTime() : Infinity;
    return txns
      .filter(t => {
        const tm = new Date(t.txnDate).getTime();
        return tm >= fromMs && tm <= toMs;
      })
      .sort((a, b) => new Date(a.txnDate).getTime() - new Date(b.txnDate).getTime());
  }, [txns, from, to]);

  // Running balance — start from opening balance (paise), apply each txn in order
  const ledgerRows = useMemo(() => {
    let running = account?.openingBalancePaise || 0;
    return filtered.map(t => {
      running = running + (t.creditPaise || 0) - (t.debitPaise || 0);
      return { ...t, runningBalancePaise: running };
    });
  }, [filtered, account]);

  // Reverse for display (newest first)
  const displayRows = useMemo(() => [...ledgerRows].reverse(), [ledgerRows]);

  const totals = useMemo(() => {
    const credit = filtered.reduce((s, t) => s + (t.creditPaise || 0), 0);
    const debit = filtered.reduce((s, t) => s + (t.debitPaise || 0), 0);
    return {
      credit, debit,
      net: credit - debit,
      opening: account?.openingBalancePaise || 0,
      closing: ledgerRows.length > 0 ? ledgerRows[ledgerRows.length - 1].runningBalancePaise : (account?.openingBalancePaise || 0),
    };
  }, [filtered, ledgerRows, account]);

  const exportCsv = () => {
    if (!account) return;
    const header = ['Date', 'Description', 'Reference', 'Debit (INR)', 'Credit (INR)', 'Running Balance (INR)', 'Status', 'Source'];
    const lines = [header.join(',')];
    // Export in chronological order (oldest first) so balance flows correctly
    ledgerRows.forEach(r => {
      const fields = [
        new Date(r.txnDate).toISOString().slice(0, 10),
        `"${(r.description || '').replace(/"/g, '""')}"`,
        `"${(r.reference || '').replace(/"/g, '""')}"`,
        (r.debitPaise / 100).toFixed(2),
        (r.creditPaise / 100).toFixed(2),
        (r.runningBalancePaise / 100).toFixed(2),
        STATUS_LABEL[r.status] || r.status,
        r.source || '',
      ];
      lines.push(fields.join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cash-bank-ledger_${account.nickname.replace(/\s+/g, '_')}_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="label text-madder">FINANCE / LEDGERS</p>
          <h1 className="font-display text-4xl text-kohl mt-2">Cash / Bank Ledger</h1>
          <p className="font-italic italic text-mitti mt-2">Running balance per bank account — every credit, debit, and statement row.</p>
        </div>
        <Link href="/admin/finance/ledgers" className="text-xs tracking-wider text-mitti hover:text-madder">
          ← BACK TO LEDGERS HUB
        </Link>
      </div>
      <div className="madder-divider mt-4"></div>

      {error && <p className="mt-6 text-sm text-madder bg-madder/10 p-3">{error}</p>}

      {loadingAccounts ? (
        <p className="mt-8 text-mitti inline-flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading bank accounts…
        </p>
      ) : accounts.length === 0 ? (
        <div className="mt-8 text-center py-16 border border-dashed border-mitti/30">
          <Banknote className="w-10 h-10 text-mitti/40 mx-auto mb-4" />
          <p className="font-display text-2xl text-kohl">No bank accounts yet</p>
          <p className="text-sm text-mitti mt-2">
            Add a bank account in{' '}
            <Link href="/admin/finance/bank-reconciliation" className="text-madder underline">
              Bank Reconciliation
            </Link>{' '}
            to start tracking transactions.
          </p>
        </div>
      ) : (
        <>
          {/* Account picker */}
          <div className="flex flex-wrap gap-2 mt-6">
            {accounts.map(a => (
              <button
                key={a.id}
                onClick={() => setSelectedId(a.id)}
                className={`px-4 py-2 text-xs tracking-wider transition-colors inline-flex items-center gap-2 ${
                  selectedId === a.id ? 'bg-kohl text-ivory' : 'bg-beige text-kohl hover:bg-mitti/10'
                }`}
              >
                <Building className="w-3 h-3" />
                {a.nickname}
                {a.accountNumber && <span className="opacity-60">·{a.accountNumber.slice(-4)}</span>}
                {!a.active && <span className="text-[10px] opacity-60">[INACTIVE]</span>}
              </button>
            ))}
          </div>

          {/* Filters + export */}
          <div className="mt-6 flex flex-wrap items-end gap-3 bg-beige p-4 border border-mitti/15">
            <div>
              <label className="label text-mitti">FROM</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                className="block w-44 px-3 py-2 bg-ivory border border-mitti/20 text-sm mt-1" />
            </div>
            <div>
              <label className="label text-mitti">TO</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                className="block w-44 px-3 py-2 bg-ivory border border-mitti/20 text-sm mt-1" />
            </div>
            <div className="flex-1" />
            <button onClick={exportCsv} disabled={ledgerRows.length === 0}
              className="px-3 py-2 border border-mitti/30 text-mitti text-xs uppercase tracking-wider hover:bg-mitti/10 inline-flex items-center gap-2 disabled:opacity-50">
              <Download className="w-3 h-3" /> Export CSV
            </button>
            <Link href="/admin/finance/bank-reconciliation" className="px-3 py-2 bg-madder text-ivory text-xs uppercase tracking-wider hover:opacity-90 inline-flex items-center gap-2">
              <RefreshCw className="w-3 h-3" /> Bank reconciliation
            </Link>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
            <SumCard label="Opening" amountPaise={totals.opening} kind="info" />
            <SumCard label="Total Credits" amountPaise={totals.credit} kind="good" />
            <SumCard label="Total Debits" amountPaise={totals.debit} kind="warn" />
            <SumCard label="Net Change" amountPaise={totals.net} kind={totals.net >= 0 ? 'good' : 'warn'} />
            <SumCard label="Closing" amountPaise={totals.closing} kind="info" strong />
          </div>

          {/* Ledger table */}
          <div className="mt-8 bg-beige border border-mitti/15 overflow-x-auto">
            <table className="w-full font-ui text-sm">
              <thead>
                <tr className="border-b border-mitti/20 text-left text-xs tracking-widest text-mitti">
                  <th className="p-3">DATE</th>
                  <th className="p-3">DESCRIPTION</th>
                  <th className="p-3 text-right">DEBIT</th>
                  <th className="p-3 text-right">CREDIT</th>
                  <th className="p-3 text-right">BALANCE</th>
                  <th className="p-3">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {loadingTxns && (
                  <tr><td colSpan={6} className="p-8 text-center text-mitti">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading…
                  </td></tr>
                )}
                {!loadingTxns && displayRows.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-mitti italic">No transactions in this date range</td></tr>
                )}
                {displayRows.map(r => (
                  <tr key={r.id} className="border-b border-mitti/10 hover:bg-ivory/50">
                    <td className="p-3 text-xs text-mitti whitespace-nowrap">
                      {new Date(r.txnDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </td>
                    <td className="p-3 text-kohl">
                      <p>{r.description}</p>
                      {r.reference && <p className="text-[11px] text-mitti font-mono mt-0.5">Ref: {r.reference}</p>}
                    </td>
                    <td className="p-3 text-right">
                      {r.debitPaise > 0 ? (
                        <span className="text-madder inline-flex items-center gap-1 justify-end">
                          <ArrowUpRight className="w-3 h-3" />{formatINR(r.debitPaise)}
                        </span>
                      ) : <span className="text-mitti/30">—</span>}
                    </td>
                    <td className="p-3 text-right">
                      {r.creditPaise > 0 ? (
                        <span className="text-neem inline-flex items-center gap-1 justify-end">
                          <ArrowDownLeft className="w-3 h-3" />{formatINR(r.creditPaise)}
                        </span>
                      ) : <span className="text-mitti/30">—</span>}
                    </td>
                    <td className="p-3 text-right font-medium">{formatINR(r.runningBalancePaise)}</td>
                    <td className="p-3">
                      <span className={`text-[10px] tracking-wider uppercase px-2 py-1 ${STATUS_CLR[r.status] || 'bg-mitti/10 text-mitti'}`}>
                        {STATUS_LABEL[r.status] || r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {account && (
            <p className="mt-4 text-xs text-mitti italic">
              Opening balance of <strong>{formatINR(account.openingBalancePaise)}</strong>
              {account.openingBalanceDate && <> as of {new Date(account.openingBalanceDate).toLocaleDateString('en-IN')}</>}.
              {account.lastSyncedAt && <> Last synced {new Date(account.lastSyncedAt).toLocaleString('en-IN')}.</>}
            </p>
          )}
        </>
      )}
    </>
  );
}

function SumCard({
  label, amountPaise, kind = 'info', strong = false,
}: { label: string; amountPaise: number; kind?: 'good' | 'warn' | 'info'; strong?: boolean }) {
  const color = kind === 'good' ? 'text-neem' : kind === 'warn' ? 'text-madder' : 'text-kohl';
  return (
    <div className={`bg-beige border ${strong ? 'border-madder' : 'border-mitti/15'} p-4`}>
      <p className="label text-mitti">{label}</p>
      <p className={`font-display text-xl mt-1 ${color}`}>{formatINR(amountPaise)}</p>
    </div>
  );
}
