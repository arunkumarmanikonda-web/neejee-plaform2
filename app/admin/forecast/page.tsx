'use client';
// Admin Demand Forecast.
// Three tabs: Global, Category, Stockout warnings (per-product).
// Uses cached ForecastSnapshot rows refreshed by daily cron.

import { useEffect, useState } from 'react';

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

type Warning = Snapshot & { product: { id: string; name: string; slug: string; inventory: number } | null };

export default function ForecastPage() {
  const [tab, setTab] = useState<'global' | 'warnings' | 'product' | 'category'>('global');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [hint, setHint] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [productId, setProductId] = useState('');
  const [categoryId, setCategoryId] = useState('');

  // Load product/category lists for pickers
  useEffect(() => {
    fetch('/api/admin/products?status=ACTIVE&take=500').then(r => r.json()).then(d => {
      setProducts((d.products || d.rows || []).map((p: any) => ({ id: p.id, name: p.name })));
    }).catch(() => {});
    fetch('/api/admin/categories').then(r => r.json()).then(d => {
      setCategories((d.categories || d.rows || d || []).map((c: any) => ({ id: c.id, name: c.name })));
    }).catch(() => {});
  }, []);

  async function loadGlobal() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/forecast?scope=GLOBAL');
      const data = await res.json();
      setSnapshot(data.snapshot);
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
      setWarnings(data.warnings || []);
    } finally {
      setLoading(false);
    }
  }

  async function loadProduct(id: string) {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/forecast?scope=PRODUCT&productId=${id}`);
      const data = await res.json();
      setSnapshot(data.snapshot);
      setHint(data.hint || '');
    } finally {
      setLoading(false);
    }
  }

  async function loadCategory(id: string) {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/forecast?scope=CATEGORY&categoryId=${id}`);
      const data = await res.json();
      setSnapshot(data.snapshot);
      setHint(data.hint || '');
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    try {
      const body: any = { scope: tab === 'global' ? 'GLOBAL' : tab === 'product' ? 'PRODUCT' : tab === 'category' ? 'CATEGORY' : 'GLOBAL' };
      if (tab === 'product') body.productId = productId;
      if (tab === 'category') body.categoryId = categoryId;
      const res = await fetch('/api/admin/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data.reason || data.error || 'Refresh failed');
      } else {
        alert('Refreshed.');
      }
      // Reload
      if (tab === 'global') loadGlobal();
      else if (tab === 'product' && productId) loadProduct(productId);
      else if (tab === 'category' && categoryId) loadCategory(categoryId);
      else if (tab === 'warnings') loadWarnings();
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (tab === 'global') loadGlobal();
    else if (tab === 'warnings') loadWarnings();
    else if (tab === 'product' && productId) loadProduct(productId);
    else if (tab === 'category' && categoryId) loadCategory(categoryId);
  }, [tab, productId, categoryId]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="font-display text-3xl">Demand Forecast</h1>
          <p className="text-sm text-charcoal/60 mt-1">
            Holt-Winters triple exponential smoothing with weekly seasonality (90-day horizon).
          </p>
        </div>
        <button onClick={refresh} disabled={refreshing} className="btn-outline text-xs">
          {refreshing ? 'Refreshing…' : 'REFRESH NOW'}
        </button>
      </header>

      <div className="flex gap-2 mb-6 border-b border-charcoal/10">
        {[
          { k: 'global' as const, l: 'Global' },
          { k: 'category' as const, l: 'By Category' },
          { k: 'product' as const, l: 'By Product' },
          { k: 'warnings' as const, l: 'Stock-out Warnings' },
        ].map(t => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`px-4 py-2 text-sm border-b-2 ${tab === t.k ? 'border-mitti text-mitti' : 'border-transparent text-charcoal/60'}`}
          >
            {t.l}
          </button>
        ))}
      </div>

      {(tab === 'product' || tab === 'category') && (
        <div className="mb-4 flex items-center gap-2">
          {tab === 'product' ? (
            <select value={productId} onChange={e => setProductId(e.target.value)} className="border border-charcoal/20 p-2 text-sm">
              <option value="">— Pick a product —</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          ) : (
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="border border-charcoal/20 p-2 text-sm">
              <option value="">— Pick a category —</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {loading && <div className="text-charcoal/50 text-sm">Loading…</div>}

      {tab === 'warnings' && (
        <div>
          {warnings.length === 0 && !loading && (
            <div className="bg-emerald-50 border border-emerald-200 p-6 text-sm text-emerald-700">
              No stock-out warnings. All OWNED products have enough inventory for the next 14 days.
            </div>
          )}
          {warnings.length > 0 && (
            <div className="border border-charcoal/10">
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
                  {warnings.map(w => (
                    <tr key={w.id} className="border-t border-charcoal/5">
                      <td className="p-2">{w.product?.name || w.productId}</td>
                      <td className="p-2 text-right">{w.product?.inventory ?? '—'}</td>
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
        <div>
          {/* Reorder hint card */}
          {snapshot.reorderHint && (
            <div className={`p-4 mb-4 text-sm ${snapshot.daysUntilStockout && snapshot.daysUntilStockout < 14 ? 'bg-rose-50 border border-rose-200 text-rose-700' : 'bg-beige/40'}`}>
              {snapshot.reorderHint}
            </div>
          )}

          {/* Diagnostics */}
          <div className="grid md:grid-cols-4 gap-4 mb-4 text-sm">
            <Card label="Average daily velocity" value={Math.round(snapshot.diagnostics.level * 100) / 100} />
            <Card label="Trend (per day)" value={Math.round(snapshot.diagnostics.trend * 1000) / 1000} />
            <Card label="RMSE (fit error)" value={Math.round(snapshot.diagnostics.rmse * 100) / 100} />
            <Card label="MAPE (fit accuracy)" value={(snapshot.diagnostics.mape * 100).toFixed(1) + '%'} />
          </div>

          {/* Series table — first 30 days */}
          <div className="border border-charcoal/10">
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
                {snapshot.series.slice(0, 30).map((pt, i) => (
                  <tr key={pt.date} className="border-t border-charcoal/5">
                    <td className="p-2 text-xs font-mono">{pt.date}</td>
                    <td className="p-2 text-right">{pt.predicted}</td>
                    <td className="p-2 text-right text-charcoal/50">{pt.lower}</td>
                    <td className="p-2 text-right text-charcoal/50">{pt.upper}</td>
                    <td className="p-2">
                      {/* Simple bar viz */}
                      <div className="bg-beige h-2 rounded">
                        <div
                          className="bg-mitti h-2 rounded"
                          style={{ width: `${Math.min(100, (pt.predicted / Math.max(...snapshot.series.slice(0, 30).map(s => s.predicted), 1)) * 100)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs text-charcoal/50">
            Snapshot created {new Date(snapshot.createdAt).toLocaleString('en-IN')} · expires {new Date(snapshot.expiresAt).toLocaleString('en-IN')} · {snapshot.diagnostics.dataPoints} data points used
          </p>
        </div>
      )}

      {tab !== 'warnings' && !snapshot && !loading && (
        <div className="bg-beige/40 p-6 text-sm text-charcoal/60">
          {hint || 'No snapshot. Click REFRESH NOW to compute one (needs ≥14 days of order history).'}
        </div>
      )}
    </div>
  );
}

function Card({ label, value }: { label: string; value: any }) {
  return (
    <div className="border border-charcoal/10 p-3">
      <div className="text-xs uppercase text-charcoal/50">{label}</div>
      <div className="text-xl font-display mt-1">{value}</div>
    </div>
  );
}
