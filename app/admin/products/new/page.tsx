'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PriceInput } from '@/components/admin/PriceInput';
import { ImageUploader } from '@/components/admin/ImageUploader';
import { formatINR, discountPct } from '@/lib/money';
import { RefreshCw, Lock, Pencil } from 'lucide-react';
import AiDraftAllButton from '@/components/admin/AiDraftAllButton';
import AiNameSuggester from '@/components/admin/AiNameSuggester';
import CategoryPicker, { CategoryPickerValue } from '@/components/admin/CategoryPicker';

const STATUSES = ['DRAFT', 'PENDING_QC', 'ACTIVE', 'ARCHIVED'] as const;
const STOCK_VISIBILITY_OPTIONS = [
  'IN_STOCK_ONLY',
  'LOW_STOCK_BADGE',
  'SHOW_EXACT',
  'HIDE_STOCK',
] as const;

export default function AdminNewProduct() {
  const router = useRouter();
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryPick, setCategoryPick] = useState<CategoryPickerValue>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [skuEditable, setSkuEditable] = useState(false);
  const [skuLoading, setSkuLoading] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const [form, setForm] = useState<any>({
    name: '',
    shortName: '',
    sku: '',
    slug: '',

    mrp: 0,
    sellingPrice: 0,
    salePrice: null,
    gstRate: 5,
    hsnCode: '',

    categoryId: '',
    craft: '',
    region: '',
    state: '',
    cluster: '',
    artisanName: '',
    material: '',
    technique: '',
    occasion: '',

    description: '',
    poeticLine: '',
    story: '',
    craftNote: '',
    careInstructions: '',
    sustainabilityNote: '',

    seoTitle: '',
    seoDesc: '',

    status: 'DRAFT',
    images: [] as string[],

    aiTryOnEligible: false,
    aiStylistEligible: false,
    arTryOnEligible: false,

    fulfilmentMode: 'IN_STOCK',
    depositPercent: 20,
    releaseDate: '',
    editionTotal: null,
    editionSold: 0,

    codEligible: true,
    returnEligible: false,
    returnPolicy: '',

    catalogueFeatured: false,
    catalogueBestseller: false,
    catalogueEditorial: false,
    cataloguePinHero: false,
    catalogueExclude: false,
    cataloguePreferredImage: '',
    catalogueAudienceTag: '',
    catalogueCtaMode: '',
    catalogueStoryBlock: '',
    catalogueImageApproved: false,
    catalogueImageQualityScore: null,
    catalogueStockVisibility: 'IN_STOCK_ONLY',
  });

  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then(d => setCategories(d.categories || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!slugManuallyEdited && form.name) {
      const auto = form.name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setForm((f: any) => ({ ...f, slug: auto }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.name]);

  useEffect(() => {
    if (skuEditable) return;
    if (!form.categoryId && !form.craft) {
      setForm((f: any) => ({ ...f, sku: '' }));
      return;
    }

    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSkuLoading(true);
      try {
        const qs = new URLSearchParams();
        if (form.craft) qs.set('craft', form.craft);
        if (form.categoryId) qs.set('categoryId', form.categoryId);

        const res = await fetch(`/api/admin/products/next-sku?${qs.toString()}`, {
          signal: ctrl.signal,
          credentials: 'include',
        });
        const data = await res.json();
        if (data?.sku) {
          setForm((f: any) => ({ ...f, sku: data.sku }));
        }
      } catch {
      } finally {
        setSkuLoading(false);
      }
    }, 250);

    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.craft, form.categoryId, skuEditable]);

  const categoryName = categories.find((c: any) => c.id === form.categoryId)?.name || '';

  const effectiveDisplayPrice =
    typeof form.salePrice === 'number' && form.salePrice > 0 && form.salePrice < form.sellingPrice
      ? form.salePrice
      : form.sellingPrice;

  const currentDiscount =
    form.mrp > 0 && effectiveDisplayPrice > 0 && effectiveDisplayPrice < form.mrp
      ? discountPct(form.mrp, effectiveDisplayPrice)
      : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      router.push(`/admin/products/${data.product.id}`);
    } catch (e: any) {
      setError(e.message || 'Failed');
      setSaving(false);
    }
  };

  const categoryPathPreview = useMemo(() => {
    if (!categoryPick) return '';
    return categoryPick.path || categoryPick.slug || categoryPick.label || '';
  }, [categoryPick]);

  return (
    <>
      <Link href="/admin/products" className="label text-mitti hover:text-madder">
        ← BACK TO PRODUCTS
      </Link>

      <div className="flex justify-between items-start mt-2 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-4xl text-kohl">Add New Product</h1>
          <p className="font-italic italic text-mitti mt-2 max-w-3xl">
            Create the product once, then enrich merchandising from the same screen:
            naming, pricing, catalogue curation, AI flags, fulfilment, and return behavior.
          </p>
        </div>

        <AiDraftAllButton
          form={{ ...form, categoryName }}
          onApply={(draft) => {
            setForm((f: any) => ({ ...f, ...draft }));
          }}
        />
      </div>

      <div className="madder-divider mt-4"></div>

      {error && (
        <p className="mt-6 font-ui text-sm text-madder bg-madder/10 p-3">
          {error}
        </p>
      )}

      <form onSubmit={submit} className="mt-8 grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-beige p-6">
            <p className="label text-madder mb-4">BASIC INFO</p>

            <AiNameSuggester
              variant="prominent"
              brief={{
                name: form.name,
                description: form.description,
                craft: form.craft,
                region: form.region,
                cluster: form.cluster,
                material: form.material,
                technique: form.technique,
                occasion: form.occasion,
                categoryName,
              }}
              onApply={(name) => setForm((f: any) => ({ ...f, name }))}
            />

            <Field
              label="Product Name"
              value={form.name}
              onChange={(v: string) => setForm((f: any) => ({ ...f, name: v }))}
              required
            />

            <Field
              label="Short Name"
              value={form.shortName}
              onChange={(v: string) => setForm((f: any) => ({ ...f, shortName: v }))}
              help="Used in compact cards and merchandising surfaces"
            />

            <div className="mb-3">
              <label className="label text-mitti block mb-1">
                SKU
                <span className="text-[10px] text-mitti/70 ml-2 normal-case">
                  {skuEditable ? '(manual)' : '(auto-generated)'}
                </span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={form.sku}
                  onChange={e => setForm((f: any) => ({ ...f, sku: e.target.value.toUpperCase() }))}
                  placeholder={
                    skuLoading
                      ? 'Generating…'
                      : (form.categoryId || form.craft ? 'NEE-XXX-0001' : 'Pick category or craft first')
                  }
                  readOnly={!skuEditable}
                  className={`flex-1 p-2 border border-mitti/20 font-ui font-mono text-sm ${
                    skuEditable ? 'bg-ivory' : 'bg-beige text-mitti'
                  }`}
                />

                {!skuEditable ? (
                  <>
                    <button
                      type="button"
                      title="Regenerate"
                      onClick={async () => {
                        if (!form.categoryId && !form.craft) return;
                        setSkuLoading(true);
                        try {
                          const qs = new URLSearchParams();
                          if (form.craft) qs.set('craft', form.craft);
                          if (form.categoryId) qs.set('categoryId', form.categoryId);
                          const res = await fetch(`/api/admin/products/next-sku?${qs.toString()}`, {
                            credentials: 'include',
                          });
                          const data = await res.json();
                          if (data?.sku) setForm((f: any) => ({ ...f, sku: data.sku }));
                        } finally {
                          setSkuLoading(false);
                        }
                      }}
                      className="p-2 text-mitti hover:text-madder border border-mitti/20 bg-ivory"
                    >
                      <RefreshCw className={`w-3 h-3 ${skuLoading ? 'animate-spin' : ''}`} />
                    </button>

                    <button
                      type="button"
                      title="Unlock for manual edit"
                      onClick={() => setSkuEditable(true)}
                      className="p-2 text-mitti hover:text-madder border border-mitti/20 bg-ivory"
                    >
                      <Lock className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    title="Switch back to auto-generated"
                    onClick={() => {
                      setSkuEditable(false);
                      setForm((f: any) => ({ ...f, sku: '' }));
                    }}
                    className="p-2 text-mitti hover:text-madder border border-mitti/20 bg-ivory"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </div>

              <p className="font-ui text-[11px] text-mitti mt-1">
                Auto-generated from category / craft unless manually unlocked.
              </p>
            </div>

            <Field
              label="URL Slug"
              value={form.slug}
              onChange={(v: string) => {
                setSlugManuallyEdited(true);
                setForm((f: any) => ({ ...f, slug: v }));
              }}
              mono
              help="Auto-generated from name until you manually edit it"
            />

            <Field
              label="Poetic Line"
              value={form.poeticLine}
              onChange={(v: string) => setForm((f: any) => ({ ...f, poeticLine: v }))}
              help="One-line tagline under the title"
            />

            <div className="grid grid-cols-2 gap-3 mt-3">
              <Field label="Craft" value={form.craft} onChange={(v: string) => setForm((f: any) => ({ ...f, craft: v }))} />
              <Field label="Region" value={form.region} onChange={(v: string) => setForm((f: any) => ({ ...f, region: v }))} />
              <Field label="State" value={form.state} onChange={(v: string) => setForm((f: any) => ({ ...f, state: v }))} />
              <Field label="Cluster" value={form.cluster} onChange={(v: string) => setForm((f: any) => ({ ...f, cluster: v }))} />
              <Field label="Artisan Name" value={form.artisanName} onChange={(v: string) => setForm((f: any) => ({ ...f, artisanName: v }))} />
              <Field label="Material" value={form.material} onChange={(v: string) => setForm((f: any) => ({ ...f, material: v }))} />
              <Field label="Technique" value={form.technique} onChange={(v: string) => setForm((f: any) => ({ ...f, technique: v }))} />
              <Field label="Occasion" value={form.occasion} onChange={(v: string) => setForm((f: any) => ({ ...f, occasion: v }))} />
            </div>

            <Field
              label="Description"
              value={form.description}
              onChange={(v: string) => setForm((f: any) => ({ ...f, description: v }))}
              multiline
              rows={4}
            />
          </div>

          <div className="bg-beige p-6">
            <p className="label text-madder mb-4">STORY & SEO</p>

            <Field
              label="Story"
              value={form.story}
              onChange={(v: string) => setForm((f: any) => ({ ...f, story: v }))}
              multiline
              rows={4}
            />

            <Field
              label="Craft Note"
              value={form.craftNote}
              onChange={(v: string) => setForm((f: any) => ({ ...f, craftNote: v }))}
              multiline
              rows={3}
            />

            <Field
              label="Care Instructions"
              value={form.careInstructions}
              onChange={(v: string) => setForm((f: any) => ({ ...f, careInstructions: v }))}
              multiline
              rows={3}
            />

            <Field
              label="Sustainability Note"
              value={form.sustainabilityNote}
              onChange={(v: string) => setForm((f: any) => ({ ...f, sustainabilityNote: v }))}
              multiline
              rows={2}
            />

            <Field
              label="SEO Title"
              value={form.seoTitle}
              onChange={(v: string) => setForm((f: any) => ({ ...f, seoTitle: v }))}
            />

            <Field
              label="SEO Description"
              value={form.seoDesc}
              onChange={(v: string) => setForm((f: any) => ({ ...f, seoDesc: v }))}
              multiline
              rows={3}
            />
          </div>

          <div className="bg-beige p-6">
            <p className="label text-madder mb-4">IMAGES</p>
            <ImageUploader
              images={form.images}
              onChange={(imgs: string[]) =>
                setForm((f: any) => ({
                  ...f,
                  images: imgs,
                  cataloguePreferredImage: f.cataloguePreferredImage || imgs[0] || '',
                }))
              }
              folder="products/new"
              max={10}
            />
            <p className="font-ui text-[11px] text-mitti mt-2">
              First uploaded image is used as the default catalogue preferred image unless you override it below.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-beige p-6">
            <p className="label text-madder mb-4">CATEGORY *</p>
            <CategoryPicker
              value={categoryPick}
              onChange={(v) => {
                setCategoryPick(v);
                setForm((f: any) => ({ ...f, categoryId: v?.id || '' }));
              }}
              required
              productContext={{
                name: form.name,
                description: form.description,
                craft: form.craft,
                region: form.region,
                material: form.material,
              }}
            />
            {categoryPathPreview && (
              <p className="text-[11px] text-mitti mt-2 font-ui">
                Path: <span className="font-mono">{categoryPathPreview}</span>
              </p>
            )}
            <p className="text-[11px] text-mitti mt-2 font-italic italic">
              Type to search and resolve the right leaf category before creation.
            </p>
          </div>

          <div className="bg-beige p-6">
            <p className="label text-madder mb-4">PRICING</p>

            <PriceInput
              label="MRP"
              valuePaise={form.mrp}
              onChangePaise={v => setForm((f: any) => ({ ...f, mrp: v || 0 }))}
              required
              helpText="Maximum Retail Price"
            />

            <PriceInput
              label="Selling Price"
              valuePaise={form.sellingPrice}
              onChangePaise={v => setForm((f: any) => ({ ...f, sellingPrice: v || 0 }))}
              required
              helpText="Customer-facing regular price"
            />

            <PriceInput
              label="Sale Price"
              valuePaise={form.salePrice}
              onChangePaise={v => setForm((f: any) => ({ ...f, salePrice: v }))}
              optional
              allowNull
              helpText="Optional promotional price"
            />

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="label text-mitti block mb-1">GST RATE (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.gstRate}
                  onChange={e => setForm((f: any) => ({ ...f, gstRate: parseFloat(e.target.value) || 0 }))}
                  className="w-full p-2 bg-ivory border border-mitti/20 font-ui text-sm"
                />
              </div>
              <Field
                label="HSN Code"
                value={form.hsnCode}
                onChange={(v: string) => setForm((f: any) => ({ ...f, hsnCode: v }))}
                mono
              />
            </div>

            <div className="mt-4 p-3 bg-ivory border border-mitti/20">
              <p className="font-ui text-xs text-mitti">Preview price</p>
              <p className="font-display text-2xl text-kohl mt-1">{formatINR(effectiveDisplayPrice)}</p>
              {form.mrp > effectiveDisplayPrice && (
                <>
                  <p className="font-ui text-sm text-mitti line-through">{formatINR(form.mrp)}</p>
                  <p className="font-ui text-xs text-neem mt-1">{currentDiscount}% off MRP</p>
                </>
              )}
            </div>
          </div>

          <div className="bg-beige p-6">
            <p className="label text-madder mb-4">CATALOGUE</p>

            <div className="space-y-2 mb-4">
              <label className="flex items-center gap-2 font-ui text-sm">
                <input type="checkbox" checked={!!form.catalogueFeatured} onChange={e => setForm((f: any) => ({ ...f, catalogueFeatured: e.target.checked }))} />
                Featured
              </label>
              <label className="flex items-center gap-2 font-ui text-sm">
                <input type="checkbox" checked={!!form.catalogueBestseller} onChange={e => setForm((f: any) => ({ ...f, catalogueBestseller: e.target.checked }))} />
                Bestseller
              </label>
              <label className="flex items-center gap-2 font-ui text-sm">
                <input type="checkbox" checked={!!form.catalogueEditorial} onChange={e => setForm((f: any) => ({ ...f, catalogueEditorial: e.target.checked }))} />
                Editorial Pick
              </label>
              <label className="flex items-center gap-2 font-ui text-sm">
                <input type="checkbox" checked={!!form.cataloguePinHero} onChange={e => setForm((f: any) => ({ ...f, cataloguePinHero: e.target.checked }))} />
                Pin to Hero
              </label>
              <label className="flex items-center gap-2 font-ui text-sm">
                <input type="checkbox" checked={!!form.catalogueExclude} onChange={e => setForm((f: any) => ({ ...f, catalogueExclude: e.target.checked }))} />
                Exclude from Catalogue
              </label>
              <label className="flex items-center gap-2 font-ui text-sm">
                <input type="checkbox" checked={!!form.catalogueImageApproved} onChange={e => setForm((f: any) => ({ ...f, catalogueImageApproved: e.target.checked }))} />
                Image Approved
              </label>
            </div>

            <Field
              label="Preferred Image URL"
              value={form.cataloguePreferredImage}
              onChange={(v: string) => setForm((f: any) => ({ ...f, cataloguePreferredImage: v }))}
            />

            <Field
              label="Audience Tag"
              value={form.catalogueAudienceTag}
              onChange={(v: string) => setForm((f: any) => ({ ...f, catalogueAudienceTag: v }))}
            />

            <Field
              label="CTA Mode"
              value={form.catalogueCtaMode}
              onChange={(v: string) => setForm((f: any) => ({ ...f, catalogueCtaMode: v }))}
            />

            <Field
              label="Story Block"
              value={form.catalogueStoryBlock}
              onChange={(v: string) => setForm((f: any) => ({ ...f, catalogueStoryBlock: v }))}
              multiline
              rows={3}
            />

            <div className="mb-3">
              <label className="label text-mitti block mb-1">IMAGE QUALITY SCORE</label>
              <input
                type="number"
                value={form.catalogueImageQualityScore ?? ''}
                onChange={e =>
                  setForm((f: any) => ({
                    ...f,
                    catalogueImageQualityScore: e.target.value === '' ? null : parseInt(e.target.value, 10) || 0,
                  }))
                }
                className="w-full p-2 bg-ivory border border-mitti/20 font-ui text-sm"
              />
            </div>

            <div>
              <label className="label text-mitti block mb-1">STOCK VISIBILITY</label>
              <select
                value={form.catalogueStockVisibility}
                onChange={e => setForm((f: any) => ({ ...f, catalogueStockVisibility: e.target.value }))}
                className="w-full p-2 bg-ivory border border-mitti/20 font-ui text-sm"
              >
                {STOCK_VISIBILITY_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-beige p-6">
            <p className="label text-madder mb-4">AI ELIGIBILITY</p>
            <label className="flex items-center gap-2 font-ui text-sm mb-2">
              <input type="checkbox" checked={!!form.aiTryOnEligible} onChange={e => setForm((f: any) => ({ ...f, aiTryOnEligible: e.target.checked }))} />
              Mirror Try-On
            </label>
            <label className="flex items-center gap-2 font-ui text-sm mb-2">
              <input type="checkbox" checked={!!form.aiStylistEligible} onChange={e => setForm((f: any) => ({ ...f, aiStylistEligible: e.target.checked }))} />
              AI Stylist Eligible
            </label>
            <label className="flex items-center gap-2 font-ui text-sm">
              <input type="checkbox" checked={!!form.arTryOnEligible} onChange={e => setForm((f: any) => ({ ...f, arTryOnEligible: e.target.checked }))} />
              AR Try-On Eligible
            </label>
          </div>

          <div className="bg-beige p-6">
            <p className="label text-madder mb-4">FULFILMENT</p>

            <select
              value={form.fulfilmentMode}
              onChange={e => setForm((f: any) => ({ ...f, fulfilmentMode: e.target.value }))}
              className="w-full p-2 bg-ivory border border-mitti/20 font-ui text-sm"
            >
              <option value="IN_STOCK">IN STOCK</option>
              <option value="PREORDER">PREORDER</option>
              <option value="LIMITED_DROP">LIMITED DROP</option>
            </select>

            {form.fulfilmentMode === 'PREORDER' && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="label text-mitti block mb-1">DEPOSIT %</label>
                  <input
                    type="number"
                    value={form.depositPercent || 20}
                    onChange={e => setForm((f: any) => ({ ...f, depositPercent: parseInt(e.target.value, 10) || 20 }))}
                    min={1}
                    max={100}
                    className="w-full p-2 bg-ivory border border-mitti/20 text-sm"
                  />
                </div>

                <div>
                  <label className="label text-mitti block mb-1">ESTIMATED SHIP DATE</label>
                  <input
                    type="date"
                    value={form.releaseDate || ''}
                    onChange={e => setForm((f: any) => ({ ...f, releaseDate: e.target.value }))}
                    className="w-full p-2 bg-ivory border border-mitti/20 text-sm"
                  />
                </div>
              </div>
            )}

            {form.fulfilmentMode === 'LIMITED_DROP' && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="label text-mitti block mb-1">EDITION TOTAL</label>
                  <input
                    type="number"
                    value={form.editionTotal ?? ''}
                    onChange={e => setForm((f: any) => ({ ...f, editionTotal: e.target.value ? parseInt(e.target.value, 10) : null }))}
                    min={1}
                    className="w-full p-2 bg-ivory border border-mitti/20 text-sm"
                  />
                </div>

                <div>
                  <label className="label text-mitti block mb-1">EDITION SOLD</label>
                  <input
                    type="number"
                    value={form.editionSold ?? 0}
                    onChange={e => setForm((f: any) => ({ ...f, editionSold: parseInt(e.target.value, 10) || 0 }))}
                    min={0}
                    className="w-full p-2 bg-ivory border border-mitti/20 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="bg-beige p-6">
            <p className="label text-madder mb-4">RETURNS & STATUS</p>

            <label className="flex items-center gap-2 font-ui text-sm mb-2">
              <input type="checkbox" checked={!!form.codEligible} onChange={e => setForm((f: any) => ({ ...f, codEligible: e.target.checked }))} />
              Cash on Delivery available
            </label>

            <label className="flex items-center gap-2 font-ui text-sm mb-3">
              <input type="checkbox" checked={!!form.returnEligible} onChange={e => setForm((f: any) => ({ ...f, returnEligible: e.target.checked }))} />
              Returnable / refundable
            </label>

            {form.returnEligible && (
              <Field
                label="Return Policy Override"
                value={form.returnPolicy}
                onChange={(v: string) => setForm((f: any) => ({ ...f, returnPolicy: v }))}
                multiline
                rows={3}
              />
            )}

            <div className="mt-3">
              <label className="label text-mitti block mb-1">STATUS</label>
              <select
                value={form.status}
                onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}
                className="w-full p-2 bg-ivory border border-mitti/20 font-ui text-sm"
              >
                {STATUSES.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>

          <button type="submit" disabled={saving} className="btn-primary w-full disabled:opacity-50">
            {saving ? 'CREATING...' : 'CREATE PRODUCT'}
          </button>
        </div>
      </form>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  required,
  mono,
  help,
  placeholder,
  rows = 3,
}: any) {
  return (
    <div className="mb-3">
      <label className="label text-mitti block mb-1">
        {label} {required && <span className="text-madder">*</span>}
      </label>
      {multiline ? (
        <textarea
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          rows={rows}
          className={`w-full p-2 bg-ivory border border-mitti/20 font-ui text-sm ${mono ? 'font-mono' : ''}`}
        />
      ) : (
        <input
          type="text"
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={`w-full p-2 bg-ivory border border-mitti/20 font-ui text-sm ${mono ? 'font-mono' : ''}`}
        />
      )}
      {help && <p className="font-ui text-[11px] text-mitti mt-1">{help}</p>}
    </div>
  );
}
