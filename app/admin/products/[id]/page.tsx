'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatINR, effectivePricePaise, discountPct } from '@/lib/money';
import { ImageUploader } from '@/components/admin/ImageUploader';
import { PriceInput } from '@/components/admin/PriceInput';
import { DateTimeInput } from '@/components/admin/DateTimeInput';
import { Trash2, Plus, Save, Archive } from 'lucide-react';

const STATUSES = ['DRAFT', 'PENDING_QC', 'ACTIVE', 'ARCHIVED', 'REJECTED'];
import { AiCopyButton } from '@/components/admin/AiCopyButton';
import AiPhotoStudio from '@/components/admin/AiPhotoStudio';
import VariantImageManager from '@/components/admin/VariantImageManager';
import AiDraftAllButton from '@/components/admin/AiDraftAllButton';
import AiNameSuggester from '@/components/admin/AiNameSuggester';
import AiFieldRedraft from '@/components/admin/AiFieldRedraft';
import CategoryPicker, { CategoryPickerValue } from '@/components/admin/CategoryPicker';
import { BADGE_CATALOG } from '@/lib/badges';
import { suggestSizesForCategory, suggestColorsForCategory } from '@/lib/variant-suggestions';

const TABS = ['BASIC', 'IMAGES', 'PRICING', 'CATALOGUE', 'INVENTORY', 'STORY', 'SEO'] as const;
const STOCK_VISIBILITY_OPTIONS = ['IN_STOCK_ONLY', 'SHOW_ALL', 'HIDE_STOCK'] as const;
type Tab = typeof TABS[number];

