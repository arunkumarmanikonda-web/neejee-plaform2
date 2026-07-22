'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Upload, FileSpreadsheet, Package, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { SingleImageInput } from '@/components/admin/SingleImageInput';

type Mode = 'choose' | 'single' | 'bulk';

export default function SubmitInventoryPage() {
  const [mode, setMode] = useState<Mode>('choose');
  const [submitted, setSubmitted] = useState<string | null>(null);

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
        <h1 className="font-display text-3xl text-kohl mt-4">Submitted!</h1>
        <p className="text-mitti mt-2">{submitted}</p>
        <p className="text-mitti text-sm mt-4 font-italic italic">
          Our team will review it and either publish or get back to you. You'll be notified by email.
        </p>
        <div className="flex gap-3 justify-center mt-6">
          <Link href="/seller/inventory" className="border border-kohl text-kohl px-5 py-2 font-ui text-xs tracking-widest">
            VIEW SUBMISSIONS
          </Link>
          <button onClick={() => { setSubmitted(null); setMode('choose'); }}
            className="bg-kohl text-ivory px-5 py-2 font-ui text-xs tracking-widest">
            SUBMIT ANOTHER
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        {mode !== 'choose' && (
          <button onClick={() => setMode('choose')} className="text-mitti hover:text-kohl">
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div>
          <h1 className="font-display text-3xl text-kohl">Submit a Product</h1>
          <p className="text-mitti text-sm">Drafts go to our team for review and polish before going live</p>
        </div>
      </div>

      {mode === 'choose' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button onClick={() => setMode('single')}
            className="bg-ivory border border-mitti/30 p-8 rounded text-left hover:border-kohl transition-colors">
            <Package className="w-8 h-8 text-banarasi" />
            <h3 className="font-display text-xl text-kohl mt-3">One at a time</h3>
            <p className="text-mitti text-sm mt-1">Fill out a simple form for a single product. Best for new launches with full storytelling.</p>
          </button>
          <button onClick={() => setMode('bulk')}
            className="bg-ivory border border-mitti/30 p-8 rounded text-left hover:border-kohl transition-colors">
            <FileSpreadsheet className="w-8 h-8 text-banarasi" />
            <h3 className="font-display text-xl text-kohl mt-3">Bulk via Excel</h3>
            <p className="text-mitti text-sm mt-1">Upload a spreadsheet for many products at once. Great for restocking a collection.</p>
          </button>
        </div>
      )}

      {mode === 'single' && <SingleProductForm onDone={msg => setSubmitted(msg)} />}
      {mode === 'bulk' && <BulkUploadForm onDone={msg => setSubmitted(msg)} />}
    </div>
  );
}

