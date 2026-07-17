'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ExternalLink, Printer } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function AdminSellerAgreementPrintPage() {
  const params = useParams();
  const id = params?.id as string;

  const [agreement, setAgreement] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/admin/sellers/${id}/agreement`, { cache: 'no-store' })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load agreement');
        setAgreement(data?.agreement || null);
      })
      .catch((e: any) => setErr(e?.message || 'Failed to load agreement'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8 text-mitti">Loading agreement...</div>;
  if (err) return <div className="p-8 text-madder">{err}</div>;
  if (!agreement) return <div className="p-8 text-madder">Agreement not found.</div>;

  const company = agreement.company || {};
  const seller = agreement.seller || {};
  const terms = agreement.commercialTerms || {};
  const execution = agreement.execution || {};

  return (
    <div className="min-h-screen bg-[#f7f2ea] text-[#1f1a17]">
      <div className="max-w-5xl mx-auto px-4 py-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/sellers/${id}`}
              className="inline-flex items-center gap-1 px-3 py-2 border border-[#c9bfb2] text-xs tracking-wider hover:bg-white"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> BACK TO REVIEW
            </Link>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1 px-3 py-2 bg-[#1f1a17] text-white text-xs tracking-wider hover:opacity-90"
            >
              <Printer className="w-3.5 h-3.5" /> PRINT / SAVE PDF
            </button>
          </div>

          {agreement.existingAgreementDocument?.fileUrl ? (
            <a
              href={agreement.existingAgreementDocument.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[#7a4031] hover:text-[#1f1a17]"
            >
              Open uploaded agreement <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ) : null}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-10">
        <div className="bg-white border border-[#d8cec2] shadow-sm print:shadow-none print:border-0">
          <div className="border-b border-[#d8cec2] px-8 py-8">
            <div className="flex items-start justify-between gap-6">
              <div className="flex-1">
                <p className="text-xs uppercase tracking-[0.3em] text-[#7f6c5d]">{company.brandName || 'NEEJEE'}</p>
                <h1 className="mt-2 text-3xl font-semibold">{agreement.title || 'Marketplace Seller Agreement'}</h1>
                <p className="mt-2 text-sm text-[#6b5b50]">{agreement.subtitle || 'Standard company agreement with seller-specific commercial terms'}</p>
              </div>

              {company.logoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={company.logoUrl} alt="Company logo" className="h-16 w-auto object-contain" />
              ) : null}
            </div>

            <div className="mt-6 grid md:grid-cols-2 gap-6 text-sm">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#7f6c5d] mb-2">Company</p>
                <p className="font-medium">{company.legalName || 'Oye Imagine Private Limited'}</p>
                <p className="mt-1 text-[#6b5b50]">{company.address || '—'}</p>
                <p className="mt-1 text-[#6b5b50]">GSTIN: {company.gstin || '—'}</p>
                <p className="text-[#6b5b50]">PAN: {company.pan || '—'}</p>
                {company.cinNumber ? <p className="text-[#6b5b50]">CIN: {company.cinNumber}</p> : null}
                {company.contactEmail ? <p className="text-[#6b5b50]">Email: {company.contactEmail}</p> : null}
                {company.contactPhone ? <p className="text-[#6b5b50]">Phone: {company.contactPhone}</p> : null}
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#7f6c5d] mb-2">Seller</p>
                <p className="font-medium">{seller.businessName || '—'}</p>
                <p className="mt-1 text-[#6b5b50]">Contact: {seller.contactName || '—'}</p>
                <p className="text-[#6b5b50]">Email: {seller.email || '—'}</p>
                <p className="text-[#6b5b50]">Phone: {seller.phone || '—'}</p>
                <p className="text-[#6b5b50]">Craft / Region: {[seller.craft, seller.region].filter(Boolean).join(' • ') || '—'}</p>
                <p className="text-[#6b5b50]">PAN: {seller.pan || '—'}</p>
                <p className="text-[#6b5b50]">GSTIN: {seller.gstin || '—'}</p>
              </div>
            </div>
          </div>

          <div className="px-8 py-8 space-y-8">
            <section>
              <p className="text-xs uppercase tracking-[0.25em] text-[#7f6c5d] mb-3">Recitals</p>
              <p className="text-sm leading-7 text-[#2a2420]">
                This Marketplace Seller Agreement is executed between {company.legalName || 'Oye Imagine Private Limited'}
                {' '}and {seller.businessName || 'the Seller'} for listing, selling, fulfilling, and servicing approved products on the NEEJEE platform.
                The standard terms below apply uniformly to all sellers unless specific commercial terms are expressly recorded in the annexure.
              </p>
            </section>

            <section>
              <p className="text-xs uppercase tracking-[0.25em] text-[#7f6c5d] mb-3">Seller-Specific Commercial Terms</p>
              <div className="grid md:grid-cols-2 gap-x-8 gap-y-3 border border-[#e7dfd5] p-5">
                <Term label="Commission %" value={`${terms.commissionPct ?? 20}%`} />
                <Term label="Payout cycle" value={terms.payoutCycle || 'MONTHLY'} />
                <Term label="Neejee Select" value={terms.isNeejeeSelect ? 'Yes' : 'No'} />
                <Term label="Quality score" value={String(terms.qualityScore ?? 0)} />
                <Term label="Years of practice" value={terms.yearsOfPractice != null ? String(terms.yearsOfPractice) : '—'} />
                <Term label="Cluster" value={terms.cluster || '—'} />
                <Term label="Bank" value={[seller.bankName, seller.ifsc, seller.bankAccountMasked].filter(Boolean).join(' • ') || '—'} />
                <Term label="Generated on" value={agreement.generatedAt ? new Date(agreement.generatedAt).toLocaleString('en-IN') : '—'} />
              </div>
            </section>

            <section>
              <p className="text-xs uppercase tracking-[0.25em] text-[#7f6c5d] mb-3">Standard Clauses</p>
              <div className="space-y-5">
                {agreement.clauses?.map((clause: any) => (
                  <div key={clause.no || clause.title}>
                    <h3 className="text-sm font-semibold">{clause.no}. {clause.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-[#2a2420]">{clause.text}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <p className="text-xs uppercase tracking-[0.25em] text-[#7f6c5d] mb-3">Annexure A — Recorded Seller Particulars</p>
              <div className="border border-[#e7dfd5] divide-y divide-[#efe8de]">
                {agreement.annexure?.map((item: any) => (
                  <div key={item.label} className="grid grid-cols-2 gap-4 px-5 py-3 text-sm">
                    <div className="text-[#6b5b50]">{item.label}</div>
                    <div className="text-right">{item.value || '—'}</div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <p className="text-xs uppercase tracking-[0.25em] text-[#7f6c5d] mb-3">Execution</p>
              <div className="grid md:grid-cols-2 gap-10">
                <div className="border border-[#e7dfd5] p-5 min-h-[220px]">
                  <p className="text-sm font-semibold">For {company.legalName || 'Oye Imagine Private Limited'}</p>
                  <div className="h-20 mt-6 flex items-end">
                    {execution.companySignatureUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={execution.companySignatureUrl} alt="Company signature" className="max-h-16 w-auto object-contain" />
                    ) : (
                      <span className="text-xs text-[#8a7a6e]">Authorised signature image not uploaded</span>
                    )}
                  </div>
                  <div className="mt-4 text-sm">
                    <p><span className="text-[#6b5b50]">Name:</span> {execution.companySignatoryName || 'Authorised Signatory'}</p>
                    <p><span className="text-[#6b5b50]">Title:</span> {execution.companySignatoryTitle || 'Authorised Signatory'}</p>
                    <p><span className="text-[#6b5b50]">Place:</span> {execution.placeOfExecution || 'India'}</p>
                  </div>
                </div>

                <div className="border border-[#e7dfd5] p-5 min-h-[220px]">
                  <p className="text-sm font-semibold">Accepted by Seller</p>
                  <div className="h-20 mt-6 flex items-end">
                    <span className="text-xs text-[#8a7a6e]">Digital seller signature to be added in Phase 3</span>
                  </div>
                  <div className="mt-4 text-sm">
                    <p><span className="text-[#6b5b50]">Name:</span> {seller.contactName || seller.businessName || '—'}</p>
                    <p><span className="text-[#6b5b50]">Business:</span> {seller.businessName || '—'}</p>
                    <p><span className="text-[#6b5b50]">Email:</span> {seller.email || '—'}</p>
                    <p><span className="text-[#6b5b50]">Phone:</span> {seller.phone || '—'}</p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="border-t border-[#d8cec2] px-8 py-4 text-[11px] text-[#7f6c5d]">
            {company.brandName || 'NEEJEE'} • Standard Seller Agreement • Template {agreement.templateVersion || 'phase-2a-v1'}
          </div>
        </div>
      </div>
    </div>
  );
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-[#6b5b50]">{label}</span>
      <span className="text-right">{value || '—'}</span>
    </div>
  );
}