'use client';
// Admin Demand Forecast.
// Global/category/product snapshots + stock-out warnings.
// UX hardening for verification, refresh feedback, and empty states.

import { useEffect, useMemo, useState } from 'react';

type Snapshot = {
  id: string;
  scope: string;
  productId: string | null;
  categoryId: string | null;
  windowStartDate: string;
  windowEndDate: string;
  horizonDays: number;
  series: Array<{ date: string; predicted: number; lower: number; upper: number }>;
  diagnostics: any;
  reorderHint: string | null;
  daysUntilStockout: number | null;
  createdAt: string;
  expiresAt: string;
};

type Warning = Snapshot & {
  product: { id: string; name: string; slug: string; inventory: number } | null;
};

type Flash = {
  type: 'success' | 'error' | 'info';
  text: string;
};

export default function ForecastPage() {
  const [tab, setTab] = useState<'global' | 'warnings' | 'product' | 'category'>('global');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [warningsCount, setWarningsCount] = useState(0);
  const [warningThresholdDays, setWarningThresholdDays] = useState(14);
  const [hint, setHint] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [flash, setFlash] = useState<Flash | null>(null);

  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [productId, setProductId] = useState('');
  const [categoryId, setCategoryId] = useState('');

  useEffect(() => {
    fetch('/api/admin/products?status=ACTIVE&take=500')
      .then((r) => r.json())
      .then((d) => {
        setProducts((d.products || d.rows || []).map((p: any) => ({ id: p.id, name: p.name })));
      })
      .catch(() => {});

    fetch('/api/admin/categories')
      .then((r) => r.json())
      .then((d) => {
        setCategories((d.categories || d.rows || d || []).map((c: any) => ({ id: c.id, name: c.name })));
      })
      .catch(() => {});
  }, []);

  const scopeLabel = useMemo(() => {
    if (tab === 'global') return 'Global forecast';
    if (tab === 'warnings') return 'Stock-out warnings';
    if (tab === 'product') return 'Product forecast';
    return 'Category forecast';
  }, [tab]);

  const selectionMissing =
    (tab === 'product' && !productId) ||
    (tab === 'category' && !categoryId);

  const snapshotIsStale = snapshot
    ? new Date(snapshot.expiresAt).getTime() <= Date.now()
    : false;

  const maxPredicted = snapshot
    ? Math.max(...snapshot.series.slice(0, 30).map((s) => s.predicted), 1)
    : 1;

  async function loadGlobal() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/forecast?scope=GLOBAL');
      const data = await res.json();
      setSnapshot(data.snapshot || null);
      setWarnings([]);
      setHint(data.hint || '');
    } finally {
      setLoading(false);
    }
  }

  async function loadWarnings() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/forecast?scope=PRODUCT');
      const data = await res.json();
      setSnapshot(null);
      setWarnings(data.warnings || []);
      setWarningsCount(data.summary?.count || 0);
      setWarningThresholdDays(data.summary?.thresholdDays || 14);
      setHint('');
    } finally {
      setLoading(false);
    }
  }

  async function loadProduct(id: string) {
    if (!id) {
      setSnapshot(null);
      setHint('Pick a product to load its forecast snapshot.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/forecast?scope=PRODUCT&productId=${id}`);
      const data = await res.json();
      setSnapshot(data.snapshot || null);
      setWarnings([]);
      setHint(data.hint || '');
    } finally {
      setLoading(false);
    }
  }

  async function loadCategory(id: string) {
    if (!id) {
      setSnapshot(null);
      setHint('Pick a category to load its forecast snapshot.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/forecast?scope=CATEGORY&categoryId=${id}`);
      const data = await res.json();
      setSnapshot(data.snapshot || null);
      setWarnings([]);
      setHint(data.hint || '');
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setFlash(null);

    if (tab === 'product' && !productId) {
      setFlash({ type: 'error', text: 'Pick a product before refreshing product-level forecast.' });
      return;
    }

    if (tab === 'category' && !categoryId) {
      setFlash({ type: 'error', text: 'Pick a category before refreshing category-level forecast.' });
      return;
    }

    setRefreshing(true);
    try {
      const body: any = {
        scope:
          tab === 'global'
            ? 'GLOBAL'
            : tab === 'product'
            ? 'PRODUCT'
            : tab === 'category'
            ? 'CATEGORY'
            : 'GLOBAL',
      };

      if (tab === 'product') body.productId = productId;
      if (tab === 'category') body.categoryId = categoryId;

      const res = await fetch('/api/admin/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setFlash({
          type: 'error',
          text: data.reason || data.error || 'Refresh failed.',
        });
      } else {
        setFlash({
          type: 'success',
          text: `${scopeLabel} refreshed successfully.`,
        });
      }

      if (tab === 'global') await loadGlobal();
      else if (tab === 'product' && productId) await loadProduct(productId);
      else if (tab === 'category' && categoryId) await loadCategory(categoryId);
      else if (tab === 'warnings') await loadWarnings();
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    setFlash(null);

    if (tab === 'global') loadGlobal();
    else if (tab === 'warnings') loadWarnings();
    else if (tab === 'product') {
      if (productId) loadProduct(productId);
      else {
        setSnapshot(null);
        setHint('Pick a product to load its forecast snapshot.');
      }
    } else if (tab === 'category') {
      if (categoryId) loadCategory(categoryId);
      else {
        setSnapshot(null);
        setHint('Pick a category to load its forecast snapshot.');
      }
    }
  }, [tab, productId, categoryId]);

  const diagnostics = snapshot?.diagnostics || {};

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:justify-between md:items-end">
        <div>
          <h1 className="font-display text-3xl">Demand Forecast</h1>
          <p className="text-sm text-charcoal/60 mt-1">
            Holt-Winters triple exponential smoothing with weekly seasonality and a 90-day horizon.
          </p>
        </div>

        <button
          onClick={refresh}
          disabled={refreshing || selectionMissing}
          className="btn-outline text-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {refreshing ? 'Refreshing...' : `REFRESH ${scopeLabel.toUpperCase()}`}
        </button>
      </header>

      {flash && (
        <div
          className={
            flash.type === 'error'
              ? 'mb-4 rounded border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700'
              : flash.type === 'success'
              ? 'mb-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700'
              : 'mb-4 rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700'
          }
        >
          {flash.text}
        </div>
      )}

      <div className="flex gap-2 mb-6 border-b border-charcoal/10">
        {[
          { k: 'global' as const, l: 'Global' },
          { k: 'category' as const, l: 'By Category' },
          { k: 'product' as const, l: 'By Product' },
          { k: 'warnings' as const, l: 'Stock-out Warnings' },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`px-4 py-2 text-sm border-b-2 ${
              tab === t.k ? 'border-mitti text-mitti' : 'border-transparent text-charcoal/60'
            }`}
          >
            {t.l}
          </button>
        ))}
      </div>

      {(tab === 'product' || tab === 'category') && (
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center">
          {tab === 'product' ? (
            <>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="border border-charcoal/20 p-2 text-sm bg-white"
              >
                <option value="">Pick a product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-charcoal/50">
                Select a product to view its latest cached forecast snapshot or trigger a refresh.
              </p>
            </>
          ) : (
            <>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="border border-charcoal/20 p-2 text-sm bg-white"
              >
                <option value="">Pick a category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-charcoal/50">
                Select a category to view its latest cached forecast snapshot or trigger a refresh.
              </p>
            </>
          )}
        </div>
      )}

      {loading && <div className="text-charcoal/50 text-sm mb-4">Loading forecast data...</div>}

      {tab === 'warnings' && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <MetricCard label="Warnings count" value={warningsCount} />
            <MetricCard label="Window" value={`${warningThresholdDays} days`} />
            <MetricCard label="Scope" value="Owned product stock-out watch" />
          </div>

          {warnings.length === 0 && !loading && (
            <div className="bg-emerald-50 border border-emerald-200 p-6 text-sm text-emerald-700">
              No stock-out warnings. All monitored products appear to have enough inventory for the next {warningThresholdDays} days.
            </div>
          )}

          {warnings.length > 0 && (
            <div className="border border-charcoal/10 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-beige/40 text-xs uppercase">
                  <tr>
                    <th className="text-left p-2">Product</th>
                    <th className="text-right p-2">Inventory</th>
                    <th className="text-right p-2">Days until stock-out</th>
                    <th className="text-left p-2">Reorder hint</th>
                  </tr>
                </thead>
                <tbody>
                  {warnings.map((w) => (
                    <tr key={w.id} className="border-t border-charcoal/5">
                      <td className="p-2">{w.product?.name || w.productId}</td>
                      <td className="p-2 text-right">{w.product?.inventory ?? ''}</td>
                      <td className="p-2 text-right font-medium text-rose-700">{w.daysUntilStockout}d</td>
                      <td className="p-2 text-xs">{w.reorderHint}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab !== 'warnings' && snapshot && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-4 gap-4 text-sm">
            <MetricCard label="Snapshot status" value={snapshotIsStale ? 'Stale' : 'Fresh'} tone={snapshotIsStale ? 'warn' : 'ok'} />
            <MetricCard label="Horizon" value={`${snapshot.horizonDays} days`} />
            <MetricCard label="Data points used" value={diagnostics.dataPoints ?? '—'} />
            <MetricCard label="Days until stock-out" value={snapshot.daysUntilStockout ?? '—'} tone={snapshot.daysUntilStockout && snapshot.daysUntilStockout < 14 ? 'warn' : 'default'} />
          </div>

          {snapshot.reorderHint && (
            <div
              className={`p-4 text-sm ${
                snapshot.daysUntilStockout && snapshot.daysUntilStockout < 14
                  ? 'bg-rose-50 border border-rose-200 text-rose-700'
                  : 'bg-beige/40 border border-charcoal/10'
              }`}
            >
              {snapshot.reorderHint}
            </div>
          )}

          <div className="grid md:grid-cols-4 gap-4 text-sm">
            <MetricCard label="Average daily velocity" value={roundNum(diagnostics.level, 2)} />
            <MetricCard label="Trend (per day)" value={roundNum(diagnostics.trend, 3)} />
            <MetricCard label="RMSE (fit error)" value={roundNum(diagnostics.rmse, 2)} />
            <MetricCard label="MAPE (fit accuracy)" value={diagnostics.mape !== undefined ? `${(diagnostics.mape * 100).toFixed(1)}%` : '—'} />
          </div>

          <div className="border border-charcoal/10 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-beige/40 text-xs uppercase">
                <tr>
                  <th className="text-left p-2">Date</th>
                  <th className="text-right p-2">Predicted</th>
                  <th className="text-right p-2">Lower (95%)</th>
                  <th className="text-right p-2">Upper (95%)</th>
                  <th className="p-2">Trend</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.series.slice(0, 30).map((pt) => (
                  <tr key={pt.date} className="border-t border-charcoal/5">
                    <td className="p-2 text-xs font-mono">{pt.date}</td>
                    <td className="p-2 text-right">{pt.predicted}</td>
                    <td className="p-2 text-right text-charcoal/50">{pt.lower}</td>
                    <td className="p-2 text-right text-charcoal/50">{pt.upper}</td>
                    <td className="p-2">
                      <div className="bg-beige h-2 rounded">
                        <div
                          className="bg-mitti h-2 rounded"
                          style={{ width: `${Math.min(100, (pt.predicted / maxPredicted) * 100)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-charcoal/50">
            Snapshot created {new Date(snapshot.createdAt).toLocaleString('en-IN')} · Expires {new Date(snapshot.expiresAt).toLocaleString('en-IN')} · Window {snapshot.windowStartDate} to {snapshot.windowEndDate}
          </p>
        </div>
      )}

      {tab !== 'warnings' && !snapshot && !loading && (
        <div className="rounded border border-charcoal/10 bg-beige/40 p-6 text-sm text-charcoal/70">
          <div className="font-medium mb-2">{scopeLabel}</div>
          <div>{hint || 'No snapshot. Click REFRESH NOW to compute one (needs enough order history to model demand).'}</div>
        </div>
      )}
    </div>
  );
}

function roundNum(value: any, digits: number) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return '—';
  const factor = Math.pow(10, digits);
  return Math.round(Number(value) * factor) / factor;
}

function MetricCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: any;
  tone?: 'default' | 'ok' | 'warn';
}) {
  const toneClass =
    tone === 'ok'
      ? 'border-emerald-200 bg-emerald-50'
      : tone === 'warn'
      ? 'border-amber-200 bg-amber-50'
      : 'border-charcoal/10 bg-white';

  return (
    <div className={`border p-3 ${toneClass}`}>
      <div className="text-xs uppercase text-charcoal/50">{label}</div>
      <div className="text-xl font-display mt-1">{value}</div>
    </div>
  );
}