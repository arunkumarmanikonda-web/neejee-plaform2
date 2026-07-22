'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Check, ExternalLink, Printer, Save, X } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function AdminSellerDetail() {
  const params = useParams();
  const id = params?.id as string;

  const [seller, setSeller] = useState<any>(null);
  const [agreement, setAgreement] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setErr('');
    try {
      const [sellerRes, agreementRes] = await Promise.all([
        fetch(`/api/admin/sellers/${id}`, { cache: 'no-store' }),
        fetch(`/api/admin/sellers/${id}/agreement`, { cache: 'no-store' }),
      ]);

      const sellerJson = await sellerRes.json();
      let agreementJson: any = null;
      try {
        agreementJson = await agreementRes.json();
      } catch {
        agreementJson = null;
      }

      if (!sellerRes.ok) {
        throw new Error(sellerJson?.error || 'Failed to load seller');
      }

      setSeller(sellerJson?.seller || null);
      setAgreement(agreementJson?.agreement || null);
    } catch (e: any) {
      setSeller(null);
      setAgreement(null);
      setErr(e?.message || 'Failed to load seller');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  const patch = async (body: any) => {
    setSaving(true);
    setErr('');
    setMsg('');
    try {
      const res = await fetch(`/api/admin/sellers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Update failed');
      setSeller(j.seller);
      setMsg('Saved');
      setTimeout(() => setMsg(''), 2500);
      await load();
    } catch (e: any) {
      setErr(e?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-mitti">Loading...</p>;
  if (err && !seller) return <p className="text-madder">{err}</p>;
  if (!seller) return <p className="text-madder">Seller not found.</p>;

  const update = (key: string, value: any) => setSeller({ ...seller, [key]: value });

  return (
    <>
      <Link href="/admin/sellers" className="text-xs tracking-wider text-mitti hover:text-kohl flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" /> ALL SELLERS
      </Link>

      <h1 className="font-display text-4xl text-kohl mt-2">{seller.businessName || 'Seller'}</h1>
      <p className="font-italic italic text-mitti mt-2">
        {[seller.craft, seller.region].filter(Boolean).join(` ${String.fromCharCode(0x2022)} `) || 'Application review'}
      </p>
      <div className="madder-divider mt-4"></div>

      {msg && <p className="text-neem text-sm mt-4">{msg}</p>}
      {err && <p className="text-madder text-sm mt-4">{err}</p>}

      <div className="mt-6 bg-beige p-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="label text-mitti">CURRENT STATUS</p>
          <p className="font-display text-2xl text-kohl mt-1">{String(seller.kycStatus || 'PENDING').replace(/_/g, ' ')}</p>
          {seller.kycStatus === 'REJECTED' && seller.rejectionNote ? (
            <p className="text-xs text-mitti mt-2 italic max-w-md">Note sent: "{seller.rejectionNote}"</p>
          ) : null}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {seller.kycStatus !== 'APPROVED' && (
            <button
              onClick={() => patch({ kycStatus: 'APPROVED', rejectionNote: null })}
              disabled={saving}
              className="px-4 py-2 bg-neem text-ivory text-xs tracking-wider hover:bg-neem/90 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" /> {seller.kycStatus === 'REJECTED' ? 'RE-APPROVE' : 'APPROVE'}
            </button>
          )}

          {seller.kycStatus !== 'UNDER_REVIEW' && seller.kycStatus !== 'APPROVED' && (
            <button
              onClick={() => patch({ kycStatus: 'UNDER_REVIEW' })}
              disabled={saving}
              className="px-4 py-2 bg-banarasi text-ivory text-xs tracking-wider hover:bg-banarasi/90 disabled:opacity-50"
            >
              MARK UNDER REVIEW
            </button>
          )}

          {seller.kycStatus !== 'REJECTED' && (
            <button
              onClick={() => setRejectOpen(true)}
              disabled={saving}
              className="px-4 py-2 border border-madder text-madder text-xs tracking-wider hover:bg-madder/10 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <X className="w-4 h-4" /> REJECT
            </button>
          )}

          <button
            onClick={() => patch({ resendApplicationEmail: true })}
            disabled={saving}
            className="px-3 py-2 border border-mitti/30 text-mitti text-[10px] tracking-wider hover:bg-mitti/5 disabled:opacity-50"
            title="Re-send the original application-received email"
          >
            RESEND CONFIRMATION
          </button>
        </div>
      </div>

      {rejectOpen ? (
        <div className="mt-4 bg-madder/5 border border-madder/30 p-4">
          <p className="label text-madder mb-2">REJECTION NOTE TO ARTISAN</p>
          <textarea
            value={rejectNote}
            onChange={e => setRejectNote(e.target.value)}
            placeholder="Optional - brief and kind"
            rows={3}
            className="w-full p-3 bg-ivory border border-mitti/20 text-sm"
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => {
                void patch({ kycStatus: 'REJECTED', rejectionNote: rejectNote });
                setRejectOpen(false);
              }}
              className="px-4 py-2 bg-madder text-ivory text-xs tracking-wider"
            >
              SEND REJECTION
            </button>
            <button
              onClick={() => setRejectOpen(false)}
              className="px-4 py-2 border border-mitti/30 text-xs tracking-wider"
            >
              CANCEL
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid lg:grid-cols-3 gap-6 mt-8">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-beige p-6">
            <p className="label text-madder mb-3">STORY</p>
            <p className="text-sm text-kohl whitespace-pre-wrap leading-relaxed">{seller.story || String.fromCharCode(0x2014)}</p>
          </section>

          {seller.portfolio && seller.portfolio.length > 0 ? (
            <section className="bg-beige p-6">
              <p className="label text-madder mb-3">PORTFOLIO ({seller.portfolio.length})</p>
              <div className="grid grid-cols-3 gap-3">
                {seller.portfolio.map((url: string, i: number) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-full aspect-square object-cover border border-mitti/20 hover:border-kohl" />
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          <section className="bg-beige p-6">
            <p className="label text-madder mb-3">COMMERCIAL TERMS</p>
            <div className="grid grid-cols-2 gap-4">
              <NumField label="Commission %" value={seller.commissionPct} onChange={v => update('commissionPct', v)} step={0.5} />
              <NumField label="Quality Score" value={seller.qualityScore} onChange={v => update('qualityScore', v)} step={0.1} max={5} />
              <div>
                <label className="label text-mitti">PAYOUT CYCLE</label>
                <select
                  value={seller.payoutCycle || 'MONTHLY'}
                  onChange={e => update('payoutCycle', e.target.value)}
                  className="w-full p-2 bg-ivory border border-mitti/20 text-sm mt-1"
                >
                  <option value="WEEKLY">Weekly</option>
                  <option value="FORTNIGHTLY">Fortnightly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </div>

              <label className="flex items-center gap-2 mt-6">
                <input
                  type="checkbox"
                  checked={!!seller.isNeejeeSelect}
                  onChange={e => update('isNeejeeSelect', e.target.checked)}
                  className="accent-madder"
                />
                <span className="text-sm text-kohl">NEEJEE Select</span>
              </label>
            </div>

            <button
              onClick={() =>
                patch({
                  commissionPct: parseFloat(seller.commissionPct),
                  qualityScore: parseFloat(seller.qualityScore),
                  payoutCycle: seller.payoutCycle,
                  isNeejeeSelect: seller.isNeejeeSelect,
                })
              }
              disabled={saving}
              className="btn-primary text-xs mt-4 inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" /> SAVE TERMS
            </button>
          </section>

          {seller.products?.length > 0 ? (
            <section className="bg-beige p-6">
              <p className="label text-madder mb-3">PRODUCTS ({seller.products.length})</p>
              <ul className="space-y-2">
                {seller.products.map((p: any) => (
                  <li key={p.id} className="flex items-center justify-between text-sm">
                    <Link href={`/admin/products/${p.id}`} className="text-kohl hover:text-madder">
                      {p.name}
                    </Link>
                    <span className="text-xs tracking-wider text-mitti">{p.status}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="space-y-4">
          <section className="bg-beige p-5">
            <p className="label text-madder mb-3">CONTACT</p>
            <p className="text-sm text-kohl">{seller.contactName || 'Ã¢â‚¬â€'}</p>
            <p className="text-xs text-mitti mt-1">{seller.email || 'Ã¢â‚¬â€'}</p>
            <p className="text-xs text-mitti">{seller.phone || 'Ã¢â‚¬â€'}</p>
            {seller.user ? (
              <p className="text-[10px] tracking-wider mt-3">
                User role: <span className="text-madder">{seller.user.role}</span>
              </p>
            ) : null}
          </section>

          <section className="bg-beige p-5">
            <p className="label text-madder mb-3">KYC DETAILS</p>
            <KvRow k="PAN" v={seller.pan} mono />
            <KvRow k="GSTIN" v={seller.gstin} mono />
            <KvRow k="Bank account" v={seller.bankAccount} mono />
            <KvRow k="IFSC" v={seller.ifsc} mono />
            <KvRow k="Bank name" v={seller.bankName} />
            <KvRow k="Years of practice" v={seller.yearsOfPractice} />
            <KvRow k="Cluster" v={seller.cluster} />
          </section>

          <section className="bg-beige p-5">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div>
                <p className="label text-madder">APPLICATION DOSSIER</p>
                <p className="text-xs text-mitti mt-1">Uploaded KYC files, support documents, and seller agreement artifacts.</p>
              </div>
            </div>

            {!seller.documents || seller.documents.length === 0 ? (
              <div className="border border-dashed border-mitti/30 p-4 text-xs text-mitti">
                No documents uploaded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {seller.documents.map((doc: any) => {
                  const href = doc.fileUrl || doc.url || '#';
                  const docType = String(doc.docType || doc.type || 'OTHER').replace(/_/g, ' ');
                  const docTitle = doc.title || doc.fileName || doc.name || docType;
                  const docStatus = doc.status || 'SUBMITTED';

                  return (
                    <div key={doc.id} className="flex items-center justify-between gap-3 border border-mitti/15 bg-ivory p-3">
                      <div className="min-w-0">
                        <p className="text-sm text-kohl truncate">{docTitle}</p>
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          <span className="text-[11px] uppercase tracking-wider text-mitti">{docType}</span>
                          <span className="text-[11px] uppercase tracking-wider text-banarasi">{docStatus}</span>
                          {doc.createdAt ? (
                            <span className="text-[11px] text-mitti">
                              {new Date(doc.createdAt).toLocaleString('en-IN')}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {href && href !== '#' ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 inline-flex items-center gap-1 text-xs text-madder hover:text-kohl"
                        >
                          View <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="shrink-0 text-xs text-mitti">No file URL</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="bg-beige p-5">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div>
                <p className="label text-madder">STANDARD SELLER AGREEMENT</p>
                <p className="text-xs text-mitti mt-1">Company-standard agreement with seller-specific terms and printable layout.</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <Link
                href={`/agreement/admin/sellers/${id}`}
                target="_blank"
                className="inline-flex items-center gap-1 px-3 py-2 bg-kohl text-ivory text-xs tracking-wider hover:opacity-90"
              >
                <Printer className="w-3.5 h-3.5" /> OPEN PRINTABLE AGREEMENT
              </Link>

              {agreement?.existingAgreementDocument?.fileUrl ? (
                <a
                  href={agreement.existingAgreementDocument.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-2 border border-mitti/30 text-xs tracking-wider text-mitti hover:bg-mitti/5"
                >
                  Open uploaded agreement <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : null}
            </div>

            {!agreement ? (
              <div className="border border-dashed border-mitti/30 p-4 text-xs text-mitti">
                Agreement preview unavailable.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-ivory border border-mitti/15 p-4">
                    <p className="label text-mitti mb-2">COMPANY</p>
                    <div className="space-y-1 text-xs">
                      <p className="text-kohl">{agreement.company?.legalName || 'Oye Imagine Private Limited'}</p>
                      <p className="text-mitti">{agreement.company?.brandName || 'NEEJEE'}</p>
                      <p className="text-mitti">{agreement.company?.address || 'Ã¢â‚¬â€'}</p>
                      <p className="text-mitti">GSTIN: {agreement.company?.gstin || 'Ã¢â‚¬â€'}</p>
                      <p className="text-mitti">PAN: {agreement.company?.pan || 'Ã¢â‚¬â€'}</p>
                      <p className="text-mitti">Authorised signatory: {agreement.company?.authorisedSignatory || 'Ã¢â‚¬â€'}</p>
                      <p className="text-mitti">Title: {agreement.company?.signatoryTitle || 'Ã¢â‚¬â€'}</p>
                    </div>

                    {agreement.company?.signatureUrl ? (
                      <div className="mt-3">
                        <p className="label text-mitti mb-2">COMPANY SIGNATURE</p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={agreement.company.signatureUrl}
                          alt="Authorised signature"
                          className="h-16 w-auto object-contain bg-white border border-mitti/10 p-2"
                        />
                      </div>
                    ) : null}
                  </div>

                  <div className="bg-ivory border border-mitti/15 p-4">
                    <p className="label text-mitti mb-2">SELLER + COMMERCIAL TERMS</p>
                    <div className="space-y-1 text-xs">
                      <p className="text-kohl">{agreement.seller?.businessName || 'Ã¢â‚¬â€'}</p>
                      <p className="text-mitti">Contact: {agreement.seller?.contactName || 'Ã¢â‚¬â€'}</p>
                      <p className="text-mitti">Email: {agreement.seller?.email || 'Ã¢â‚¬â€'}</p>
                      <p className="text-mitti">Phone: {agreement.seller?.phone || 'Ã¢â‚¬â€'}</p>
                      <p className="text-mitti">Craft / Region: {[agreement.seller?.craft, agreement.seller?.region].filter(Boolean).join(` ${String.fromCharCode(0x2022)} `) || String.fromCharCode(0x2014)}</p>
                      <p className="text-mitti">Commission: {agreement.commercialTerms?.commissionPct ?? 20}%</p>
                      <p className="text-mitti">Payout cycle: {agreement.commercialTerms?.payoutCycle || 'Ã¢â‚¬â€'}</p>
                      <p className="text-mitti">Neejee Select: {agreement.commercialTerms?.isNeejeeSelect ? 'Yes' : 'No'}</p>
                      <p className="text-mitti">Quality score: {agreement.commercialTerms?.qualityScore ?? 0}</p>
                      <p className="text-mitti">Cluster: {agreement.commercialTerms?.cluster || 'Ã¢â‚¬â€'}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-ivory border border-mitti/15 p-4">
                  <p className="label text-mitti mb-3">DETAILED CLAUSES</p>
                  <ol className="list-decimal pl-4 space-y-3 text-xs text-kohl">
                    {agreement.clauses?.map((clause: any) => (
                      <li key={clause.no || clause.title}>
                        <span className="font-medium">{clause.title}:</span> {clause.text}
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="bg-ivory border border-mitti/15 p-4">
                  <p className="label text-mitti mb-3">ANNEXURE: SELLER-SPECIFIC COMMERCIAL TERMS</p>
                  <div className="space-y-2">
                    {agreement.annexure?.map((item: any) => (
                      <div key={item.label} className="flex items-start justify-between gap-3 text-xs border-b border-mitti/10 pb-2 last:border-0">
                        <span className="text-mitti">{item.label}</span>
                        <span className="text-kohl text-right">{item.value || String.fromCharCode(0x2014)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-ivory border border-dashed border-mitti/20 p-4 text-xs text-mitti">
                  Printable agreement page is live. Seller-side digital signing remains pending for Phase 3.
                </div>
              </div>
            )}
          </section>

          {seller.payouts && seller.payouts.length > 0 ? (
            <section className="bg-beige p-5">
              <p className="label text-madder mb-3">RECENT PAYOUTS</p>
              <ul className="space-y-2 text-xs">
                {seller.payouts.slice(0, 5).map((p: any) => (
                  <li key={p.id} className="flex justify-between">
                    <span className="text-kohl">INR {(Number(p.netPayoutPaise || 0) / 100).toLocaleString('en-IN')}</span>
                    <span className="text-mitti">{p.status}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}

function NumField({
  label,
  value,
  onChange,
  step = 1,
  max,
}: {
  label: string;
  value: any;
  onChange: (val: string) => void;
  step?: number;
  max?: number;
}) {
  return (
    <div>
      <label className="label text-mitti">{label}</label>
      <input
        type="number"
        step={step}
        max={max}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        className="w-full p-2 bg-ivory border border-mitti/20 text-sm mt-1"
      />
    </div>
  );
}

function KvRow({ k, v, mono }: { k: string; v: any; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between text-xs py-1.5 border-b border-mitti/10 last:border-0">
      <span className="text-mitti">{k}</span>
      <span className={`${mono ? 'font-mono' : ''} text-kohl text-right ml-2`}>{v || String.fromCharCode(0x2014)}</span>
    </div>
  );
}