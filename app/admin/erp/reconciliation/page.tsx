'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type {
  ErpReconciliationFilter,
  ErpReconciliationItem,
  ErpReconciliationResponse,
} from '@/lib/erp/reconciliation';

const EMPTY_RESPONSE: ErpReconciliationResponse = {
  version: 'phase3.erp-reconciliation.v1',
  generatedAt: new Date(0).toISOString(),
  adapterKind: 'mock',
  filter: 'ALL',
  summary: {
    total: 0,
    matched: 0,
    drift: 0,
    missingInErp: 0,
    missingInPlatform: 0,
    statusMismatchCount: 0,
    sellingPriceMismatchCount: 0,
    mrpMismatchCount: 0,
    inventoryMismatchCount: 0,
  },
  items: [],
};

const FILTERS: ErpReconciliationFilter[] = [
  'ALL',
  'DRIFT',
  'MISSING_IN_ERP',
  'MISSING_IN_PLATFORM',
  'MATCHED',
];

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

export default function AdminErpReconciliationPage() {
  const [filter, setFilter] = useState<ErpReconciliationFilter>('DRIFT');
  const [data, setData] = useState<ErpReconciliationResponse>(EMPTY_RESPONSE);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');

    try {
      const response = await fetch(
        `/api/admin/erp/reconciliation?filter=${encodeURIComponent(filter)}&limit=200`,
        {
          credentials: 'include',
          cache: 'no-store',
        }
      );

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error || 'Failed to load reconciliation report');
      }

      setData(body);
    } catch (error: any) {
      setData(EMPTY_RESPONSE);
      setErr(error?.message || 'Failed to load reconciliation report');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="label text-madder">ERP RECONCILIATION</p>
          <h1 className="font-display text-4xl text-kohl">Drift report</h1>
          <p className="mt-1 font-italic italic text-mitti">
            Compare platform catalogue truth against ERP product, price, and stock snapshots.
          </p>
          <p className="mt-2 text-xs text-mitti">
            Adapter: {data.adapterKind} · Generated {formatDate(data.generatedAt)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`px-4 py-2 text-xs tracking-wider font-ui ${
                filter === value
                  ? 'bg-kohl text-ivory'
                  : 'bg-beige text-kohl hover:bg-beige/60'
              }`}
            >
              {value.replaceAll('_', ' ')}
            </button>
          ))}

          <Link
            href="/admin/erp/dashboard"
            className="bg-madder px-4 py-2 text-xs tracking-wider font-ui text-white hover:opacity-90"
          >
            OPEN DASHBOARD
          </Link>
        </div>
      </div>

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {err}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard label="TOTAL SKUS" value={data.summary.total} accent />
        <KpiCard label="DRIFT" value={data.summary.drift} />
        <KpiCard label="MISSING IN ERP" value={data.summary.missingInErp} />
        <KpiCard label="MISSING IN PLATFORM" value={data.summary.missingInPlatform} />
        <KpiCard label="MATCHED" value={data.summary.matched} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="STATUS MISMATCH" value={data.summary.statusMismatchCount} />
        <KpiCard
          label="SELLING PRICE MISMATCH"
          value={data.summary.sellingPriceMismatchCount}
        />
        <KpiCard label="MRP MISMATCH" value={data.summary.mrpMismatchCount} />
        <KpiCard label="INVENTORY MISMATCH" value={data.summary.inventoryMismatchCount} />
      </div>

      <section className="bg-beige p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="label text-madder">REPORT RESULTS</p>
            <p className="mt-1 font-display text-2xl text-kohl">
              {data.items.length.toLocaleString('en-IN')} rows returned
            </p>
          </div>
          <p className="text-xs text-mitti">
            Filter: {filter.replaceAll('_', ' ')}
          </p>
        </div>

        {loading ? (
          <p className="font-italic italic text-mitti text-sm">Comparing platform and ERP…</p>
        ) : data.items.length === 0 ? (
          <p className="font-italic italic text-mitti text-sm">
            No reconciliation rows found for this filter.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mitti/20 text-left text-xs label text-mitti">
                  <th className="pb-2">SKU</th>
                  <th className="pb-2">KIND</th>
                  <th className="pb-2">PLATFORM</th>
                  <th className="pb-2">ERP</th>
                  <th className="pb-2">DIFFS</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={`${item.kind}-${item.sku}`} className="border-b border-mitti/10 align-top">
                    <td className="py-3">
                      <div className="font-medium text-kohl">{item.sku}</div>
                      {item.platform?.productId ? (
                        <Link
                          href={`/admin/products/${item.platform.productId}`}
                          className="mt-1 inline-block text-xs text-madder underline underline-offset-2"
                        >
                          Open product
                        </Link>
                      ) : (
                        <div className="mt-1 text-xs text-mitti">No platform record</div>
                      )}
                    </td>

                    <td className="py-3">
                      <KindBadge kind={item.kind} />
                    </td>

                    <td className="py-3">
                      {item.platform ? (
                        <SnapshotCard
                          title={item.platform.name}
                          status={item.platform.status}
                          sellingPricePaise={item.platform.sellingPricePaise}
                          mrpPaise={item.platform.mrpPaise}
                          inventoryQuantity={item.platform.inventoryQuantity}
                          updatedAt={item.platform.updatedAt}
                        />
                      ) : (
                        <span className="text-xs text-mitti">Missing in platform</span>
                      )}
                    </td>

                    <td className="py-3">
                      {item.erp ? (
                        <SnapshotCard
                          title={item.erp.name}
                          status={item.erp.status}
                          sellingPricePaise={item.erp.sellingPricePaise}
                          mrpPaise={item.erp.mrpPaise}
                          inventoryQuantity={item.erp.inventoryQuantity}
                          updatedAt={item.erp.updatedAt}
                        />
                      ) : (
                        <span className="text-xs text-mitti">Missing in ERP</span>
                      )}
                    </td>

                    <td className="py-3">
                      {item.mismatches.length === 0 ? (
                        <span className="text-xs text-mitti">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {item.mismatches.map((mismatch) => (
                            <span
                              key={mismatch}
                              className="inline-flex rounded-full bg-white px-2.5 py-1 text-xs text-kohl"
                            >
                              {mismatch.replaceAll('_', ' ')}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
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

function KindBadge({ kind }: { kind: ErpReconciliationItem['kind'] }) {
  const className =
    kind === 'MATCHED'
      ? 'bg-green-50 text-green-700'
      : kind === 'DRIFT'
      ? 'bg-amber-50 text-amber-700'
      : 'bg-red-50 text-red-700';

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs ${className}`}>
      {kind.replaceAll('_', ' ')}
    </span>
  );
}

function SnapshotCard({
  title,
  status,
  sellingPricePaise,
  mrpPaise,
  inventoryQuantity,
  updatedAt,
}: {
  title: string;
  status: string;
  sellingPricePaise: number;
  mrpPaise: number;
  inventoryQuantity: number;
  updatedAt: string;
}) {
  return (
    <div className="space-y-1 text-xs">
      <div className="font-medium text-kohl">{title}</div>
      <div className="text-mitti">Status: {status}</div>
      <div className="text-mitti">SP: ₹{(sellingPricePaise / 100).toLocaleString('en-IN')}</div>
      <div className="text-mitti">MRP: ₹{(mrpPaise / 100).toLocaleString('en-IN')}</div>
      <div className="text-mitti">Inventory: {inventoryQuantity.toLocaleString('en-IN')}</div>
      <div className="text-mitti">Updated: {formatDate(updatedAt)}</div>
    </div>
  );
}

