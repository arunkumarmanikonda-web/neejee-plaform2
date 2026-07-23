'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  ExternalLink,
  Lock,
  LockOpen,
  Plus,
  Printer,
  Save,
  Send,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const STATUS_OPTIONS = [
  'DRAFT',
  'INTERNAL_REVIEW',
  'SELLER_REVIEW',
  'READY_TO_LOCK',
  'LOCKED',
  'SENT_FOR_SIGNATURE',
  'SELLER_SIGNED',
  'COMPANY_SIGNED',
  'CLOSED',
  'VOID',
];

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? {}));
}

function ensureDocumentShape(input: any) {
  const doc = deepClone(input || {});
  doc.meta = doc.meta || {};
  doc.company = doc.company || {};
  doc.seller = doc.seller || {};
  doc.commercialTerms = doc.commercialTerms || {};
  doc.recitals = Array.isArray(doc.recitals) ? doc.recitals : [];
  doc.annexure = Array.isArray(doc.annexure) ? doc.annexure : [];
  doc.clauses = Array.isArray(doc.clauses) ? doc.clauses : [];
  return doc;
}

async function readJson(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

function badgeTone(status: string) {
  switch (status) {
    case 'LOCKED':
    case 'SENT_FOR_SIGNATURE':
      return 'bg-kohl text-ivory';
    case 'SELLER_SIGNED':
    case 'COMPANY_SIGNED':
    case 'CLOSED':
      return 'bg-neem/20 text-neem';
    case 'VOID':
      return 'bg-madder/20 text-madder';
    default:
      return 'bg-beige text-kohl';
  }
}

export default function AdminAgreementWorkbenchPage() {
  const params = useParams();
  const id = params?.id as string;

  const [seller, setSeller] = useState<any>(null);
  const [addressDiag, setAddressDiag] = useState({ sellerApi: '', workflowDoc: '', agreementApi: '' });
  const [bundle, setBundle] = useState<any>(null);
  const [doc, setDoc] = useState<any>(ensureDocumentShape({}));
  const [draftStatus, setDraftStatus] = useState('DRAFT');
  const [selectedSignatory, setSelectedSignatory] = useState('');
  const [agreementNumber, setAgreementNumber] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [renewalMode, setRenewalMode] = useState('MANUAL');
  const [renewalNoticeDays, setRenewalNoticeDays] = useState('30');
  const [expiryAction, setExpiryAction] = useState('LOCK_STOCK_BARREL');
  const [renegotiationReason, setRenegotiationReason] = useState('');
  const [changeSummary, setChangeSummary] = useState('');
  const [observationDrafts, setObservationDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const agreement = bundle?.agreement || null;
  const signatories = bundle?.signatories || [];
  const observations = bundle?.observations || [];

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setErr('');

    try {
      const [sellerRes, workflowRes] = await Promise.all([
        fetch(`/api/admin/sellers/${id}`, { cache: 'no-store' }),
        fetch(`/api/admin/sellers/${id}/agreement-workflow`, { cache: 'no-store' }),
      ]);

      const sellerJson = await readJson(sellerRes);
      const workflowJson = await readJson(workflowRes);

      if (!sellerRes.ok) throw new Error(sellerJson?.error || 'Failed to load seller');
      if (!workflowRes.ok) throw new Error(workflowJson?.error || 'Failed to load workflow');

      setSeller(sellerJson?.seller || null);
      setAddressDiag({
        sellerApi: String(sellerJson?.seller?.address || '').trim(),
        workflowDoc: String(workflowJson?.agreement?.currentDocumentJson?.seller?.address || '').trim(),
        agreementApi: '',
      });

      try {
        const agreementRes = await fetch(`/api/admin/sellers/${id}/agreement`);
        const agreementJson = await agreementRes.json().catch(() => ({}));
        setAddressDiag((prev) => ({
          ...prev,
          agreementApi: String(
            agreementJson?.seller?.address ||
            agreementJson?.agreement?.currentDocumentJson?.seller?.address ||
            ''
          ).trim(),
        }));
      } catch {}
      setBundle(workflowJson || null);

      const nextDoc = ensureDocumentShape(workflowJson?.agreement?.currentDocumentJson || {});
      const fallbackAgreementNumber = `AGR-${String(id || '').slice(-8).toUpperCase()}`;
      const sellerFromApi = sellerJson?.seller || {};
      const resolvedSellerAddress =
        String(nextDoc?.seller?.address || '').trim() ||
        String(sellerFromApi?.address || '').trim();

      nextDoc.meta = nextDoc.meta || {};
      nextDoc.seller = {
        ...sellerFromApi,
        ...(nextDoc.seller || {}),
        address: resolvedSellerAddress,
      };

      if (!String(nextDoc.meta.agreementNumber || '').trim()) {
        nextDoc.meta.agreementNumber = fallbackAgreementNumber;
      }

      if ((!Array.isArray(nextDoc.recitals) || nextDoc.recitals.length === 0) && nextDoc.seller) {
        const recitalSeed = [
          nextDoc.seller.businessName
            ? `The Seller, ${nextDoc.seller.businessName}, has requested onboarding on the Neejee marketplace for listing and selling its products.`
            : '',
          nextDoc.seller.address
            ? `The Seller's principal place of business is ${nextDoc.seller.address}.`
            : '',
        ].filter(Boolean);

        if (recitalSeed.length) {
          nextDoc.recitals = recitalSeed;
        }
      }
      setDoc(nextDoc);
      setDraftStatus(String(workflowJson?.agreement?.status || 'DRAFT'));

      const defaultSignatoryId =
        workflowJson?.agreement?.companySignatoryId ||
        workflowJson?.signatories?.find((x: any) => x.isDefault)?.id ||
        '';

      setSelectedSignatory(String(defaultSignatoryId || ''));
      setAgreementNumber(
        String(
          workflowJson?.agreement?.agreementNumber ||
          nextDoc?.meta?.agreementNumber ||
          `AGR-${String(id || '').slice(-8).toUpperCase()}`
        )
      );
      setEffectiveDate(String(workflowJson?.agreement?.effectiveDate || ''));
      setValidFrom(String(workflowJson?.agreement?.validFrom || ''));
      setValidTo(String(workflowJson?.agreement?.validTo || ''));
      setRenewalMode(String(workflowJson?.agreement?.renewalMode || 'MANUAL'));
      setRenewalNoticeDays(String(workflowJson?.agreement?.renewalNoticeDays ?? 30));
      setExpiryAction(String(workflowJson?.agreement?.expiryAction || 'LOCK_STOCK_BARREL'));
      setRenegotiationReason(String(workflowJson?.agreement?.renegotiationReason || ''));

      const nextResponses: Record<string, string> = {};
      for (const obs of workflowJson?.observations || []) {
        nextResponses[obs.id] = String(obs.adminResponse || '');
      }
      setObservationDrafts(nextResponses);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load workbench');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  const persistWorkflow = async (body: any, successMessage: string) => {
    setSaving(true);
    setErr('');
    setMsg('');

    try {
      const res = await fetch(`/api/admin/sellers/${id}/agreement-workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await readJson(res);
      if (!res.ok) throw new Error(json?.error || 'Action failed');

      setBundle(json || null);

      if (json?.agreement?.currentDocumentJson) {
        setDoc(ensureDocumentShape(json.agreement.currentDocumentJson));
      }

      setDraftStatus(String(json?.agreement?.status || draftStatus));
      setSelectedSignatory(String(json?.agreement?.companySignatoryId || selectedSignatory));
      setAgreementNumber(String(json?.agreement?.agreementNumber || agreementNumber));
      setEffectiveDate(String(json?.agreement?.effectiveDate || effectiveDate));
      setValidFrom(String(json?.agreement?.validFrom || validFrom));
      setValidTo(String(json?.agreement?.validTo || validTo));
      setRenewalMode(String(json?.agreement?.renewalMode || renewalMode));
      setRenewalNoticeDays(String(json?.agreement?.renewalNoticeDays ?? renewalNoticeDays));
      setExpiryAction(String(json?.agreement?.expiryAction || expiryAction));
      setRenegotiationReason(String(json?.agreement?.renegotiationReason || renegotiationReason));
      setMsg(successMessage);
      setTimeout(() => setMsg(''), 2500);
    } catch (e: any) {
      setErr(e?.message || 'Action failed');
    } finally {
      setSaving(false);
    }
  };

  const commercialPayload = () => ({
    companySignatoryId: selectedSignatory || null,
    agreementNumber,
    effectiveDate,
    validFrom,
    validTo,
    renewalMode,
    renewalNoticeDays: Number(renewalNoticeDays || 30),
    expiryAction,
    renegotiationReason,
  });

  const saveDraft = async () => {
    await persistWorkflow(
      {
        action: 'save-draft',
        document: doc,
        status: draftStatus,
        ...commercialPayload(),
        changeSummary: changeSummary || 'Agreement updated in workbench',
      },
      'Draft saved',
    );
  };

  const workflowAction = async (action: string, extra: any = {}) => {
    const messages: Record<string, string> = {
      lock: 'Agreement locked',
      reopen: 'Agreement reopened',
      'send-for-signature': 'Agreement sent for signature',
      'company-sign': 'Company signature recorded',
      close: 'Agreement closed',
      'set-status': 'Status updated',
      'set-signatory': 'Signatory updated',
    };

    await persistWorkflow(
      { action, ...extra },
      messages[action] || 'Updated',
    );
  };

  const updateRecital = (index: number, value: string) => {
    setDoc((prev: any) => {
      const next = ensureDocumentShape(prev);
      next.recitals[index] = value;
      return next;
    });
  };

  const addRecital = () => {
    setDoc((prev: any) => {
      const next = ensureDocumentShape(prev);
      next.recitals.push('');
      return next;
    });
  };

  const removeRecital = (index: number) => {
    setDoc((prev: any) => {
      const next = ensureDocumentShape(prev);
      next.recitals.splice(index, 1);
      return next;
    });
  };

  const updateClauseTitle = (clauseIndex: number, value: string) => {
    setDoc((prev: any) => {
      const next = ensureDocumentShape(prev);
      next.clauses[clauseIndex].title = value;
      next.clauses[clauseIndex].heading = value;
      return next;
    });
  };

  const updateParagraph = (clauseIndex: number, paragraphIndex: number, value: string) => {
    setDoc((prev: any) => {
      const next = ensureDocumentShape(prev);
      next.clauses[clauseIndex].paragraphs[paragraphIndex].text = value;
      return next;
    });
  };

  const addClause = () => {
    setDoc((prev: any) => {
      const next = ensureDocumentShape(prev);
      const stamp = Date.now();
      next.clauses.push({
        id: String(stamp),
        title: `New Clause ${next.clauses.length + 1}`,
        heading: `New Clause ${next.clauses.length + 1}`,
        paragraphs: [{ key: `c${next.clauses.length + 1}_p1_${stamp}`, text: '' }],
      });
      return next;
    });
  };

  const removeClause = (index: number) => {
    setDoc((prev: any) => {
      const next = ensureDocumentShape(prev);
      next.clauses.splice(index, 1);
      return next;
    });
  };

  const addParagraph = (clauseIndex: number) => {
    setDoc((prev: any) => {
      const next = ensureDocumentShape(prev);
      const stamp = Date.now();
      next.clauses[clauseIndex].paragraphs.push({
        key: `c${clauseIndex + 1}_p${next.clauses[clauseIndex].paragraphs.length + 1}_${stamp}`,
        text: '',
      });
      return next;
    });
  };

  const removeParagraph = (clauseIndex: number, paragraphIndex: number) => {
    setDoc((prev: any) => {
      const next = ensureDocumentShape(prev);
      next.clauses[clauseIndex].paragraphs.splice(paragraphIndex, 1);
      return next;
    });
  };

  const addAnnexureItem = () => {
    setDoc((prev: any) => {
      const next = ensureDocumentShape(prev);
      next.annexure.push({ label: '', value: '' });
      return next;
    });
  };

  const updateAnnexure = (index: number, key: 'label' | 'value', value: string) => {
    setDoc((prev: any) => {
      const next = ensureDocumentShape(prev);
      next.annexure[index][key] = value;
      return next;
    });
  };

  const removeAnnexureItem = (index: number) => {
    setDoc((prev: any) => {
      const next = ensureDocumentShape(prev);
      next.annexure.splice(index, 1);
      return next;
    });
  };

  const saveObservation = async (observationId: string, status?: string) => {
    if (!agreement?.id) return;

    setSaving(true);
    setErr('');
    setMsg('');

    try {
      const res = await fetch(
        `/api/admin/agreements/${agreement.id}/observations/${observationId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminResponse: observationDrafts[observationId] || '',
            ...(status ? { status } : {}),
          }),
        },
      );

      const json = await readJson(res);
      if (!res.ok) throw new Error(json?.error || 'Failed to update observation');

      await load();
      setMsg(status ? `Observation marked ${status}` : 'Observation response saved');
      setTimeout(() => setMsg(''), 2500);
    } catch (e: any) {
      setErr(e?.message || 'Failed to update observation');
    } finally {
      setSaving(false);
    }
  };

  const observationCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const obs of observations) {
      const key = `${obs.clauseId}:${obs.paragraphKey}`;
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [observations]);

  if (loading) return <p className="text-mitti">Loading agreement workbench...</p>;
  if (err && !bundle) return <p className="text-madder">{err}</p>;
  if (!seller || !agreement) return <p className="text-madder">Agreement workbench unavailable.</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/sellers/${id}`}
          className="text-xs tracking-wider text-mitti hover:text-kohl inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-3 h-3" /> BACK TO SELLER
        </Link>

        <p className="label text-madder mt-6">LEGAL WORKBENCH</p>
        <div className="flex items-start justify-between gap-4 flex-wrap mt-2">
          <div>
            <h1 className="font-display text-4xl text-kohl">
              Agreement workbench - {seller.businessName || 'Seller'}
            </h1>
            <p className="font-italic italic text-mitti mt-2">
              Admin/legal can revise, lock, route for signature, and close the agreement.
            </p>
          </div>

          <span className={`text-xs tracking-wider px-3 py-2 ${badgeTone(String(agreement.status || 'DRAFT'))}`}>
            {String(agreement.status || 'DRAFT').replace(/_/g, ' ')}
          </span>
        </div>
        <div className="madder-divider mt-4"></div>
      </div>

      {msg ? <p className="text-neem text-sm">{msg}</p> : null}
      {err ? <p className="text-madder text-sm">{err}</p> : null}

      <div className="grid xl:grid-cols-[1.35fr_0.65fr] gap-6">
        <div className="space-y-6">
          <section className="bg-beige p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="label text-mitti">WORKFLOW CONTROLS</p>
                <p className="text-xs text-mitti mt-1">
                  Sellers can comment and sign only when permitted. Final lock/finalisation remains admin-controlled.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/agreement/admin/sellers/${id}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 px-3 py-2 bg-kohl text-ivory text-xs tracking-wider hover:opacity-90"
                >
                  <Printer className="w-3.5 h-3.5" /> PRINT PREVIEW
                </Link>

                <Link
                  href={`/seller/agreements/${agreement.id}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 px-3 py-2 border border-mitti/30 text-xs tracking-wider text-mitti hover:bg-mitti/5"
                >
                  Seller review <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            <div className="grid lg:grid-cols-[190px_1fr] gap-4 mt-5">
              <div>
                <label className="label text-mitti">STATUS</label>
                <select
                  value={draftStatus}
                  onChange={e => setDraftStatus(e.target.value)}
                  className="w-full p-3 bg-ivory border border-mitti/20 text-sm mt-1"
                >
                  {STATUS_OPTIONS.map(status => (
                    <option key={status} value={status}>
                      {status.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label text-mitti">CHANGE SUMMARY</label>
                <input
                  value={changeSummary}
                  onChange={e => setChangeSummary(e.target.value)}
                  placeholder="Example: revised termination clause and updated signatory"
                  className="w-full p-3 bg-ivory border border-mitti/20 text-sm mt-1"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              <button
                onClick={saveDraft}
                disabled={saving}
                className="btn-primary text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" /> SAVE DRAFT
              </button>

              <button
                onClick={() => workflowAction('set-status', { status: draftStatus })}
                disabled={saving}
                className="px-3 py-2 border border-mitti/25 text-xs tracking-wider text-mitti hover:bg-mitti/5 disabled:opacity-50"
              >
                APPLY STATUS
              </button>

              <button
                onClick={() => workflowAction('lock')}
                disabled={saving}
                className="px-3 py-2 bg-kohl text-ivory text-xs tracking-wider inline-flex items-center gap-1 disabled:opacity-50"
              >
                <Lock className="w-3.5 h-3.5" /> LOCK
              </button>

              <button
                onClick={() => workflowAction('reopen')}
                disabled={saving}
                className="px-3 py-2 border border-kohl text-kohl text-xs tracking-wider inline-flex items-center gap-1 disabled:opacity-50"
              >
                <LockOpen className="w-3.5 h-3.5" /> REOPEN
              </button>

              <button
                onClick={() => workflowAction('send-for-signature')}
                disabled={saving}
                className="px-3 py-2 bg-banarasi text-ivory text-xs tracking-wider inline-flex items-center gap-1 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" /> SEND FOR SIGNATURE
              </button>

              <button
                onClick={() => workflowAction('set-signatory', { signatoryId: selectedSignatory || null, ...commercialPayload() })}
                disabled={saving}
                className="px-3 py-2 border border-mitti/25 text-xs tracking-wider text-mitti hover:bg-mitti/5 disabled:opacity-50"
              >
                APPLY SIGNATORY + TERMS
              </button>

              <button
                onClick={() => workflowAction('company-sign', { signatoryId: selectedSignatory || null, ...commercialPayload() })}
                disabled={saving}
                className="px-3 py-2 bg-neem text-ivory text-xs tracking-wider inline-flex items-center gap-1 disabled:opacity-50"
              >
                <ShieldCheck className="w-3.5 h-3.5" /> COMPANY SIGN
              </button>

              <button
                onClick={() => workflowAction('close')}
                disabled={saving}
                className="px-3 py-2 border border-neem text-neem text-xs tracking-wider disabled:opacity-50"
              >
                CLOSE
              </button>
            </div>
          </section>

          <section className="bg-beige p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="label text-mitti">RECITALS / WHEREAS</p>
                <p className="text-xs text-mitti mt-1">Editable preamble lines appearing before the clauses.</p>
              </div>
              <button
                onClick={addRecital}
                className="btn-outline text-xs inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> ADD RECITAL
              </button>
            </div>

            <div className="space-y-3 mt-4">
              {doc.recitals?.length ? (
                doc.recitals.map((item: string, index: number) => (
                  <div key={index} className="bg-ivory border border-mitti/15 p-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <p className="label text-mitti">RECITAL {index + 1}</p>
                      <button
                        onClick={() => removeRecital(index)}
                        className="text-madder text-xs inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> REMOVE
                      </button>
                    </div>
                    <textarea
                      value={item || ''}
                      onChange={e => updateRecital(index, e.target.value)}
                      rows={3}
                      className="w-full p-3 bg-ivory border border-mitti/20 text-sm"
                    />
                  </div>
                ))
              ) : (
                <div className="bg-ivory border border-dashed border-mitti/25 p-4 text-xs text-mitti">
                  No recitals yet.
                </div>
              )}
            </div>
          </section>

          <section className="bg-beige p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="label text-mitti">CLAUSES</p>
                <p className="text-xs text-mitti mt-1">
                  Edit titles and paragraph text, add or remove clauses and paragraphs.
                </p>
              </div>
              <button
                onClick={addClause}
                className="btn-outline text-xs inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> ADD CLAUSE
              </button>
            </div>

            <div className="space-y-4 mt-4">
              {doc.clauses?.map((clause: any, clauseIndex: number) => (
                <div key={clause.id || clauseIndex} className="bg-ivory border border-mitti/15 p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <label className="label text-mitti">CLAUSE TITLE</label>
                      <input
                        value={clause.title || ''}
                        onChange={e => updateClauseTitle(clauseIndex, e.target.value)}
                        className="w-full p-3 bg-ivory border border-mitti/20 text-sm mt-1"
                      />
                    </div>

                    <button
                      onClick={() => removeClause(clauseIndex)}
                      className="text-madder text-xs inline-flex items-center gap-1 shrink-0 mt-6"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> REMOVE CLAUSE
                    </button>
                  </div>

                  <div className="space-y-3">
                    {(clause.paragraphs || []).map((paragraph: any, paragraphIndex: number) => {
                      const obsKey = `${String(clause.id)}:${String(paragraph.key)}`;
                      const count = observationCounts[obsKey] || 0;

                      return (
                        <div key={paragraph.key || paragraphIndex} className="border border-mitti/10 p-3">
                          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                            <p className="label text-mitti">PARAGRAPH {paragraphIndex + 1}</p>
                            <div className="flex items-center gap-3">
                              {count ? (
                                <span className="text-[10px] tracking-wider px-2 py-1 bg-beige text-kohl">
                                  {count} OBSERVATION{count === 1 ? '' : 'S'}
                                </span>
                              ) : null}
                              <button
                                onClick={() => removeParagraph(clauseIndex, paragraphIndex)}
                                className="text-madder text-xs inline-flex items-center gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> REMOVE
                              </button>
                            </div>
                          </div>

                          <textarea
                            value={paragraph.text || ''}
                            onChange={e => updateParagraph(clauseIndex, paragraphIndex, e.target.value)}
                            rows={5}
                            className="w-full p-3 bg-ivory border border-mitti/20 text-sm"
                          />
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => addParagraph(clauseIndex)}
                    className="mt-3 text-xs text-kohl inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> ADD PARAGRAPH
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-beige p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="label text-mitti">ANNEXURE</p>
                <p className="text-xs text-mitti mt-1">Editable end-of-document commercial fields.</p>
              </div>
              <button
                onClick={addAnnexureItem}
                className="btn-outline text-xs inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> ADD ITEM
              </button>
            </div>

            <div className="space-y-3 mt-4">
              {doc.annexure?.map((item: any, index: number) => (
                <div key={index} className="grid md:grid-cols-[1fr_1fr_auto] gap-3 bg-ivory border border-mitti/15 p-4">
                  <input
                    value={item.label || ''}
                    onChange={e => updateAnnexure(index, 'label', e.target.value)}
                    placeholder="Label"
                    className="w-full p-3 bg-ivory border border-mitti/20 text-sm"
                  />
                  <input
                    value={item.value || ''}
                    onChange={e => updateAnnexure(index, 'value', e.target.value)}
                    placeholder="Value"
                    className="w-full p-3 bg-ivory border border-mitti/20 text-sm"
                  />
                  <button
                    onClick={() => removeAnnexureItem(index)}
                    className="text-madder text-xs inline-flex items-center gap-1 px-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> REMOVE
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-beige p-5">
            <p className="label text-madder mb-3">SELLER SNAPSHOT</p>
            <div className="space-y-2 text-sm">
              <p className="font-display text-2xl text-kohl">{seller.businessName || '-'}</p>
              <p className="text-mitti">{seller.contactName || '-'}</p>
              <p className="text-mitti">{seller.email || '-'}</p>
              <p className="text-mitti">{seller.phone || '-'}</p>
              <p className="text-mitti">Address: {seller.address || '-'}</p>
                      <div className="mt-2 rounded border border-dashed border-stone-300 bg-stone-50 p-2 text-[11px]">
                        <p className="font-medium text-stone-700">ADDRESS DIAG</p>
                        <p className="text-stone-600">/api/admin/sellers/[id]: {addressDiag.sellerApi || '-'}</p>
                        <p className="text-stone-600">workflow currentDocumentJson: {addressDiag.workflowDoc || '-'}</p>
                        <p className="text-stone-600">/api/admin/sellers/[id]/agreement: {addressDiag.agreementApi || '-'}</p>
                      </div>
              <p className="text-mitti">
                {[seller.craft, seller.region].filter(Boolean).join(' - ') || '-'}
              </p>
              <p className="text-mitti">Commission: {seller.commissionPct ?? '-'}%</p>
              <p className="text-mitti">Payout cycle: {seller.payoutCycle || '-'}</p>
            </div>
          </section>

          <section className="bg-beige p-5">
            <div className="bg-beige border border-mitti/15 p-5 mb-6">
              <p className="label text-madder mb-3">COMMERCIAL TERMS</p>

              <div className="grid md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="label text-mitti">AGREEMENT NUMBER</span>
                  <input
                    value={agreementNumber}
                    onChange={e => setAgreementNumber(e.target.value.toUpperCase())}
                    placeholder={`AGR-${String(id || '').slice(-8).toUpperCase()}`}
                    className="w-full p-3 bg-ivory border border-mitti/20 text-sm mt-1"
                  />
                  <p className="text-[11px] text-mitti mt-1">Auto-generated if blank on first save.</p>
                </label>

                <label className="block">
                  <span className="label text-mitti">EFFECTIVE DATE</span>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={e => setEffectiveDate(e.target.value)}
                    className="w-full p-3 bg-ivory border border-mitti/20 text-sm mt-1"
                  />
                </label>

                <label className="block">
                  <span className="label text-mitti">VALID FROM</span>
                  <input
                    type="date"
                    value={validFrom}
                    onChange={e => setValidFrom(e.target.value)}
                    className="w-full p-3 bg-ivory border border-mitti/20 text-sm mt-1"
                  />
                </label>

                <label className="block">
                  <span className="label text-mitti">VALID TO</span>
                  <input
                    type="date"
                    value={validTo}
                    onChange={e => setValidTo(e.target.value)}
                    className="w-full p-3 bg-ivory border border-mitti/20 text-sm mt-1"
                  />
                </label>

                <label className="block">
                  <span className="label text-mitti">RENEWAL MODE</span>
                  <select
                    value={renewalMode}
                    onChange={e => setRenewalMode(e.target.value)}
                    className="w-full p-3 bg-ivory border border-mitti/20 text-sm mt-1"
                  >
                    <option value="MANUAL">MANUAL</option>
                    <option value="AUTO_RENEW">AUTO RENEW</option>
                    <option value="RENEGOTIATION_REQUIRED">RENEGOTIATION REQUIRED</option>
                    <option value="NON_RENEWING">NON RENEWING</option>
                  </select>
                </label>

                <label className="block">
                  <span className="label text-mitti">RENEWAL NOTICE DAYS</span>
                  <input
                    type="number"
                    min="0"
                    value={renewalNoticeDays}
                    onChange={e => setRenewalNoticeDays(e.target.value)}
                    className="w-full p-3 bg-ivory border border-mitti/20 text-sm mt-1"
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="label text-mitti">EXPIRY ACTION</span>
                  <select
                    value={expiryAction}
                    onChange={e => setExpiryAction(e.target.value)}
                    className="w-full p-3 bg-ivory border border-mitti/20 text-sm mt-1"
                  >
                    <option value="LOCK_STOCK_BARREL">LOCK STOCK BARREL</option>
                    <option value="BLOCK_NEW_UPLOADS">BLOCK NEW UPLOADS</option>
                    <option value="REQUIRE_RENEGOTIATION">REQUIRE RENEGOTIATION</option>
                    <option value="CLOSE_AGREEMENT">CLOSE AGREEMENT</option>
                  </select>
                </label>

                <label className="block md:col-span-2">
                  <span className="label text-mitti">RENEGOTIATION REASON</span>
                  <textarea
                    value={renegotiationReason}
                    onChange={e => setRenegotiationReason(e.target.value)}
                    className="w-full p-3 bg-ivory border border-mitti/20 text-sm mt-1 min-h-[88px]"
                  />
                </label>
              </div>
            </div>

            <p className="label text-madder mb-3">COMPANY SIGNATORY</p>

            <select
              value={selectedSignatory}
              onChange={e => setSelectedSignatory(e.target.value)}
              className="w-full p-3 bg-ivory border border-mitti/20 text-sm"
            >
              <option value="">Select signatory</option>
              {signatories.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name} - {s.title}{s.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </select>

            <button
              onClick={() => workflowAction('set-signatory', { signatoryId: selectedSignatory || null })}
              disabled={saving}
              className="btn-primary text-xs inline-flex items-center gap-1.5 mt-3 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" /> SAVE SIGNATORY
            </button>

            {selectedSignatory ? (
              <div className="mt-4">
                {signatories
                  .filter((s: any) => s.id === selectedSignatory)
                  .map((s: any) => (
                    <div key={s.id} className="bg-ivory border border-mitti/15 p-4 text-xs">
                      <p className="text-kohl font-medium">{s.name}</p>
                      <p className="text-mitti mt-1">{s.title}</p>
                      {s.signatureUrl ? (
                        <div className="mt-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={s.signatureUrl}
                            alt={s.name}
                            className="h-20 w-auto object-contain bg-white border border-mitti/10 p-2"
                          />
                        </div>
                      ) : null}
                    </div>
                  ))}
              </div>
            ) : null}
          </section>

          <section className="bg-beige p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="label text-madder">SELLER OBSERVATIONS</p>
                <p className="text-xs text-mitti mt-1">
                  Reply, resolve, or reject observations paragraph by paragraph.
                </p>
              </div>
              <span className="text-xs tracking-wider text-mitti">
                {observations.length} total
              </span>
            </div>

            {observations.length === 0 ? (
              <div className="bg-ivory border border-dashed border-mitti/25 p-4 text-xs text-mitti">
                No seller observations yet.
              </div>
            ) : (
              <div className="space-y-4">
                {observations.map((obs: any) => (
                  <div key={obs.id} className="bg-ivory border border-mitti/15 p-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-xs text-kohl font-medium">
                          Clause {obs.clauseId} - {obs.paragraphKey}
                        </p>
                        <p className="text-[11px] text-mitti mt-1">
                          Status: {String(obs.status || 'OPEN').replace(/_/g, ' ')}
                        </p>
                      </div>
                      <span className={`text-[10px] tracking-wider px-2 py-1 ${badgeTone(String(obs.status || 'OPEN'))}`}>
                        {String(obs.status || 'OPEN').replace(/_/g, ' ')}
                      </span>
                    </div>

                    {obs.paragraphText ? (
                      <div className="mt-3 p-3 border border-mitti/10 text-xs text-mitti bg-beige/40">
                        {obs.paragraphText}
                      </div>
                    ) : null}

                    <div className="mt-3">
                      <p className="label text-mitti">SELLER COMMENT</p>
                      <p className="text-sm text-kohl mt-1">{obs.sellerComment}</p>
                    </div>

                    <div className="mt-3">
                      <label className="label text-mitti">ADMIN RESPONSE</label>
                      <textarea
                        value={observationDrafts[obs.id] || ''}
                        onChange={e =>
                          setObservationDrafts(prev => ({
                            ...prev,
                            [obs.id]: e.target.value,
                          }))
                        }
                        rows={3}
                        className="w-full p-3 bg-ivory border border-mitti/20 text-sm mt-1"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        onClick={() => saveObservation(obs.id)}
                        disabled={saving}
                        className="btn-outline text-xs disabled:opacity-50"
                      >
                        SAVE RESPONSE
                      </button>
                      <button
                        onClick={() => saveObservation(obs.id, 'RESOLVED')}
                        disabled={saving}
                        className="px-3 py-2 border border-neem text-neem text-xs tracking-wider disabled:opacity-50"
                      >
                        RESOLVE
                      </button>
                      <button
                        onClick={() => saveObservation(obs.id, 'REJECTED')}
                        disabled={saving}
                        className="px-3 py-2 border border-madder text-madder text-xs tracking-wider disabled:opacity-50"
                      >
                        REJECT
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-ivory border border-dashed border-mitti/20 p-4 text-xs text-mitti">
            Printable agreement remains available separately via the print preview link.
            This workbench is for draft control, signatory selection, and legal review workflow.
          </section>
        </div>
      </div>
    </div>
  );
}
