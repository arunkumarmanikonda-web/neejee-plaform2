'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Loader2,
  Package,
  ShieldCheck,
  Store,
  FileText,
  AlertCircle,
} from 'lucide-react';

type SellerRow = {
  id: string;
  slug: string | null;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  craft: string | null;
  region: string | null;
  kycStatus: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  createdAt: string;
  productCount: number;
  hasPan: boolean;
  hasGstin: boolean;
  hasBank: boolean;
  hasPortfolio: boolean;
  hasUserAccount: boolean;
  phoneVerified: boolean;
  emailVerified: boolean;
  autoKycPassed: boolean;
  canActivate: boolean;
};

type ChangeRequestRow = {
  id: string;
  sellerId: string;
  seller: { id: string; businessName: string; slug: string | null };
  status: string;
  createdAt: string;
  changedFieldCount: number;
  supportingDocCount: number;
  reason: string | null;
};

type InventoryRow = {
  id: string;
  sellerId: string;
  seller: { id: string; businessName: string; slug: string | null };
  product: { id: string; name: string; sku: string | null; status: string | null } | null;
  status: string;
  submissionType: string;
  createdAt: string;
};

type Overview = {
  summary: {
    sellersPending: number;
    sellersUnderReview: number;
    sellersApproved: number;
    sellersRejected: number;
    changeRequestsPending: number;
    inventorySubmitted: number;
    inventoryUnderReview: number;
    inventoryNeedsInfo: number;
    activationReady: number;
  };
  pendingSellers: SellerRow[];
  pendingChangeRequests: ChangeRequestRow[];
  inventoryQueue: InventoryRow[];
};

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function kycPill(status: SellerRow['kycStatus']) {
  const map: Record<string, string> = {
    PENDING: 'bg-haldi/20 text-mitti',
    UNDER_REVIEW: 'bg-banarasi/20 text-kohl',
    APPROVED: 'bg-neem/20 text-neem',
    REJECTED: 'bg-madder/15 text-madder',
    SUSPENDED: 'bg-mitti/20 text-mitti',
  };
  return map[status] || 'bg-beige text-mitti';
}

function inventoryPill(status: string) {
  const map: Record<string, string> = {
    SUBMITTED: 'bg-banarasi/20 text-banarasi',
    UNDER_REVIEW: 'bg-banarasi/30 text-kohl',
    NEEDS_INFO: 'bg-madder/20 text-madder',
    APPROVED: 'bg-neem/20 text-neem',
    PUBLISHED: 'bg-neem/25 text-neem',
    REJECTED: 'bg-madder/15 text-madder',
  };
  return map[status] || 'bg-beige text-mitti';
}

