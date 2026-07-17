'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Agreement = any;

function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function statusTone(status?: string) {
  const s = String(status || '').toUpperCase();
  if (['FULLY_EXECUTED', 'COMPANY_SIGNED', 'CLOSED'].includes(s)) return 'bg-neem/10 text-neem border border-neem/30';
  if (['SELLER_SIGNED', 'SENT_FOR_SIGNATURE', 'UNDER_REVIEW'].includes(s)) return 'bg-banarasi/10 text-banarasi border border-banarasi/30';
  if (['CHANGES_REQUESTED', 'OBSERVED'].includes(s)) return 'bg-madder/10 text-madder border border-madder/30';
  return 'bg-beige text-kohl border border-mitti/20';
}

export default function SellerAgreementsPage() {
  const [items, setItems] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/seller/agreements', { cache: 'no-store' });
        const t = await r.text();
        let j: any = {};
        try { j = JSON.parse(t); } catch {}
        if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
        const list = Array.isArray(j) ? j : Array.isArray(j?.agreements) ? j.agreements : [];
        setItems(list);
      } catch (e: any) {
        setErr(e?.message || 'Failed to load agreements');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const ta = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
      const tb = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
      return tb - ta;
    });
  }, [items]);

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <p className="label text-banarasi">LEGAL</p>
        <h1 className="font-display text-4xl text-kohl mt-2">Seller agreements</h1>
        <p className="text-mitti mt-2 max-w-2xl">
          Review your current agreement status, open the latest draft, add observations, and complete OTP signing when requested.
        </p>
      </div>

      {loading && (
        <div className="bg-beige p-6 text-mitti font-italic italic">Loading agreements…</div>
      )}

      {!loading && err && (
        <div className="bg-madder/10 border border-madder p-6 text-madder">{err}</div>
      )}

      {!loading && !err && sorted.length === 0 && (
        <div className="bg-ivory border border-mitti/20 rounded p-8">
          <h2 className="font-display text-2xl text-kohl">No agreements yet</h2>
          <p className="text-mitti mt-2">
            Your team has not sent any agreements for review yet.
          </p>
          <Link
            href="/seller/dashboard"
            className="inline-flex mt-5 bg-kohl text-ivory px-4 py-2 text-xs tracking-widest hover:bg-kohl/90 transition-colors"
          >
            BACK TO DASHBOARD
          </Link>
        </div>
      )}

      {!loading && !err && sorted.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {sorted.map((agreement) => (
            <Link
              key={agreement.id}
              href={`/seller/agreements/${agreement.id}`}
              className="block bg-ivory border border-mitti/20 rounded p-6 hover:border-kohl transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="label text-banarasi">AGREEMENT</p>
                  <h2 className="font-display text-2xl text-kohl mt-2">
                    Version {agreement.currentVersionNo ?? '—'}
                  </h2>
                </div>
                <span className={`px-3 py-1 text-[11px] tracking-widest uppercase rounded-full ${statusTone(agreement.status)}`}>
                  {String(agreement.status || 'DRAFT').replace(/_/g, ' ')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-5 text-sm">
                <div>
                  <p className="label text-mitti">CREATED</p>
                  <p className="text-kohl mt-1">{formatDate(agreement.createdAt)}</p>
                </div>
                <div>
                  <p className="label text-mitti">UPDATED</p>
                  <p className="text-kohl mt-1">{formatDate(agreement.updatedAt)}</p>
                </div>
                <div>
                  <p className="label text-mitti">SELLER SIGNED</p>
                  <p className="text-kohl mt-1">{formatDate(agreement.sellerSignedAt)}</p>
                </div>
                <div>
                  <p className="label text-mitti">COMPANY SIGNED</p>
                  <p className="text-kohl mt-1">{formatDate(agreement.companySignedAt)}</p>
                </div>
              </div>

              <div className="mt-6 inline-flex items-center gap-2 text-xs tracking-widest text-kohl">
                OPEN AGREEMENT <span aria-hidden="true">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}