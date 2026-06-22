'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ArrowLeft, Check, X, MessageSquare, Upload } from 'lucide-react';

export default function ReviewSubmissionPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [sub, setSub] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<any>({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    const [sR, cR] = await Promise.all([
      fetch(`/api/admin/seller-inventory/${params.id}`),
      fetch('/api/admin/categories').catch(() => null),
    ]);
    const sJ = await sR.json();
    if (!sR.ok) { setErr(sJ.error); return; }
    setSub(sJ.submission);
    setOverrides(sJ.submission.proposedData || {});
    if (cR) {
      const cJ = await cR.json();
      setCategories(cJ.categories || cJ || []);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [params.id]);

  const act = async (action: string) => {
    setErr(''); setMsg(''); setBusy(action);
    try {
      const body: any = { action, note };
      if (action === 'publish') body.productOverrides = overrides;
      const r = await fetch(`/api/admin/seller-inventory/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setMsg(action === 'publish' ? 'Published — product is live!' : `Marked as ${action}`);
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally { setBusy(''); }
  };

  if (!sub) return <div className="text-mitti py-20 text-center"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>;

  const data = sub.proposedData || {};
  const status = sub.status;

  return (
    <div className="space-y-6 max-w-5xl">
      <Link href="/admin/seller-inventory" className="text-mitti hover:text-kohl text-xs flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" /> BACK TO QUEUE
      </Link>

      <div>
        <p className="label text-banarasi">SUBMISSION FROM {sub.seller.businessName}</p>
        <h1 className="font-display text-3xl text-kohl mt-1">{data.name || sub.product?.name || 'Untitled'}</h1>
        <p className="text-mitti text-sm mt-1">
          {sub.submissionType.replace(/_/g, ' ')} · status: <span className="font-medium">{status}</span> ·
          submitted {new Date(sub.createdAt).toLocaleString('en-IN')}
        </p>
      </div>

      {msg && <div className="bg-emerald-50 border border-emerald-200 p-3 text-sm">{msg}</div>}
      {err && <div className="bg-madder/10 border border-madder p-3 text-madder text-sm">{err}</div>}

      {/* Source file (bulk) */}
      {sub.sourceFileUrl && (
        <div className="bg-banarasi/10 border border-banarasi/30 p-4 rounded">
          <p className="label text-banarasi mb-1">BULK SOURCE</p>
          <a href={sub.sourceFileUrl} target="_blank" rel="noreferrer"
            className="text-kohl hover:underline text-sm">📊 {sub.sourceFileName || 'Excel file'}</a>
        </div>
      )}

      {/* Image gallery */}
      {data.images?.length > 0 && (
        <div>
          <p className="label text-banarasi mb-2">IMAGES ({data.images.length})</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.images.map((url: string, i: number) => (
              <img key={i} src={url} alt="" className="w-full aspect-square object-cover rounded border border-mitti/20" />
            ))}
          </div>
        </div>
      )}

      {/* Proposed data, side-by-side admin polish */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Panel title="Seller submitted">
          <DataRow k="Name" v={data.name} />
          <DataRow k="SKU" v={data.sku} />
          <DataRow k="MRP" v={data.mrp ? `₹${(data.mrp / 100).toLocaleString('en-IN')}` : '—'} />
          <DataRow k="Selling price" v={data.sellingPrice ? `₹${(data.sellingPrice / 100).toLocaleString('en-IN')}` : '—'} />
          <DataRow k="Material" v={data.material} />
          <DataRow k="Technique" v={data.technique} />
          <DataRow k="Craft" v={data.craft} />
          <DataRow k="Region" v={data.region} />
          <DataRow k="Description" v={data.description} multi />
          <DataRow k="Story" v={data.story} multi />
          <DataRow k="Care" v={data.careInstructions} multi />
        </Panel>

        <Panel title="Admin polish (what gets published)">
          <Editable k="name" label="Name" value={overrides.name} onChange={v => setOverrides({ ...overrides, name: v })} />
          <Editable k="categoryId" label="Category *" value={overrides.categoryId} onChange={v => setOverrides({ ...overrides, categoryId: v })}
            options={categories.map((c: any) => ({ v: c.id, l: c.name }))} />
          <Editable k="mrp" label="MRP (paise)" value={overrides.mrp} type="number" onChange={v => setOverrides({ ...overrides, mrp: parseInt(v) })} />
          <Editable k="sellingPrice" label="Selling price (paise)" value={overrides.sellingPrice} type="number" onChange={v => setOverrides({ ...overrides, sellingPrice: parseInt(v) })} />
          <Editable k="description" label="Description" value={overrides.description} multi onChange={v => setOverrides({ ...overrides, description: v })} />
          <Editable k="story" label="Story" value={overrides.story} multi onChange={v => setOverrides({ ...overrides, story: v })} />
          <p className="text-xs text-mitti mt-2 italic">Empty fields fall back to the seller's submitted values.</p>
        </Panel>
      </div>

      {/* Note */}
      <div>
        <p className="label text-banarasi mb-1">REVIEWER NOTE</p>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
          placeholder="Optional — required for 'needs info' and 'reject'"
          className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory" />
      </div>

      {/* Actions */}
      <div className="bg-ivory border border-mitti/20 p-4 rounded flex gap-2 flex-wrap sticky bottom-4 shadow-lg">
        {status === 'SUBMITTED' && (
          <button onClick={() => act('review')} disabled={!!busy}
            className="bg-kohl text-ivory px-4 py-2 font-ui text-xs tracking-widest disabled:opacity-50">
            START REVIEW
          </button>
        )}
        <button onClick={() => act('needs_info')} disabled={!!busy || !note}
          className="border border-banarasi text-banarasi px-4 py-2 font-ui text-xs tracking-widest disabled:opacity-50 flex items-center gap-1">
          <MessageSquare className="w-3 h-3" /> NEEDS INFO
        </button>
        <button onClick={() => act('reject')} disabled={!!busy || !note}
          className="border border-madder text-madder px-4 py-2 font-ui text-xs tracking-widest disabled:opacity-50 flex items-center gap-1">
          <X className="w-3 h-3" /> REJECT
        </button>
        <button onClick={() => act('approve')} disabled={!!busy}
          className="bg-emerald-600 text-white px-4 py-2 font-ui text-xs tracking-widest disabled:opacity-50 flex items-center gap-1">
          <Check className="w-3 h-3" /> APPROVE
        </button>
        <button onClick={() => act('publish')} disabled={!!busy}
          className="bg-banarasi text-kohl px-4 py-2 font-ui text-xs tracking-widest disabled:opacity-50 flex items-center gap-1">
          <Upload className="w-3 h-3" /> PUBLISH LIVE
        </button>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-ivory border border-mitti/20 p-5 rounded">
      <h3 className="font-display text-lg text-kohl border-b border-mitti/20 pb-2 mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function DataRow({ k, v, multi }: { k: string; v?: string; multi?: boolean }) {
  return (
    <div className="text-sm">
      <p className="label text-banarasi text-[10px]">{k.toUpperCase()}</p>
      <p className={`text-kohl mt-0.5 ${multi ? 'whitespace-pre-wrap' : ''}`}>{v || <span className="text-mitti/40 italic">empty</span>}</p>
    </div>
  );
}

function Editable({ k, label, value, onChange, type = 'text', multi, options }: { k: string; label: string; value: any; onChange: (v: string) => void; type?: string; multi?: boolean; options?: { v: string; l: string }[] }) {
  return (
    <div>
      <p className="label text-banarasi text-[10px] mb-1">{label}</p>
      {options ? (
        <select value={value || ''} onChange={e => onChange(e.target.value)}
          className="w-full border border-mitti/30 px-2 py-1 text-sm bg-ivory">
          <option value="">— pick —</option>
          {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      ) : multi ? (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={2}
          className="w-full border border-mitti/30 px-2 py-1 text-sm bg-ivory" />
      ) : (
        <input type={type} value={value || ''} onChange={e => onChange(e.target.value)}
          className="w-full border border-mitti/30 px-2 py-1 text-sm bg-ivory" />
      )}
    </div>
  );
}
