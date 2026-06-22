'use client';
// v23.40.3 — Trial Balance: debits / credits per account, counterparty, and bank account.
import { useEffect, useState } from 'react';
import { Download, Loader2, Building2 } from 'lucide-react';
import { formatINR } from '@/lib/money';

export default function TrialBalancePage() {
  const startOfYear = `${new Date().getFullYear()}-01-01`;
  const today = new Date().toISOString().slice(0, 10);

  const [from, setFrom] = useState(startOfYear);
  const [to,   setTo]   = useState(today);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const url = new URL('/api/admin/finance/trial-balance', window.location.origin);
    url.searchParams.set('from', from);
    url.searchParams.set('to', to);
    const r = await fetch(url.toString());
    const d = await r.json();
    setData(d);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  function exportCsv() {
    if (!data) return;
    const lines: string[] = [];
    lines.push('TRIAL BALANCE,' + from + ' to ' + to);
    lines.push('');
    lines.push('ACCOUNTS (BY CATEGORY)');
    lines.push('Code,Account,Group,Entries,Debit,Credit,Balance (Dr−Cr)');
    for (const a of data.accounts as any[]) {
      lines.push([
        a.code, `"${a.label}"`, a.group, a.entryCount,
        (a.debit / 100).toFixed(2), (a.credit / 100).toFixed(2), (a.balance / 100).toFixed(2),
      ].join(','));
    }
    lines.push('');
    lines.push('COUNTERPARTIES (VENDORS / PAYEES)');
    lines.push('Counterparty,Entries,Debit,Credit,Balance (we owe)');
    for (const p of data.parties as any[]) {
      lines.push([
        `"${p.name.replace(/"/g, '""')}"`, p.entryCount,
        (p.debit / 100).toFixed(2), (p.credit / 100).toFixed(2), (p.balance / 100).toFixed(2),
      ].join(','));
    }
    lines.push('');
    lines.push('BANK ACCOUNTS');
    lines.push('Account,Opening,Credits (in),Debits (out),Closing');
    for (const b of data.banks as any[]) {
      lines.push([
        `"${b.label.replace(/"/g, '""')}"`,
        (b.openingBalancePaise / 100).toFixed(2),
        (b.credits / 100).toFixed(2),
        (b.debits / 100).toFixed(2),
        (b.closingBalancePaise / 100).toFixed(2),
      ].join(','));
    }
    lines.push('');
    lines.push(`TOTAL DEBITS,${(data.totals.totalDebitsPaise  / 100).toFixed(2)}`);
    lines.push(`TOTAL CREDITS,${(data.totals.totalCreditsPaise / 100).toFixed(2)}`);
    lines.push(`OUTSTANDING (Dr − Cr),${(data.totals.differencePaise / 100).toFixed(2)}`);

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `trial-balance-${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl text-kohl">Trial Balance</h1>
          <p className="text-mitti text-sm mt-1">
            Account-wise debits and credits for the selected period. Use this for monthly close and reconciliation.
          </p>
        </div>
        <button onClick={exportCsv} disabled={!data}
          className="flex items-center gap-1 px-3 py-2 border border-kohl text-kohl text-xs tracking-widest hover:bg-kohl hover:text-ivory disabled:opacity-50">
          <Download className="w-3 h-3" /> EXPORT CSV
        </button>
      </div>

      {/* Date filter */}
      <div className="bg-ivory border border-mitti/20 p-4 mb-4 flex items-end gap-3 flex-wrap">
        <div>
          <p className="label text-banarasi mb-1">FROM</p>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
        </div>
        <div>
          <p className="label text-banarasi mb-1">TO</p>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
        </div>
        <button onClick={load} disabled={loading}
          className="px-4 py-2 bg-kohl text-ivory text-xs tracking-widest disabled:opacity-50">
          {loading ? 'LOADING…' : 'GENERATE'}
        </button>
        <div className="flex gap-1 ml-auto">
          {[
            { l: 'This month', from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10), to: today },
            { l: 'Last month', from: new Date(new Date().getFullYear(), new Date().getMonth()-1, 1).toISOString().slice(0,10), to: new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().slice(0,10) },
            { l: 'FY-to-date', from: startOfYear, to: today },
          ].map(p => (
            <button key={p.l} onClick={() => { setFrom(p.from); setTo(p.to); setTimeout(load, 0); }}
              className="px-2 py-1 text-[10px] tracking-widest border border-mitti/30 text-mitti hover:bg-beige/50">
              {p.l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {loading || !data ? (
        <div className="flex items-center justify-center py-12 text-mitti">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Computing…
        </div>
      ) : (
        <>
          {/* Grand totals */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            <Tile label="Total debits"   value={formatINR(data.totals.totalDebitsPaise)}  variant="dr" />
            <Tile label="Total credits"  value={formatINR(data.totals.totalCreditsPaise)} variant="cr" />
            <Tile label="Net outstanding (Dr − Cr)" value={formatINR(data.totals.differencePaise)}
              variant={data.totals.differencePaise === 0 ? 'ok' : 'warn'} />
          </div>

          {/* Accounts */}
          <Section title="Accounts (by expense category)">
            {data.accounts.length === 0 ? (
              <Empty />
            ) : (
              <table className="w-full font-ui text-sm">
                <thead className="bg-beige/60 text-mitti text-xs label">
                  <tr>
                    <th className="text-left p-3">CODE</th>
                    <th className="text-left p-3">ACCOUNT</th>
                    <th className="text-left p-3">GROUP</th>
                    <th className="text-right p-3">ENTRIES</th>
                    <th className="text-right p-3">DEBIT</th>
                    <th className="text-right p-3">CREDIT</th>
                    <th className="text-right p-3">BALANCE</th>
                  </tr>
                </thead>
                <tbody>
                  {data.accounts.map((a: any) => (
                    <tr key={a.id} className="border-t border-mitti/10 hover:bg-beige/30">
                      <td className="p-3 text-mitti font-mono text-xs">{a.code}</td>
                      <td className="p-3 text-kohl">{a.label}</td>
                      <td className="p-3 text-mitti text-xs">{a.group.replace('OPEX_', '').replace('_', ' ')}</td>
                      <td className="p-3 text-right text-mitti text-xs">{a.entryCount}</td>
                      <td className="p-3 text-right tabular-nums text-madder">{a.debit  ? formatINR(a.debit)  : '—'}</td>
                      <td className="p-3 text-right tabular-nums text-emerald-700">{a.credit ? formatINR(a.credit) : '—'}</td>
                      <td className={`p-3 text-right tabular-nums font-medium ${a.balance > 0 ? 'text-madder' : a.balance < 0 ? 'text-emerald-700' : 'text-mitti'}`}>
                        {a.balance !== 0 ? formatINR(a.balance) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* Counterparties */}
          <Section title="Counterparties (vendors / payees)">
            {data.parties.length === 0 ? (
              <Empty />
            ) : (
              <table className="w-full font-ui text-sm">
                <thead className="bg-beige/60 text-mitti text-xs label">
                  <tr>
                    <th className="text-left p-3">COUNTERPARTY</th>
                    <th className="text-right p-3">ENTRIES</th>
                    <th className="text-right p-3">DEBIT</th>
                    <th className="text-right p-3">CREDIT</th>
                    <th className="text-right p-3">BALANCE (WE OWE)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.parties.map((p: any) => (
                    <tr key={p.name} className="border-t border-mitti/10 hover:bg-beige/30">
                      <td className="p-3 text-kohl">{p.name}</td>
                      <td className="p-3 text-right text-mitti text-xs">{p.entryCount}</td>
                      <td className="p-3 text-right tabular-nums text-madder">{p.debit  ? formatINR(p.debit)  : '—'}</td>
                      <td className="p-3 text-right tabular-nums text-emerald-700">{p.credit ? formatINR(p.credit) : '—'}</td>
                      <td className={`p-3 text-right tabular-nums font-medium ${p.balance > 0 ? 'text-madder' : 'text-mitti'}`}>
                        {p.balance !== 0 ? formatINR(p.balance) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* Bank accounts */}
          <Section title="Bank accounts (cash position)">
            {data.banks.length === 0 ? (
              <Empty msg="No bank accounts configured. Set one up under Bank Reco." />
            ) : (
              <table className="w-full font-ui text-sm">
                <thead className="bg-beige/60 text-mitti text-xs label">
                  <tr>
                    <th className="text-left p-3">ACCOUNT</th>
                    <th className="text-right p-3">OPENING</th>
                    <th className="text-right p-3">CREDITS (IN)</th>
                    <th className="text-right p-3">DEBITS (OUT)</th>
                    <th className="text-right p-3">CLOSING</th>
                  </tr>
                </thead>
                <tbody>
                  {data.banks.map((b: any) => (
                    <tr key={b.id} className="border-t border-mitti/10 hover:bg-beige/30">
                      <td className="p-3 text-kohl flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-mitti" /> {b.label}
                      </td>
                      <td className="p-3 text-right tabular-nums">{formatINR(b.openingBalancePaise)}</td>
                      <td className="p-3 text-right tabular-nums text-emerald-700">{formatINR(b.credits)}</td>
                      <td className="p-3 text-right tabular-nums text-madder">{formatINR(b.debits)}</td>
                      <td className={`p-3 text-right tabular-nums font-medium ${b.closingBalancePaise < 0 ? 'text-madder' : 'text-kohl'}`}>
                        {formatINR(b.closingBalancePaise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: any }) {
  return (
    <div className="mb-6">
      <h2 className="font-display text-xl text-kohl mb-2">{title}</h2>
      <div className="bg-ivory border border-mitti/20 overflow-x-auto">{children}</div>
    </div>
  );
}

function Empty({ msg }: { msg?: string }) {
  return <p className="p-6 text-mitti italic text-sm">{msg || 'No data in this period.'}</p>;
}

function Tile({ label, value, variant }: { label: string; value: string; variant: 'dr' | 'cr' | 'ok' | 'warn' }) {
  const cls =
    variant === 'dr'   ? 'bg-madder/10 border-madder/30 text-madder' :
    variant === 'cr'   ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
    variant === 'ok'   ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                         'bg-amber-50 border-amber-200 text-amber-800';
  return (
    <div className={`p-4 border ${cls}`}>
      <p className="label text-mitti text-[10px]">{label}</p>
      <p className="font-display text-xl mt-1">{value}</p>
    </div>
  );
}
