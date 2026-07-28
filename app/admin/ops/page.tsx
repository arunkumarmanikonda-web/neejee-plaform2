'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CrudEntityDescriptor } from './_lib/entities';

type RegistryResponse = {
  ok: boolean;
  query: string;
  total: number;
  allEntitiesTotal: number;
  entities: CrudEntityDescriptor[];
};

const DOMAIN_LABELS: Record<CrudEntityDescriptor['domain'], string> = {
  marketplace: 'Marketplace',
  catalog: 'Catalog',
  operations: 'Operations',
  growth: 'Growth',
  system: 'System',
};

export const dynamic = 'force-dynamic';

export default function AdminOpsPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RegistryResponse | null>(null);

  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      setLoading(true);

      try {
        const response = await fetch(
          `/api/admin/ops/registry?q=${encodeURIComponent(query)}`,
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
          allEntitiesTotal: 0,
          entities: [],
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
    const buckets: Record<string, CrudEntityDescriptor[]> = {};
    for (const entity of data?.entities ?? []) {
      const key = entity.domain;
      buckets[key] = buckets[key] ?? [];
      buckets[key].push(entity);
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
                Admin Ops Workspace
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                Deep CRUD + operator UX shell
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-400">
                One consistent admin workspace for high-frequency CRUD domains: sellers,
                KYC, orders, users, catalogue, tickets, SEO, and settings.
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
              placeholder="Search CRUD domains, queues, settings, or operator actions..."
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-base outline-none placeholder:text-slate-500 focus:border-cyan-500"
            />
          </div>

          <div className="mt-4 text-sm text-slate-400">
            {loading
              ? 'Loading workspace…'
              : `Showing ${data?.total ?? 0} of ${data?.allEntitiesTotal ?? 0} domains`}
          </div>
        </div>

        {Object.keys(grouped).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/60 p-8 text-sm text-slate-400">
            No matching CRUD domains.
          </div>
        ) : null}

        <div className="grid gap-6">
          {Object.entries(grouped).map(([domain, entities]) => (
            <section
              key={domain}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                  {DOMAIN_LABELS[domain as CrudEntityDescriptor['domain']]}
                </h2>
                <span className="text-xs text-slate-500">{entities.length}</span>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {entities.map((entity) => (
                  <article
                    key={entity.slug}
                    className="rounded-xl border border-slate-800 bg-slate-950/60 p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-medium text-white">{entity.title}</h3>
                        <p className="mt-1 text-sm text-slate-400">{entity.subtitle}</p>
                      </div>
                      <a
                        href={`/admin/ops/${entity.slug}`}
                        className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-cyan-500 hover:text-white"
                      >
                        Open workspace
                      </a>
                    </div>

                    <p className="mt-4 text-sm text-slate-400">{entity.description}</p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {entity.badges.map((badge) => (
                        <span
                          key={badge}
                          className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-300"
                        >
                          {badge}
                        </span>
                      ))}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {entity.actions.map((action) => (
                        <a
                          key={`${entity.slug}-${action.id}`}
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
