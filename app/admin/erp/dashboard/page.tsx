'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ErpDashboardResponse } from '@/lib/erp/dashboard';

export const dynamic = 'force-dynamic';

const EMPTY_DATA: ErpDashboardResponse = {
  version: 'erp.dashboard.v1',
  rangeDays: 30,
  summary: {
    totalAttempts: 0,
    queued: 0,
    processing: 0,
    succeeded: 0,
    failed: 0,
    deadLetterAttempts: 0,
    openDeadLetters: 0,
    retryScheduledDeadLetters: 0,
    resolvedDeadLetters: 0,
    discardedDeadLetters: 0,
  },
  daily: [],
  byEntity: [],
  recentAttempts: [],
  recentDeadLetters: [],
};

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatDate(value: string | null): string {
  if (!value) return '—';
  return dateFormatter.format(new Date(value));
}

export default function AdminErpDashboardPage() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<ErpDashboardResponse>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setErr('');

    try {
      const response = await fetch(`/api/admin/erp/dashboard?days=${days}`, {
        credentials: 'include',
        cache: 'no-store',
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error || 'Failed to load ERP dashboard');
      }

      setData(body);
    } catch (error: any) {
      setData(EMPTY_DATA);
      setErr(error?.message || 'Failed to load ERP dashboard');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const dailyMax = useMemo(() => {
    return Math.max(1, ...data.daily.map((item) => item.total));
  }, [data.daily]);

  if (loading) {
    return (
      <div className="p-12 text-center text-mitti font-italic italic">
        Reading ERP pulse...
      </div>
    );
  }

  if (err) {
    return (
      <div className="m-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {err}
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="label text-madder">ERP OBSERVABILITY</p>
          <h1 className="font-display text-4xl text-kohl">Sync dashboard</h1>
          <p className="mt-1 font-italic italic text-mitti">
            Watch queue health, recent attempts, and dead-letter pressure.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {[7, 30, 90].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setDays(value as 7 | 30 | 90)}
              className={`px-4 py-2 text-xs tracking-wider font-ui ${
                days === value
                  ? 'bg-kohl text-ivory'
                  : 'bg-beige text-kohl hover:bg-beige/60'
              }`}
            >
              {value} DAYS
            </button>
          ))}

          <Link
            href="/admin/erp/failures"
            className="bg-madder px-4 py-2 text-xs tracking-wider font-ui text-white hover:opacity-90"
          >
            OPEN FAILURE QUEUE
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard label="TOTAL ATTEMPTS" value={data.summary.totalAttempts} accent />
        <KpiCard label="SUCCEEDED" value={data.summary.succeeded} />
        <KpiCard label="FAILED" value={data.summary.failed} />
        <KpiCard label="DEAD LETTER ATTEMPTS" value={data.summary.deadLetterAttempts} />
        <KpiCard label="OPEN DEAD LETTERS" value={data.summary.openDeadLetters} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="QUEUED" value={data.summary.queued} />
        <KpiCard label="PROCESSING" value={data.summary.processing} />
        <KpiCard label="RETRY SCHEDULED" value={data.summary.retryScheduledDeadLetters} />
        <KpiCard label="RESOLVED" value={data.summary.resolvedDeadLetters} />
      </div>

      <section className="bg-beige p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="label text-madder">ATTEMPTS OVER TIME</p>
            <p className="mt-1 font-display text-2xl text-kohl">
              {data.summary.totalAttempts} attempts in {data.rangeDays} days
            </p>
          </div>
          <p className="font-italic italic text-mitti text-sm">
            Daily throughput snapshot
          </p>
        </div>

        {data.daily.length === 0 ? (
          <p className="font-italic italic text-mitti text-sm">
            No ERP sync attempts recorded in this range.
          </p>
        ) : (
          <>
            <div className="flex h-36 items-end gap-1">
              {data.daily.map((item) => (
                <div
                  key={item.date}
                  className="group relative flex-1 bg-kohl/75 transition-colors hover:bg-madder"
                  style={{
                    height: `${Math.max(6, (item.total / dailyMax) * 100)}%`,
                  }}
                  title={`${item.date}: ${item.total} attempts`}
                >
                  <div className="pointer-events-none absolute -top-10 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap bg-kohl px-2 py-1 text-xs text-ivory opacity-0 group-hover:opacity-100">
                    {item.date}: {item.total}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex justify-between text-xs text-mitti">
              <span>{data.daily[0]?.date}</span>
              <span>{data.daily[data.daily.length - 1]?.date}</span>
            </div>
          </>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="bg-beige p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="label text-madder">ENTITY BREAKDOWN</p>
            <p className="text-xs text-mitti">By sync attempt volume</p>
          </div>

          {data.byEntity.length === 0 ? (
            <p className="font-italic italic text-mitti text-sm">
              No entity activity recorded yet.
            </p>
          ) : (
            <div className="space-y-3">
              {data.byEntity.map((item) => {
                const max = Math.max(1, ...data.byEntity.map((entry) => entry.count));
                const width = Math.max(6, (item.count / max) * 100);

                return (
                  <div key={item.entityType}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-kohl">{item.entityType}</span>
                      <span className="font-medium text-kohl">{item.count}</span>
                    </div>
                    <div className="h-2 overflow-hidden bg-mitti/10">
                      <div
                        className="h-full bg-madder"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="bg-beige p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="label text-madder">DEAD-LETTER STATUS</p>
            <Link
              href="/admin/erp/failures"
              className="text-xs text-kohl underline underline-offset-2"
            >
              Review queue
            </Link>
          </div>

          <div className="space-y-3 text-sm">
            <StatusRow label="Open" value={data.summary.openDeadLetters} />
            <StatusRow
              label="Retry scheduled"
              value={data.summary.retryScheduledDeadLetters}
            />
            <StatusRow label="Resolved" value={data.summary.resolvedDeadLetters} />
            <StatusRow label="Discarded" value={data.summary.discardedDeadLetters} />
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="bg-beige p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="label text-madder">RECENT ATTEMPTS</p>
            <p className="text-xs text-mitti">Latest 20 records</p>
          </div>

          {data.recentAttempts.length === 0 ? (
            <p className="font-italic italic text-mitti text-sm">
              No recent attempts found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-mitti/20 text-left text-xs label text-mitti">
                    <th className="pb-2">ENTITY</th>
                    <th className="pb-2">STATUS</th>
                    <th className="pb-2">ATTEMPT</th>
                    <th className="pb-2">CREATED</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentAttempts.map((item) => (
                    <tr key={item.id} className="border-b border-mitti/10 align-top">
                      <td className="py-3">
                        <div className="font-medium text-kohl">{item.entityType}</div>
                        <div className="text-xs text-mitti">{item.entityKey}</div>
                        <div className="mt-1 text-xs text-mitti">
                          {item.action} · {item.adapterKind}
                        </div>
                      </td>
                      <td className="py-3">
                        <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-xs text-kohl">
                          {item.status}
                        </span>
                        {item.errorMessage ? (
                          <div className="mt-2 max-w-xs whitespace-pre-wrap text-xs text-red-700">
                            {item.errorMessage}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-3 text-kohl">
                        {item.attemptNumber} / {item.maxAttempts}
                      </td>
                      <td className="py-3 text-xs text-mitti">
                        {formatDate(item.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="bg-beige p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="label text-madder">RECENT DEAD LETTERS</p>
            <Link
              href="/admin/erp/failures"
              className="text-xs text-kohl underline underline-offset-2"
            >
              Open queue
            </Link>
          </div>

          {data.recentDeadLetters.length === 0 ? (
            <p className="font-italic italic text-mitti text-sm">
              No dead-letter records found.
            </p>
          ) : (
            <div className="space-y-4">
              {data.recentDeadLetters.map((item) => (
                <div key={item.id} className="border-b border-mitti/10 pb-4 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-kohl">
                        {item.entityType} · {item.entityKey}
                      </div>
                      <div className="mt-1 text-xs text-mitti">
                        {item.syncAttempt.action} · {item.syncAttempt.adapterKind} · attempt{' '}
                        {item.syncAttempt.attemptNumber}/{item.syncAttempt.maxAttempts}
                      </div>
                    </div>

                    <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-xs text-kohl">
                      {item.status}
                    </span>
                  </div>

                  <div className="mt-2 text-sm text-red-700">
                    {item.errorCode ? `${item.errorCode}: ` : ''}
                    {item.errorMessage}
                  </div>

                  {item.resolutionNote ? (
                    <div className="mt-2 text-xs text-emerald-700">
                      Resolution: {item.resolutionNote}
                    </div>
                  ) : null}

                  <div className="mt-2 text-xs text-mitti">
                    Last failed {formatDate(item.lastFailedAt)} · Updated{' '}
                    {formatDate(item.updatedAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className={accent ? 'bg-kohl p-5 text-ivory' : 'bg-beige p-5 text-kohl'}>
      <p className={`label ${accent ? 'text-banarasi' : 'text-mitti'}`}>{label}</p>
      <p className="mt-2 font-display text-3xl">{value.toLocaleString('en-IN')}</p>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-kohl">{label}</span>
        <span className="font-medium text-kohl">{value}</span>
      </div>
      <div className="h-2 overflow-hidden bg-mitti/10">
        <div
          className="h-full bg-kohl/70"
          style={{ width: `${Math.min(100, Math.max(6, value * 8))}%` }}
        />
      </div>
    </div>
  );
}
