'use client';
// Admin queue of vendor-raised AI photo requests.

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Row = {
  id: string;
  description: string;
  proposedCategory: string | null;
  sourceImageUrls: string[];
  status: string;
  resultingJobId: string | null;
  adminNote: string | null;
  createdAt: string;
  vendor: { id: string; legalName: string };
  product: { id: string; name: string; slug: string } | null;
};

const STATUS_STYLE: Record<string, string> = {
  SUBMITTED: 'bg-amber-100 text-amber-700',
  ACCEPTED: 'bg-blue-100 text-blue-700',
  REJECTED: 'bg-rose-100 text-rose-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-charcoal/10 text-charcoal/50',
};

export default function AdminAiPhotoRequestsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [status, setStatus] = useState('SUBMITTED');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const qs = status ? `?status=${status}` : '';
      const res = await fetch(`/api/admin/ai-photo-requests${qs}`);
      const data = await res.json();
      setRows(data.rows || []);
      setCounts(data.counts || {});
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [status]);

  async function accept(id: string) {
    if (!confirm('Run AI Photo Studio on these raw shots? This will use ~$0.24 of fal credits and take 2–3 minutes.')) return;
    setProcessing(id);
    try {
      const res = await fetch(`/api/admin/ai-photo-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ACCEPT' }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data.error || data.result?.firstError || 'Failed');
        return;
      }
      alert(`Generated ${data.result?.variantCount || 0} variants. Vendor has been notified.`);
      load();
    } finally {
      setProcessing(null);
    }
  }

  async function reject(id: string) {
    const note = prompt('Reason for rejection (will be visible to the vendor):');
    if (!note) return;
    const res = await fetch(`/api/admin/ai-photo-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'REJECT', adminNote: note }),
    });
    if (res.ok) load();
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display text-3xl">AI Photo Requests — Vendor Queue</h1>
        <p className="text-sm text-charcoal/60 mt-1">
          Vendors uploaded raw shots and asked for studio imagery. Accept to run AI Photo Studio inline.
        </p>
      </header>

      <div className="flex gap-2 mb-4 flex-wrap">
        {['SUBMITTED', 'ACCEPTED', 'COMPLETED', 'REJECTED', 'CANCELLED'].map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`text-xs px-3 py-1 border ${status === s ? 'bg-charcoal text-ivory' : 'border-charcoal/20'}`}
          >
            {s} {counts[s] != null && `· ${counts[s]}`}
          </button>
        ))}
        <button
          onClick={() => setStatus('')}
          className={`text-xs px-3 py-1 border ${status === '' ? 'bg-charcoal text-ivory' : 'border-charcoal/20'}`}
        >
          ALL
        </button>
      </div>

      {loading && <div className="text-sm text-charcoal/50">Loading…</div>}
      {!loading && rows.length === 0 && (
        <div className="bg-beige/40 p-6 text-sm text-charcoal/60">
          No requests in this status.
        </div>
      )}

      <div className="space-y-3">
        {rows.map(r => (
          <div key={r.id} className="border border-charcoal/10 p-4 bg-ivory">
            <div className="flex justify-between items-start gap-3 mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                  <strong>{r.vendor.legalName}</strong>
                  <span className="text-xs text-charcoal/50">
                    · {new Date(r.createdAt).toLocaleString('en-IN')}
                  </span>
                </div>
                {r.product && (
                  <div className="text-xs text-charcoal/60 mt-1">
                    Product:{' '}
                    <Link href={`/admin/products/${r.product.id}`} className="underline">
                      {r.product.name}
                    </Link>
                  </div>
                )}
                {r.proposedCategory && (
                  <div className="text-xs text-charcoal/60 mt-1">Category hint: {r.proposedCategory}</div>
                )}
              </div>
              {r.status === 'SUBMITTED' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => accept(r.id)}
                    disabled={processing === r.id}
                    className="btn-primary text-xs"
                  >
                    {processing === r.id ? 'Generating…' : 'ACCEPT & GENERATE'}
                  </button>
                  <button onClick={() => reject(r.id)} className="btn-outline text-xs">
                    REJECT
                  </button>
                </div>
              )}
              {r.resultingJobId && (
                <Link
                  href={`/admin/ai-photo-studio`}
                  className="text-xs underline"
                >
                  View job
                </Link>
              )}
            </div>
            <p className="text-sm whitespace-pre-wrap mb-2">{r.description}</p>
            {r.adminNote && (
              <div className="bg-beige/40 p-2 text-xs mt-2">
                <strong>Admin note:</strong> {r.adminNote}
              </div>
            )}
            <div className="grid grid-cols-4 md:grid-cols-8 gap-2 mt-3">
              {r.sourceImageUrls.map((u, i) => (
                <a key={i} href={u} target="_blank" rel="noreferrer">
                  <img src={u} alt="" className="w-full aspect-square object-cover border border-mitti/15" />
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
