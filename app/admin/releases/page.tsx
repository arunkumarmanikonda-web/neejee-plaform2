'use client';

import { useEffect, useState } from 'react';

type Proposal = {
  id: string;
  title: string;
  domain: string;
  riskClass: 'A' | 'B' | 'C';
  status: string;
  summary: string;
  rationale?: string | null;
  evidence?: any[];
  proposedChange?: any;
  testPlan?: any;
  rollbackPlan?: any;
  createdAt: string;
};

type Data = {
  canApprove: boolean;
  policy: {
    enabled: boolean;
    webResearchEnabled: boolean;
    maxProposalsPerRun: number;
    codeAutoApply: boolean;
    coreAutoApply: boolean;
    approvalRequired: boolean;
  } | null;
  proposals: Proposal[];
};

export default function ReleaseControlPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setError('');
    const res = await fetch('/api/admin/releases', { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || 'Unable to load release proposals');
    setData(json);
  }

  useEffect(() => { void load().catch((e) => setError(e.message)); }, []);

  async function review(id: string, action: 'approve' | 'reject' | 'request_rollback') {
    setBusy(id);
    setError('');
    try {
      const note = action === 'approve'
        ? 'Approved by Super Admin from NEEJEE Release Control.'
        : action === 'reject'
          ? 'Rejected by Super Admin from NEEJEE Release Control.'
          : 'Rollback requested by Super Admin.';
      const res = await fetch('/api/admin/releases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, note }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Review action failed');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Review action failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <p className="label text-madder">AUTONOMOUS RELEASE CONTROL</p>
      <h1 className="font-display text-4xl text-kohl mt-2">NEEJEE Evolution Queue</h1>
      <p className="font-ui text-sm text-mitti mt-3 max-w-4xl leading-7">
        NEEJEE may research, diagnose and prepare improvements autonomously. Nothing production-facing is silently released: every proposal carries evidence, risk, tests and rollback information for Super Admin review.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-7">
        <Stat label="AUTONOMY" value={data?.policy?.enabled ? 'ON' : 'OFF'} />
        <Stat label="WEB RESEARCH" value={data?.policy?.webResearchEnabled ? 'ON' : 'OFF'} />
        <Stat label="APPROVAL" value={data?.policy?.approvalRequired ? 'REQUIRED' : 'OFF'} />
        <Stat label="CODE AUTO APPLY" value={data?.policy?.codeAutoApply ? 'ON' : 'BLOCKED'} />
        <Stat label="CORE AUTO APPLY" value={data?.policy?.coreAutoApply ? 'ON' : 'BLOCKED'} />
        <Stat label="MAX / RUN" value={String(data?.policy?.maxProposalsPerRun ?? '—')} />
      </div>

      {error ? <div className="mt-6 border border-madder/30 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}

      <div className="mt-8 space-y-4">
        {(data?.proposals || []).length === 0 ? (
          <div className="bg-beige border border-kohl/10 p-8">
            <p className="font-display text-2xl text-kohl">No proposals waiting yet.</p>
            <p className="font-ui text-sm text-mitti mt-2">The autonomous research job will populate this queue only when it finds evidence-backed improvements worth reviewing.</p>
          </div>
        ) : null}

        {(data?.proposals || []).map((p) => (
          <article key={p.id} className="bg-white border border-kohl/10 p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-4xl">
                <div className="flex flex-wrap gap-2 text-xs font-ui">
                  <span className="px-2 py-1 bg-beige text-kohl">{p.domain}</span>
                  <span className="px-2 py-1 bg-beige text-kohl">RISK {p.riskClass}</span>
                  <span className="px-2 py-1 bg-beige text-kohl">{p.status}</span>
                </div>
                <h2 className="font-display text-2xl text-kohl mt-3">{p.title}</h2>
                <p className="font-ui text-sm text-mitti mt-2 leading-6">{p.summary}</p>
                {p.rationale ? <p className="font-ui text-sm text-kohl/75 mt-3 leading-6">{p.rationale}</p> : null}
              </div>
              <p className="text-xs text-mitti">{new Date(p.createdAt).toLocaleString()}</p>
            </div>

            <details className="mt-5 border-t border-kohl/10 pt-4">
              <summary className="cursor-pointer font-ui text-sm text-kohl">Evidence, proposed change, tests and rollback</summary>
              <pre className="mt-3 whitespace-pre-wrap break-words text-xs bg-beige p-4 overflow-auto">{JSON.stringify({ evidence: p.evidence, proposedChange: p.proposedChange, testPlan: p.testPlan, rollbackPlan: p.rollbackPlan }, null, 2)}</pre>
            </details>

            {data?.canApprove && p.status === 'PROPOSED' ? (
              <div className="flex flex-wrap gap-3 mt-5">
                <button disabled={busy === p.id} onClick={() => void review(p.id, 'approve')} className="px-4 py-2 bg-kohl text-ivory text-sm disabled:opacity-50">Approve for controlled execution</button>
                <button disabled={busy === p.id} onClick={() => void review(p.id, 'reject')} className="px-4 py-2 border border-madder text-madder text-sm disabled:opacity-50">Reject</button>
              </div>
            ) : null}
            {data?.canApprove && p.status === 'APPLIED' ? (
              <button disabled={busy === p.id} onClick={() => void review(p.id, 'request_rollback')} className="mt-5 px-4 py-2 border border-kohl/20 text-sm disabled:opacity-50">Request rollback</button>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="bg-beige border border-kohl/10 p-4"><p className="label text-madder">{label}</p><p className="font-display text-kohl mt-2">{value}</p></div>;
}