export default function AdminProductEdit() {
  const params = useParams();
  const router = useRouter();
  const productId = params?.id as string;
  const [product, setProduct] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [variants, setVariants] = useState<any[]>([]);
  const [categories, setCategories] = useState<{ id: string; slug: string; name: string; path?: string | null; level?: number | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState<Tab>('BASIC');

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(d => setCategories(d.categories || []));
  }, []);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/admin/products/${productId}`);
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch { data = { error: text }; }
      if (!res.ok) {
        const fallback = await fetch(`/api/admin/products/by-slug/${encodeURIComponent(productId)}`);
        if (fallback.ok) {
          const fData = await fallback.json();
          if (fData.product) {
            data = fData;
          } else {
            throw new Error(`${res.status} ${data.error || 'Unknown error'} — id: ${productId}`);
          }
        } else {
          throw new Error(`${res.status} ${data.error || 'Unknown error'} — id: ${productId}`);
        }
      }
      const p = data.product;
      if (!p) throw new Error(`API returned no product object — id: ${productId}`);
      setProduct(p);
      setForm({
        name: p.name || '',
        shortName: p.shortName || '',
        slug: p.slug || '',
        description: p.description || '',
        craft: p.craft || '',
        region: p.region || '',
        state: p.state || '',
        cluster: p.cluster || '',
        artisanName: p.artisanName || '',
        material: p.material || '',
        technique: p.technique || '',
        occasion: p.occasion || '',
        mrp: p.mrp || 0,
        sellingPrice: p.sellingPrice || 0,
        salePrice: p.salePrice ?? null,
        saleStartsAt: p.saleStartsAt || null,
        saleEndsAt: p.saleEndsAt || null,
        gstRate: p.gstRate || 5,
        hsnCode: p.hsnCode || '',
        status: p.status || 'DRAFT',
        poeticLine: p.poeticLine || '',
        story: p.story || '',
        craftNote: p.craftNote || '',
        careInstructions: p.careInstructions || '',
        sustainabilityNote: p.sustainabilityNote || '',
        images: Array.isArray(p.images) ? p.images : [],
        badges: Array.isArray(p.badges) ? p.badges : [],
        seoTitle: p.seoTitle || '',
        seoDesc: p.seoDesc || '',
        aiTryOnEligible: !!p.aiTryOnEligible,
        aiRoomEligible: !!p.aiRoomEligible,
        arTryOnEligible: !!p.arTryOnEligible,
        fulfilmentMode: p.fulfilmentMode || 'IN_STOCK',
        depositPercent: p.depositPercent ?? 20,
        releaseDate: p.releaseDate ? new Date(p.releaseDate).toISOString().slice(0, 10) : '',
        editionSize: p.editionSize ?? null,
        editionSold: p.editionSold ?? 0,
        codEligible: p.codEligible !== false,
        returnEligible: p.returnEligible === true,
        returnPolicy: p.returnPolicy || '',
        categoryId: p.categoryId || '',
        catalogueFeatured: !!p.catalogueFeatured,
        catalogueBestseller: !!p.catalogueBestseller,
        catalogueEditorial: !!p.catalogueEditorial,
        cataloguePinHero: !!p.cataloguePinHero,
        catalogueExclude: !!p.catalogueExclude,
        cataloguePreferredImage: p.cataloguePreferredImage || '',
        catalogueAudienceTag: p.catalogueAudienceTag || '',
        catalogueCtaMode: p.catalogueCtaMode || '',
        catalogueStoryBlock: p.catalogueStoryBlock || '',
        catalogueImageApproved: !!p.catalogueImageApproved,
        catalogueImageQualityScore: p.catalogueImageQualityScore ?? null,
        catalogueStockVisibility: p.catalogueStockVisibility || 'IN_STOCK_ONLY',
      });
      setVariants(p.variants || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (productId) load(); }, [productId]);

  const save = async () => {
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess('Product saved');
      setTimeout(() => setSuccess(''), 2500);
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const archive = async () => {
    if (!confirm('Archive this product? It will not be visible to customers.')) return;
    try {
      const res = await fetch(`/api/admin/products/${productId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push('/admin/products');
    } catch (e: any) { alert('Failed: ' + e.message); }
  };

  const [variantQuickAddOpen, setVariantQuickAddOpen] = useState(false);

  const addVariant = () => setVariantQuickAddOpen(true);

  const createVariantsBulk = async (
    sizes: string[],
    colours: Array<{ name: string; hex: string }>
  ) => {
    const productSku = product?.sku || form.sku || 'NEE';
    const sizeAxis = sizes.length > 0 ? sizes : [''];
    const colourAxis = colours.length > 0 ? colours : [{ name: '', hex: '' }];
    const existingSkus = new Set(variants.map((v: any) => (v.sku || '').toUpperCase()));
    let okCount = 0, skipCount = 0, failCount = 0;
    for (const size of sizeAxis) {
      for (const c of colourAxis) {
        const sizeTag = size.toString().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
        const colourTag = c.name.toString().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
        const tag = [sizeTag, colourTag].filter(Boolean).join('-') || 'VAR';
        let sku = `${productSku}-${tag}`;
        let suffix = 2;
        while (existingSkus.has(sku.toUpperCase())) {
          sku = `${productSku}-${tag}-${suffix++}`;
          if (suffix > 50) break;
        }
        existingSkus.add(sku.toUpperCase());
        try {
          const res = await fetch(`/api/admin/products/${productId}/variants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              sku,
              size: size || null,
              color: c.name || null,
              colorHex: c.hex || null,
              inventory: 0,
            }),
          });
          if (res.ok) okCount++;
          else {
            const d = await res.json().catch(() => ({}));
            if (d?.error?.includes?.('already exists') || d?.error?.includes?.('Unique')) skipCount++;
            else { failCount++; console.warn(`Variant ${sku} failed:`, d.error || res.status); }
          }
        } catch (e: any) {
          failCount++;
          console.warn(`Variant ${sku} failed:`, e.message);
        }
      }
    }
    setVariantQuickAddOpen(false);
    await load();
    if (failCount > 0 || skipCount > 0) {
      alert(`Created ${okCount}. Skipped ${skipCount} duplicate(s). Failed ${failCount}.`);
    }
  };

  const updateVariant = async (vid: string, patch: any) => {
    try {
      const res = await fetch(`/api/admin/products/${productId}/variants/${vid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
    } catch (e: any) { alert('Failed: ' + e.message); }
  };

  const deleteVariant = async (vid: string) => {
    if (!confirm('Delete this variant?')) return;
    try {
      const res = await fetch(`/api/admin/products/${productId}/variants/${vid}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
    } catch (e: any) { alert('Failed: ' + e.message); }
  };

  const duplicateVariant = async (source: any) => {
    const productSku = product?.sku || form.sku || 'NEE';
    const sizeTag = (source.size || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    const base = [productSku, sizeTag].filter(Boolean).join('-') || 'VAR';
    const existingSkus = new Set(variants.map((v: any) => (v.sku || '').toUpperCase()));
    let sku = `${base}-NEW`;
    let suffix = 2;
    while (existingSkus.has(sku.toUpperCase())) {
      sku = `${base}-NEW-${suffix++}`;
      if (suffix > 50) break;
    }
    try {
      const res = await fetch(`/api/admin/products/${productId}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sku,
          size: source.size || null,
          color: '',
          colorHex: null,
          inventory: 0,
          lowStockThreshold: source.lowStockThreshold ?? 3,
          mrp: source.mrp ?? null,
          sellingPrice: source.sellingPrice ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      await load();
    } catch (e: any) { alert('Duplicate failed: ' + e.message); }
  };

  const saveAllVariants = () => {
    window.dispatchEvent(new CustomEvent('variant-save-all'));
  };

  if (loading) return <p className="text-mitti">Loading product...</p>;
  if (!product) return (
    <div className="max-w-2xl">
      <Link href="/admin/products" className="label text-mitti hover:text-madder">← BACK TO PRODUCTS</Link>
      <h1 className="font-display text-3xl text-kohl mt-4">Product not found</h1>
      <p className="font-italic italic text-mitti mt-2">We looked for ID / slug / SKU “<span className="font-mono">{productId}</span>” but couldn’t find a matching product.</p>
      {error && (
        <div className="mt-6 bg-madder/5 border border-madder/20 p-4">
          <p className="label text-madder">API ERROR</p>
          <p className="font-mono text-xs text-kohl mt-2 break-all">{error}</p>
        </div>
      )}
      <div className="mt-6 flex gap-3">
        <button onClick={load} className="btn-outline text-xs">RETRY</button>
        <Link href="/admin/products" className="btn-primary text-xs">BACK TO LIST</Link>
      </div>
      <div className="mt-8 bg-beige p-4 text-xs text-mitti">
        <p className="label text-mitti mb-2">DEBUG TIPS</p>
        <ol className="list-decimal pl-4 space-y-1">
          <li>Open browser DevTools → Network → reload this page → inspect the failing /api/admin/products/{productId} call.</li>
          <li>If status is 401 → your session expired, sign in again.</li>
          <li>If status is 404 → the product was deleted or the ID is wrong. Go back to the list and click EDIT again.</li>
          <li>If status is 500 → server-side database error. Check Vercel function logs.</li>
        </ol>
      </div>
    </div>
  );

  const eff = effectivePricePaise(form.sellingPrice, form.salePrice, form.saleStartsAt, form.saleEndsAt);
  const dp = discountPct(form.mrp, eff.price);

  return (
    <>
      <Link href="/admin/products" className="label text-mitti hover:text-madder">← BACK TO PRODUCTS</Link>
      <div className="flex justify-between items-start mt-2 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-kohl">{product.name}</h1>
          <p className="font-italic italic text-mitti mt-1">SKU: <span className="font-mono">{product.sku}</span> · Slug: /{product.slug}</p>
          {eff.onSale && (
            <span className="inline-block mt-2 bg-madder text-ivory text-[10px] tracking-widest font-ui px-2 py-1">
              ON SALE — {dp}% OFF
            </span>
          )}
        </div>
        <div className="flex gap-3 flex-wrap">
          <AiDraftAllButton
            form={{
              name: form.name,
              shortName: form.shortName,
              poeticLine: form.poeticLine,
              description: form.description,
              story: form.story,
              craftNote: form.craftNote,
              careInstructions: form.careInstructions,
              sustainabilityNote: form.sustainabilityNote,
              material: form.material,
              technique: form.technique,
              occasion: form.occasion,
              seoTitle: form.seoTitle,
              seoDesc: form.seoDesc,
              craft: form.craft,
              region: form.region,
              state: form.state,
              cluster: form.cluster,
              artisanName: form.artisanName,
              categoryName: product?.category?.name,
            }}
            onApply={(draft: any) => {
              setForm((f: any) => ({ ...f, ...draft }));
            }}
          />
          <button onClick={archive} className="btn-outline flex items-center gap-2">
            <Archive className="w-4 h-4" /> ARCHIVE
          </button>
          <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50 flex items-center gap-2">
            <Save className="w-4 h-4" /> {saving ? 'SAVING...' : 'SAVE CHANGES'}
          </button>
        </div>
      </div>
      <div className="madder-divider mt-4"></div>

      {error && <p className="mt-4 font-ui text-sm text-madder bg-madder/10 p-3">{error}</p>}
      {success && <p className="mt-4 font-ui text-sm text-neem bg-neem/10 p-3">{success}</p>}

      <div className="flex gap-1 mt-6 border-b border-mitti/20">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 font-ui text-xs tracking-widest transition-colors ${
              tab === t ? 'bg-kohl text-ivory' : 'text-mitti hover:text-kohl'
            }`}>
            {t}
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          {tab === 'BASIC' && (
            <div className="bg-beige p-6">
              <p className="label text-madder mb-4">BASIC INFORMATION</p>
              <Field label="Product Name" value={form.name} onChange={(v: string) => setForm((f: any) => ({...f, name: v}))} required />
              <Field label="Short Name" value={form.shortName} onChange={(v: string) => setForm((f: any) => ({...f, shortName: v}))} help="Used in carousels and small cards" />
              <Field label="URL Slug" value={form.slug} onChange={(v: string) => setForm((f: any) => ({...f, slug: v}))} help="Becomes /products/<slug>" mono />
              <div>
                <label className="label text-mitti">CATEGORY <span className="text-madder">*</span></label>
                <div className="mt-1">
                  <CategoryPicker
                    value={
                      form.categoryId
                        ? (() => {
                            const c = categories.find((x: any) => x.id === form.categoryId);
                            return c
                              ? {
                                  id: c.id,
                                  slug: c.slug,
                                  path: c.path || c.slug,
                                  label: c.name,
                                  level: c.level || 1,
                                }
                              : null;
                          })()
                        : null
                    }
                    onChange={(v) => setForm((f: any) => ({ ...f, categoryId: v?.id || '' }))}
                    required
                    productContext={{
                      name: form.name,
                      description: form.description,
                      craft: form.craft,
                      region: form.region,
                      material: form.material,
                    }}
                  />
                </div>
                <p className="font-ui text-[11px] text-mitti mt-1">
                  Search any leaf (e.g. “Banarasi”) — the full path is shown. AI can resolve or create missing sub-categories on demand.
                </p>
              </div>
              <div>
                <Field label="Poetic Line" value={form.poeticLine} onChange={(v: string) => setForm((f: any) => ({...f, poeticLine: v}))} help="The one-liner that appears under the title" />
                <div className="mt-1">
                  <AiCopyButton
                    field="poeticLine"
                    brief={{ name: form.name, craft: form.craft, region: form.region, artisanName: form.artisanName, material: form.material, technique: form.technique, occasion: form.occasion }}
                    onApply={(d: any) => setForm((f: any) => ({ ...f, poeticLine: d.text }))}
                  />
                </div>
              </div>
              <div>
                <Field label="Description" value={form.description} onChange={(v: string) => setForm((f: any) => ({...f, description: v}))} multiline rows={4} />
                <div className="mt-1">
                  <AiCopyButton
                    field="description"
                    brief={{ name: form.name, craft: form.craft, region: form.region, artisanName: form.artisanName, material: form.material, technique: form.technique, occasion: form.occasion }}
                    onApply={(d: any) => setForm((f: any) => ({ ...f, description: d.text }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <Field label="Craft" value={form.craft} onChange={(v: string) => setForm((f: any) => ({...f, craft: v}))} help="e.g. Banarasi, Chanderi, Kalamkari" />
                <Field label="Region" value={form.region} onChange={(v: string) => setForm((f: any) => ({...f, region: v}))} help="e.g. Varanasi, Hyderabad" />
                <Field label="State" value={form.state} onChange={(v: string) => setForm((f: any) => ({...f, state: v}))} />
                <Field label="Cluster" value={form.cluster} onChange={(v: string) => setForm((f: any) => ({...f, cluster: v}))} help="Artisan cluster" />
                <Field label="Artisan Name" value={form.artisanName} onChange={(v: string) => setForm((f: any) => ({...f, artisanName: v}))} />
                <Field label="Material" value={form.material} onChange={(v: string) => setForm((f: any) => ({...f, material: v}))} />
                <Field label="Technique" value={form.technique} onChange={(v: string) => setForm((f: any) => ({...f, technique: v}))} />
                <Field label="Occasion" value={form.occasion} onChange={(v: string) => setForm((f: any) => ({...f, occasion: v}))} help="Wedding, Festive, Workwear..." />
              </div>
            </div>
          )}

          {tab === 'IMAGES' && (
            <div className="bg-beige p-6 space-y-6">
              <ImageUploader
                images={form.images}
                onChange={(imgs: string[]) => setForm((f: any) => ({...f, images: imgs}))}
                folder={`products/${product.id}`}
                max={10}
              />
              <p className="font-italic italic text-mitti text-sm">
                Aim for 4 angles minimum at 2000px+ per Phase 2 spec. First image is shown on cards and as the PDP hero.
              </p>

              <AiPhotoStudio
                productId={product.id}
                productName={form.name}
                categoryName={product.category?.name}
                categorySlug={product.category?.slug}
                initialImages={form.images}
                onApplied={(newImages: string[]) => {
                  if (Array.isArray(newImages) && newImages.length > 0) {
                    setForm((f: any) => ({ ...f, images: newImages }));
                  }
                }}
              />

              {Array.isArray(variants) && variants.length > 0 && (
                <VariantImageManager
                  productId={product.id}
                  productName={form.name}
                  categoryName={product.category?.name}
                  variants={variants.map((v: any) => ({
                    id: v.id,
                    sku: v.sku,
                    color: v.color,
                    colorHex: v.colorHex,
                    size: v.size,
                    material: v.material,
                    images: Array.isArray(v.images) ? v.images : [],
                  }))}
                  onVariantImagesChanged={(variantId: string, imgs: string[]) => {
                    setVariants((prev: any[]) =>
                      prev.map(v => (v.id === variantId ? { ...v, images: imgs } : v))
                    );
                  }}
                />
              )}
            </div>
          )}

          {tab === 'PRICING' && (
            <div className="space-y-6">
              <div className="bg-beige p-6">
                <p className="label text-madder mb-4">PRICING</p>
                <div className="grid grid-cols-2 gap-4">
                  <PriceInput label="MRP" valuePaise={form.mrp} onChangePaise={v => setForm((f: any) => ({...f, mrp: v || 0}))} required helpText="Maximum Retail Price (strikethrough)" />
                  <PriceInput label="Selling Price" valuePaise={form.sellingPrice} onChangePaise={v => setForm((f: any) => ({...f, sellingPrice: v || 0}))} required helpText="Regular price customers see" />
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div>
                    <label className="label text-mitti block mb-1">GST Rate (%)</label>
                    <input type="number" step="0.1" value={form.gstRate}
                      onChange={e => setForm((f: any) => ({...f, gstRate: parseFloat(e.target.value) || 0}))}
                      className="w-full p-2 bg-ivory border border-mitti/20 font-ui text-sm" />
                  </div>
                  <div className="col-span-2">
                    <Field label="HSN Code" value={form.hsnCode} onChange={(v: string) => setForm((f: any) => ({...f, hsnCode: v}))} mono />
                  </div>
                </div>
                {form.mrp > 0 && form.sellingPrice > 0 && form.sellingPrice < form.mrp && (
                  <p className="font-ui text-xs text-neem mt-3">
                    Regular discount: {discountPct(form.mrp, form.sellingPrice)}% off MRP
                  </p>
                )}
              </div>

              <div className="bg-beige p-6">
                <p className="label text-madder mb-1">SALE / OFFER WINDOW</p>
                <p className="font-italic italic text-mitti text-sm mb-4">
                  Optional. Set a sale price that overrides the selling price during a specific time window.
                </p>
                <div className="grid grid-cols-3 gap-4">
                  <PriceInput label="Sale Price" valuePaise={form.salePrice} onChangePaise={v => setForm((f: any) => ({...f, salePrice: v}))} optional allowNull helpText="Leave empty for no sale" />
                  <DateTimeInput label="Sale Starts At" value={form.saleStartsAt} onChange={v => setForm((f: any) => ({...f, saleStartsAt: v}))} helpText="Empty = starts now" />
                  <DateTimeInput label="Sale Ends At" value={form.saleEndsAt} onChange={v => setForm((f: any) => ({...f, saleEndsAt: v}))} helpText="Empty = no end date" />
                </div>
                {form.salePrice && form.sellingPrice && (
                  <div className="mt-4 p-3 bg-ivory border border-madder/30 flex items-center justify-between">
                    <div>
                      <p className="font-ui text-xs text-mitti">Sale discount: {discountPct(form.sellingPrice, form.salePrice)}% off selling price</p>
                      <p className="font-ui text-xs text-mitti">Effective price now: <strong className="text-kohl">{formatINR(eff.price)}</strong> ({eff.onSale ? '🟢 SALE ACTIVE' : '⏸️ NOT IN WINDOW'})</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'CATALOGUE' && (
            <div className="bg-beige p-6 space-y-6">
              <div>
                <p className="label text-madder mb-1">CATALOGUE CURATION</p>
                <p className="font-italic italic text-mitti text-sm">
                  Control merchandising, editorial placement, preferred imagery, and stock display behavior for catalogue surfaces.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 font-ui text-sm">
                  <input
                    type="checkbox"
                    checked={!!form.catalogueFeatured}
                    onChange={e => setForm((f: any) => ({ ...f, catalogueFeatured: e.target.checked }))}
                  />
                  Featured
                </label>
                <label className="flex items-center gap-2 font-ui text-sm">
                  <input
                    type="checkbox"
                    checked={!!form.catalogueBestseller}
                    onChange={e => setForm((f: any) => ({ ...f, catalogueBestseller: e.target.checked }))}
                  />
                  Bestseller
                </label>
                <label className="flex items-center gap-2 font-ui text-sm">
                  <input
                    type="checkbox"
                    checked={!!form.catalogueEditorial}
                    onChange={e => setForm((f: any) => ({ ...f, catalogueEditorial: e.target.checked }))}
                  />
                  Editorial Pick
                </label>
                <label className="flex items-center gap-2 font-ui text-sm">
                  <input
                    type="checkbox"
                    checked={!!form.cataloguePinHero}
                    onChange={e => setForm((f: any) => ({ ...f, cataloguePinHero: e.target.checked }))}
                  />
                  Pin to Hero
                </label>
                <label className="flex items-center gap-2 font-ui text-sm">
                  <input
                    type="checkbox"
                    checked={!!form.catalogueExclude}
                    onChange={e => setForm((f: any) => ({ ...f, catalogueExclude: e.target.checked }))}
                  />
                  Exclude from Catalogue
                </label>
                <label className="flex items-center gap-2 font-ui text-sm">
                  <input
                    type="checkbox"
                    checked={!!form.catalogueImageApproved}
                    onChange={e => setForm((f: any) => ({ ...f, catalogueImageApproved: e.target.checked }))}
                  />
                  Image Approved
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Preferred Image URL"
                  value={form.cataloguePreferredImage}
                  onChange={(v: string) => setForm((f: any) => ({ ...f, cataloguePreferredImage: v }))}
                  help="Optional override for catalogue cards and hero slots"
                />
                <Field
                  label="Audience Tag"
                  value={form.catalogueAudienceTag}
                  onChange={(v: string) => setForm((f: any) => ({ ...f, catalogueAudienceTag: v }))}
                  help="Examples: BRIDE, FESTIVE, GIFTING, EVERYDAY"
                />
                <Field
                  label="CTA Mode"
                  value={form.catalogueCtaMode}
                  onChange={(v: string) => setForm((f: any) => ({ ...f, catalogueCtaMode: v }))}
                  help="Optional merchandising CTA mode"
                />
                <div>
                  <label className="label text-mitti block mb-1">IMAGE QUALITY SCORE</label>
                  <input
                    type="number"
                    value={form.catalogueImageQualityScore ?? ''}
                    onChange={e => setForm((f: any) => ({
                      ...f,
                      catalogueImageQualityScore: e.target.value === '' ? null : parseInt(e.target.value, 10) || 0,
                    }))}
                    className="w-full p-2 bg-ivory border border-mitti/20 font-ui text-sm"
                  />
                  <p className="font-ui text-[11px] text-mitti mt-1">Integer score used for image curation and ranking.</p>
                </div>
              </div>

              <div>
                <label className="label text-mitti block mb-1">STOCK VISIBILITY</label>
                <select
                  value={form.catalogueStockVisibility || 'IN_STOCK_ONLY'}
                  onChange={e => setForm((f: any) => ({ ...f, catalogueStockVisibility: e.target.value }))}
                  className="w-full p-2 bg-ivory border border-mitti/20 font-ui text-sm"
                >
                  {STOCK_VISIBILITY_OPTIONS.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <p className="font-ui text-[11px] text-mitti mt-1">Matches the admin API enum exactly.</p>
              </div>

              <Field
                label="Story Block"
                value={form.catalogueStoryBlock}
                onChange={(v: string) => setForm((f: any) => ({ ...f, catalogueStoryBlock: v }))}
                multiline
                rows={4}
                help="Short curated text block for catalogue storytelling surfaces"
              />
            </div>
          )}

          {tab === 'INVENTORY' && (
            <div className="bg-beige p-6">
              <div className="flex justify-between items-center mb-4">
                <p className="label text-madder">VARIANTS · INVENTORY</p>
                <div className="flex gap-2">
                  {variants.length > 0 && (
                    <button onClick={saveAllVariants} className="bg-madder text-ivory text-xs uppercase tracking-widest px-3 py-1 hover:bg-kohl flex items-center gap-1">
                      <Save className="w-3 h-3" /> SAVE ALL
                    </button>
                  )}
                  <button onClick={addVariant} className="btn-outline text-xs flex items-center gap-1">
                    <Plus className="w-3 h-3" /> ADD VARIANT
                  </button>
                </div>
              </div>
              {variants.length === 0 && (
                <p className="font-italic italic text-mitti text-sm py-6 text-center">
                  No variants yet. Add at least one to make this product purchasable.
                </p>
              )}
              {variants.length > 0 && (
                <table className="w-full font-ui text-sm">
                  <thead>
                    <tr className="border-b border-mitti/20 text-left text-xs tracking-widest text-mitti">
                      <th className="py-2">SKU</th>
                      <th>SIZE</th>
                      <th>COLOR</th>
                      <th>INVENTORY</th>
                      <th>LOW STOCK AT</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map(v => <VariantRow key={v.id} variant={v}
                      onSave={(patch: any) => updateVariant(v.id, patch)}
                      onDelete={() => deleteVariant(v.id)}
                      onDuplicate={() => duplicateVariant(v)} />)}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === 'STORY' && (
            <div className="bg-beige p-6">
              <p className="label text-madder mb-4">STORY & CRAFT</p>
              <div>
                <Field label="Story" value={form.story} onChange={(v: string) => setForm((f: any) => ({...f, story: v}))} multiline rows={5} help="The narrative shown in the PDP 'Craft Story' tab" />
                <div className="mt-1">
                  <AiCopyButton field="story" brief={{ name: form.name, craft: form.craft, region: form.region, artisanName: form.artisanName, material: form.material, technique: form.technique, occasion: form.occasion }} onApply={(d: any) => setForm((f: any) => ({ ...f, story: d.text }))} />
                </div>
              </div>
              <div>
                <Field label="Craft Note" value={form.craftNote} onChange={(v: string) => setForm((f: any) => ({...f, craftNote: v}))} multiline rows={3} help="Technique-specific notes" />
                <div className="mt-1">
                  <AiCopyButton field="craftNote" brief={{ name: form.name, craft: form.craft, region: form.region, artisanName: form.artisanName, material: form.material, technique: form.technique, occasion: form.occasion }} onApply={(d: any) => setForm((f: any) => ({ ...f, craftNote: d.text }))} />
                </div>
              </div>
              <div>
                <Field label="Care Instructions" value={form.careInstructions} onChange={(v: string) => setForm((f: any) => ({...f, careInstructions: v}))} multiline rows={3} />
                <div className="mt-1">
                  <AiCopyButton field="careInstructions" brief={{ name: form.name, craft: form.craft, region: form.region, artisanName: form.artisanName, material: form.material, technique: form.technique, occasion: form.occasion }} onApply={(d: any) => setForm((f: any) => ({ ...f, careInstructions: d.text }))} />
                </div>
              </div>
              <Field label="Sustainability Note" value={form.sustainabilityNote} onChange={(v: string) => setForm((f: any) => ({...f, sustainabilityNote: v}))} multiline rows={2} />
            </div>
          )}

          {tab === 'SEO' && (
            <div className="bg-beige p-6">
              <p className="label text-madder mb-4">SEO</p>
              <Field label="SEO Title" value={form.seoTitle} onChange={(v: string) => setForm((f: any) => ({...f, seoTitle: v}))} help="Shown in browser tab and Google results. Falls back to product name if empty." />
              <Field label="SEO Description" value={form.seoDesc} onChange={(v: string) => setForm((f: any) => ({...f, seoDesc: v}))} multiline rows={3} help="155-160 characters ideal" />
              <div className="mt-1">
                <AiCopyButton
                  field="seo"
                  brief={{ name: form.name, craft: form.craft, region: form.region, artisanName: form.artisanName, material: form.material, technique: form.technique, occasion: form.occasion }}
                  onApply={(d: any) => setForm((f: any) => ({ ...f, seoTitle: d.seoTitle, seoDesc: d.seoDesc }))}
                  label="DRAFT SEO WITH AI"
                />
              </div>
              <p className="font-ui text-[11px] text-mitti mt-2">
                URL: /products/{form.slug}<br/>
                Title preview: <strong className="text-kohl">{form.seoTitle || form.name} · NEEJEE</strong>
              </p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-beige p-6">
            <p className="label text-madder mb-4">STATUS</p>
            <select value={form.status} onChange={e => setForm((f: any) => ({...f, status: e.target.value}))}
              className="w-full p-2 bg-ivory border border-mitti/20 font-ui text-sm">
              {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
            <p className="font-ui text-[11px] text-mitti mt-2">Only ACTIVE products are visible to customers.</p>
          </div>

          <div className="bg-beige p-6">
            <p className="label text-madder mb-3">PRICE PREVIEW</p>
            {form.salePrice && eff.onSale ? (
              <>
                <p className="font-display text-2xl text-madder">{formatINR(eff.price)}</p>
                <p className="font-ui text-sm text-mitti line-through">{formatINR(form.sellingPrice)}</p>
                {form.mrp > eff.price && <p className="font-ui text-xs text-mitti">MRP {formatINR(form.mrp)}</p>}
                <p className="font-ui text-xs text-neem mt-2">{dp}% off MRP</p>
              </>
            ) : (
              <>
                <p className="font-display text-2xl text-kohl">{formatINR(form.sellingPrice)}</p>
                {form.mrp > form.sellingPrice && (
                  <>
                    <p className="font-ui text-sm text-mitti line-through">{formatINR(form.mrp)}</p>
                    <p className="font-ui text-xs text-neem mt-1">{dp}% off MRP</p>
                  </>
                )}
              </>
            )}
          </div>

          <div className="bg-beige p-6">
            <p className="label text-madder mb-3">INVENTORY (TOTAL)</p>
            <p className="font-display text-3xl">{variants.reduce((s: number, v: any) => s + (v.inventory || 0), 0)}</p>
            <p className="font-ui text-xs text-mitti mt-1">across {variants.length} variant{variants.length !== 1 ? 's' : ''}</p>
          </div>

          <div className="bg-beige p-6">
            <p className="label text-madder mb-3">AI ELIGIBILITY</p>
            <label className="flex items-center gap-2 font-ui text-sm mb-2">
              <input type="checkbox" checked={form.aiTryOnEligible} onChange={e => setForm((f: any) => ({...f, aiTryOnEligible: e.target.checked}))} />
              Mirror Try-On
            </label>
            <label className="flex items-center gap-2 font-ui text-sm mb-2">
              <input type="checkbox" checked={form.aiRoomEligible} onChange={e => setForm((f: any) => ({...f, aiRoomEligible: e.target.checked}))} />
              Space Room Preview
            </label>
            <label className="flex items-center gap-2 font-ui text-sm">
              <input type="checkbox" checked={form.arTryOnEligible} onChange={e => setForm((f: any) => ({...f, arTryOnEligible: e.target.checked}))} />
              AR Try-On (jewellery)
            </label>
            <p className="text-[10px] italic text-mitti/70 mt-2">
              Enable AR Try-On for earrings, necklaces, bangles, rings. Customers can place
              this piece on a portrait via AI.
            </p>
          </div>

          <div className="bg-beige p-6">
            <p className="label text-madder mb-3">SEALS &amp; BADGES</p>
            <p className="font-italic italic text-xs text-mitti mb-3">
              Tag this piece with the seals it earns. Shown on PDP and product cards.
            </p>
            <BadgePicker
              selected={form.badges || []}
              onChange={(newBadges) => setForm((f: any) => ({...f, badges: newBadges}))}
            />
          </div>

          <div className="bg-beige p-6">
            <p className="label text-madder mb-3">FULFILMENT MODE</p>
            <div className="flex gap-2 mb-3">
              {[
                { v: 'IN_STOCK', label: 'In stock', desc: 'Normal stock, ships in 3-5 days' },
                { v: 'PREORDER', label: 'Pre-order', desc: 'Deposit now, balance when ready' },
                { v: 'LIMITED_DROP', label: 'Limited Drop', desc: 'Numbered edition' },
              ].map(opt => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setForm((f: any) => ({ ...f, fulfilmentMode: opt.v }))}
                  className={`flex-1 text-left p-2 border text-[11px] uppercase tracking-widest transition-colors ${
                    form.fulfilmentMode === opt.v
                      ? 'bg-madder text-ivory border-madder'
                      : 'bg-ivory text-kohl border-mitti/30 hover:border-madder'
                  }`}
                  title={opt.desc}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {form.fulfilmentMode === 'PREORDER' && (
              <div className="mt-3 space-y-2">
                <label className="label text-mitti block">DEPOSIT %</label>
                <input
                  type="number"
                  value={form.depositPercent || 20}
                  onChange={e => setForm((f: any) => ({ ...f, depositPercent: parseInt(e.target.value) || 20 }))}
                  min={1}
                  max={100}
                  className="w-full p-2 bg-ivory border border-mitti/20 text-sm"
                />
                <p className="text-[10px] italic text-mitti/70">% of the full price charged at checkout. Balance billed when piece is ready.</p>
                <label className="label text-mitti block mt-2">ESTIMATED SHIP DATE</label>
                <input
                  type="date"
                  value={form.releaseDate || ''}
                  onChange={e => setForm((f: any) => ({ ...f, releaseDate: e.target.value }))}
                  className="w-full p-2 bg-ivory border border-mitti/20 text-sm"
                />
                <p className="text-[10px] italic text-mitti/70">Shown to customer on the PDP as “Ships from …”.</p>
              </div>
            )}

            {form.fulfilmentMode === 'LIMITED_DROP' && (
              <div className="mt-3 space-y-2">
                <label className="label text-mitti block">EDITION SIZE</label>
                <input
                  type="number"
                  value={form.editionSize ?? ''}
                  onChange={e => setForm((f: any) => ({ ...f, editionSize: e.target.value ? parseInt(e.target.value) : null }))}
                  min={1}
                  placeholder="24"
                  className="w-full p-2 bg-ivory border border-mitti/20 text-sm"
                />
                <p className="text-[10px] italic text-mitti/70">Shown as “Edition of 24”. Auto sold-out when sold count hits this number.</p>
                <div className="text-[11px] text-mitti">
                  Sold so far: <strong>{form.editionSold ?? 0}</strong>
                  {form.editionSize && ` of ${form.editionSize}`}
                </div>
              </div>
            )}
          </div>

          <div className="bg-beige p-6">
            <p className="label text-madder mb-3">SHIPPING & RETURNS</p>
            <label className="flex items-center gap-2 font-ui text-sm mb-2">
              <input type="checkbox" checked={form.codEligible !== false} onChange={e => setForm((f: any) => ({...f, codEligible: e.target.checked}))} />
              Cash on Delivery available
            </label>
            <label className="flex items-center gap-2 font-ui text-sm mb-3">
              <input type="checkbox" checked={form.returnEligible === true} onChange={e => setForm((f: any) => ({
                ...f,
                returnEligible: e.target.checked,
                ...(e.target.checked ? {} : { returnPolicy: '' }),
              }))} />
              Returnable / refundable
            </label>

            {form.returnEligible === true ? (
              <>
                <label className="label text-mitti block">RETURN POLICY (OVERRIDE)</label>
                <textarea
                  value={form.returnPolicy || ''}
                  onChange={e => setForm((f: any) => ({...f, returnPolicy: e.target.value}))}
                  rows={3}
                  placeholder="Leave blank to use the global return policy. Override only when this piece needs different terms."
                  className="w-full p-2 bg-ivory border border-mitti/20 text-xs mt-1"
                />
                <div className="mt-1">
                  <AiCopyButton
                    field="returnPolicy"
                    brief={{ name: form.name, craft: form.craft, region: form.region, material: form.material, returnEligible: true }}
                    onApply={(d: any) => setForm((f: any) => ({ ...f, returnPolicy: d.text }))}
                    label="DRAFT POLICY WITH AI"
                  />
                </div>
              </>
            ) : (
              <div className="border border-madder/30 bg-madder/5 p-3 text-xs text-madder font-ui">
                <strong>NON-RETURNABLE.</strong> Customers will see a clear no-return notice on the PDP and at checkout. No AI policy override available for non-returnable pieces.
              </div>
            )}
          </div>
        </div>
      </div>

      {variantQuickAddOpen && (
        <VariantQuickAddModal
          categoryName={categories.find(c => c.id === form.categoryId)?.name || ''}
          categorySlug={categories.find(c => c.id === form.categoryId)?.slug || ''}
          existingSizes={variants.map(v => (v.size || '').toString().toUpperCase())}
          onClose={() => setVariantQuickAddOpen(false)}
          onCreate={createVariantsBulk}
        />
      )}
    </>
  );
}

function VariantQuickAddModal({
  categoryName,
  categorySlug,
  existingSizes,
  onClose,
  onCreate,
}: {
  categoryName: string;
  categorySlug: string;
  existingSizes: string[];
  onClose: () => void;
  onCreate: (sizes: string[], colours: Array<{ name: string; hex: string }>) => Promise<void>;
}) {
  const sizeSuggestions = suggestSizesForCategory(categorySlug || categoryName);
  const colourSuggestions = suggestColorsForCategory(categorySlug || categoryName);

  const [sizes, setSizes] = useState<string[]>([]);
  const [colours, setColours] = useState<Array<{ name: string; hex: string }>>([]);
  const [customSize, setCustomSize] = useState('');
  const [customColour, setCustomColour] = useState('');
  const [customHex, setCustomHex] = useState('#cccccc');
  const [submitting, setSubmitting] = useState(false);

  const toggleSize = (s: string) => setSizes(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);
  const toggleColour = (c: { name: string; hex: string }) =>
    setColours(p => p.some(x => x.name === c.name) ? p.filter(x => x.name !== c.name) : [...p, c]);

  const applySizePreset = (next: string[]) => setSizes(p => Array.from(new Set([...p, ...next])));
  const applyColourPreset = (next: Array<{ name: string; hex: string }>) =>
    setColours(p => {
      const seen = new Set(p.map(x => x.name));
      return [...p, ...next.filter(x => !seen.has(x.name))];
    });

  const addCustomSize = () => {
    const s = customSize.trim();
    if (!s) return;
    if (!sizes.includes(s)) setSizes([...sizes, s]);
    setCustomSize('');
  };
  const addCustomColour = () => {
    const n = customColour.trim();
    if (!n) return;
    if (!colours.some(c => c.name === n)) setColours([...colours, { name: n, hex: customHex }]);
    setCustomColour('');
  };

  const total = (sizes.length || 1) * (colours.length || 1);
  const canSubmit = sizes.length + colours.length > 0;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    await onCreate(sizes, colours);
  };

  return (
    <div className="fixed inset-0 bg-kohl/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-ivory border border-mitti/30 max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-2xl text-kohl">Add variants</h2>
            <p className="text-xs text-mitti mt-1">
              Pick any combination of sizes and colours. We’ll create one variant for every combination ({sizes.length} × {colours.length} = <strong>{total}</strong>).
            </p>
          </div>
          <button onClick={onClose} className="text-mitti hover:text-kohl text-xl">×</button>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <div>
            <p className="label text-madder mb-2">SIZES (optional)</p>
            <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
              {sizeSuggestions.map((sug, i) => (
                <button key={i} type="button" onClick={() => applySizePreset(sug.sizes)}
                  className="w-full text-left p-2 border border-mitti/20 bg-beige/30 hover:border-madder text-xs">
                  <span className="font-display text-kohl">{sug.label}</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {sug.sizes.map(s => <span key={s} className="px-1.5 py-0.5 bg-ivory border border-mitti/20 text-[10px]">{s}</span>)}
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-1 mb-2">
              <input value={customSize} onChange={e => setCustomSize(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomSize(); } }}
                placeholder="Custom size" className="flex-1 p-1.5 bg-ivory border border-mitti/20 text-sm" />
              <button type="button" onClick={addCustomSize} disabled={!customSize.trim()}
                className="px-2 border border-mitti/30 text-mitti text-xs disabled:opacity-40">+</button>
            </div>
            <div className="flex flex-wrap gap-1">
              {sizes.map(s => (
                <button key={s} onClick={() => toggleSize(s)}
                  className="px-2 py-0.5 bg-ivory border border-madder text-madder text-[11px]">{s} ×</button>
              ))}
              {sizes.length === 0 && <p className="text-[11px] italic text-mitti">none — colour-only product</p>}
            </div>
          </div>

          <div>
            <p className="label text-madder mb-2">COLOURS (optional)</p>
            <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
              {colourSuggestions.map((sug, i) => (
                <button key={i} type="button" onClick={() => applyColourPreset(sug.colors)}
                  className="w-full text-left p-2 border border-mitti/20 bg-beige/30 hover:border-madder text-xs">
                  <span className="font-display text-kohl">{sug.label}</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {sug.colors.map(c => (
                      <span key={c.name} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-ivory border border-mitti/20 text-[10px]">
                        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: c.hex }} />
                        {c.name}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-1 mb-2">
              <input type="color" value={customHex} onChange={e => setCustomHex(e.target.value)}
                className="w-9 h-9 border border-mitti/20 bg-ivory cursor-pointer" />
              <input value={customColour} onChange={e => setCustomColour(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomColour(); } }}
                placeholder="Custom colour name" className="flex-1 p-1.5 bg-ivory border border-mitti/20 text-sm" />
              <button type="button" onClick={addCustomColour} disabled={!customColour.trim()}
                className="px-2 border border-mitti/30 text-mitti text-xs disabled:opacity-40">+</button>
            </div>
            <div className="flex flex-wrap gap-1">
              {colours.map(c => (
                <button key={c.name} onClick={() => toggleColour(c)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-ivory border border-madder text-madder text-[11px]">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: c.hex }} />
                  {c.name} ×
                </button>
              ))}
              {colours.length === 0 && <p className="text-[11px] italic text-mitti">none — size-only product</p>}
            </div>
          </div>
        </div>

        {total > 0 && (
          <div className="mt-5 p-3 bg-madder/5 border border-madder/30">
            <p className="text-[10px] uppercase tracking-widest text-madder mb-2">
              {total} variant{total === 1 ? '' : 's'} will be created
            </p>
            <p className="text-[11px] text-mitti">
              SKUs auto-generated as <code className="font-mono">PRODUCT-SIZE-COLOUR</code>. Duplicates get a numeric suffix.
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-4 mt-4 border-t border-mitti/15">
          <button onClick={submit} disabled={!canSubmit || submitting}
            className="flex-1 px-4 py-2 bg-kohl text-ivory text-xs uppercase tracking-widest hover:bg-madder disabled:opacity-40">
            {submitting ? 'Creating…' : `Create ${total} variant${total === 1 ? '' : 's'}`}
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-mitti/30 text-mitti text-xs uppercase tracking-widest hover:bg-mitti/10">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, multiline, help, rows = 3, required, mono }: any) {
  return (
    <div className="mb-3">
      <label className="label text-mitti block mb-1">
        {label} {required && <span className="text-madder">*</span>}
      </label>
      {multiline ? (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)}
          rows={rows} className={`w-full p-2 bg-ivory border border-mitti/20 font-ui text-sm focus:outline-none focus:border-madder ${mono ? 'font-mono' : ''}`} />
      ) : (
        <input type="text" value={value ?? ''} onChange={e => onChange(e.target.value)}
          required={required}
          className={`w-full p-2 bg-ivory border border-mitti/20 font-ui text-sm focus:outline-none focus:border-madder ${mono ? 'font-mono' : ''}`} />
      )}
      {help && <p className="font-ui text-[11px] text-mitti mt-1">{help}</p>}
    </div>
  );
}

function VariantRow({ variant, onSave, onDelete, onDuplicate }: { variant: any; onSave: (p: any) => void; onDelete: () => void; onDuplicate?: () => void }) {
  const [v, setV] = useState<any>({
    sku: variant.sku || '',
    size: variant.size || '',
    color: variant.color || '',
    colorHex: variant.colorHex || '',
    inventory: variant.inventory ?? 0,
    lowStockThreshold: variant.lowStockThreshold ?? 3,
  });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const change = (patch: any) => { setV({ ...v, ...patch }); setDirty(true); };
  const save = async () => {
    setSaving(true);
    await onSave(v);
    setDirty(false); setSaving(false);
  };
  useEffect(() => {
    const handler = () => { if (dirty && !saving) save(); };
    window.addEventListener('variant-save-all', handler);
    return () => window.removeEventListener('variant-save-all', handler);
  }, [dirty, saving, v]);
  const lowStock = v.inventory <= v.lowStockThreshold;
  return (
    <tr className="border-b border-mitti/10">
      <td className="py-2 pr-2"><input value={v.sku} onChange={e => change({ sku: e.target.value })} className="w-full p-1 bg-ivory border border-mitti/20 font-mono text-xs" /></td>
      <td className="pr-2"><input value={v.size} onChange={e => change({ size: e.target.value })} placeholder="—" className="w-20 p-1 bg-ivory border border-mitti/20" /></td>
      <td className="pr-2">
        <div className="flex items-center gap-1">
          <input value={v.color || ''} onChange={e => change({ color: e.target.value })} placeholder="—" className="w-20 p-1 bg-ivory border border-mitti/20" />
          <label className="relative inline-block w-6 h-6 border border-mitti/20 cursor-pointer" style={{ backgroundColor: v.colorHex || 'transparent' }} title={v.colorHex || 'Set hex'}>
            <input type="color" value={v.colorHex || '#ffffff'} onChange={e => change({ colorHex: e.target.value })}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
          </label>
        </div>
      </td>
      <td className="pr-2">
        <input type="number" value={v.inventory} onChange={e => change({ inventory: parseInt(e.target.value) || 0 })}
          className={`w-20 p-1 bg-ivory border ${lowStock ? 'border-madder text-madder' : 'border-mitti/20'}`} />
      </td>
      <td className="pr-2"><input type="number" value={v.lowStockThreshold} onChange={e => change({ lowStockThreshold: parseInt(e.target.value) || 0 })} className="w-16 p-1 bg-ivory border border-mitti/20" /></td>
      <td className="text-right whitespace-nowrap">
        <button onClick={save} disabled={saving || !dirty}
          className={`text-xs font-ui mr-2 px-2 py-1 border tracking-widest ${dirty ? 'bg-madder text-ivory border-madder hover:bg-kohl' : 'bg-beige text-mitti border-mitti/20 cursor-not-allowed'}`}>
          {saving ? '…' : (dirty ? 'SAVE' : 'SAVED')}
        </button>
        {onDuplicate && (
          <button onClick={onDuplicate} className="text-mitti hover:text-madder mr-2" title="Duplicate as new colour">
            <Plus className="w-4 h-4 inline" />
          </button>
        )}
        <button onClick={onDelete} className="text-monsoon hover:text-madder" title="Delete variant"><Trash2 className="w-4 h-4 inline" /></button>
      </td>
    </tr>
  );
}

interface PickerBadge { key: string; label: string; description: string; group: string; imageUrl?: string | null; active?: boolean }

function BadgePicker({ selected, onChange }: { selected: string[]; onChange: (next: string[]) => void }) {
  const [catalog, setCatalog] = useState<PickerBadge[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/badges', { credentials: 'include', cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.badges) setCatalog(d.badges);
        else setCatalog(BADGE_CATALOG as any);
      })
      .catch(() => setCatalog(BADGE_CATALOG as any))
      .finally(() => setLoaded(true));
  }, []);

  const toggle = (key: string) => {
    if (selected.includes(key)) {
      onChange(selected.filter(k => k !== key));
    } else {
      onChange([...selected, key]);
    }
  };

  const groups = Array.from(new Set(catalog.map(b => b.group)));
  const groupOrder = ['editorial', 'craft', 'trust'];
  groups.sort((a, b) => {
    const ai = groupOrder.indexOf(a); const bi = groupOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  if (!loaded) return <p className="text-xs text-mitti italic">Loading badges…</p>;

  return (
    <div className="space-y-3">
      {groups.map(group => {
        const groupBadges = catalog.filter(b => b.group === group);
        const groupLabel = group.charAt(0).toUpperCase() + group.slice(1);
        return (
          <div key={group}>
            <p className="text-[10px] uppercase tracking-widest text-mitti/70 mb-1.5">{groupLabel}</p>
            <div className="flex flex-wrap gap-2">
              {groupBadges.map(b => {
                const isSelected = selected.includes(b.key);
                return (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => toggle(b.key)}
                    title={b.description}
                    className={`px-3 py-1.5 text-[11px] tracking-widest uppercase font-ui border transition-colors inline-flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-madder text-ivory border-madder'
                        : 'bg-ivory text-kohl border-mitti/30 hover:border-madder'
                    }`}
                  >
                    {b.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.imageUrl} alt="" className="w-4 h-4 object-contain" />
                    )}
                    {b.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {selected.length > 0 && (
        <p className="text-xs italic text-mitti pt-1">
          {selected.length} seal{selected.length === 1 ? '' : 's'} selected.
        </p>
      )}
      <p className="text-[11px] text-mitti/70 pt-1">
        Manage the badge catalog at{' '}
        <a href="/admin/badges" className="underline text-madder">/admin/badges</a>{' '}
        — add, delete, or generate AI seal artwork.
      </p>
    </div>
  );
}
