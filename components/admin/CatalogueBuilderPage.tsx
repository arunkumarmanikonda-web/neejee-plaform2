'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Download,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';

type AdminProduct = {
  id: string;
  slug: string | null;
  sku: string | null;
  name: string;
  shortName: string | null;
  craft: string | null;
  region: string | null;
  material: string | null;
  occasion: string | null;
  category: string | null;
  categorySlug: string | null;
  categoryPath: string | null;
  status: string;
  image: string | null;
  totalInventory: number;
  mrp?: number | null;
  sellingPrice?: number | null;
  salePrice?: number | null;
  catalogueFeatured: boolean;
  cataloguePinHero: boolean;
  catalogueExclude: boolean;
  catalogueAudienceTag: string | null;
};

type Project = {
  id: string;
  slug: string;
  title: string;
  status: 'DRAFT' | 'PREVIEW' | 'PUBLISHED' | 'ARCHIVED';
  updatedAt: string;
  createdAt: string;
  productCount: number;
  founderName: string;
  sections: {
    config: {
      brandName: string;
      templateKey: 'luxury_signature';
      includeFounderNotes: boolean;
      includeClosingPage: boolean;
      coverImage?: string | null;
    };
    selection: {
      productIds: string[];
      categorySlug?: string | null;
      categoryPath?: string | null;
      limit?: number | null;
    };
    copy: {
      title: string;
      slug: string;
      seoTitle?: string | null;
      seoDesc?: string | null;
      founderName: string;
      preNote: string;
      endingNote: string;
      heroHeading: string;
      heroSubheading: string;
      sectionIntro: string;
      productNarratives: Record<string, string>;
      productPullQuotes: Record<string, string>;
    };
  };
  products: Array<{
    id: string;
    slug: string | null;
    sku: string | null;
    name: string;
    categoryName: string | null;
    craft: string | null;
    region: string | null;
    material: string | null;
    technique: string | null;
    occasion: string | null;
    totalInventory: number;
    image: string | null;
    cataloguePinHero: boolean;
    salePrice: number | null;
    sellingPrice: number | null;
    mrp: number | null;
  }>;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatInr(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return `₹${(value / 100).toLocaleString('en-IN')}`;
}

export default function CatalogueBuilderPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [active, setActive] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [newTitle, setNewTitle] = useState('Neejee Premium Catalogue');
  const [createSelection, setCreateSelection] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadProjects(nextId?: string) {
    const res = await fetch('/api/admin/catalogues', { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load projects');
    setProjects(data.projects || []);

    const firstId = nextId || activeId || data.projects?.[0]?.id || '';
    if (firstId) {
      await loadProject(firstId);
    } else {
      setActive(null);
      setActiveId('');
    }
  }

  async function loadProducts() {
    const res = await fetch('/api/admin/products?status=ACTIVE&excluded=false', { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load products');
    setProducts(data.products || []);
  }

  async function loadProject(id: string) {
    const res = await fetch(`/api/admin/catalogues/${id}`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load project');
    setActive(data.project);
    setActiveId(data.project.id);
  }

  async function boot() {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadProducts(), loadProjects()]);
    } catch (e: any) {
      setError(e?.message || 'Failed to load catalogue builder');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    boot();
  }, []);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter((item) =>
      [item.name, item.shortName, item.slug, item.sku, item.craft, item.region, item.category, item.material]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [products, search]);

  function updateCopyField<K extends keyof Project['sections']['copy']>(key: K, value: Project['sections']['copy'][K]) {
    if (!active) return;
    setActive({
      ...active,
      title: key === 'title' ? String(value) : active.title,
      slug: key === 'slug' ? String(value) : active.slug,
      sections: {
        ...active.sections,
        copy: {
          ...active.sections.copy,
          [key]: value,
        },
      },
    });
  }

  function updateProductSelection(productId: string, checked: boolean) {
    if (!active) return;
    const next = checked
      ? Array.from(new Set([...active.sections.selection.productIds, productId]))
      : active.sections.selection.productIds.filter((id) => id !== productId);

    const picked = products.find((item) => item.id === productId);
    const nextProducts = checked
      ? picked && !active.products.some((item) => item.id === productId)
        ? [
            ...active.products,
            {
              id: picked.id,
              slug: picked.slug,
              sku: picked.sku,
              name: picked.name,
              categoryName: picked.category,
              craft: picked.craft,
              region: picked.region,
              material: picked.material,
              technique: null,
              occasion: picked.occasion,
              totalInventory: picked.totalInventory,
              image: picked.image,
              cataloguePinHero: picked.cataloguePinHero,
              salePrice: picked.salePrice ?? null,
              sellingPrice: picked.sellingPrice ?? null,
              mrp: picked.mrp ?? null,
            },
          ]
        : active.products
      : active.products.filter((item) => item.id !== productId);

    setActive({
      ...active,
      productCount: next.length,
      sections: {
        ...active.sections,
        selection: {
          ...active.sections.selection,
          productIds: next,
        },
      },
      products: nextProducts,
    });
  }

  async function saveActive(status?: Project['status']) {
    if (!active) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/admin/catalogues/${active.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: active.sections.copy.title,
          slug: active.sections.copy.slug,
          status: status || active.status,
          config: active.sections.config,
          selection: active.sections.selection,
          copy: active.sections.copy,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save project');
      setActive(data.project);
      setMessage('Catalogue project saved.');
      await loadProjects(data.project.id);
    } catch (e: any) {
      setError(e?.message || 'Failed to save project');
    } finally {
      setSaving(false);
    }
  }

  async function createProject() {
    const ids = Object.entries(createSelection)
      .filter(([, checked]) => checked)
      .map(([id]) => id);

    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/admin/catalogues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: newTitle, productIds: ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create project');
      setMessage('Catalogue project created.');
      setCreateSelection({});
      await loadProjects(data.project.id);
    } catch (e: any) {
      setError(e?.message || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  }

  async function deleteActive() {
    if (!active) return;
    if (!window.confirm(`Delete ${active.title}?`)) return;
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/catalogues/${active.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete project');
      setMessage('Catalogue project deleted.');
      setActive(null);
      setActiveId('');
      await loadProjects();
    } catch (e: any) {
      setError(e?.message || 'Failed to delete project');
    } finally {
      setDeleting(false);
    }
  }

  async function draftWithAi() {
    if (!active) return;
    setDrafting(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/admin/catalogues/${active.id}/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ feedback }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || data.message || 'Failed to generate draft');
      setActive(data.project);
      setMessage('AI draft applied to catalogue copy.');
      await loadProjects(active.id);
    } catch (e: any) {
      setError(e?.message || 'Failed to generate AI draft');
    } finally {
      setDrafting(false);
    }
  }

  const activeProductIds = new Set(active?.sections.selection.productIds || []);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="label text-banarasi">CATALOGUE BUILDER</p>
          <h1 className="font-display text-4xl text-kohl mt-2">Full-bleed HTML → PDF catalogues</h1>
          <p className="font-ui text-sm text-mitti mt-3 max-w-3xl leading-7">
            Build founder-led catalogues from existing eligible inventory only, edit copy manually,
            generate AI drafts, preview HTML, and export a proper full-bleed PDF from the saved project.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={boot}
            className="inline-flex items-center gap-2 px-4 py-2 rounded border border-mitti/30 bg-white text-kohl font-ui text-xs tracking-widest"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            type="button"
            onClick={createProject}
            disabled={creating}
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-kohl text-ivory font-ui text-xs tracking-widest disabled:opacity-60"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create project
          </button>
        </div>
      </div>

      {(message || error) && (
        <div className={`rounded border px-4 py-3 font-ui text-sm ${error ? 'border-madder/30 bg-madder/5 text-madder' : 'border-neem/30 bg-neem/5 text-neem'}`}>
          {error || message}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-3 rounded border border-mitti/20 bg-white p-6 font-ui text-sm text-mitti">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading catalogue builder…
        </div>
      ) : (
        <div className="grid grid-cols-[300px_1fr] gap-6">
          <aside className="space-y-6">
            <div className="rounded-2xl border border-mitti/15 bg-white p-5 shadow-sm">
              <p className="label text-banarasi mb-3">NEW PROJECT</p>
              <label className="block text-xs font-ui tracking-widest text-mitti mb-2">Title</label>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full rounded border border-mitti/20 px-3 py-2 font-ui text-sm"
                placeholder="Neejee Premium Catalogue"
              />
              <label className="block text-xs font-ui tracking-widest text-mitti mt-4 mb-2">Seed selection</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded border border-mitti/20 px-3 py-2 font-ui text-sm"
                placeholder="Search by name, SKU, craft, region"
              />
              <div className="mt-3 max-h-[360px] overflow-auto rounded border border-mitti/15">
                {filteredProducts.map((product) => (
                  <label key={product.id} className="flex gap-3 border-b border-mitti/10 px-3 py-3 last:border-b-0">
                    <input
                      type="checkbox"
                      checked={!!createSelection[product.id]}
                      onChange={(e) => setCreateSelection((prev) => ({ ...prev, [product.id]: e.target.checked }))}
                      className="mt-1"
                    />
                    <div className="min-w-0">
                      <p className="font-ui text-sm text-kohl font-medium truncate">{product.name}</p>
                      <p className="font-ui text-[11px] uppercase tracking-widest text-mitti mt-1">
                        {[product.category, product.craft, product.region].filter(Boolean).join(' · ') || 'Eligible inventory'}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-mitti/15 bg-white p-5 shadow-sm">
              <p className="label text-banarasi mb-3">PROJECTS</p>
              <div className="space-y-2">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => loadProject(project.id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left ${activeId === project.id ? 'border-kohl bg-kohl text-ivory' : 'border-mitti/15 bg-ivory text-kohl'}`}
                  >
                    <p className="font-ui text-sm font-medium">{project.title}</p>
                    <p className={`font-ui text-[11px] uppercase tracking-widest mt-1 ${activeId === project.id ? 'text-beige/80' : 'text-mitti'}`}>
                      {project.productCount} products · {project.status}
                    </p>
                    <p className={`font-ui text-[11px] mt-1 ${activeId === project.id ? 'text-beige/70' : 'text-mitti'}`}>
                      Updated {formatDate(project.updatedAt)}
                    </p>
                  </button>
                ))}
                {projects.length === 0 && (
                  <p className="font-ui text-sm text-mitti">No catalogue projects yet.</p>
                )}
              </div>
            </div>
          </aside>

          <section className="space-y-6">
            {!active ? (
              <div className="rounded-2xl border border-dashed border-mitti/30 bg-white p-12 text-center">
                <BookOpen className="w-8 h-8 mx-auto text-mitti" />
                <p className="font-ui text-sm text-mitti mt-4">Create a project or select one from the left.</p>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-mitti/15 bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="label text-banarasi">PROJECT SETTINGS</p>
                      <h2 className="font-display text-3xl text-kohl mt-2">{active.sections.copy.title}</h2>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => saveActive()}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded border border-mitti/30 bg-white text-kohl font-ui text-xs tracking-widest disabled:opacity-60"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={draftWithAi}
                        disabled={drafting}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded bg-madder text-ivory font-ui text-xs tracking-widest disabled:opacity-60"
                      >
                        {drafting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        AI draft
                      </button>
                      <Link
                        href={`/api/catalog/project/${active.id}?format=html`}
                        target="_blank"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded bg-kohl text-ivory font-ui text-xs tracking-widest"
                      >
                        <Eye className="w-4 h-4" /> Preview HTML
                      </Link>
                      <Link
                        href={`/api/catalog/project/${active.id}?format=pdf`}
                        target="_blank"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded bg-neem text-ivory font-ui text-xs tracking-widest"
                      >
                        <Download className="w-4 h-4" /> Export PDF
                      </Link>
                      <button
                        type="button"
                        onClick={deleteActive}
                        disabled={deleting}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded border border-madder/30 text-madder font-ui text-xs tracking-widest disabled:opacity-60"
                      >
                        {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <label className="block">
                      <span className="block text-xs font-ui tracking-widest text-mitti mb-2">Title</span>
                      <input value={active.sections.copy.title} onChange={(e) => updateCopyField('title', e.target.value)} className="w-full rounded border border-mitti/20 px-3 py-2 font-ui text-sm" />
                    </label>
                    <label className="block">
                      <span className="block text-xs font-ui tracking-widest text-mitti mb-2">Slug</span>
                      <input value={active.sections.copy.slug} onChange={(e) => updateCopyField('slug', e.target.value)} className="w-full rounded border border-mitti/20 px-3 py-2 font-ui text-sm" />
                    </label>
                    <label className="block">
                      <span className="block text-xs font-ui tracking-widest text-mitti mb-2">Founder name</span>
                      <input value={active.sections.copy.founderName} onChange={(e) => updateCopyField('founderName', e.target.value)} className="w-full rounded border border-mitti/20 px-3 py-2 font-ui text-sm" />
                    </label>
                    <label className="block">
                      <span className="block text-xs font-ui tracking-widest text-mitti mb-2">SEO title</span>
                      <input value={active.sections.copy.seoTitle || ''} onChange={(e) => updateCopyField('seoTitle', e.target.value)} className="w-full rounded border border-mitti/20 px-3 py-2 font-ui text-sm" />
                    </label>
                    <label className="block col-span-2">
                      <span className="block text-xs font-ui tracking-widest text-mitti mb-2">SEO description</span>
                      <textarea value={active.sections.copy.seoDesc || ''} onChange={(e) => updateCopyField('seoDesc', e.target.value)} className="w-full rounded border border-mitti/20 px-3 py-2 font-ui text-sm min-h-[72px]" />
                    </label>
                    <label className="block">
                      <span className="block text-xs font-ui tracking-widest text-mitti mb-2">Hero heading</span>
                      <input value={active.sections.copy.heroHeading} onChange={(e) => updateCopyField('heroHeading', e.target.value)} className="w-full rounded border border-mitti/20 px-3 py-2 font-ui text-sm" />
                    </label>
                    <label className="block">
                      <span className="block text-xs font-ui tracking-widest text-mitti mb-2">Hero subheading</span>
                      <textarea value={active.sections.copy.heroSubheading} onChange={(e) => updateCopyField('heroSubheading', e.target.value)} className="w-full rounded border border-mitti/20 px-3 py-2 font-ui text-sm min-h-[72px]" />
                    </label>
                    <label className="block col-span-2">
                      <span className="block text-xs font-ui tracking-widest text-mitti mb-2">Founder pre-note</span>
                      <textarea value={active.sections.copy.preNote} onChange={(e) => updateCopyField('preNote', e.target.value)} className="w-full rounded border border-mitti/20 px-3 py-2 font-ui text-sm min-h-[120px] leading-7" />
                    </label>
                    <label className="block col-span-2">
                      <span className="block text-xs font-ui tracking-widest text-mitti mb-2">Section intro</span>
                      <textarea value={active.sections.copy.sectionIntro} onChange={(e) => updateCopyField('sectionIntro', e.target.value)} className="w-full rounded border border-mitti/20 px-3 py-2 font-ui text-sm min-h-[90px] leading-7" />
                    </label>
                    <label className="block col-span-2">
                      <span className="block text-xs font-ui tracking-widest text-mitti mb-2">Ending note</span>
                      <textarea value={active.sections.copy.endingNote} onChange={(e) => updateCopyField('endingNote', e.target.value)} className="w-full rounded border border-mitti/20 px-3 py-2 font-ui text-sm min-h-[120px] leading-7" />
                    </label>
                    <label className="block col-span-2">
                      <span className="block text-xs font-ui tracking-widest text-mitti mb-2">AI draft guidance</span>
                      <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} className="w-full rounded border border-mitti/20 px-3 py-2 font-ui text-sm min-h-[72px]" placeholder="Optional tone guidance for the AI draft" />
                    </label>
                  </div>
                </div>

                <div className="rounded-2xl border border-mitti/15 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div>
                      <p className="label text-banarasi">SELECTION</p>
                      <p className="font-ui text-sm text-mitti mt-2">Only ACTIVE and catalogue-eligible inventory is available here.</p>
                    </div>
                    <p className="font-ui text-xs tracking-widest text-mitti uppercase">{active.sections.selection.productIds.length} selected</p>
                  </div>
                  <div className="max-h-[420px] overflow-auto rounded border border-mitti/10">
                    <table className="w-full font-ui text-sm">
                      <thead className="sticky top-0 bg-ivory z-10">
                        <tr className="text-left text-[11px] uppercase tracking-widest text-mitti">
                          <th className="p-3">Pick</th>
                          <th className="p-3">Product</th>
                          <th className="p-3">Category</th>
                          <th className="p-3">Price</th>
                          <th className="p-3">Inventory</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProducts.map((product) => (
                          <tr key={product.id} className="border-t border-mitti/10 align-top">
                            <td className="p-3">
                              <input
                                type="checkbox"
                                checked={activeProductIds.has(product.id)}
                                onChange={(e) => updateProductSelection(product.id, e.target.checked)}
                              />
                            </td>
                            <td className="p-3 min-w-[280px]">
                              <div className="font-medium text-kohl">{product.name}</div>
                              <div className="text-[11px] uppercase tracking-widest text-mitti mt-1">
                                {[product.sku, product.craft, product.region].filter(Boolean).join(' · ')}
                              </div>
                            </td>
                            <td className="p-3 text-mitti">{product.category || '—'}</td>
                            <td className="p-3 text-kohl">{formatInr(product.salePrice ?? product.sellingPrice ?? product.mrp)}</td>
                            <td className="p-3 text-kohl">{product.totalInventory}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-2xl border border-mitti/15 bg-white p-6 shadow-sm">
                  <p className="label text-banarasi mb-4">PRODUCT COPY OVERRIDES</p>
                  <div className="space-y-6">
                    {active.products.map((product) => (
                      <div key={product.id} className="rounded-2xl border border-mitti/10 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-display text-2xl text-kohl">{product.name}</h3>
                            <p className="font-ui text-xs uppercase tracking-widest text-mitti mt-2">
                              {[product.categoryName, product.craft, product.region].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-ui text-sm text-kohl">{formatInr(product.salePrice ?? product.sellingPrice ?? product.mrp)}</p>
                            <p className="font-ui text-xs uppercase tracking-widest text-mitti mt-1">Inventory {product.totalInventory}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <label className="block col-span-2">
                            <span className="block text-xs font-ui tracking-widest text-mitti mb-2">Narrative override</span>
                            <textarea
                              value={active.sections.copy.productNarratives[product.id] || ''}
                              onChange={(e) => updateCopyField('productNarratives', { ...active.sections.copy.productNarratives, [product.id]: e.target.value })}
                              className="w-full rounded border border-mitti/20 px-3 py-2 font-ui text-sm min-h-[96px]"
                            />
                          </label>
                          <label className="block col-span-2">
                            <span className="block text-xs font-ui tracking-widest text-mitti mb-2">Pull-quote override</span>
                            <textarea
                              value={active.sections.copy.productPullQuotes[product.id] || ''}
                              onChange={(e) => updateCopyField('productPullQuotes', { ...active.sections.copy.productPullQuotes, [product.id]: e.target.value })}
                              className="w-full rounded border border-mitti/20 px-3 py-2 font-ui text-sm min-h-[72px]"
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                    {active.products.length === 0 && (
                      <p className="font-ui text-sm text-mitti">No selected products yet. Tick products in the selection table above.</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
