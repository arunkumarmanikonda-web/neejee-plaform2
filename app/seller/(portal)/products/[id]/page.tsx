'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { PriceInput } from '@/components/admin/PriceInput';
import { ImageUploader } from '@/components/admin/ImageUploader';

export const dynamic = 'force-dynamic';

export default function SellerEditProduct() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch(`/api/seller/products/${id}`).then(r => r.json()).then(d => { setProduct(d.product); setLoading(false); });
  }, [id]);

  const update = (k: string, v: any) => setProduct({ ...product, [k]: v });

  const save = async () => {
    setSaving(true); setMsg(''); setErr('');
    try {
      const res = await fetch(`/api/seller/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: product.name, poeticLine: product.poeticLine, description: product.description,
          story: product.story, craftNote: product.craftNote, careInstructions: product.careInstructions,
          craft: product.craft, region: product.region, material: product.material,
          technique: product.technique, occasion: product.occasion,
          images: product.images, mrp: product.mrp, sellingPrice: product.sellingPrice,
          salePrice: product.salePrice,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Save failed');
      setProduct(j.product);
      setMsg('✓ Saved — your piece is back in review');
      setTimeout(() => setMsg(''), 3500);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-mitti">Loading…</p>;
  if (!product) return <p className="text-madder">Product not found.</p>;

  return (
    <>
      <Link href="/seller/products" className="text-xs tracking-wider text-mitti hover:text-kohl flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" /> ALL PIECES
      </Link>
      <div className="flex items-start justify-between flex-wrap gap-4 mt-2">
        <div>
          <h1 className="font-display text-4xl text-kohl">{product.name}</h1>
          <p className="text-mitti text-sm font-mono mt-1">{product.sku}</p>
        </div>
        <span className="text-xs tracking-wider bg-beige px-3 py-1.5">{product.status?.replace(/_/g, ' ')}</span>
      </div>
      <div className="madder-divider mt-4"></div>

      {msg && <p className="text-neem text-sm mt-4">{msg}</p>}
      {err && <p className="text-madder text-sm mt-4">{err}</p>}

      <div className="grid lg:grid-cols-[1fr_360px] gap-6 mt-8">
        <div className="space-y-6">
          <section className="bg-beige p-6 space-y-3">
            <p className="label text-madder mb-2">BASIC</p>
            <Field label="Name" value={product.name} onChange={v => update('name', v)} />
            <Field label="Poetic line" value={product.poeticLine || ''} onChange={v => update('poeticLine', v)} />
            <div>
              <label className="label text-mitti">DESCRIPTION</label>
              <textarea value={product.description || ''} onChange={e => update('description', e.target.value)} rows={4} className="w-full p-3 bg-ivory border border-mitti/20 text-sm mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Craft" value={product.craft || ''} onChange={v => update('craft', v)} />
              <Field label="Region" value={product.region || ''} onChange={v => update('region', v)} />
              <Field label="Material" value={product.material || ''} onChange={v => update('material', v)} />
              <Field label="Technique" value={product.technique || ''} onChange={v => update('technique', v)} />
              <Field label="Occasion" value={product.occasion || ''} onChange={v => update('occasion', v)} />
            </div>
          </section>

          <section className="bg-beige p-6 space-y-3">
            <p className="label text-madder mb-2">STORY & CARE</p>
            <div>
              <label className="label text-mitti">STORY</label>
              <textarea value={product.story || ''} onChange={e => update('story', e.target.value)} rows={5} className="w-full p-3 bg-ivory border border-mitti/20 text-sm mt-1" />
            </div>
            <div>
              <label className="label text-mitti">CRAFT NOTE</label>
              <textarea value={product.craftNote || ''} onChange={e => update('craftNote', e.target.value)} rows={3} className="w-full p-3 bg-ivory border border-mitti/20 text-sm mt-1" />
            </div>
            <div>
              <label className="label text-mitti">CARE INSTRUCTIONS</label>
              <textarea value={product.careInstructions || ''} onChange={e => update('careInstructions', e.target.value)} rows={3} className="w-full p-3 bg-ivory border border-mitti/20 text-sm mt-1" />
            </div>
          </section>

          <section className="bg-beige p-6">
            <p className="label text-madder mb-3">PHOTOGRAPHS</p>
            <ImageUploader images={product.images || []} onChange={v => update('images', v)} folder="seller-products" label="UP TO 8" max={8} endpoint="/api/seller/upload" />
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-beige p-6 space-y-3">
            <p className="label text-madder mb-2">PRICING</p>
            <PriceInput label="MRP" valuePaise={product.mrp} onChangePaise={(v) => update('mrp', v)} />
            <PriceInput label="Selling price" valuePaise={product.sellingPrice} onChangePaise={(v) => update('sellingPrice', v)} />
            <PriceInput label="Sale price (optional)" valuePaise={product.salePrice || 0} onChangePaise={(v) => update('salePrice', v || null)} allowNull />
          </section>

          {product.status === 'REJECTED' && (
            <section className="bg-madder/5 border border-madder/30 p-5 text-xs text-mitti leading-relaxed">
              <p className="label text-madder mb-2">PREVIOUSLY REJECTED</p>
              <p>Edit this piece and re-submit. It will go back into review automatically.</p>
            </section>
          )}

          <button onClick={save} disabled={saving} className="btn-primary w-full disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> SAVING…</> : <><Save className="w-4 h-4" /> SAVE & RE-SUBMIT</>}
          </button>
          <p className="text-[10px] text-mitti text-center">Edits send your piece back into a short review.</p>
        </div>
      </div>
    </>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label text-mitti">{label}</label>
      <input value={value || ''} onChange={e => onChange(e.target.value)} className="w-full p-3 bg-ivory border border-mitti/20 text-sm mt-1" />
    </div>
  );
}
