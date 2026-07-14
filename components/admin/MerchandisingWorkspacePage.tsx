'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Loader2, Plus, RefreshCcw, Save, Trash2 } from 'lucide-react';
import type { MerchLaunch, MerchLaunchSummary, MerchLaunchStatus } from '@/lib/merchandising/contracts';

type AdminProduct = {
  id: string;
  slug: string | null;
  sku: string | null;
  name: string;
  category: string | null;
  categorySlug: string | null;
  categoryPath: string | null;
  image: string | null;
  mrp: number | null;
  sellingPrice: number | null;
  salePrice: number | null;
  totalInventory: number;
  catalogueFeatured: boolean;
  cataloguePinHero: boolean;
  catalogueExclude: boolean;
  catalogueAudienceTag: string | null;
};

function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `₹${(value / 100).toLocaleString('en-IN')}`;
}

function toDateTimeLocal(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

const STATUS_OPTIONS: MerchLaunchStatus[] = ['DRAFT', 'SCHEDULED', 'LIVE', 'CLOSED'];

export default function MerchandisingWorkspacePage() {
  const [launches, setLaunches] = useState<MerchLaunchSummary[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [activeId, setActiveId] = useState('');
  const [active, setActive] = useState<MerchLaunch | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  async function loadLaunches(nextId?: string) {
    setError('');
    const res = await fetch('/api/admin/merchandising', { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Failed to load launches');

    const rows = Array.isArray(data?.launches) ? data.launches : [];
    setLaunches(rows);

    const targetId = nextId || activeId || rows[0]?.id || '';
    setActiveId(targetId);

    if (targetId) {
      await loadLaunch(targetId);
    } else {
      setActive(null);
    }
  }

  async function loadLaunch(id: string) {
    if (!id) {
      setActive(null);
      return;
    }

    const res = await fetch(`/api/admin/merchandising/${id}`, { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Failed to load launch');

    setActive(data.launch || null);
    setActiveId(data?.launch?.id || id);
  }

  async function loadProducts() {
    const res = await fetch('/api/admin/products?status=ACTIVE&excluded=false', { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Failed to load products');
    setProducts(Array.isArray(data?.products) ? data.products : []);
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        await Promise.all([loadProducts(), loadLaunches()]);
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Failed to initialize workspace');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((product) =>
      [product.name, product.slug, product.sku, product.category, product.catalogueAudienceTag]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [products, search]);

  const selectedIds = useMemo(() => new Set(active?.productIds || []), [active?.productIds]);

  function patchActive(patch: Partial<MerchLaunch>) {
    setActive((current) => (current ? { ...current, ...patch } : current));
  }

  function toggleProduct(productId: string) {
    setActive((current) => {
      if (!current) return current;
      const set = new Set(current.productIds);
      if (set.has(productId)) set.delete(productId);
      else set.add(productId);
      return { ...current, productIds: Array.from(set) };
    });
  }

  async function createLaunch() {
    try {
      setCreating(true);
      setError('');
      setMessage('');

      const title = newTitle.trim();
      if (!title) throw new Error('Title required');

      const res = await fetch('/api/admin/merchandising', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to create launch');

      setNewTitle('');
      setMessage('Launch created');
      await loadLaunches(data?.launch?.id);
    } catch (e: any) {
      setError(e?.message || 'Failed to create launch');
    } finally {
      setCreating(false);
    }
  }

  async function saveLaunch() {
    if (!active) return;

    try {
      setSaving(true);
      setError('');
      setMessage('');

      const res = await fetch(`/api/admin/merchandising/${active.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: active.title,
          slug: active.slug,
          subtitle: active.subtitle,
          description: active.description,
          coverImage: active.coverImage,
          founderNote: active.founderNote,
          seoTitle: active.seoTitle,
          seoDesc: active.seoDesc,
          startsAt: active.startsAt,
          endsAt: active.endsAt,
          status: active.status,
          productIds: active.productIds,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save launch');

      setActive(data.launch || null);
      setMessage('Launch saved');
      await loadLaunches(data?.launch?.id || active.id);
    } catch (e: any) {
      setError(e?.message || 'Failed to save launch');
    } finally {
      setSaving(false);
    }
  }

  async function deleteLaunch() {
    if (!active) return;
    if (!window.confirm(`Delete "${active.title}"?`)) return;

    try {
      setDeleting(true);
      setError('');
      setMessage('');

      const res = await fetch(`/api/admin/merchandising/${active.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to delete launch');

      setMessage('Launch deleted');
      setActive(null);
      setActiveId('');
      await loadLaunches();
    } catch (e: any) {
      setError(e?.message || 'Failed to delete launch');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-mitti">P2-005</p>
          <h1 className="font-display text-4xl text-kohl">Merchandising Workspace</h1>
          <p className="mt-2 max-w-3xl text-sm text-mitti">
            Curated launches, founder-note detail flow, and launch-specific product selection.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadLaunches(activeId)}
          className="inline-flex items-center gap-2 rounded border border-kohl/15 bg-white px-4 py-2 text-sm text-kohl hover:bg-ivory"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      </header>

      {error ? (
        <div className="rounded border border-madder/20 bg-madder/5 px-4 py-3 text-sm text-madder">{error}</div>
      ) : null}

      {message ? (
        <div className="rounded border border-neem/20 bg-neem/5 px-4 py-3 text-sm text-neem">{message}</div>
      ) : null}

      {loading ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-kohl/10 bg-white">
          <Loader2 className="h-5 w-5 animate-spin text-kohl" />
        </div>
      ) : (
        <div className="grid grid-cols-[320px_1fr] gap-6">
          <aside className="space-y-6">
            <section className="rounded-2xl border border-kohl/10 bg-white p-5 shadow-sm">
              <div className="mb-3">
                <p className="text-xs uppercase tracking-[0.28em] text-mitti">Create launch</p>
              </div>
              <div className="space-y-3">
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Monsoon Edit / Rakhi Edit / Festive Edit"
                  className="w-full rounded-xl border border-kohl/15 bg-ivory px-3 py-2 text-sm text-kohl outline-none focus:border-kohl"
                />
                <button
                  type="button"
                  onClick={createLaunch}
                  disabled={creating}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-kohl px-4 py-2 text-sm text-ivory disabled:opacity-60"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Create
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-kohl/10 bg-white shadow-sm">
              <div className="border-b border-kohl/10 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.28em] text-mitti">Launches</p>
              </div>
              <div className="max-h-[720px] overflow-auto">
                {launches.map((launch) => {
                  const isActive = launch.id === activeId;
                  return (
                    <button
                      key={launch.id}
                      type="button"
                      onClick={() => loadLaunch(launch.id)}
                      className={`w-full border-b border-kohl/5 px-5 py-4 text-left transition ${
                        isActive ? 'bg-ivory' : 'bg-white hover:bg-ivory/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-ui text-sm font-medium text-kohl">{launch.title}</div>
                          <div className="mt-1 text-xs uppercase tracking-[0.22em] text-mitti">
                            {launch.status} · {launch.productCount} products
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
                {!launches.length ? (
                  <div className="px-5 py-8 text-sm text-mitti">No launches yet.</div>
                ) : null}
              </div>
            </section>
          </aside>

          <section className="space-y-6">
            {!active ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-kohl/15 bg-white text-center">
                <BookOpen className="mb-4 h-10 w-10 text-mitti" />
                <h2 className="font-display text-2xl text-kohl">Select or create a launch</h2>
              </div>
            ) : (
              <>
                <section className="rounded-2xl border border-kohl/10 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-mitti">Launch details</p>
                      <h2 className="font-display text-2xl text-kohl">{active.title}</h2>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={saveLaunch}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-xl bg-kohl px-4 py-2 text-sm text-ivory disabled:opacity-60"
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={deleteLaunch}
                        disabled={deleting}
                        className="inline-flex items-center gap-2 rounded-xl border border-madder/20 bg-madder/5 px-4 py-2 text-sm text-madder disabled:opacity-60"
                      >
                        {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.22em] text-mitti">Title</span>
                      <input
                        value={active.title}
                        onChange={(e) => patchActive({ title: e.target.value })}
                        className="w-full rounded-xl border border-kohl/15 bg-ivory px-3 py-2 text-sm text-kohl outline-none focus:border-kohl"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.22em] text-mitti">Slug</span>
                      <input
                        value={active.slug}
                        onChange={(e) => patchActive({ slug: e.target.value })}
                        className="w-full rounded-xl border border-kohl/15 bg-ivory px-3 py-2 text-sm text-kohl outline-none focus:border-kohl"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.22em] text-mitti">Status</span>
                      <select
                        value={active.status}
                        onChange={(e) => patchActive({ status: e.target.value as MerchLaunchStatus })}
                        className="w-full rounded-xl border border-kohl/15 bg-ivory px-3 py-2 text-sm text-kohl outline-none focus:border-kohl"
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.22em] text-mitti">Subtitle</span>
                      <input
                        value={active.subtitle || ''}
                        onChange={(e) => patchActive({ subtitle: e.target.value })}
                        className="w-full rounded-xl border border-kohl/15 bg-ivory px-3 py-2 text-sm text-kohl outline-none focus:border-kohl"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.22em] text-mitti">Starts at</span>
                      <input
                        type="datetime-local"
                        value={toDateTimeLocal(active.startsAt)}
                        onChange={(e) => patchActive({ startsAt: e.target.value ? new Date(e.target.value).toISOString() : active.startsAt })}
                        className="w-full rounded-xl border border-kohl/15 bg-ivory px-3 py-2 text-sm text-kohl outline-none focus:border-kohl"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.22em] text-mitti">Ends at</span>
                      <input
                        type="datetime-local"
                        value={toDateTimeLocal(active.endsAt)}
                        onChange={(e) => patchActive({ endsAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                        className="w-full rounded-xl border border-kohl/15 bg-ivory px-3 py-2 text-sm text-kohl outline-none focus:border-kohl"
                      />
                    </label>

                    <label className="col-span-2 space-y-2">
                      <span className="text-xs uppercase tracking-[0.22em] text-mitti">Cover image</span>
                      <input
                        value={active.coverImage || ''}
                        onChange={(e) => patchActive({ coverImage: e.target.value })}
                        className="w-full rounded-xl border border-kohl/15 bg-ivory px-3 py-2 text-sm text-kohl outline-none focus:border-kohl"
                      />
                    </label>

                    <label className="col-span-2 space-y-2">
                      <span className="text-xs uppercase tracking-[0.22em] text-mitti">Description</span>
                      <textarea
                        rows={4}
                        value={active.description || ''}
                        onChange={(e) => patchActive({ description: e.target.value })}
                        className="w-full rounded-xl border border-kohl/15 bg-ivory px-3 py-2 text-sm text-kohl outline-none focus:border-kohl"
                      />
                    </label>

                    <label className="col-span-2 space-y-2">
                      <span className="text-xs uppercase tracking-[0.22em] text-mitti">Founder note</span>
                      <textarea
                        rows={4}
                        value={active.founderNote || ''}
                        onChange={(e) => patchActive({ founderNote: e.target.value })}
                        className="w-full rounded-xl border border-kohl/15 bg-ivory px-3 py-2 text-sm text-kohl outline-none focus:border-kohl"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.22em] text-mitti">SEO title</span>
                      <input
                        value={active.seoTitle || ''}
                        onChange={(e) => patchActive({ seoTitle: e.target.value })}
                        className="w-full rounded-xl border border-kohl/15 bg-ivory px-3 py-2 text-sm text-kohl outline-none focus:border-kohl"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.22em] text-mitti">SEO description</span>
                      <input
                        value={active.seoDesc || ''}
                        onChange={(e) => patchActive({ seoDesc: e.target.value })}
                        className="w-full rounded-xl border border-kohl/15 bg-ivory px-3 py-2 text-sm text-kohl outline-none focus:border-kohl"
                      />
                    </label>
                  </div>
                </section>

                <section className="rounded-2xl border border-kohl/10 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-mitti">Product selection</p>
                      <h3 className="font-display text-xl text-kohl">Curate the launch lineup</h3>
                    </div>
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search products, SKU, category, audience"
                      className="w-[340px] rounded-xl border border-kohl/15 bg-ivory px-3 py-2 text-sm text-kohl outline-none focus:border-kohl"
                    />
                  </div>

                  <div className="grid grid-cols-[1fr_360px] gap-5">
                    <div className="overflow-hidden rounded-xl border border-kohl/10">
                      <div className="max-h-[520px] overflow-auto">
                        <table className="min-w-full text-sm">
                          <thead className="sticky top-0 bg-ivory">
                            <tr className="text-left text-xs uppercase tracking-[0.22em] text-mitti">
                              <th className="px-4 py-3">Pick</th>
                              <th className="px-4 py-3">Product</th>
                              <th className="px-4 py-3">Category</th>
                              <th className="px-4 py-3">Price</th>
                              <th className="px-4 py-3">Inventory</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredProducts.map((product) => {
                              const checked = selectedIds.has(product.id);
                              return (
                                <tr key={product.id} className="border-t border-kohl/5 align-top">
                                  <td className="px-4 py-3">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleProduct(product.id)}
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="font-medium text-kohl">{product.name}</div>
                                    <div className="mt-1 text-xs text-mitti">{product.sku || product.slug || product.id}</div>
                                  </td>
                                  <td className="px-4 py-3 text-kohl/80">{product.category || '—'}</td>
                                  <td className="px-4 py-3 text-kohl/80">{money(product.salePrice ?? product.sellingPrice ?? product.mrp)}</td>
                                  <td className="px-4 py-3 text-kohl/80">{product.totalInventory}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="rounded-xl border border-kohl/10 bg-ivory/50 p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-mitti">Selected</p>
                      <div className="mt-3 space-y-3">
                        {(active.selectedProducts || [])
                          .filter((product) => selectedIds.has(product.id))
                          .map((product) => (
                            <div key={product.id} className="rounded-lg border border-kohl/10 bg-white p-3">
                              <div className="font-medium text-kohl">{product.name}</div>
                              <div className="mt-1 text-xs text-mitti">
                                {product.sku || product.slug || product.id}
                              </div>
                            </div>
                          ))}

                        {!active.productIds.length ? (
                          <div className="rounded-lg border border-dashed border-kohl/15 px-3 py-4 text-sm text-mitti">
                            No products selected yet.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </section>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}