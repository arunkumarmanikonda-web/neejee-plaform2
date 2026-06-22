'use client';
// v23.40.14 — Period Close + GSTR-3B helper UI.

import { useEffect, useState } from 'react';
import { Lock, Unlock, AlertTriangle, CheckCircle2, Loader2, FileDown, Calendar, ShieldCheck, RotateCcw } from 'lucide-react';
import { formatINR } from '@/lib/money';

interface LockRow { id: string; monthBucket: string; lockedAt: string; lockedByUserId: string; notes?: string | null; }
interface Issue   { code: string; severity: 'BLOCKER' | 'WARN'; count: number; message: string; }

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function previousMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function PeriodClosePage() {
  const [selectedMonth, setSelectedMonth] = useState<string>(previousMonth());
  const [locks, setLocks] = useState<LockRow[]>([]);
  const [check, setCheck] = useState<any>(null);
  const [gstr, setGstr]   = useState<any>(null);
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState('');
  const [msg, setMsg]     = useState('');

  const loadCheck = async () => {
    setBusy(true); setErr(''); setMsg('');
    try {
      const r = await fetch(`/api/admin/finance/period-close?check=${selectedMonth}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setLocks(d.locks || []);
      setCheck(d.check);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const loadGstr = async () => {
    try {
      const r = await fetch(`/api/admin/finance/gstr-3b?month=${selectedMonth}`);
      const d = await r.json();
      if (r.ok) setGstr(d);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadCheck(); loadGstr(); /* eslint-disable-next-line */ }, [selectedMonth]);

  const closePeriod = async (force = false) => {
    if (!confirm(`Lock ${selectedMonth}? After locking, no new entries can be posted to that month without an admin reopen.`)) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      const r = await fetch('/api/admin/finance/period-close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthBucket: selectedMonth, force }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg(`Period ${selectedMonth} locked.`);
      loadCheck();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const reopenPeriod = async (monthBucket: string) => {
    if (!confirm(`Reopen ${monthBucket}? This allows new entries again — make sure GSTR-3B has been filed.`)) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      const r = await fetch(`/api/admin/finance/period-close?monthBucket=${monthBucket}`, { method: 'DELETE' });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error);
      }
      setMsg(`Period ${monthBucket} reopened.`);
      loadCheck();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="font-display text-3xl text-kohl flex items-center gap-2">
        <Lock className="w-6 h-6 text-madder" /> Period close + GSTR-3B
      </h1>
      <p className="text-mitti text-sm mt-1">
        Lock a month after GST is filed so no further postings can change historical numbers. Run the pre-close check first.
      </p>

      {/* Month selector */}
      <div className="bg-ivory border border-mitti/20 p-4 mt-6 flex items-center gap-3">
        <Calendar className="w-4 h-4 text-mitti" />
        <label className="text-xs text-mitti uppercase tracking-widest">Month</label>
        <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
          className="bg-ivory border border-mitti/30 px-3 py-1.5 text-sm" />
        {check?.alreadyLocked && (
          <span className="ml-3 px-2 py-0.5 text-[10px] tracking-widest bg-emerald-100 text-emerald-800 inline-flex items-center gap-1">
            <Lock className="w-3 h-3" /> LOCKED
          </span>
        )}
      </div>

      {err && <div className="bg-madder/10 border border-madder/30 text-madder p-3 text-sm mt-4">{err}</div>}
      {msg && <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-3 text-sm mt-4">{msg}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Left: validation card */}
        <div className="bg-ivory border border-mitti/20 p-6">
          <h2 className="font-display text-xl text-kohl mb-3 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-banarasi" /> Pre-close validation
          </h2>
          {busy && !check ? (
            <p className="text-mitti text-sm flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Checking…</p>
          ) : !check ? (
            <p className="text-mitti text-sm">No data.</p>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                {check.canClose ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-100 text-emerald-800 text-xs tracking-widest">
                    <CheckCircle2 className="w-4 h-4" /> READY TO CLOSE
                  </span>
                ) : check.alreadyLocked ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-100 text-emerald-800 text-xs tracking-widest">
                    <Lock className="w-4 h-4" /> ALREADY LOCKED
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-madder/15 text-madder text-xs tracking-widest">
                    <AlertTriangle className="w-4 h-4" /> {check.blockerCount} BLOCKER(S)
                  </span>
                )}
                {check.warnCount > 0 && (
                  <span className="text-xs text-amber-700">{check.warnCount} warning(s)</span>
                )}
              </div>

              {check.issues.length === 0 ? (
                <p className="text-emerald-700 text-sm">All clear. Safe to close.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {check.issues.map((i: Issue) => (
                    <li key={i.code} className={`p-3 border ${i.severity === 'BLOCKER' ? 'border-madder/30 bg-madder/5 text-madder' : 'border-amber-300 bg-amber-50 text-amber-900'} flex items-start gap-2`}>
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium">{i.code} <span className="text-[10px] tracking-widest opacity-70">({i.severity})</span></p>
                        <p className="text-xs mt-0.5">{i.message}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-5 flex gap-2 flex-wrap">
                {check.canClose && (
                  <button onClick={() => closePeriod(false)} disabled={busy}
                    className="px-4 py-2 bg-kohl text-ivory text-xs tracking-widest hover:bg-madder disabled:opacity-50 inline-flex items-center gap-1">
                    <Lock className="w-3 h-3" /> CLOSE PERIOD
                  </button>
                )}
                {!check.canClose && !check.alreadyLocked && check.blockerCount > 0 && (
                  <button onClick={() => closePeriod(true)} disabled={busy}
                    className="px-4 py-2 border border-madder text-madder text-xs tracking-widest hover:bg-madder hover:text-ivory disabled:opacity-50 inline-flex items-center gap-1">
                    FORCE CLOSE (override blockers)
                  </button>
                )}
                {check.alreadyLocked && (
                  <button onClick={() => reopenPeriod(selectedMonth)} disabled={busy}
                    className="px-4 py-2 border border-kohl text-kohl text-xs tracking-widest hover:bg-kohl hover:text-ivory disabled:opacity-50 inline-flex items-center gap-1">
                    <Unlock className="w-3 h-3" /> REOPEN
                  </button>
                )}
                <button onClick={loadCheck} disabled={busy}
                  className="px-4 py-2 border border-mitti text-mitti text-xs tracking-widest hover:bg-mitti hover:text-ivory disabled:opacity-50 inline-flex items-center gap-1">
                  <RotateCcw className="w-3 h-3" /> RE-CHECK
                </button>
              </div>
            </>
          )}
        </div>

        {/* Right: GSTR-3B summary */}
        <div className="bg-ivory border border-mitti/20 p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-xl text-kohl">GSTR-3B summary</h2>
            <a href={`/api/admin/finance/gstr-3b?month=${selectedMonth}&format=csv`}
              className="text-xs text-banarasi hover:text-madder inline-flex items-center gap-1">
              <FileDown className="w-3 h-3" /> CSV
            </a>
          </div>
          {!gstr ? (
            <p className="text-mitti text-sm">Loading…</p>
          ) : (
            <div className="text-sm">
              <table className="w-full">
                <thead className="text-mitti text-[10px] uppercase tracking-widest border-b border-mitti/10">
                  <tr><th className="text-left py-2">Box</th><th className="text-right py-2">CGST</th><th className="text-right py-2">SGST</th><th className="text-right py-2">IGST</th></tr>
                </thead>
                <tbody>
                  <BoxRow label="3.1(a) Outward taxable"   data={gstr.boxes['3.1(a) Taxable outward (other than zero-rated, nil-rated, exempt)']} />
                  <BoxRow label="3.1(c) Exempt / nil"      data={gstr.boxes['3.1(c) Other outward (nil-rated, exempt)']} />
                  <BoxRow label="4(C) Net ITC"             data={gstr.boxes['4(C) Net ITC available']} />
                  <tr className="border-t border-mitti/30 font-medium text-kohl">
                    <td className="py-3">6.1 Tax payable (net)</td>
                    <td className="text-right tabular-nums">{gstr.boxes['6.1 Tax payable (net)'].cgst.toFixed(2)}</td>
                    <td className="text-right tabular-nums">{gstr.boxes['6.1 Tax payable (net)'].sgst.toFixed(2)}</td>
                    <td className="text-right tabular-nums">{gstr.boxes['6.1 Tax payable (net)'].igst.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="text-right text-kohl font-display text-lg pt-2">Total payable</td>
                    <td className="text-right tabular-nums font-display text-lg text-madder pt-2">₹{gstr.boxes['6.1 Tax payable (net)'].total.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="text-[10px] text-mitti mt-3 grid grid-cols-2 gap-2">
                <span>Outward invoices: {gstr.counts.outwardInvoices}</span>
                <span>Refund reversals: {gstr.counts.refundReversals}</span>
                <span>Inward bills:     {gstr.counts.inwardBills}</span>
                <span>Inward expenses:  {gstr.counts.inwardExpenses}</span>
                <span>B2B taxable: ₹{(gstr.splits.b2bTaxable).toFixed(2)}</span>
                <span>B2C taxable: ₹{(gstr.splits.b2cTaxable).toFixed(2)}</span>
              </div>
              <p className="text-[10px] text-amber-700 mt-2 italic">{gstr.note}</p>
            </div>
          )}
        </div>
      </div>

      {/* Locked months history */}
      <h2 className="font-display text-xl text-kohl mt-10 mb-3">Closed months</h2>
      {locks.length === 0 ? (
        <p className="text-mitti text-sm">No periods closed yet.</p>
      ) : (
        <div className="bg-ivory border border-mitti/20 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-beige/30 text-mitti text-[10px] uppercase tracking-widest">
              <tr><th className="text-left p-3">Month</th><th className="text-left p-3">Closed on</th><th className="text-left p-3">Closed by</th><th className="text-left p-3">Notes</th><th className="p-3"></th></tr>
            </thead>
            <tbody>
              {locks.map(l => (
                <tr key={l.id} className="border-t border-mitti/10">
                  <td className="p-3 font-mono">{l.monthBucket}</td>
                  <td className="p-3 text-mitti">{new Date(l.lockedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td className="p-3 text-mitti text-xs">{l.lockedByUserId}</td>
                  <td className="p-3 text-mitti text-xs">{l.notes || '—'}</td>
                  <td className="p-3 text-right">
                    <button onClick={() => reopenPeriod(l.monthBucket)} disabled={busy}
                      className="text-xs text-madder hover:underline inline-flex items-center gap-1">
                      <Unlock className="w-3 h-3" /> Reopen
                    </button>
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

function BoxRow({ label, data }: { label: string; data: any }) {
  return (
    <tr className="border-b border-mitti/5">
      <td className="py-2 text-kohl">
        {label}
        <span className="block text-[10px] text-mitti">Taxable ₹{(data.taxableValue || 0).toFixed(2)}</span>
      </td>
      <td className="py-2 text-right tabular-nums">{(data.cgst || 0).toFixed(2)}</td>
      <td className="py-2 text-right tabular-nums">{(data.sgst || 0).toFixed(2)}</td>
      <td className="py-2 text-right tabular-nums">{(data.igst || 0).toFixed(2)}</td>
    </tr>
  );
}
