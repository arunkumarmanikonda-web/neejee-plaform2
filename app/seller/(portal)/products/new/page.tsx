'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { PriceInput } from '@/components/admin/PriceInput';
import { ImageUploader } from '@/components/admin/ImageUploader';
import CategoryPicker, { CategoryPickerValue } from '@/components/admin/CategoryPicker';

export const dynamic = 'force-dynamic';

export default function SellerNewProduct() {
  const router = useRouter();
  const [cats, setCats] = useState<any[]>([]);
  const [categoryPick, setCategoryPick] = useState<CategoryPickerValue>(null);
  const [images, setImages] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: '',
    categoryId: '',
    craft: '',
    region: '',
    material: '',
    technique: '',
    occasion: '',
    description: '',
    mrp: 0,
    sellingPrice: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(d => setCats(d.categories || []));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.mrp <= 0 || form.sellingPrice <= 0) { setError('Please set MRP and selling price'); return; }
    if (images.length === 0) { setError('Add at least one photograph'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/seller/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, images }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed to submit');
      router.push('/seller/products');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Link href="/seller/products" className="text-xs tracking-wider text-mitti hover:text-kohl flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" /> ALL PIECES
      </Link>
      <h1 className="font-display text-4xl text-kohl mt-2">Add a new piece</h1>
      <p className="font-italic italic text-mitti mt-2">Submitted pieces enter a short personal review before going live.</p>
      <div className="madder-divider mt-4"></div>

      <form onSubmit={submit} className="mt-8 grid lg:grid-cols-[1fr_380px] gap-8">
        {/* Main */}
        <div className="space-y-6">
          <section className="bg-beige p-6 space-y-3">
            <p className="label text-madder mb-2">BASIC</p>
            <Field label="Name" value={form.name} onChange={v => setForm({ ...form, name: v })} required />
            <div>
              <label className="label text-mitti">CATEGORY</label>
              <div className="mt-1">
                <CategoryPicker
                  value={categoryPick}
                  onChange={(v) => {
                    setCategoryPick(v);
                    setForm({ ...form, categoryId: v?.id || '' });
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
                  <p className="text-[11px] text-mitti mt-1 font-mono">{categoryPick.path}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Craft" value={form.craft} onChange={v => setForm({ ...form, craft: v })} placeholder="e.g. Banarasi" />
              <Field label="Region" value={form.region} onChange={v => setForm({ ...form, region: v })} placeholder="e.g. Varanasi" />
              <Field label="Material" value={form.material} onChange={v => setForm({ ...form, material: v })} />
              <Field label="Technique" value={form.technique} onChange={v => setForm({ ...form, technique: v })} />
              <Field label="Occasion" value={form.occasion} onChange={v => setForm({ ...form, occasion: v })} />
            </div>
            <div>
              <label className="label text-mitti">DESCRIPTION</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4} className="w-full p-3 bg-ivory border border-mitti/20 font-ui text-sm mt-1" placeholder="Tactile, specific, factual…" />
            </div>
          </section>

          <section className="bg-beige p-6">
            <p className="label text-madder mb-3">PHOTOGRAPHS</p>
            <ImageUploader images={images} onChange={setImages} folder="seller-products" label="UPLOAD UP TO 8" max={8} endpoint="/api/seller/upload" />
          </section>
        </div>

        {/* Side */}
        <div className="space-y-6">
          <section className="bg-beige p-6 space-y-3">
            <p className="label text-madder mb-2">PRICING</p>
            <PriceInput label="MRP" valuePaise={form.mrp} onChangePaise={(v) => setForm({ ...form, mrp: v || 0 })} />
            <PriceInput label="Selling Price" valuePaise={form.sellingPrice} onChangePaise={(v) => setForm({ ...form, sellingPrice: v || 0 })} />
          </section>

          <section className="bg-beige p-5 text-xs text-mitti leading-relaxed">
            <p className="label text-mitti mb-2">REVIEW PROCESS</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>You submit the piece.</li>
              <li>NEEJEE reviews photos, story, and pricing.</li>
              <li>Approved pieces appear on the site.</li>
              <li>Rejected pieces come back with a note.</li>
            </ol>
          </section>

          {error && <p className="text-madder text-sm">{error}</p>}
          <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> SUBMITTING…</> : 'SUBMIT FOR REVIEW'}
          </button>
        </div>
      </form>
    </>
  );
}

function Field({ label, value, onChange, required, placeholder }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string }) {
  return (
    <div>
      <label className="label text-mitti">{label}{required && <span className="text-madder ml-1">*</span>}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full p-3 bg-ivory border border-mitti/20 font-ui text-sm mt-1"
      />
    </div>
  );
}