function SingleProductForm({ onDone }: { onDone: (msg: string) => void }) {
  const [form, setForm] = useState({
    name: '', shortName: '', poeticLine: '', description: '',
    mrp: '', sellingPrice: '',
    material: '', technique: '', occasion: '',
    region: '', craft: '', state: '', cluster: '',
    story: '', craftNote: '', careInstructions: '',
    images: [] as string[],
    sku: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const addImage = (url: string) => {
    if (url && !form.images.includes(url)) setForm({ ...form, images: [...form.images, url] });
  };
  const rmImage = (i: number) => setForm({ ...form, images: form.images.filter((_, j) => j !== i) });

  const submit = async () => {
    setErr(''); setSaving(true);
    try {
      if (!form.name || !form.mrp || !form.sellingPrice) throw new Error('Name, MRP and selling price are required');
      const proposedData = {
        ...form,
        mrp: Math.round(parseFloat(form.mrp) * 100),
        sellingPrice: Math.round(parseFloat(form.sellingPrice) * 100),
      };
      const r = await fetch('/api/seller/inventory-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionType: 'NEW_PRODUCT', proposedData }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      onDone(`Your product "${form.name}" was submitted for review.`);
    } catch (e: any) {
      setErr(e.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-ivory border border-mitti/20 p-6 rounded space-y-5">
      <Group title="The basics">
        <FieldRow><Input label="PRODUCT NAME *" value={form.name} onChange={v => setForm({ ...form, name: v })} /></FieldRow>
        <FieldRow>
          <Input label="SHORT NAME" value={form.shortName} onChange={v => setForm({ ...form, shortName: v })} placeholder="e.g. Indigo Banarasi" />
          <Input label="SKU" value={form.sku} onChange={v => setForm({ ...form, sku: v })} placeholder="optional" />
        </FieldRow>
        <FieldRow>
          <Input label="MRP (INR) *" type="number" value={form.mrp} onChange={v => setForm({ ...form, mrp: v })} />
          <Input label="SELLING PRICE (INR) *" type="number" value={form.sellingPrice} onChange={v => setForm({ ...form, sellingPrice: v })} />
        </FieldRow>
        <FieldRow>
          <Input label="POETIC LINE" value={form.poeticLine} onChange={v => setForm({ ...form, poeticLine: v })} placeholder="A whisper of monsoon" />
        </FieldRow>
        <div>
          <p className="label text-banarasi mb-1">DESCRIPTION</p>
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            rows={3} className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory" />
        </div>
      </Group>

      <Group title="Craft details">
        <FieldRow>
          <Input label="MATERIAL" value={form.material} onChange={v => setForm({ ...form, material: v })} placeholder="Pure silk" />
          <Input label="TECHNIQUE" value={form.technique} onChange={v => setForm({ ...form, technique: v })} placeholder="Handloom weaving" />
        </FieldRow>
        <FieldRow>
          <Input label="OCCASION" value={form.occasion} onChange={v => setForm({ ...form, occasion: v })} placeholder="Wedding" />
          <Input label="CRAFT" value={form.craft} onChange={v => setForm({ ...form, craft: v })} placeholder="Banarasi weaving" />
        </FieldRow>
        <FieldRow>
          <Input label="REGION / STATE" value={form.region} onChange={v => setForm({ ...form, region: v })} />
          <Input label="CLUSTER / VILLAGE" value={form.cluster} onChange={v => setForm({ ...form, cluster: v })} />
        </FieldRow>
      </Group>

      <Group title="Story & care">
        <div>
          <p className="label text-banarasi mb-1">STORY</p>
          <textarea value={form.story} onChange={e => setForm({ ...form, story: e.target.value })}
            rows={3} placeholder="What makes this piece special?"
            className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory" />
        </div>
        <div>
          <p className="label text-banarasi mb-1">CRAFT NOTE</p>
          <textarea value={form.craftNote} onChange={e => setForm({ ...form, craftNote: e.target.value })}
            rows={2} className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory" />
        </div>
        <div>
          <p className="label text-banarasi mb-1">CARE INSTRUCTIONS</p>
          <textarea value={form.careInstructions} onChange={e => setForm({ ...form, careInstructions: e.target.value })}
            rows={2} className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory" />
        </div>
      </Group>

      <Group title="Images">
        <p className="text-mitti text-xs">Add at least 3 high-quality images. First one is the hero.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {form.images.map((url, i) => (
            <div key={i} className="relative">
              <img src={url} alt="" className="w-full aspect-square object-cover rounded border border-mitti/20" />
              <button onClick={() => rmImage(i)}
                className="absolute top-1 right-1 bg-kohl text-ivory text-xs w-6 h-6 rounded-full">x</button>
              {i === 0 && <span className="absolute bottom-1 left-1 bg-banarasi text-kohl text-[9px] tracking-widest px-1.5 py-0.5">HERO</span>}
            </div>
          ))}
          <SingleImageInput value="" onChange={addImage} folder="sellers/products"
            label="ADD IMAGE" recommendedSize="1200 x 1500 px" recommendedAspect="4:5 portrait" />
        </div>
      </Group>

      {err && <div className="bg-madder/10 border border-madder p-3 text-madder text-sm">{err}</div>}

      <button onClick={submit} disabled={saving}
        className="bg-kohl text-ivory px-6 py-3 font-ui text-xs tracking-widest flex items-center gap-2 disabled:opacity-50">
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
        {saving ? 'SUBMITTING...' : 'SUBMIT FOR REVIEW'}
      </button>
    </div>
  );
}

function BulkUploadForm({ onDone }: { onDone: (msg: string) => void }) {
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [rowSummary, setRowSummary] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const uploadFile = async (file: File) => {
    setErr('');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', 'sellers/bulk-uploads');
    const r = await fetch('/api/seller/upload', { method: 'POST', body: fd });
    const j = await r.json();
    if (!r.ok) { setErr(j.error); return; }
    const f0 = j.files?.[0] || j;
    setFileUrl(f0.url);
    setFileName(file.name);
  };

  const submit = async () => {
    setErr(''); setSaving(true);
    try {
      if (!fileUrl) throw new Error('Upload an Excel file first');
      const r = await fetch('/api/seller/inventory-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionType: 'NEW_PRODUCT',
          proposedData: {
            name: `Bulk: ${fileName}`,
            isBulk: true,
            note: rowSummary || 'Multiple products in attached spreadsheet',
          },
          sourceFileUrl: fileUrl,
          sourceFileName: fileName,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      onDone(`Your bulk file "${fileName}" was submitted. Our team will parse and review the products.`);
    } catch (e: any) {
      setErr(e.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-ivory border border-mitti/20 p-6 rounded space-y-5">
      <div>
        <h3 className="font-display text-lg text-kohl">Bulk product upload</h3>
        <p className="text-mitti text-sm mt-1">
          Upload an Excel/CSV with one product per row. Include columns: name, sku, mrp, sellingPrice, description, material, images (comma-separated URLs).
        </p>
        <a href="/seller-bulk-template.xlsx" download className="text-banarasi text-xs hover:underline mt-2 inline-block">Download template</a>
      </div>

      <label className="block border-2 border-dashed border-mitti/30 hover:border-kohl cursor-pointer p-8 rounded text-center transition-colors">
        <input type="file" hidden accept=".xlsx,.xls,.csv"
          onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0])} />
        {fileName ? (
          <>
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
            <p className="text-kohl mt-2 font-medium">{fileName}</p>
            <p className="text-mitti text-xs">Click to change</p>
          </>
        ) : (
          <>
            <FileSpreadsheet className="w-8 h-8 text-banarasi mx-auto" />
            <p className="text-kohl mt-2">Click to pick your Excel/CSV file</p>
            <p className="text-mitti text-xs">.xlsx, .xls, .csv up to 10 MB</p>
          </>
        )}
      </label>

      <div>
        <p className="label text-banarasi mb-1">QUICK SUMMARY <span className="text-mitti font-normal">- optional</span></p>
        <input value={rowSummary} onChange={e => setRowSummary(e.target.value)}
          placeholder="e.g. 32 new Banarasi sarees from June collection"
          className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory" />
      </div>

      {err && <div className="bg-madder/10 border border-madder p-3 text-madder text-sm">{err}</div>}

      <button onClick={submit} disabled={saving || !fileUrl}
        className="bg-kohl text-ivory px-6 py-3 font-ui text-xs tracking-widest flex items-center gap-2 disabled:opacity-50">
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
        {saving ? 'SUBMITTING...' : 'SUBMIT BULK FILE'}
      </button>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="font-display text-lg text-kohl border-b border-mitti/20 pb-1">{title}</h3>
      {children}
    </div>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>;
}

function Input({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <p className="label text-banarasi mb-1">{label}</p>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory" />
    </div>
  );
}
