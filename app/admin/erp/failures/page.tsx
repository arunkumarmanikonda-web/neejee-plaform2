'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type FailureStatus = 'OPEN' | 'RETRY_SCHEDULED' | 'RESOLVED' | 'DISCARDED';
type FilterStatus = FailureStatus | 'ALL';

type FailureItem = {
  id: string;
  entityType: string;
  entityKey: string;
  status: FailureStatus;
  errorCode: string | null;
  errorMessage: string;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
  lastFailedAt: string;
  resolvedAt: string | null;
  syncAttempt: {
    id: string;
    action: string;
    adapterKind: string;
    attemptNumber: number;
    maxAttempts: number;
    status: string;
    runAfter: string;
  };
};

type FailureStats = {
  total: number;
  open: number;
  retryScheduled: number;
  resolved: number;
  discarded: number;
};

const EMPTY_STATS: FailureStats = {
  total: 0,
  open: 0,
  retryScheduled: 0,
  resolved: 0,
  discarded: 0,
};

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatDate(value: string | null): string {
  if (!value) return '—';
  return dateFormatter.format(new Date(value));
}

export default function AdminErpFailuresPage() {
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
  const [failures, setFailures] = useState<FailureItem[]>([]);
  const [stats, setStats] = useState<FailureStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filterOptions = useMemo<FilterStatus[]>(
    () => ['ALL', 'OPEN', 'RETRY_SCHEDULED', 'RESOLVED', 'DISCARDED'],
    []
  );

  async function loadFailures() {
    setLoading(true);
    setError(null);

    try {
      const query =
        statusFilter === 'ALL' ? '' : `?status=${encodeURIComponent(statusFilter)}`;

      const response = await fetch(`/api/admin/erp/failures${query}`, {
        cache: 'no-store',
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error || 'Failed to load ERP failures');
      }

      setFailures(Array.isArray(body.failures) ? body.failures : []);
      setStats(body.stats || EMPTY_STATS);
    } catch (err: any) {
      setFailures([]);
      setStats(EMPTY_STATS);
      setError(err?.message || 'Failed to load ERP failures');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFailures();
  }, [statusFilter]);

  async function retryFailure(id: string) {
    setBusyId(id);
    setError(null);

    try {
      const response = await fetch(`/api/admin/erp/failures/${id}/retry`, {
        method: 'POST',
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error || 'Failed to retry ERP item');
      }

      await loadFailures();
    } catch (err: any) {
      setError(err?.message || 'Failed to retry ERP item');
    } finally {
      setBusyId(null);
    }
  }

  async function resolveFailure(id: string) {
    const resolutionNote = window.prompt(
      'Optional resolution note',
      'Resolved manually after review'
    );

    if (resolutionNote === null) {
      return;
    }

    setBusyId(id);
    setError(null);

    try {
      const response = await fetch(`/api/admin/erp/failures/${id}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resolutionNote }),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error || 'Failed to resolve ERP item');
      }

      await loadFailures();
    } catch (err: any) {
      setError(err?.message || 'Failed to resolve ERP item');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">ERP failure queue</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Review dead-letter items, schedule retries, and mark failures resolved.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/erp"
            className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-700"
          >
            ERP home
          </Link>
          <Link
            href="/admin/erp/dashboard"
            className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-700"
          >
            Sync dashboard
          </Link>
          <Link
            href="/admin/erp/reconciliation"
            className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-700"
          >
            Reconciliation
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {filterOptions.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setStatusFilter(option)}
            className={`rounded-full border px-4 py-2 text-sm ${
              statusFilter === option
                ? 'border-neutral-900 bg-neutral-900 text-white'
                : 'border-neutral-300 bg-white text-neutral-700'
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Open" value={stats.open} />
        <StatCard label="Retry scheduled" value={stats.retryScheduled} />
        <StatCard label="Resolved" value={stats.resolved} />
        <StatCard label="Discarded" value={stats.discarded} />
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <HeaderCell>Entity</HeaderCell>
                <HeaderCell>Error</HeaderCell>
                <HeaderCell>Attempt</HeaderCell>
                <HeaderCell>Status</HeaderCell>
                <HeaderCell>Last failed</HeaderCell>
                <HeaderCell>Actions</HeaderCell>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                    Loading ERP failures…
                  </td>
                </tr>
              ) : failures.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                    No ERP failure records found.
                  </td>
                </tr>
              ) : (
                failures.map((item) => {
                  const isBusy = busyId === item.id;
                  const canRetry =
                    item.status === 'OPEN' || item.status === 'RETRY_SCHEDULED';
                  const canResolve = item.status !== 'RESOLVED';

                  return (
                    <tr key={item.id} className="align-top">
                      <BodyCell>
                        <div className="font-medium text-neutral-900">
                          {item.entityType}
                        </div>
                        <div className="text-neutral-600">{item.entityKey}</div>
                        <div className="mt-1 text-xs text-neutral-500">
                          Action: {item.syncAttempt.action}
                        </div>
                      </BodyCell>

                      <BodyCell>
                        <div className="font-medium text-neutral-900">
                          {item.errorCode || 'ERP_ERROR'}
                        </div>
                        <div className="mt-1 whitespace-pre-wrap text-neutral-600">
                          {item.errorMessage}
                        </div>
                        {item.resolutionNote ? (
                          <div className="mt-2 text-xs text-emerald-700">
                            Resolution: {item.resolutionNote}
                          </div>
                        ) : null}
                      </BodyCell>

                      <BodyCell>
                        <div className="text-neutral-900">
                          {item.syncAttempt.attemptNumber} / {item.syncAttempt.maxAttempts}
                        </div>
                        <div className="text-xs text-neutral-500">
                          Adapter: {item.syncAttempt.adapterKind}
                        </div>
                      </BodyCell>

                      <BodyCell>
                        <span className="inline-flex rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">
                          {item.status}
                        </span>
                      </BodyCell>

                      <BodyCell>
                        <div>{formatDate(item.lastFailedAt)}</div>
                        <div className="mt-1 text-xs text-neutral-500">
                          Updated {formatDate(item.updatedAt)}
                        </div>
                      </BodyCell>

                      <BodyCell>
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => retryFailure(item.id)}
                            disabled={!canRetry || isBusy}
                            className="rounded-lg border border-neutral-300 px-3 py-2 text-left text-sm text-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isBusy ? 'Working…' : 'Schedule retry'}
                          </button>

                          <button
                            type="button"
                            onClick={() => resolveFailure(item.id)}
                            disabled={!canResolve || isBusy}
                            className="rounded-lg border border-neutral-300 px-3 py-2 text-left text-sm text-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isBusy ? 'Working…' : 'Mark resolved'}
                          </button>
                        </div>
                      </BodyCell>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-neutral-900">{value}</div>
    </div>
  );
}

function HeaderCell({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
      {children}
    </th>
  );
}

function BodyCell({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-4 text-sm text-neutral-700">{children}</td>;
}