function Gate({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] tracking-widest uppercase ${ok ? 'bg-neem/15 text-neem' : 'bg-madder/10 text-madder'}`}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
      {label}
    </span>
  );
}

function Metric({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: number;
  hint: string;
  icon: any;
}) {
  return (
    <div className="rounded-2xl border border-kohl/10 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-mitti">{label}</p>
          <p className="mt-3 font-display text-4xl text-kohl">{value}</p>
          <p className="mt-2 text-sm text-mitti">{hint}</p>
        </div>
        <div className="rounded-xl bg-ivory p-3">
          <Icon className="h-5 w-5 text-kohl" />
        </div>
      </div>
    </div>
  );
}

export default function SellerOnboardingPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/seller-onboarding/overview', {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load overview');
      setData(json);
    } catch (e: any) {
      setError(e?.message || 'Failed to load overview');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label text-madder">PHASE 4</p>
          <h1 className="mt-2 font-display text-4xl text-kohl">Seller Onboarding</h1>
          <p className="mt-2 text-sm text-mitti">KYC, activation gates, change requests, and seller inventory review.</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-xl border border-kohl/15 bg-white px-4 py-2 text-sm text-kohl hover:bg-ivory"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-madder/20 bg-madder/5 px-4 py-3 text-sm text-madder">{error}</div>
      ) : null}

      {loading ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-kohl/10 bg-white">
          <Loader2 className="h-5 w-5 animate-spin text-kohl" />
        </div>
      ) : !data ? null : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="Seller applications" value={data.summary.sellersPending} hint="Pending KYC intake" icon={Store} />
            <Metric label="Under review" value={data.summary.sellersUnderReview} hint="Needs admin decision" icon={Clock3} />
            <Metric label="Change requests" value={data.summary.changeRequestsPending} hint="Profile edits awaiting review" icon={FileText} />
            <Metric label="Activation ready" value={data.summary.activationReady} hint="Approved + bank + PAN ready" icon={ShieldCheck} />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.95fr]">
            <section className="rounded-2xl border border-kohl/10 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-mitti">Review queue</p>
                  <h2 className="font-display text-2xl text-kohl">Sellers needing action</h2>
                </div>
                <Link href="/admin/sellers" className="inline-flex items-center gap-2 text-sm text-madder hover:text-kohl">
                  Open sellers <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-mitti/20 text-left text-[10px] uppercase tracking-[0.22em] text-mitti">
                      <th className="px-3 py-3">Seller</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Gates</th>
                      <th className="px-3 py-3">Applied</th>
                      <th className="px-3 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pendingSellers.map((seller) => (
                      <tr key={seller.id} className="border-b border-mitti/10 align-top hover:bg-beige/20">
                        <td className="px-3 py-3">
                          <div className="font-display text-kohl">{seller.businessName}</div>
                          <div className="mt-1 text-xs text-mitti">
                            {seller.contactName} · {seller.craft || '—'} · {seller.region || '—'}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex rounded px-2 py-1 text-[10px] tracking-widest uppercase ${kycPill(seller.kycStatus)}`}>
                            {seller.kycStatus.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Gate ok={seller.hasPan} label="PAN" />
                            <Gate ok={seller.hasBank} label="Bank" />
                            <Gate ok={seller.hasGstin} label="GSTIN" />
                            <Gate ok={seller.hasPortfolio} label="Portfolio" />
                            <Gate ok={seller.hasUserAccount} label="User" />
                            <Gate ok={seller.phoneVerified} label="Phone OTP" />
                            <Gate ok={seller.emailVerified} label="Email OTP" />
                            <Gate ok={seller.autoKycPassed} label="Auto KYC" />
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs text-mitti">{fmtDate(seller.createdAt)}</td>
                        <td className="px-3 py-3 text-right">
                          <Link href={`/admin/sellers/${seller.id}`} className="text-sm text-madder hover:text-kohl">
                            Review →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-6">
              <div className="rounded-2xl border border-kohl/10 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.28em] text-mitti">Profile approvals</p>
                    <h2 className="font-display text-2xl text-kohl">Pending seller changes</h2>
                  </div>
                  <Link href="/admin/seller-change-requests" className="inline-flex items-center gap-2 text-sm text-madder hover:text-kohl">
                    Open queue <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="space-y-3">
                  {data.pendingChangeRequests.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-kohl/15 px-4 py-6 text-sm text-mitti">No pending change requests.</div>
                  ) : (
                    data.pendingChangeRequests.map((row) => (
                      <div key={row.id} className="rounded-xl border border-kohl/10 bg-ivory/40 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-kohl">{row.seller.businessName}</div>
                            <div className="mt-1 text-xs text-mitti">
                              {row.changedFieldCount} changed fields · {row.supportingDocCount} docs · {fmtDate(row.createdAt)}
                            </div>
                          </div>
                          <Link href="/admin/seller-change-requests" className="text-xs uppercase tracking-widest text-madder hover:text-kohl">
                            Open
                          </Link>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-kohl/10 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.28em] text-mitti">Catalogue intake</p>
                    <h2 className="font-display text-2xl text-kohl">Seller inventory queue</h2>
                  </div>
                  <Link href="/admin/seller-inventory" className="inline-flex items-center gap-2 text-sm text-madder hover:text-kohl">
                    Open queue <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="mb-4 grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-ivory p-3 text-center">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-mitti">Submitted</div>
                    <div className="mt-2 font-display text-2xl text-kohl">{data.summary.inventorySubmitted}</div>
                  </div>
                  <div className="rounded-xl bg-ivory p-3 text-center">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-mitti">Under review</div>
                    <div className="mt-2 font-display text-2xl text-kohl">{data.summary.inventoryUnderReview}</div>
                  </div>
                  <div className="rounded-xl bg-ivory p-3 text-center">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-mitti">Needs info</div>
                    <div className="mt-2 font-display text-2xl text-kohl">{data.summary.inventoryNeedsInfo}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  {data.inventoryQueue.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-kohl/15 px-4 py-6 text-sm text-mitti">No active seller inventory items.</div>
                  ) : (
                    data.inventoryQueue.map((row) => (
                      <div key={row.id} className="rounded-xl border border-kohl/10 bg-ivory/40 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-kohl">{row.product?.name || 'Untitled submission'}</div>
                            <div className="mt-1 text-xs text-mitti">
                              {row.seller.businessName} · {row.submissionType.replace(/_/g, ' ')} · {fmtDate(row.createdAt)}
                            </div>
                          </div>
                          <span className={`inline-flex rounded px-2 py-1 text-[10px] tracking-widest uppercase ${inventoryPill(row.status)}`}>
                            {row.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-kohl/10 bg-white p-6 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <Package className="h-5 w-5 text-kohl" />
                  <h2 className="font-display text-2xl text-kohl">Phase 4 links</h2>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Link href="/admin/sellers" className="rounded-xl border border-kohl/10 bg-ivory/50 px-4 py-3 text-sm text-kohl hover:bg-ivory">Sellers</Link>
                  <Link href="/admin/seller-inventory" className="rounded-xl border border-kohl/10 bg-ivory/50 px-4 py-3 text-sm text-kohl hover:bg-ivory">Seller Inventory Queue</Link>
                  <Link href="/admin/seller-change-requests" className="rounded-xl border border-kohl/10 bg-ivory/50 px-4 py-3 text-sm text-kohl hover:bg-ivory">Seller Change Requests</Link>
                  <Link href="/admin/vendors" className="rounded-xl border border-kohl/10 bg-ivory/50 px-4 py-3 text-sm text-kohl hover:bg-ivory">Vendors</Link>
                </div>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}