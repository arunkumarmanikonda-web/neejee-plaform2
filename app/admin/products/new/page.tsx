'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PriceInput } from '@/components/admin/PriceInput';
import { ImageUploader } from '@/components/admin/ImageUploader';
import { formatINR, discountPct } from '@/lib/money';
import { RefreshCw, Lock, Pencil } from 'lucide-react';
import AiDraftAllButton from '@/components/admin/AiDraftAllButton';
import AiNameSuggester from '@/components/admin/AiNameSuggester';
import AiFieldRedraft from '@/components/admin/AiFieldRedraft';
import { AiCopyButton } from '@/components/admin/AiCopyButton';
import CategoryPicker, { CategoryPickerValue } from '@/components/admin/CategoryPicker';

export default function AdminNewProduct() {
  const router = useRouter();
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryPick, setCategoryPick] = useState<CategoryPickerValue>(null);
  const [form, setForm] = useState({
    name: '', shortName: '', sku: '', slug: '',
    mrp: 0, sellingPrice: 0,
    categoryId: '', craft: '', region: '', state: '', cluster: '', artisanName: '',
    material: '', technique: '', occasion: '',
    description: '', poeticLine: '',
    story: '', craftNote: '', careInstructions: '', sustainabilityNote: '',
    seoTitle: '', seoDesc: '',
    status: 'DRAFT',
    images: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [skuEditable, setSkuEditable] = useState(false);   // SKU is auto by default; user can unlock
  const [skuLoading, setSkuLoading] = useState(false);

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(d => setCategories(d.categories || [])).catch(() => {});
  }, []);

  // Track whether the user has manually edited the slug. If they have, we
  // stop auto-generating from name. Otherwise, every keystroke in name
  // updates the slug live (fixes the "slug stays at first letter" bug).
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  useEffect(() => {
    if (!slugManuallyEdited && form.name) {
      const auto = form.name.toLowerCase().trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setForm(f => ({ ...f, slug: auto }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.name]);

  // Auto-generate SKU when craft or category changes (unless user has unlocked manual edit).
  useEffect(() => {
    if (skuEditable) return;
    if (!form.categoryId && !form.craft) {
      setForm(f => ({ ...f, sku: '' }));
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
          setForm(f => ({ ...f, sku: data.sku }));
        }
      } catch {
        /* ignore aborts */
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      router.push(`/admin/products/${data.product.id}`);
    } catch (e: any) { setError(e.message); setSaving(false); }
  };

  // Resolve category name for AI context
  const categoryName = categories.find(c => c.id === form.categoryId)?.name || '';

  return (
    <>
      <Link href="/admin/products" className="label text-mitti hover:text-madder">← BACK TO PRODUCTS</Link>
      <div className="flex justify-between items-start mt-2">
        <div>
          <h1 className="font-display text-4xl text-kohl">Add New Product</h1>
          <p className="font-italic italic text-mitti mt-2">
            Fill the locked fields below (craft, region, price), then click <strong>DRAFT WITH AI</strong>
            to auto-fill name, description, story, care, SEO and more. Verify and publish.
          </p>
        </div>
        <AiDraftAllButton
          form={{ ...form, categoryName }}
          onApply={(draft) => {
            // Map AI's "name" output to form.name etc.
            setForm((f: any) => ({ ...f, ...draft }));
          }}
        />
      </div>
      <div className="madder-divider mt-4"></div>

      {error && <p className="mt-6 font-ui text-sm text-madder bg-madder/10 p-3">{error}</p>}

      <form onSubmit={submit} className="mt-8 grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-beige p-6">
            <p className="label text-madder mb-4">BASIC INFO</p>
            {/* v23.40.21 — Prominent AI naming CTA above the name field. */}
            <AiNameSuggester
              variant="prominent"
              brief={{
                // v26.1.2 — pass the typed name + description so suggestions
                // refine the SAME piece instead of jumping crafts.
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
            <Field label="Product Name" value={form.name} onChange={(v: string) => setForm((f: any) => ({...f, name: v}))} required />

            {/* SKU field — auto-generated, optionally unlocked for manual override */}
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
                  placeholder={skuLoading ? 'Generating…' : (form.categoryId || form.craft ? 'NEE-XXX-0001' : 'Pick category or craft first')}
                  readOnly={!skuEditable}
                  className={`flex-1 p-2 border border-mitti/20 font-ui font-mono text-sm ${skuEditable ? 'bg-ivory' : 'bg-beige text-mitti'}`}
                />
                {!skuEditable ? (
                  <>
                    <button
                      type="button"
                      title="Regenerate"
                      onClick={async () => {
                        if (!form.categoryId && !form.craft) return;
                        setSkuLoading(true);
                        const qs = new URLSearchParams();
                        if (form.craft) qs.set('craft', form.craft);
                        if (form.categoryId) qs.set('categoryId', form.categoryId);
                        const res = await fetch(`/api/admin/products/next-sku?${qs.toString()}`, { credentials: 'include' });
                        const data = await res.json();
                        if (data?.sku) setForm(f => ({ ...f, sku: data.sku }));
                        setSkuLoading(false);
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
                      setForm(f => ({ ...f, sku: '' })); // will re-fetch via useEffect
                    }}
                    className="p-2 text-mitti hover:text-madder border border-mitti/20 bg-ivory"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </div>
              <p className="font-ui text-[11px] text-mitti mt-1">
                Format: NEE-{'{CRAFT3}'}-{'{COUNTER4}'} (e.g. NEE-BAN-0001 for Banarasi). Auto-generated when category/craft is picked. Click the lock to override.
              </p>
            </div>

            <Field label="URL Slug" value={form.slug}
              onChange={(v: string) => { setSlugManuallyEdited(true); setForm((f: any) => ({...f, slug: v})); }}
              mono help="Auto-generated from name; once you edit it manually it stops auto-updating." />
            <Field label="Poetic Line" value={form.poeticLine} onChange={(v: string) => setForm((f: any) => ({...f, poeticLine: v}))} help="One-line tagline" />
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Field label="Craft" value={form.craft} onChange={(v: string) => setForm((f: any) => ({...f, craft: v}))} />
              <Field label="Region" value={form.region} onChange={(v: string) => setForm((f: any) => ({...f, region: v}))} />
            </div>
            <Field label="Description" value={form.description} onChange={(v: string) => setForm((f: any) => ({...f, description: v}))} multiline />
          </div>

          <div className="bg-beige p-6">
            <p className="label text-madder mb-4">IMAGES</p>
            <ImageUploader images={form.images} onChange={imgs => setForm((f: any) => ({...f, images: imgs}))} folder="products/new" max={10} />
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
            {categoryPick && (
              <p className="text-[11px] text-mitti mt-2 font-ui">
                Path: <span className="font-mono">{categoryPick.path}</span>
              </p>
            )}
            <p className="text-[11px] text-mitti mt-2 font-italic italic">
              Type to search · click <strong>✨ Resolve with AI</strong> to let AI pick or auto-create the right sub-category.
            </p>
          </div>

          <div className="bg-beige p-6">
            <p className="label text-madder mb-4">PRICING</p>
            <PriceInput label="MRP" valuePaise={form.mrp} onChangePaise={v => setForm((f: any) => ({...f, mrp: v || 0}))} required helpText="Maximum Retail Price" />
            <PriceInput label="Selling Price" valuePaise={form.sellingPrice} onChangePaise={v => setForm((f: any) => ({...f, sellingPrice: v || 0}))} required helpText="Customer-facing price" />
            {form.mrp > 0 && form.sellingPrice > 0 && form.sellingPrice < form.mrp && (
              <p className="font-ui text-xs text-neem mt-2">{discountPct(form.mrp, form.sellingPrice)}% off MRP</p>
            )}
            <p className="font-italic italic text-mitti text-xs mt-3">
              Sale windows can be set after creation in the Pricing tab.
            </p>
          </div>

          <div className="bg-beige p-6">
            <p className="label text-madder mb-4">STATUS</p>
            <select value={form.status} onChange={e => setForm((f: any) => ({...f, status: e.target.value}))}
              className="w-full p-2 bg-ivory border border-mitti/20 font-ui text-sm">
              <option value="DRAFT">DRAFT</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PENDING_QC">PENDING QC</option>
            </select>
            <p className="font-ui text-[11px] text-mitti mt-2">Only ACTIVE products are visible to customers.</p>
          </div>

          <button type="submit" disabled={saving} className="btn-primary w-full disabled:opacity-50">
            {saving ? 'CREATING...' : 'CREATE PRODUCT'}
          </button>
        </div>
      </form>
    </>
  );
}

function Field({ label, value, onChange, multiline, required, mono, help, placeholder }: any) {
  return (
    <div className="mb-3">
      <label className="label text-mitti block mb-1">
        {label} {required && <span className="text-madder">*</span>}
      </label>
      {multiline ? (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={3}
          className="w-full p-2 bg-ivory border border-mitti/20 font-ui text-sm" />
      ) : (
        <input type="text" value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          required={required}
          className={`w-full p-2 bg-ivory border border-mitti/20 font-ui text-sm ${mono ? 'font-mono' : ''}`} />
      )}
      {help && <p className="font-ui text-[11px] text-mitti mt-1">{help}</p>}
    </div>
  );
}
