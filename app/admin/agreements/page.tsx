'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, FileText, Search } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface SellerSummary {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  craft: string | null;
  region: string | null;
  kycStatus: string;
  createdAt: string;
  productCount?: number;
}

interface AgreementData {
  id?: string;
  sellerId?: string;
  agreementNumber?: string;
  templateVersion?: string;
  status?: string;
  companySignatoryId?: string;
  effectiveDate?: string;
  signedDate?: string;
  validFrom?: string;
  validTo?: string;
  renewalMode?: string;
  renewalNoticeDays?: number;
  expiryAction?: string;
  updatedAt?: string;
  currentDocumentJson?: any;
}

interface SignatoryData {
  id?: string;
  name?: string;
  title?: string;
  isDefault?: boolean;
  active?: boolean;
}

interface AgreementBundle {
  agreement?: AgreementData;
  signatories?: SignatoryData[];
  observations?: any[];
  error?: string;
}

interface AgreementRow {
  sellerId: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  craft: string;
  region: string;
  kycStatus: string;
  createdAt: string;
  productCount: number;
  agreementId: string;
  agreementNumber: string;
  templateVersion: string;
  status: string;
  derivedStatus: string;
  signatoryName: string;
  signatoryTitle: string;
  effectiveDate: string;
  signedDate: string;
  validFrom: string;
  validTo: string;
  renewalMode: string;
  renewalNoticeDays: number;
  expiryAction: string;
  updatedAt: string;
  hasWorkflowError: boolean;
}

const STATUS_TABS = [
  'ALL',
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
  'EXPIRED',
] as const;

const safe = (value: unknown, fallback = 'â€”') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

function parseDate(value?: string) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(value?: string) {
  const d = parseDate(value);
  return d ? d.toLocaleDateString('en-IN') : 'â€”';
}

