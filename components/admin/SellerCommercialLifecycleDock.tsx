'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, FileClock, FilePlus2, History, RefreshCw, SquareArrowOutUpRight, XCircle } from 'lucide-react';

type InstrumentType = 'INITIAL' | 'ADDENDUM' | 'RENEWAL' | 'TERMINATION';

type Instrument = {
  id: string;
  sequence: number;
  instrumentType: InstrumentType;
  instrumentNumber: string;
  title: string;
  status: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  commissionPct: number | null;
  qualityScore: number | null;
  payoutCycle: string | null;
  isNeejeeSelect: boolean | null;
  changeReason: string | null;
  createdAt: string;
  issuedAt?: string | null;
  sellerSignedAt?: string | null;
  companySignedAt?: string | null;
  closedAt?: string | null;
};

type LifecyclePayload = {
  seller: any;
  instruments: Instrument[];
  events: any[];
  current: Instrument | null;
  latest: Instrument | null;
  counts: { total: number; addenda: number; renewals: number; terminations: number };
};

function asDateInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function addYears(value: string, years: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  date.setUTCFullYear(date.getUTCFullYear() + years);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function dateLabel(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysRemaining(value?: string | null) {
  if (!value) return null;
  const end = new Date(value).getTime();
  if (!Number.isFinite(end)) return null;
  return Math.ceil((end - Date.now()) / 86400000);
}

function typeLabel(type: InstrumentType) {
  if (type === 'INITIAL') return 'Initial agreement';
  if (type === 'ADDENDUM') return 'Addendum';
  if (type === 'RENEWAL') return 'Renewal agreement';
  return 'Termination agreement';
}

export default function SellerCommercialLifecycleDock() {
  const pathname = usePathname();
  const match = pathname?.match(/^\/admin\/sellers\/([^/]+)\/?$/);
  const sellerId = match?.[1] || '';

  const [data, setData] = useState<LifecyclePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [action, setAction] = useState<InstrumentType | null>(null);
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [reason, setReason] = useState('');
  const [commissionPct, setCommissionPct] = useState('20');
  const [qualityScore, setQualityScore] = useState('0');
  const [payoutCycle, setPayoutCycle] = useState('MONTHLY');
  const [isNeejeeSelect, setIsNeejeeSelect] = useState(false);

  const load = async () => {
    if (!sellerId) return;
    setLoading(true);
    setErr('');
    try {
      const res = await fetch(`/api/admin/sellers/${sellerId}/commercial-lifecycle`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load commercial relationship history');
      setData(json);
      const source = json?.current || json?.latest || json?.seller || {};
      setCommissionPct(String(source?.commissionPct ?? json?.seller?.commissionPct ?? 20));
      setQualityScore(String(source?.qualityScore ?? json?.seller?.qualityScore ?? 0));
      setPayoutCycle(String(source?.payoutCycle || json?.seller?.payoutCycle || 'MONTHLY'));
      setIsNeejeeSelect(Boolean(source?.isNeejeeSelect ?? json?.seller?.isNeejeeSelect));
    } catch (e: any) {
      setErr(e?.message || 'Failed to load commercial relationship history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sellerId) {
      setData(null);
      return;
    }
    void load();
  }, [sellerId]);

  const remaining = useMemo(() => daysRemaining(data?.current?.effectiveTo || data?.latest?.effectiveTo), [data]);

  const beginAction = (nextAction: InstrumentType) => {
    setAction(nextAction);
    setErr('');
    setMsg('');
    setReason('');

    const currentStart = today();
    const latestEnd = asDateInput(data?.latest?.effectiveTo || data?.current?.effectiveTo);
    if (nextAction === 'INITIAL') {
      setValidFrom(currentStart);
      setValidTo(addYears(currentStart, 1));
    } else if (nextAction === 'ADDENDUM') {
      setValidFrom(currentStart);
      setValidTo(latestEnd || addYears(currentStart, 1));
    } else if (nextAction === 'RENEWAL') {
      const start = latestEnd ? addDays(latestEnd, 1) : currentStart;
      setValidFrom(start);
      setValidTo(addYears(start, 1));
    } else {
      setValidFrom(currentStart);
      setValidTo('');
    }
  };

  const submit = async () => {
    if (!sellerId || !action) return;
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const res = await fetch(`/api/admin/sellers/${sellerId}/commercial-lifecycle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          validFrom,
          validTo: action === 'TERMINATION' ? null : validTo,
          changeReason: reason,
          commissionPct: Number(commissionPct),
          qualityScore: Number(qualityScore),
          payoutCycle,
          isNeejeeSelect,
          autoIssue: data?.seller?.kycStatus === 'APPROVED',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Commercial lifecycle action failed');
      setMsg(
        json?.autoIssued
          ? `${typeLabel(action)} created and issued to the seller for secure review/signing.`
          : `${typeLabel(action)} created in the Agreement Workbench.${json?.warning ? ` ${json.warning}` : ''}`,
      );
      setAction(null);
      await load();
    } catch (e: any) {
      setErr(e?.message || 'Commercial lifecycle action failed');
    } finally {
      setBusy(false);
    }
  };

  if (!sellerId) return null;

  const latest = data?.latest || null;
  const current = data?.current || null;
  const hasHistory = !!data?.instruments?.length;
  const approved = String(data?.seller?.kycStatus || '') === 'APPROVED';

  return (
    <section className="mb-8 border border-banarasi/25 bg-beige/70 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-madder" />
            <p className="label text-madder">COMMERCIAL RELATIONSHIP & CONTRACT HISTORY</p>
          </div>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-mitti">
            Every signed commercial period is retained as an immutable legal instrument. Mid-term changes become numbered addenda; post-term extensions become renewal agreements; ending the relationship creates a termination instrument. Prior instruments remain permanently referenced and annexed in the relationship record.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1 border border-mitti/25 px-3 py-2 text-[10px] tracking-wider text-mitti disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> REFRESH
        </button>
      </div>

      {err ? <p className="mt-4 text-sm text-madder">{err}</p> : null}
      {msg ? <p className="mt-4 text-sm text-neem">{msg}</p> : null}

      {loading && !data ? (
        <p className="mt-5 text-sm text-mitti">Loading relationship history...</p>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label="Relationship status" value={current ? 'ACTIVE TERM' : latest ? latest.status.replace(/_/g, ' ') : 'NO AGREEMENT YET'} />
            <Metric label="Current instrument" value={current?.instrumentNumber || latest?.instrumentNumber || '—'} />
            <Metric label="Valid from" value={dateLabel(current?.effectiveFrom || latest?.effectiveFrom)} />
            <Metric label="Valid until" value={dateLabel(current?.effectiveTo || latest?.effectiveTo)} />
            <Metric
              label="Time remaining"
              value={remaining === null ? '—' : remaining < 0 ? 'Expired' : remaining === 0 ? 'Ends today' : `${remaining} days`}
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {!hasHistory ? (
              <button onClick={() => beginAction('INITIAL')} className="btn-primary text-xs inline-flex items-center gap-1.5">
                <FilePlus2 className="w-3.5 h-3.5" /> SET VALIDITY & CREATE INITIAL AGREEMENT
              </button>
            ) : (
              <>
                <button
                  onClick={() => beginAction('ADDENDUM')}
                  disabled={!approved}
                  className="px-4 py-2 bg-kohl text-ivory text-xs tracking-wider disabled:opacity-40 inline-flex items-center gap-1.5"
                  title={!approved ? 'Available after seller approval' : 'Change terms during the current contractual period'}
                >
                  <FilePlus2 className="w-3.5 h-3.5" /> CREATE ADDENDUM
                </button>
                <button
                  onClick={() => beginAction('RENEWAL')}
                  disabled={!approved}
                  className="px-4 py-2 border border-banarasi text-banarasi text-xs tracking-wider disabled:opacity-40 inline-flex items-center gap-1.5"
                  title={!approved ? 'Available after seller approval' : 'Create the next contractual term'}
                >
                  <CalendarDays className="w-3.5 h-3.5" /> RENEW
                </button>
                <button
                  onClick={() => beginAction('TERMINATION')}
                  disabled={!approved}
                  className="px-4 py-2 border border-madder text-madder text-xs tracking-wider disabled:opacity-40 inline-flex items-center gap-1.5"
                  title={!approved ? 'Available after seller approval' : 'Prepare a termination agreement'}
                >
                  <XCircle className="w-3.5 h-3.5" /> END RELATIONSHIP
                </button>
              </>
            )}
            <Link
              href={`/admin/sellers/${sellerId}/agreement-workbench`}
              className="px-4 py-2 border border-mitti/30 text-mitti text-xs tracking-wider inline-flex items-center gap-1.5"
            >
              <FileClock className="w-3.5 h-3.5" /> AGREEMENT WORKBENCH
            </Link>
          </div>

          {action ? (
            <div className="mt-5 border border-mitti/20 bg-ivory p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-xl text-kohl">{typeLabel(action)}</p>
                  <p className="text-xs text-mitti mt-1">
                    {action === 'ADDENDUM'
                      ? 'Use this for a commercial change that becomes effective before the current term expires. It will be numbered Addendum 1, 2, 3… and reference the earlier instruments.'
                      : action === 'RENEWAL'
                        ? 'Use this for the next commercial period. The renewal agreement will reference the complete earlier agreement/addendum history.'
                        : action === 'TERMINATION'
                          ? 'This prepares a termination agreement with an effective end date and permanent relationship-history entry.'
                          : 'Set the first contractual validity. These dates flow into the legal workbench and agreement annexure.'}
                  </p>
                </div>
                <button onClick={() => setAction(null)} className="text-xs text-mitti">CANCEL</button>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label={action === 'TERMINATION' ? 'TERMINATION EFFECTIVE DATE' : 'VALID FROM'}>
                  <input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} className="w-full p-2 bg-white border border-mitti/20 text-sm" />
                </Field>
                {action !== 'TERMINATION' ? (
                  <Field label="VALID UNTIL">
                    <input type="date" value={validTo} onChange={e => setValidTo(e.target.value)} className="w-full p-2 bg-white border border-mitti/20 text-sm" />
                  </Field>
                ) : null}
                <Field label="COMMISSION %">
                  <input type="number" min="0" max="100" step="0.5" value={commissionPct} onChange={e => setCommissionPct(e.target.value)} className="w-full p-2 bg-white border border-mitti/20 text-sm" />
                </Field>
                <Field label="QUALITY SCORE">
                  <input type="number" min="0" max="5" step="0.1" value={qualityScore} onChange={e => setQualityScore(e.target.value)} className="w-full p-2 bg-white border border-mitti/20 text-sm" />
                </Field>
                <Field label="PAYOUT CYCLE">
                  <select value={payoutCycle} onChange={e => setPayoutCycle(e.target.value)} className="w-full p-2 bg-white border border-mitti/20 text-sm">
                    <option value="WEEKLY">Weekly</option>
                    <option value="FORTNIGHTLY">Fortnightly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </Field>
                <label className="flex items-center gap-2 pt-6 text-sm text-kohl">
                  <input type="checkbox" checked={isNeejeeSelect} onChange={e => setIsNeejeeSelect(e.target.checked)} className="accent-madder" />
                  NEEJEE Select
                </label>
              </div>

              <div className="mt-4">
                <label className="label text-mitti">{action === 'TERMINATION' ? 'TERMINATION REASON *' : 'CHANGE / RENEWAL NOTE'}</label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder={action === 'TERMINATION' ? 'Reason and contractual context for ending the relationship' : 'Commercial rationale or changes being recorded'}
                  className="mt-1 w-full bg-white border border-mitti/20 p-3 text-sm"
                />
              </div>

              <button
                type="button"
                onClick={() => void submit()}
                disabled={busy || !validFrom || (action !== 'TERMINATION' && !validTo) || (action === 'TERMINATION' && !reason.trim())}
                className="mt-4 bg-madder text-ivory px-5 py-2.5 text-xs tracking-wider disabled:opacity-40"
              >
                {busy ? 'CREATING…' : approved ? `CREATE & ISSUE ${typeLabel(action).toUpperCase()}` : `CREATE ${typeLabel(action).toUpperCase()} DRAFT`}
              </button>
            </div>
          ) : null}

          {hasHistory ? (
            <div className="mt-6">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="label text-madder">PERMANENT RELATIONSHIP HISTORY</p>
                  <p className="text-xs text-mitti mt-1">Nothing here is overwritten when commercial terms change.</p>
                </div>
                <p className="text-[10px] tracking-widest text-mitti">
                  {data?.counts?.total || 0} INSTRUMENTS • {data?.counts?.addenda || 0} ADDENDA • {data?.counts?.renewals || 0} RENEWALS
                </p>
              </div>

              <div className="mt-3 overflow-x-auto border border-mitti/15 bg-ivory">
                <table className="min-w-[900px] w-full text-xs">
                  <thead className="bg-beige text-mitti">
                    <tr>
                      <th className="p-3 text-left font-normal tracking-wider">#</th>
                      <th className="p-3 text-left font-normal tracking-wider">INSTRUMENT</th>
                      <th className="p-3 text-left font-normal tracking-wider">VALIDITY</th>
                      <th className="p-3 text-left font-normal tracking-wider">COMMERCIAL TERMS</th>
                      <th className="p-3 text-left font-normal tracking-wider">STATUS</th>
                      <th className="p-3 text-left font-normal tracking-wider">RECORD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...(data?.instruments || [])].sort((a, b) => b.sequence - a.sequence).map(item => (
                      <tr key={item.id} className="border-t border-mitti/10 align-top">
                        <td className="p-3 text-mitti">{item.sequence}</td>
                        <td className="p-3">
                          <div className="text-kohl font-medium">{item.title}</div>
                          <div className="text-[10px] text-mitti mt-1">{item.instrumentNumber}</div>
                          {item.changeReason ? <div className="text-[11px] text-mitti mt-2 max-w-xs">{item.changeReason}</div> : null}
                        </td>
                        <td className="p-3 text-mitti">
                          <div>{dateLabel(item.effectiveFrom)}</div>
                          <div>to {dateLabel(item.effectiveTo)}</div>
                        </td>
                        <td className="p-3 text-mitti">
                          <div>Commission {item.commissionPct ?? '—'}%</div>
                          <div>{item.payoutCycle || '—'}</div>
                          <div>NEEJEE Select {item.isNeejeeSelect ? 'Yes' : 'No'}</div>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex bg-beige px-2 py-1 text-[10px] tracking-wider text-kohl">{String(item.status).replace(/_/g, ' ')}</span>
                        </td>
                        <td className="p-3">
                          <Link href={`/admin/sellers/${sellerId}/commercial-instruments/${item.id}`} className="inline-flex items-center gap-1 text-madder hover:text-kohl">
                            VIEW RECORD <SquareArrowOutUpRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-mitti/15 bg-ivory p-3">
      <p className="label text-mitti">{label}</p>
      <p className="mt-1 text-sm text-kohl break-words">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label text-mitti">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
