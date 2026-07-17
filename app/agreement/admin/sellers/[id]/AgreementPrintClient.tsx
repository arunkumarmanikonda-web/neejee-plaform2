'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Printer } from 'lucide-react';

export default function AgreementPrintClient({ sellerId }: { sellerId: string }) {
  const [agreement, setAgreement] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!sellerId) return;
    setLoading(true);
    setErr('');

    fetch(`/api/admin/sellers/${sellerId}/agreement`, { cache: 'no-store' })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load agreement');
        setAgreement(data?.agreement || null);
      })
      .catch((e: any) => setErr(e?.message || 'Failed to load agreement'))
      .finally(() => setLoading(false));
  }, [sellerId]);

  if (loading) return <div className="px-8 py-10 text-sm text-stone-600">Loading agreement...</div>;
  if (err) return <div className="px-8 py-10 text-sm text-red-700">{err}</div>;
  if (!agreement) return <div className="px-8 py-10 text-sm text-red-700">Agreement not found.</div>;

  const company = agreement.company || {};
  const seller = agreement.seller || {};
  const terms = agreement.commercialTerms || {};
  const execution = agreement.execution || {};

  return (
    <div className="min-h-screen bg-[#f5f1ea] text-[#1d1916] agreement-root">
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 14mm 12mm 16mm 12mm;
        }

        @media print {
          html, body {
            background: #ffffff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .print-toolbar {
            display: none !important;
          }

          .agreement-shell {
            max-width: none !important;
            padding: 0 !important;
          }

          .agreement-card {
            border: none !important;
            box-shadow: none !important;
            margin: 0 !important;
          }

          .page-break {
            break-before: page;
            page-break-before: always;
          }

          .avoid-break {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          a {
            color: inherit !important;
            text-decoration: none !important;
          }
        }
      `}</style>

      <div className="print-toolbar max-w-5xl mx-auto px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/admin/sellers/${sellerId}`}
              className="inline-flex items-center gap-1 px-3 py-2 border border-stone-300 bg-white text-xs tracking-wider hover:bg-stone-50"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> BACK TO REVIEW
            </Link>

            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1 px-3 py-2 bg-[#1d1916] text-white text-xs tracking-wider hover:opacity-90"
            >
              <Printer className="w-3.5 h-3.5" /> PRINT / SAVE PDF
            </button>
          </div>

          {agreement.existingAgreementDocument?.fileUrl ? (
            <a
              href={agreement.existingAgreementDocument.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[#7a4031] hover:text-[#1d1916]"
            >
              Open uploaded agreement <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ) : null}
        </div>
      </div>

      <div className="agreement-shell max-w-5xl mx-auto px-4 pb-10">
        <div className="agreement-card bg-white border border-stone-300 shadow-sm">
          <div className="border-b border-stone-300 px-8 py-8">
            <div className="flex items-start justify-between gap-6 avoid-break">
              <div className="flex-1">
                <p className="text-[11px] uppercase tracking-[0.35em] text-stone-500">
                  {company.brandName || 'NEEJEE'}
                </p>
                <h1 className="mt-2 text-3xl font-semibold text-stone-900">
                  {agreement.title || 'Marketplace Seller Agreement'}
                </h1>
                <p className="mt-2 text-sm text-stone-600">
                  {agreement.subtitle || 'Standard agreement with seller-specific commercial schedule'}
                </p>
                <p className="mt-3 text-[11px] text-stone-500">
                  Generated on{' '}
                  {agreement.generatedAt ? new Date(agreement.generatedAt).toLocaleString('en-IN') : '—'}
                </p>
              </div>

              {company.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={company.logoUrl}
                  alt="Company logo"
                  className="h-16 w-auto object-contain"
                />
              ) : null}
            </div>

            <div className="mt-6 grid md:grid-cols-2 gap-6 text-sm">
              <div className="avoid-break">
                <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500 mb-2">Company</p>
                <p className="font-semibold">{company.legalName || 'Oye Imagine Private Limited'}</p>
                <p className="mt-1 text-stone-600">{company.address || '—'}</p>
                <p className="mt-1 text-stone-600">GSTIN: {company.gstin || '—'}</p>
                <p className="text-stone-600">PAN: {company.pan || '—'}</p>
                {company.cinNumber ? <p className="text-stone-600">CIN: {company.cinNumber}</p> : null}
                {company.msmeNumber ? <p className="text-stone-600">MSME/Udyam: {company.msmeNumber}</p> : null}
                {company.contactEmail ? <p className="text-stone-600">Email: {company.contactEmail}</p> : null}
                {company.contactPhone ? <p className="text-stone-600">Phone: {company.contactPhone}</p> : null}
              </div>

              <div className="avoid-break">
                <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500 mb-2">Seller</p>
                <p className="font-semibold">{seller.businessName || '—'}</p>
                <p className="mt-1 text-stone-600">Contact: {seller.contactName || '—'}</p>
                <p className="text-stone-600">Email: {seller.email || '—'}</p>
                <p className="text-stone-600">Phone: {seller.phone || '—'}</p>
                <p className="text-stone-600">
                  Craft / Region: {[seller.craft, seller.region].filter(Boolean).join(' • ') || '—'}
                </p>
                <p className="text-stone-600">PAN: {seller.pan || '—'}</p>
                <p className="text-stone-600">GSTIN: {seller.gstin || '—'}</p>
                <p className="text-stone-600">
                  Bank: {[seller.bankName, seller.ifsc, seller.bankAccountMasked].filter(Boolean).join(' • ') || '—'}
                </p>
              </div>
            </div>
          </div>

          <div className="px-8 py-8 space-y-8">
            <section className="avoid-break">
              <p className="text-[11px] uppercase tracking-[0.25em] text-stone-500 mb-3">Recitals</p>
              <div className="space-y-3 text-[14px] leading-7 text-stone-800">
                {agreement.recitals?.map((item: string, idx: number) => (
                  <p key={idx}>{item}</p>
                ))}
              </div>
            </section>

            <section className="avoid-break">
              <p className="text-[11px] uppercase tracking-[0.25em] text-stone-500 mb-3">
                Commercial Schedule
              </p>
              <div className="grid md:grid-cols-2 gap-x-8 gap-y-3 border border-stone-200 p-5">
                <Term label="Commission %" value={`${terms.commissionPct ?? 20}%`} />
                <Term label="Payout cycle" value={terms.payoutCycle || 'MONTHLY'} />
                <Term label="Neejee Select" value={terms.isNeejeeSelect ? 'Yes' : 'No'} />
                <Term label="Quality score" value={String(terms.qualityScore ?? 0)} />
                <Term
                  label="Years of practice"
                  value={terms.yearsOfPractice != null ? String(terms.yearsOfPractice) : '—'}
                />
                <Term label="Cluster" value={terms.cluster || '—'} />
                <Term
                  label="Banking details"
                  value={[seller.bankName, seller.ifsc, seller.bankAccountMasked].filter(Boolean).join(' • ') || '—'}
                />
                <Term label="Template version" value={agreement.templateVersion || '—'} />
              </div>
            </section>

            <section className="page-break">
              <p className="text-[11px] uppercase tracking-[0.25em] text-stone-500 mb-4">
                Standard Clauses
              </p>
              <div className="space-y-6">
                {agreement.clauses?.map((clause: any) => (
                  <div key={clause.no || clause.title} className="avoid-break">
                    <h3 className="text-[15px] font-semibold text-stone-900">
                      {clause.no}. {clause.title}
                    </h3>
                    <p className="mt-2 text-[14px] leading-7 text-stone-800 text-justify">
                      {clause.text}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="page-break">
              <p className="text-[11px] uppercase tracking-[0.25em] text-stone-500 mb-3">
                Annexure A — Seller-Specific Particulars
              </p>
              <div className="border border-stone-200 divide-y divide-stone-100">
                {agreement.annexure?.map((item: any) => (
                  <div key={item.label} className="grid grid-cols-2 gap-4 px-5 py-3 text-sm">
                    <div className="text-stone-600">{item.label}</div>
                    <div className="text-right text-stone-900">{item.value || '—'}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="page-break">
              <p className="text-[11px] uppercase tracking-[0.25em] text-stone-500 mb-3">Execution</p>
              <div className="grid md:grid-cols-2 gap-10">
                <div className="border border-stone-200 p-5 min-h-[250px] avoid-break">
                  <p className="text-sm font-semibold">For {company.legalName || 'Oye Imagine Private Limited'}</p>

                  <div className="h-20 mt-6 flex items-end">
                    {execution.companySignatureUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={execution.companySignatureUrl}
                        alt="Company signature"
                        className="max-h-16 w-auto object-contain"
                      />
                    ) : (
                      <span className="text-xs text-stone-500">Authorised signature image not uploaded</span>
                    )}
                  </div>

                  <div className="mt-4 text-sm leading-7">
                    <p><span className="text-stone-500">Name:</span> {execution.companySignatoryName || 'Authorised Signatory'}</p>
                    <p><span className="text-stone-500">Title:</span> {execution.companySignatoryTitle || 'Authorised Signatory'}</p>
                    <p><span className="text-stone-500">Place:</span> {execution.placeOfExecution || 'India'}</p>
                  </div>
                </div>

                <div className="border border-stone-200 p-5 min-h-[250px] avoid-break">
                  <p className="text-sm font-semibold">Accepted by Seller</p>

                  <div className="h-20 mt-6 flex items-end">
                    <span className="text-xs text-stone-500">
                      Digital seller signature workflow to be added in Phase 3
                    </span>
                  </div>

                  <div className="mt-4 text-sm leading-7">
                    <p><span className="text-stone-500">Name:</span> {seller.contactName || seller.businessName || '—'}</p>
                    <p><span className="text-stone-500">Business:</span> {seller.businessName || '—'}</p>
                    <p><span className="text-stone-500">Email:</span> {seller.email || '—'}</p>
                    <p><span className="text-stone-500">Phone:</span> {seller.phone || '—'}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 border border-dashed border-stone-300 p-4 text-xs text-stone-600">
                {execution.executionNote || 'Seller-side digital execution remains pending.'}
              </div>
            </section>
          </div>

          <div className="border-t border-stone-300 px-8 py-4 text-[11px] text-stone-500">
            {company.brandName || 'NEEJEE'} • Marketplace Seller Agreement • Template {agreement.templateVersion || '—'}
          </div>
        </div>
      </div>
    </div>
  );
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-stone-600">{label}</span>
      <span className="text-right text-stone-900">{value || '—'}</span>
    </div>
  );
}