function isExpired(validTo?: string, status?: string) {
  if (!validTo) return false;
  if (status === 'CLOSED' || status === 'VOID') return false;
  const d = parseDate(validTo);
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

function daysUntil(value?: string) {
  const d = parseDate(value);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function deriveStatus(status?: string, validTo?: string) {
  return isExpired(validTo, status) ? 'EXPIRED' : String(status || 'DRAFT');
}

function toAgreementRow(seller: SellerSummary, bundle?: AgreementBundle | null): AgreementRow {
  const agreement = bundle?.agreement || {};
  const signatories = Array.isArray(bundle?.signatories) ? bundle!.signatories! : [];
  const selectedSignatory =
    signatories.find((item) => String(item?.id || '') === String(agreement.companySignatoryId || '')) ||
    signatories.find((item) => !!item?.isDefault) ||
    signatories[0] ||
    null;

  const status = String(agreement.status || 'DRAFT');

  return {
    sellerId: seller.id,
    businessName: seller.businessName || seller.contactName || 'Seller',
    contactName: seller.contactName || '',
    email: seller.email || '',
    phone: seller.phone || '',
    craft: seller.craft || '',
    region: seller.region || '',
    kycStatus: seller.kycStatus || '',
    createdAt: seller.createdAt || '',
    productCount: Number(seller.productCount || 0),
    agreementId: String(agreement.id || `seller-agreement-${seller.id}`),
    agreementNumber: String(agreement.agreementNumber || `AGR-${seller.id.slice(-8).toUpperCase()}`),
    templateVersion: String(agreement.templateVersion || 'v1'),
    status,
    derivedStatus: deriveStatus(status, agreement.validTo),
    signatoryName: String(selectedSignatory?.name || ''),
    signatoryTitle: String(selectedSignatory?.title || ''),
    effectiveDate: String(agreement.effectiveDate || ''),
    signedDate: String(agreement.signedDate || ''),
    validFrom: String(agreement.validFrom || ''),
    validTo: String(agreement.validTo || ''),
    renewalMode: String(agreement.renewalMode || 'MANUAL'),
    renewalNoticeDays: Number(agreement.renewalNoticeDays || 30),
    expiryAction: String(agreement.expiryAction || 'LOCK_STOCK_BARREL'),
    updatedAt: String(agreement.updatedAt || ''),
    hasWorkflowError: !!bundle?.error,
  };
}

function badgeTone(status: string) {
  const map: Record<string, string> = {
    DRAFT: 'bg-beige text-kohl',
    INTERNAL_REVIEW: 'bg-banarasi/20 text-mitti',
    SELLER_REVIEW: 'bg-haldi/20 text-mitti',
    READY_TO_LOCK: 'bg-haldi/20 text-kohl',
    LOCKED: 'bg-kohl text-ivory',
    SENT_FOR_SIGNATURE: 'bg-banarasi/25 text-kohl',
    SELLER_SIGNED: 'bg-neem/15 text-neem',
    COMPANY_SIGNED: 'bg-neem/20 text-neem',
    CLOSED: 'bg-mitti/20 text-mitti',
    VOID: 'bg-madder/20 text-madder',
    EXPIRED: 'bg-madder text-ivory',
  };
  return map[status] || 'bg-beige text-kohl';
}

export default function AdminAgreementsPage() {
  const [rows, setRows] = useState<AgreementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_TABS)[number]>('ALL');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const sellerRes = await fetch('/api/admin/sellers', { cache: 'no-store' });
        const sellerJson = await sellerRes.json().catch(() => ({}));

        if (!sellerRes.ok) {
          throw new Error(String(sellerJson?.error || 'Failed to load sellers'));
        }

        const sellers: SellerSummary[] = Array.isArray(sellerJson?.sellers) ? sellerJson.sellers : [];

        const bundles = await Promise.all(
          sellers.map(async (seller) => {
            try {
              const workflowRes = await fetch(`/api/admin/sellers/${seller.id}/agreement-workflow`, {
                cache: 'no-store',
              });
              const workflowJson = await workflowRes.json().catch(() => ({}));

              if (!workflowRes.ok) {
                return toAgreementRow(seller, { error: String(workflowJson?.error || 'Failed to load workflow') });
              }

              return toAgreementRow(seller, workflowJson);
            } catch (e: any) {
              return toAgreementRow(seller, { error: e?.message || 'Failed to load workflow' });
            }
          })
        );

        setRows(bundles);
      } catch (e: any) {
        setError(String(e?.message || 'Failed to load agreements'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const counts = useMemo(() => {
    const next: Record<string, number> = { ALL: rows.length };
    STATUS_TABS.slice(1).forEach((status) => {
      next[status] = rows.filter((row) => row.derivedStatus === status).length;
    });
    return next;
  }, [rows]);

  const stats = useMemo(() => {
    const expired = rows.filter((row) => row.derivedStatus === 'EXPIRED').length;
    const locked = rows.filter((row) => row.derivedStatus === 'LOCKED').length;
    const sent = rows.filter((row) => row.derivedStatus === 'SENT_FOR_SIGNATURE').length;
    const expiringSoon = rows.filter((row) => {
      const diff = daysUntil(row.validTo);
      return diff !== null && diff >= 0 && diff <= 30 && row.derivedStatus !== 'EXPIRED';
    }).length;
    return { expired, locked, sent, expiringSoon };
  }, [rows]);

  const filtered = useMemo(() => {
    let list = statusFilter === 'ALL'
      ? rows
      : rows.filter((row) => row.derivedStatus === statusFilter);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((row) =>
        row.businessName.toLowerCase().includes(q) ||
        row.contactName.toLowerCase().includes(q) ||
        row.sellerId.toLowerCase().includes(q) ||
        row.agreementNumber.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q) ||
        row.signatoryName.toLowerCase().includes(q) ||
        row.craft.toLowerCase().includes(q) ||
        row.region.toLowerCase().includes(q)
      );
    }

    return [...list].sort((a, b) => {
      const aExpired = a.derivedStatus === 'EXPIRED' ? 0 : 1;
      const bExpired = b.derivedStatus === 'EXPIRED' ? 0 : 1;
      if (aExpired !== bExpired) return aExpired - bExpired;

      const aDate = parseDate(a.validTo)?.getTime() || Number.MAX_SAFE_INTEGER;
      const bDate = parseDate(b.validTo)?.getTime() || Number.MAX_SAFE_INTEGER;
      return aDate - bDate;
    });
  }, [rows, search, statusFilter]);

  return (
    <>
      <p className="label text-madder">LEGAL Â· MARKETPLACE</p>
      <h1 className="font-display text-4xl text-kohl mt-2">Agreement Control Center</h1>
      <p className="font-italic italic text-mitti mt-2">
        Search agreements by seller name, seller ID, agreement number, or signing authority.
      </p>
      <div className="madder-divider mt-4"></div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
        <MetricCard label="Total" value={String(rows.length)} helper="seller agreement jobs" />
        <MetricCard label="Locked" value={String(stats.locked)} helper="ready and frozen" />
        <MetricCard label="Sent" value={String(stats.sent)} helper="out for signature" />
        <MetricCard label="Expired / Soon" value={`${stats.expired} / ${stats.expiringSoon}`} helper="needs renewal attention" />
      </div>

      <div className="border border-mitti/15 bg-ivory p-5 mt-8">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-mitti" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search seller name, seller ID, agreement number, signatoryâ€¦"
              className="w-full pl-9 pr-3 py-2 bg-beige border border-mitti/20 text-sm"
            />
          </div>
          <Link
            href="/admin/legal-signatories"
            className="inline-flex items-center gap-2 px-3 py-2 bg-kohl text-ivory text-xs tracking-wider hover:opacity-90"
          >
            <FileText className="w-4 h-4" />
            LEGAL SIGNATORY REGISTRY
          </Link>
        </div>

        <div className="flex items-center gap-2 mt-4 flex-wrap">
          {STATUS_TABS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`text-xs tracking-wider px-3 py-1.5 ${
                statusFilter === status ? 'bg-kohl text-ivory' : 'bg-beige text-kohl hover:bg-mitti/10'
              }`}
            >
              {status.replace(/_/g, ' ')} ({counts[status] || 0})
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {loading ? (
          <p className="text-mitti">Loading agreementsâ€¦</p>
        ) : error ? (
          <div className="border border-dashed border-madder/30 p-6 text-madder bg-madder/5 inline-flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5" />
            <div>
              <p className="font-display text-xl">Failed to load agreements</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-mitti/30">
            <FileText className="w-10 h-10 text-mitti/40 mx-auto mb-4" />
            <p className="font-display text-2xl text-kohl">No agreements in this view</p>
            <p className="text-mitti mt-2 text-sm">Try another status filter or a broader search term.</p>
          </div>
        ) : (
          <div className="border border-mitti/15 bg-ivory overflow-x-auto">
            <table className="w-full min-w-[1280px]">
              <thead>
                <tr className="border-b border-mitti/20 text-left">
                  <th className="p-3 label text-mitti">SELLER</th>
                  <th className="p-3 label text-mitti">AGREEMENT</th>
                  <th className="p-3 label text-mitti">STATUS</th>
                  <th className="p-3 label text-mitti">VALIDITY</th>
                  <th className="p-3 label text-mitti">SIGNATORY</th>
                  <th className="p-3 label text-mitti">RENEWAL / EXPIRY</th>
                  <th className="p-3 label text-mitti">UPDATED</th>
                  <th className="p-3 text-right label text-mitti">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const expiryDiff = daysUntil(row.validTo);
                  const expiringSoon = expiryDiff !== null && expiryDiff >= 0 && expiryDiff <= 30 && row.derivedStatus !== 'EXPIRED';

                  return (
                    <tr key={row.sellerId} className="border-b border-mitti/10 hover:bg-beige/30 align-top">
                      <td className="p-3">
                        <p className="font-display text-kohl">{safe(row.businessName)}</p>
                        <p className="text-xs text-mitti mt-1">{safe(row.contactName)}</p>
                        <p className="text-[11px] text-mitti mt-2 font-mono">{row.sellerId}</p>
                        <p className="text-[11px] text-mitti mt-1">{safe(row.email)} Â· {safe(row.phone)}</p>
                        <p className="text-[11px] text-mitti mt-1">
                          {safe(row.craft)} Â· {safe(row.region)}
                        </p>
                      </td>

                      <td className="p-3 text-sm text-kohl">
                        <p className="font-mono">{row.agreementNumber}</p>
                        <p className="text-xs text-mitti mt-1">Template {safe(row.templateVersion)}</p>
                        <p className="text-xs text-mitti mt-1">KYC {safe(row.kycStatus)} Â· Products {row.productCount}</p>
                        {row.hasWorkflowError && (
                          <p className="text-[11px] text-madder mt-2">Workflow fallback loaded</p>
                        )}
                      </td>

                      <td className="p-3">
                        <StatusBadge status={row.derivedStatus} />
                        {row.derivedStatus !== row.status && (
                          <p className="text-[10px] mt-2 text-mitti">Base status: {row.status.replace(/_/g, ' ')}</p>
                        )}
                        <p className="text-[10px] mt-2 text-mitti">Effective: {formatDate(row.effectiveDate)}</p>
                        <p className="text-[10px] mt-1 text-mitti">Signed: {formatDate(row.signedDate)}</p>
                      </td>

                      <td className="p-3 text-sm text-kohl">
                        <p>{formatDate(row.validFrom)} â†’ {formatDate(row.validTo)}</p>
                        {row.derivedStatus === 'EXPIRED' ? (
                          <p className="text-[11px] text-madder mt-2">Expired â€” seller should be blocked from fresh uploads after enforcement is wired</p>
                        ) : expiringSoon ? (
                          <p className="text-[11px] text-haldi mt-2">Expiring in {expiryDiff} day(s)</p>
                        ) : (
                          <p className="text-[11px] text-mitti mt-2">Within validity window</p>
                        )}
                      </td>

                      <td className="p-3 text-sm text-kohl">
                        <p>{safe(row.signatoryName)}</p>
                        <p className="text-xs text-mitti mt-1">{safe(row.signatoryTitle)}</p>
                      </td>

                      <td className="p-3 text-sm text-kohl">
                        <p>Renewal: {safe(row.renewalMode)}</p>
                        <p className="text-xs text-mitti mt-1">Notice: {row.renewalNoticeDays} day(s)</p>
                        <p className="text-xs text-mitti mt-1">Expiry action: {safe(row.expiryAction)}</p>
                      </td>

                      <td className="p-3 text-xs text-mitti">
                        {formatDate(row.updatedAt)}
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex flex-col items-end gap-2">
                          <Link href={`/admin/sellers/${row.sellerId}/agreement-workbench`} className="text-madder hover:text-kohl text-sm">
                            WORKBENCH â†’
                          </Link>
                          <Link href={`/agreement/admin/sellers/${row.sellerId}`} className="text-madder hover:text-kohl text-sm">
                            PRINTABLE â†’
                          </Link>
                          <Link href={`/admin/sellers/${row.sellerId}`} className="text-madder hover:text-kohl text-sm">
                            SELLER â†’
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="border border-mitti/15 bg-ivory p-5">
      <p className="label text-mitti">{label}</p>
      <p className="font-display text-3xl text-kohl mt-2">{value}</p>
      <p className="text-xs text-mitti mt-2">{helper}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-[10px] tracking-wider px-2 py-1 ${badgeTone(status)}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}