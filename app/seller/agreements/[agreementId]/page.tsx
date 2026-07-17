'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type AnyRecord = Record<string, any>;

function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function firstArray(...values: any[]): any[] {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

function getAgreementPayload(data: any) {
  return data?.agreement || data?.item || data || {};
}

function getCurrentVersion(agreement: any) {
  return agreement?.currentVersion || agreement?.version || agreement?.latestVersion || {};
}

function normalizeRecitals(version: any, agreement: any) {
  return firstArray(version?.recitals, agreement?.recitals).map((item: any, index: number) => ({
    key: String(item?.id || item?.key || `recital-${index + 1}`),
    text: String(typeof item === 'string' ? item : item?.text || item?.content || item?.body || ''),
  })).filter((item: any) => item.text);
}

function normalizeClauses(version: any, agreement: any) {
  return firstArray(version?.clauses, agreement?.clauses).map((clause: any, clauseIndex: number) => {
    const paragraphs = firstArray(clause?.paragraphs, clause?.items, clause?.content).map((p: any, pIndex: number) => ({
      key: String(p?.paragraphKey || p?.key || p?.id || `${clause?.id || clauseIndex + 1}-p-${pIndex + 1}`),
      text: String(typeof p === 'string' ? p : p?.text || p?.content || p?.body || ''),
    })).filter((p: any) => p.text);

    return {
      id: String(clause?.id || `clause-${clauseIndex + 1}`),
      title: String(clause?.title || clause?.heading || `Clause ${clauseIndex + 1}`),
      paragraphs,
    };
  });
}

function normalizeAnnexure(version: any, agreement: any) {
  return firstArray(version?.annexure, agreement?.annexure, agreement?.annexureItems).map((item: any, index: number) => ({
    key: String(item?.key || item?.label || `annexure-${index + 1}`),
    label: String(item?.label || item?.key || `Item ${index + 1}`),
    value: String(item?.value || item?.text || item?.content || ''),
  }));
}

function normalizeObservations(agreement: any) {
  return firstArray(agreement?.observations).map((item: any, index: number) => ({
    id: String(item?.id || `obs-${index + 1}`),
    clauseId: item?.clauseId ? String(item.clauseId) : '',
    paragraphKey: item?.paragraphKey ? String(item.paragraphKey) : '',
    status: String(item?.status || 'OPEN'),
    sellerComment: String(item?.sellerComment || ''),
    adminComment: String(item?.adminComment || item?.resolutionComment || ''),
    createdAt: item?.createdAt || null,
  }));
}

function statusTone(status?: string) {
  const s = String(status || '').toUpperCase();
  if (['FULLY_EXECUTED', 'COMPANY_SIGNED', 'CLOSED'].includes(s)) return 'bg-neem/10 text-neem border border-neem/30';
  if (['SELLER_SIGNED', 'SENT_FOR_SIGNATURE', 'UNDER_REVIEW'].includes(s)) return 'bg-banarasi/10 text-banarasi border border-banarasi/30';
  if (['CHANGES_REQUESTED', 'OBSERVED'].includes(s)) return 'bg-madder/10 text-madder border border-madder/30';
  return 'bg-beige text-kohl border border-mitti/20';
}

export default function SellerAgreementDetailPage() {
  const params = useParams() as { agreementId?: string | string[] };
  const agreementId = Array.isArray(params?.agreementId) ? params.agreementId[0] : params?.agreementId;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);
  const [selectedClauseId, setSelectedClauseId] = useState('');
  const [selectedParagraphKey, setSelectedParagraphKey] = useState('');
  const [sellerComment, setSellerComment] = useState('');
  const [observationBusy, setObservationBusy] = useState(false);

  async function load() {
    if (!agreementId) return;
    setLoading(true);
    setErr('');
    try {
      const r = await fetch(`/api/seller/agreements/${agreementId}`, { cache: 'no-store' });
      const t = await r.text();
      let j: any = {};
      try { j = JSON.parse(t); } catch {}
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setData(j);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load agreement');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [agreementId]);

  const agreement = useMemo(() => getAgreementPayload(data), [data]);
  const version = useMemo(() => getCurrentVersion(agreement), [agreement]);
  const recitals = useMemo(() => normalizeRecitals(version, agreement), [version, agreement]);
  const clauses = useMemo(() => normalizeClauses(version, agreement), [version, agreement]);
  const annexure = useMemo(() => normalizeAnnexure(version, agreement), [version, agreement]);
  const observations = useMemo(() => normalizeObservations(agreement), [agreement]);

  const status = String(agreement?.status || 'DRAFT');
  const canComment = !['SELLER_SIGNED', 'COMPANY_SIGNED', 'FULLY_EXECUTED', 'CLOSED'].includes(status);
  const canOtp = !agreement?.sellerSignedAt && String(agreement?.sellerExecutionMode || 'OTP').toUpperCase() !== 'NONE';

  async function requestOtp() {
    if (!agreementId) return;
    setOtpBusy(true);
    setErr('');
    setMsg('');
    try {
      const r = await fetch(`/api/seller/agreements/${agreementId}/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const t = await r.text();
      let j: any = {};
      try { j = JSON.parse(t); } catch {}
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setMsg(j?.message || 'OTP sent successfully.');
    } catch (e: any) {
      setErr(e?.message || 'Failed to request OTP');
    } finally {
      setOtpBusy(false);
    }
  }

  async function verifyOtp() {
    if (!agreementId) return;
    if (!otpCode.trim()) {
      setErr('Enter the OTP code first.');
      return;
    }
    setOtpBusy(true);
    setErr('');
    setMsg('');
    try {
      const r = await fetch(`/api/seller/agreements/${agreementId}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: otpCode.trim(), otp: otpCode.trim() }),
      });
      const t = await r.text();
      let j: any = {};
      try { j = JSON.parse(t); } catch {}
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setMsg(j?.message || 'Agreement signed successfully.');
      setOtpCode('');
      await load();
    } catch (e: any) {
      setErr(e?.message || 'Failed to verify OTP');
    } finally {
      setOtpBusy(false);
    }
  }

  async function submitObservation() {
    if (!agreementId) return;
    if (!sellerComment.trim()) {
      setErr('Enter your observation before sending.');
      return;
    }
    setObservationBusy(true);
    setErr('');
    setMsg('');
    try {
      const r = await fetch(`/api/seller/agreements/${agreementId}/observations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clauseId: selectedClauseId || null,
          paragraphKey: selectedParagraphKey || null,
          sellerComment: sellerComment.trim(),
        }),
      });
      const t = await r.text();
      let j: any = {};
      try { j = JSON.parse(t); } catch {}
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setMsg(j?.message || 'Observation submitted.');
      setSellerComment('');
      await load();
    } catch (e: any) {
      setErr(e?.message || 'Failed to submit observation');
    } finally {
      setObservationBusy(false);
    }
  }

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="label text-banarasi">LEGAL</p>
          <h1 className="font-display text-4xl text-kohl mt-2">Agreement review</h1>
          <p className="text-mitti mt-2">
            Review the draft, leave paragraph-level observations, and sign using OTP when requested.
          </p>
        </div>
        <Link
          href="/seller/agreements"
          className="inline-flex bg-kohl text-ivory px-4 py-2 text-xs tracking-widest hover:bg-kohl/90 transition-colors"
        >
          ALL AGREEMENTS
        </Link>
      </div>

      {msg && <div className="bg-neem/10 border border-neem/30 text-neem p-4">{msg}</div>}
      {err && <div className="bg-madder/10 border border-madder p-4 text-madder">{err}</div>}

      {loading ? (
        <div className="bg-beige p-6 text-mitti font-italic italic">Loading agreement…</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
          <div className="space-y-6">
            <section className="bg-ivory border border-mitti/20 rounded p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="label text-mitti">STATUS</p>
                  <div className={`inline-flex mt-2 px-3 py-1 text-[11px] tracking-widest uppercase rounded-full ${statusTone(status)}`}>
                    {status.replace(/_/g, ' ')}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm min-w-[280px]">
                  <div>
                    <p className="label text-mitti">VERSION</p>
                    <p className="text-kohl mt-1">{agreement?.currentVersionNo ?? version?.versionNo ?? '—'}</p>
                  </div>
                  <div>
                    <p className="label text-mitti">UPDATED</p>
                    <p className="text-kohl mt-1">{formatDate(agreement?.updatedAt)}</p>
                  </div>
                  <div>
                    <p className="label text-mitti">SELLER SIGNED</p>
                    <p className="text-kohl mt-1">{formatDate(agreement?.sellerSignedAt)}</p>
                  </div>
                  <div>
                    <p className="label text-mitti">COMPANY SIGNED</p>
                    <p className="text-kohl mt-1">{formatDate(agreement?.companySignedAt)}</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-ivory border border-mitti/20 rounded p-6">
              <h2 className="font-display text-2xl text-kohl">Recitals</h2>
              <div className="space-y-3 mt-4">
                {recitals.length > 0 ? recitals.map((item: AnyRecord) => (
                  <p key={item.key} className="text-kohl leading-7">{item.text}</p>
                )) : (
                  <p className="text-mitti">No recitals available.</p>
                )}
              </div>
            </section>

            <section className="bg-ivory border border-mitti/20 rounded p-6">
              <h2 className="font-display text-2xl text-kohl">Clauses</h2>
              <div className="space-y-6 mt-4">
                {clauses.length > 0 ? clauses.map((clause: AnyRecord, clauseIndex: number) => (
                  <div key={clause.id} className="border border-mitti/15 rounded p-5">
                    <h3 className="font-display text-xl text-kohl">
                      {clauseIndex + 1}. {clause.title}
                    </h3>
                    <div className="space-y-4 mt-4">
                      {clause.paragraphs.length > 0 ? clause.paragraphs.map((paragraph: AnyRecord, pIndex: number) => {
                        const selected = selectedClauseId === clause.id && selectedParagraphKey === paragraph.key;
                        return (
                          <div key={paragraph.key} className={`rounded p-4 ${selected ? 'bg-banarasi/10 border border-banarasi/30' : 'bg-beige/60'}`}>
                            <p className="text-kohl leading-7">
                              {clauseIndex + 1}.{pIndex + 1} {paragraph.text}
                            </p>
                            {canComment && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedClauseId(clause.id);
                                  setSelectedParagraphKey(paragraph.key);
                                }}
                                className="mt-3 text-xs tracking-widest text-banarasi hover:underline"
                              >
                                COMMENT ON THIS PARAGRAPH
                              </button>
                            )}
                          </div>
                        );
                      }) : (
                        <p className="text-mitti">No paragraph text available.</p>
                      )}
                    </div>
                  </div>
                )) : (
                  <p className="text-mitti">No clauses available.</p>
                )}
              </div>
            </section>

            <section className="bg-ivory border border-mitti/20 rounded p-6">
              <h2 className="font-display text-2xl text-kohl">Annexure</h2>
              {annexure.length > 0 ? (
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-sm border-collapse">
                    <tbody>
                      {annexure.map((item: AnyRecord) => (
                        <tr key={item.key} className="border-b border-mitti/15">
                          <td className="py-3 pr-4 label text-mitti align-top">{item.label}</td>
                          <td className="py-3 text-kohl">{item.value || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-mitti mt-4">No annexure details available.</p>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="bg-ivory border border-mitti/20 rounded p-6">
              <h2 className="font-display text-2xl text-kohl">Seller observations</h2>
              <p className="text-mitti text-sm mt-2">
                Select a paragraph, then send your comment to the legal team.
              </p>

              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <p className="label text-mitti">CLAUSE</p>
                  <p className="text-kohl mt-1">{selectedClauseId || 'Not selected'}</p>
                </div>
                <div>
                  <p className="label text-mitti">PARAGRAPH</p>
                  <p className="text-kohl mt-1">{selectedParagraphKey || 'Not selected'}</p>
                </div>
              </div>

              <textarea
                value={sellerComment}
                onChange={(e) => setSellerComment(e.target.value)}
                rows={5}
                placeholder="Describe the change or clarification you need..."
                className="w-full mt-4 border border-mitti/30 bg-beige/50 px-4 py-3 outline-none focus:border-kohl"
                disabled={!canComment}
              />

              <button
                type="button"
                onClick={submitObservation}
                disabled={!canComment || observationBusy}
                className="mt-4 w-full bg-kohl text-ivory px-4 py-3 text-xs tracking-widest disabled:opacity-50"
              >
                {observationBusy ? 'SAVING…' : 'SEND OBSERVATION'}
              </button>
            </section>

            <section className="bg-ivory border border-mitti/20 rounded p-6">
              <h2 className="font-display text-2xl text-kohl">OTP signing</h2>
              <p className="text-mitti text-sm mt-2">
                When the agreement is ready for signature, request an OTP and verify it to sign.
              </p>

              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <p className="label text-mitti">EXECUTION MODE</p>
                  <p className="text-kohl mt-1">{String(agreement?.sellerExecutionMode || 'OTP')}</p>
                </div>
                <div>
                  <p className="label text-mitti">SELLER SIGNED</p>
                  <p className="text-kohl mt-1">{formatDate(agreement?.sellerSignedAt)}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={requestOtp}
                disabled={!canOtp || otpBusy}
                className="mt-5 w-full bg-banarasi text-kohl px-4 py-3 text-xs tracking-widest disabled:opacity-50"
              >
                {otpBusy ? 'REQUESTING…' : 'REQUEST OTP'}
              </button>

              <input
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="Enter OTP"
                className="w-full mt-4 border border-mitti/30 bg-beige/50 px-4 py-3 outline-none focus:border-kohl"
                disabled={!canOtp || otpBusy}
              />

              <button
                type="button"
                onClick={verifyOtp}
                disabled={!canOtp || otpBusy}
                className="mt-3 w-full bg-neem text-ivory px-4 py-3 text-xs tracking-widest disabled:opacity-50"
              >
                {otpBusy ? 'VERIFYING…' : 'VERIFY & SIGN'}
              </button>
            </section>

            <section className="bg-ivory border border-mitti/20 rounded p-6">
              <h2 className="font-display text-2xl text-kohl">Observation history</h2>
              <div className="mt-4 space-y-4">
                {observations.length > 0 ? observations.map((item: AnyRecord) => (
                  <div key={item.id} className="border border-mitti/15 rounded p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="label text-banarasi">{item.status.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-mitti">{formatDate(item.createdAt)}</p>
                    </div>
                    {(item.clauseId || item.paragraphKey) && (
                      <p className="text-xs text-mitti mt-2">
                        {item.clauseId ? `Clause: ${item.clauseId}` : ''}{item.clauseId && item.paragraphKey ? ' • ' : ''}{item.paragraphKey ? `Paragraph: ${item.paragraphKey}` : ''}
                      </p>
                    )}
                    {item.sellerComment && (
                      <p className="text-kohl mt-3 whitespace-pre-wrap">{item.sellerComment}</p>
                    )}
                    {item.adminComment && (
                      <div className="mt-3 bg-beige/70 p-3 rounded">
                        <p className="label text-mitti">LEGAL RESPONSE</p>
                        <p className="text-kohl mt-1 whitespace-pre-wrap">{item.adminComment}</p>
                      </div>
                    )}
                  </div>
                )) : (
                  <p className="text-mitti">No observations yet.</p>
                )}
              </div>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}