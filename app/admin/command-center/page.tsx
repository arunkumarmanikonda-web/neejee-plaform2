'use client';

import { useEffect, useState } from 'react';
import type {
  CommandAction,
  CommandCenterResult,
  CommandCenterSearchResponse,
  SearchEntityKind,
} from './_lib/contract';

export const dynamic = 'force-dynamic';

const GROUP_LABELS: Record<SearchEntityKind, string> = {
  command: 'Commands',
  page: 'Pages',
  seller: 'Sellers',
  user: 'Users',
  order: 'Orders',
  catalog: 'Catalogue',
  ticket: 'Tickets',
  seo: 'SEO',
  setting: 'Settings',
  kyc: 'KYC',
};

async function runAction(
  action: CommandAction,
  result: CommandCenterResult,
  setMessage: (value: string) => void,
) {
  const target = action.href ?? result.href;

  if (action.id === 'copy-link') {
    try {
      await navigator.clipboard.writeText(target);
      setMessage(`Copied: ${target}`);
    } catch {
      setMessage('Copy failed.');
    }
    return;
  }

  window.location.assign(target);
}

export default function AdminCommandCenterPage() {
  const [query, setQuery] = useState('');
  const [data, setData] = useState<CommandCenterSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      setLoading(true);
      setMessage('');

      try {
        const response = await fetch(
          `/api/admin/command-center/search?q=${encodeURIComponent(query)}`,
          { cache: 'no-store' },
        );

        const json = (await response.json()) as {
          ok: boolean;
          query: string;
          total: number;
          grouped: CommandCenterSearchResponse['grouped'];
          results: CommandCenterResult[];
        };

        if (!active) return;

        setData({
          query: json.query,
          total: json.total,
          grouped: json.grouped,
          results: json.results,
        });
        setSelectedIndex(0);
      } catch {
        if (!active) return;

        setData({
          query,
          total: 0,
          grouped: {},
          results: [],
        });
        setMessage('Search failed.');
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

  const results = data?.results ?? [];
  const groupedEntries = Object.entries(data?.grouped ?? {}) as [
    SearchEntityKind,
    CommandCenterResult[],
  ][];

  async function openSelectedResult() {
    const selected = results[selectedIndex];
    if (!selected) return;

    const primaryAction = selected.actions[0] ?? {
      id: 'open' as const,
      label: 'Open',
      href: selected.href,
    };

    await runAction(primaryAction, selected, setMessage);
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/20">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Admin AI Command Center
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                Search commands, admin surfaces, KYC flows, sellers, orders, users, catalogue, SEO, and settings.
              </p>
            </div>
            <a
              href="/admin"
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500 hover:text-white"
            >
              Back to admin
            </a>
          </div>

          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setSelectedIndex((current) =>
                  results.length === 0 ? 0 : Math.min(current + 1, results.length - 1),
                );
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setSelectedIndex((current) => Math.max(current - 1, 0));
              }
              if (event.key === 'Enter') {
                event.preventDefault();
                void openSelectedResult();
              }
            }}
            placeholder="Search admin commands, pages, KYC, sellers, orders, users, SEO..."
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-base outline-none placeholder:text-slate-500 focus:border-cyan-500"
          />

          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
            <span className="rounded-full border border-slate-800 px-2 py-1">Enter = open</span>
            <span className="rounded-full border border-slate-800 px-2 py-1">↑ ↓ = move</span>
            <span className="rounded-full border border-slate-800 px-2 py-1">Live ranked search</span>
          </div>

          <div className="mt-4 text-sm text-slate-400">
            {loading ? 'Searching…' : `Results: ${data?.total ?? 0}`}
            {message ? <span className="ml-3 text-cyan-400">{message}</span> : null}
          </div>
        </div>

        <div className="grid gap-4">
          {groupedEntries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/60 p-8 text-sm text-slate-400">
              No results yet. Try “kyc”, “seller”, “orders”, “seo”, or “settings”.
            </div>
          ) : null}

          {groupedEntries.map(([kind, entries]) => (
            <section
              key={kind}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                  {GROUP_LABELS[kind]}
                </h2>
                <span className="text-xs text-slate-500">{entries.length}</span>
              </div>

              <div className="grid gap-3">
                {entries.map((result) => {
                  const absoluteIndex = results.findIndex((item) => item.id === result.id);
                  const selected = absoluteIndex === selectedIndex;

                  return (
                    <div
                      key={result.id}
                      className={`rounded-xl border p-4 transition ${
                        selected
                          ? 'border-cyan-500 bg-cyan-500/10'
                          : 'border-slate-800 bg-slate-950/60'
                      }`}
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="text-base font-medium text-white">
                            {result.title}
                          </div>
                          <div className="mt-1 text-sm text-slate-400">
                            {result.subtitle}
                          </div>
                          <div className="mt-2 text-xs text-slate-500">
                            {result.href}
                            {result.reason ? ` · ${result.reason}` : ''}
                            {typeof result.score === 'number' ? ` · score ${result.score}` : ''}
                            {result.matchedFields?.length
                              ? ` · matched ${result.matchedFields.join(', ')}`
                              : ''}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {result.actions.map((action) => (
                            <button
                              key={`${result.id}-${action.id}`}
                              type="button"
                              onClick={() => void runAction(action, result, setMessage)}
                              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-cyan-500 hover:text-white"
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
