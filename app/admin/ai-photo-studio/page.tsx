'use client';
// AI Photo Studio dashboard — list of recent jobs across all products.

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Job = {
  id: string;
  strategy: string;
  status: string;
  sourceImageUrls: string[];
  variants: { id: string; url: string; decision: string }[];
  product: { id: string; name: string; slug: string } | null;
  createdAt: string;
  errorMessage: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  QUEUED: 'bg-charcoal/10 text-charcoal/60',
  RUNNING: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-rose-100 text-rose-700',
  CANCELLED: 'bg-charcoal/10 text-charcoal/40',
};

export default function AiPhotoStudioDashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  async function load() {
    setLoading(true);
    try {
      const qs = status ? `?status=${status}` : '';
      const res = await fetch(`/api/admin/ai-photo-studio/jobs${qs}`);
      const data = await res.json();
      setJobs(data.jobs || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [status]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display text-3xl">AI Photo Studio</h1>
        <p className="text-sm text-charcoal/60 mt-1">
          Recent generation jobs. To start a new one, open any product → Images tab.
        </p>
      </header>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setStatus('')}
          className={`text-xs px-3 py-1 border ${status === '' ? 'bg-charcoal text-ivory' : 'border-charcoal/20'}`}
        >
          ALL
        </button>
        {['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'].map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`text-xs px-3 py-1 border ${status === s ? 'bg-charcoal text-ivory' : 'border-charcoal/20'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading && <div className="text-sm text-charcoal/50">Loading…</div>}

      {!loading && jobs.length === 0 && (
        <div className="bg-beige/40 p-6 text-sm text-charcoal/60">
          No jobs yet. Open a product → Images tab → upload raw phone shots → click Generate.
        </div>
      )}

      <div className="space-y-3">
        {jobs.map(j => (
          <div key={j.id} className="border border-charcoal/10 p-4 bg-ivory">
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {j.product ? (
                    <Link
                      href={`/admin/products/${j.product.id}`}
                      className="font-display text-lg underline"
                    >
                      {j.product.name}
                    </Link>
                  ) : (
                    <span className="font-display text-lg text-charcoal/60">(no product attached)</span>
                  )}
                  <span className={`text-xs px-2 py-1 ${STATUS_STYLE[j.status]}`}>{j.status}</span>
                </div>
                <p className="text-xs text-charcoal/60 mt-1">
                  Strategy: {j.strategy.replace(/_/g, ' ').toLowerCase()} ·{' '}
                  {new Date(j.createdAt).toLocaleString('en-IN')}
                </p>
                {j.errorMessage && (
                  <p className="text-xs text-rose-700 mt-1">Error: {j.errorMessage}</p>
                )}
              </div>
              <div className="text-xs text-charcoal/50 whitespace-nowrap">
                {j.variants.length} variants
                {j.variants.length > 0 && (
                  <> · {j.variants.filter(v => v.decision === 'APPROVED').length} applied</>
                )}
              </div>
            </div>

            {j.variants.length > 0 && (
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-3">
                {j.variants.slice(0, 6).map(v => (
                  <div key={v.id} className="relative">
                    <img src={v.url} alt="" className="w-full aspect-square object-cover" />
                    {v.decision === 'APPROVED' && (
                      <div className="absolute top-1 right-1 text-[10px] bg-emerald-100 text-emerald-700 px-1">
                        APPLIED
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {j.sourceImageUrls.length > 0 && (
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer text-charcoal/50">
                  Source raw shots ({j.sourceImageUrls.length})
                </summary>
                <div className="grid grid-cols-4 md:grid-cols-8 gap-2 mt-2">
                  {j.sourceImageUrls.map((u, i) => (
                    <img key={i} src={u} alt="" className="w-full aspect-square object-cover" />
                  ))}
                </div>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
