'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SeoControlPlaneEntry } from './_lib/registry';

type RegistryResponse = {
  ok: boolean;
  query: string;
  total: number;
  allEntriesTotal: number;
  summary: {
    total: number;
    healthy: number;
    warning: number;
    needsReview: number;
  };
  entries: SeoControlPlaneEntry[];
};

const STATE_STYLES: Record<SeoControlPlaneEntry['validationState'], string> = {
  healthy: 'border-emerald-700 text-emerald-300',
  warning: 'border-amber-700 text-amber-300',
  'needs-review': 'border-rose-700 text-rose-300',
};

export const dynamic = 'force-dynamic';

export default function AdminSeoControlPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RegistryResponse | null>(null);

  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      setLoading(true);

      try {
        const response = await fetch(
          `/api/admin/seo-control/registry?q=${encodeURIComponent(query)}`,
          { cache: 'no-store' },
        );
        const json = (await response.json()) as RegistryResponse;
        if (!active) return;
        setData(json);
      } catch {
        if (!active) return;
        setData({
          ok: false,
          query,
          total: 0,
          allEntriesTotal: 0,
          summary: { total: 0, healthy: 0, warning: 0, needsReview: 0 },
          entries: [],
        });
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }, 120);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const grouped = useMemo(() => {
    const buckets: Record<string, SeoControlPlaneEntry[]> = {};
    for (const entry of data?.entries ?? []) {
      buckets[entry.surfaceType] = buckets[entry.surfaceType] ?? [];
      buckets[entry.surfaceType].push(entry);
    }
    return buckets;
  }, [data]);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
                SEO / SEM Control Plane
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                Metadata governance and discoverability operations
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-400">
                Central workspace for metadata validation, canonical policy, SEM campaign linkage,
                and launch-readiness review across key surfaces.
              </p>
            </div>

            <div className="flex gap-2">
              <a
                href="/admin"
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500 hover:text-white"
              >
                Back to admin
              </a>
              <a
                href="/admin/command-center"
                className="rounded-lg border border-cyan-700 px-3 py-2 text-sm text-cyan-300 hover:border-cyan-500 hover:text-cyan-200"
              >
                Command center
              </a>
            </div>
          </div>

          <div className="mt-5">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search metadata surfaces, campaigns, validation issues, or owners..."
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-base outline-none placeholder:text-slate-500 focus:border-cyan-500"
            />
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Visible</div>
              <div className="mt-2 text-2xl font-semibold text-white">{data?.total ?? 0}</div>
            </div>
            <div className="rounded-xl border border-emerald-900 bg-slate-950/60 p-4">
              <div className="text-xs uppercase tracking-wide text-emerald-400">Healthy</div>
              <div className="mt-2 text-2xl font-semibold text-emerald-300">
                {data?.summary.healthy ?? 0}
              </div>
            </div>
            <div className="rounded-xl border border-amber-900 bg-slate-950/60 p-4">
              <div className="text-xs uppercase tracking-wide text-amber-400">Warning</div>
              <div className="mt-2 text-2xl font-semibold text-amber-300">
                {data?.summary.warning ?? 0}
              </div>
            </div>
            <div className="rounded-xl border border-rose-900 bg-slate-950/60 p-4">
              <div className="text-xs uppercase tracking-wide text-rose-400">Needs review</div>
              <div className="mt-2 text-2xl font-semibold text-rose-300">
                {data?.summary.needsReview ?? 0}
              </div>
            </div>
          </div>

          <div className="mt-4 text-sm text-slate-400">
            {loading
              ? 'Loading SEO control plane…'
              : `Showing ${data?.total ?? 0} of ${data?.allEntriesTotal ?? 0} tracked surfaces`}
          </div>
        </div>

        {Object.keys(grouped).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/60 p-8 text-sm text-slate-400">
            No matching SEO / SEM surfaces.
          </div>
        ) : null}

        <div className="grid gap-6">
          {Object.entries(grouped).map(([surfaceType, entries]) => (
            <section
              key={surfaceType}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                  {surfaceType}
                </h2>
                <span className="text-xs text-slate-500">{entries.length}</span>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {entries.map((entry) => (
                  <article
                    key={entry.id}
                    className="rounded-xl border border-slate-800 bg-slate-950/60 p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-medium text-white">{entry.title}</h3>
                        <p className="mt-1 text-sm text-slate-400">{entry.route}</p>
                      </div>
                      <span
                        className={`rounded-full border px-2 py-1 text-xs ${STATE_STYLES[entry.validationState]}`}
                      >
                        {entry.validationState}
                      </span>
                    </div>

                    <div className="mt-4 space-y-2 text-sm text-slate-400">
                      <div>
                        <span className="text-slate-300">Metadata title:</span> {entry.metadataTitle}
                      </div>
                      <div>
                        <span className="text-slate-300">Description:</span> {entry.metadataDescription}
                      </div>
                      <div>
                        <span className="text-slate-300">Canonical:</span> {entry.canonicalUrl}
                      </div>
                      <div>
                        <span className="text-slate-300">SEM campaign:</span> {entry.semCampaign}
                      </div>
                      <div>
                        <span className="text-slate-300">Owner:</span> {entry.owner}
                      </div>
                      <div>
                        <span className="text-slate-300">Updated:</span> {entry.updatedAt}
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="text-sm font-medium text-white">Validation issues</div>
                      <ul className="mt-2 space-y-2 text-sm text-slate-400">
                        {entry.issues.length === 0 ? (
                          <li>• No current issues</li>
                        ) : (
                          entry.issues.map((issue) => <li key={issue}>• {issue}</li>)
                        )}
                      </ul>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {entry.actions.map((action) => (
                        <a
                          key={`${entry.id}-${action.id}`}
                          href={action.href}
                          className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-cyan-500 hover:text-white"
                        >
                          {action.label}
                        </a>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
