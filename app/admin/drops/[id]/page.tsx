'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ArrowLeft, ExternalLink, X, Plus, Trash2, Sparkles } from 'lucide-react';
import { SingleImageInput } from '@/components/admin/SingleImageInput';
import AiAssistField from '@/components/admin/AiAssistField';

export const dynamic = 'force-dynamic';

const STATUS_OPTIONS = ['DRAFT', 'SCHEDULED', 'LIVE', 'CLOSED'] as const;

export default function AdminDropEditor() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [form, setForm] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productPickerOpen, setProductPickerOpen] = useState(false);

  const load = () => {
    fetch(`/api/admin/drops/${id}`, { credentials: 'include', cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return; }
        const drop = d.drop;
        setForm({
          ...drop,
          startsAt: drop.startsAt ? drop.startsAt.slice(0, 16) : '',
          endsAt: drop.endsAt ? drop.endsAt.slice(0, 16) : '',
          productIds: drop.productIds || [],
        });
        setProducts(d.products || []);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (id) load(); }, [id]);

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/admin/drops/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) setError(d.error || 'Save failed');
      else load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-12 text-center text-mitti"><Loader2 className="w-6 h-6 animate-spin inline" /></div>;
  if (!form) return <div className="p-6 text-madder">{error || 'Drop not found'}</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href="/admin/drops" className="text-xs text-mitti hover:text-madder inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="w-3 h-3" /> All drops
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-kohl">{form.title}</h1>
          <p className="text-xs text-mitti mt-1">
            /drops/<strong>{form.slug}</strong>{' '}
            <a href={`/drops/${form.slug}`} target="_blank" rel="noopener noreferrer" className="text-madder ml-2 inline-flex items-center gap-1">
              <ExternalLink className="w-3 h-3" /> View live
            </a>
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 bg-kohl text-ivory text-xs uppercase tracking-widest hover:bg-madder disabled:opacity-50 inline-flex items-center gap-2"
        >
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save changes'}
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-madder/10 border border-madder text-madder text-sm">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="bg-beige/30 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="label text-madder">DETAILS</p>
              <DraftDropWithAI form={form} setForm={setForm} />
            </div>

            <AiAssistField
              label="Title"
              field="dropAnnouncement"
              value={form.title || ''}
              onChange={v => setForm((f: any) => ({ ...f, title: v }))}
              brief={{ name: form.title, releaseDate: form.startsAt, category: form.category }}
              onApplyJson={d => setForm((f: any) => ({ ...f,
                title:    d.title    ?? f.title,
                subtitle: d.subtitle ?? f.subtitle,
                description: d.body  ?? f.description,
              }))}
              buttonLabel="DRAFT TITLE"
              className="mb-3"
              inputClassName="w-full p-2 bg-ivory border border-mitti/20 text-sm"
            />
            <AiAssistField
              label="Subtitle"
              field="dropAnnouncement"
              value={form.subtitle || ''}
              onChange={v => setForm((f: any) => ({ ...f, subtitle: v }))}
              brief={{ name: form.title, releaseDate: form.startsAt }}
              onApplyJson={d => setForm((f: any) => ({ ...f,
                subtitle: d.subtitle ?? f.subtitle,
              }))}
              buttonLabel="DRAFT SUBTITLE"
              className="mb-3"
              inputClassName="w-full p-2 bg-ivory border border-mitti/20 text-sm"
            />
            <AiAssistField
              label="Description"
              field="dropAnnouncement"
              value={form.description || ''}
              onChange={v => setForm((f: any) => ({ ...f, description: v }))}
              brief={{ name: form.title, releaseDate: form.startsAt }}
              onApplyJson={d => setForm((f: any) => ({ ...f,
                description: d.body ?? f.description,
              }))}
              buttonLabel="DRAFT DESCRIPTION"
              multiline
              rows={4}
              placeholder="A paragraph or two introducing this drop."
              className="mb-3"
              inputClassName="w-full p-2 bg-ivory border border-mitti/20 text-sm"
            />
            <AiAssistField
              label="Founder note"
              field="cmsFounderNote"
              value={form.founderNote || ''}
              onChange={v => setForm((f: any) => ({ ...f, founderNote: v }))}
              brief={{ name: form.title, campaign: form.title || 'a NEEJEE drop' }}
              buttonLabel="DRAFT NOTE"
              multiline
              rows={4}
              placeholder="A personal note from Nidhi — appears prominently on the drop page."
              inputClassName="w-full p-2 bg-ivory border border-mitti/20 text-sm"
            />
          </div>

          <div className="bg-beige/30 p-5">
            <p className="label text-madder mb-3">COVER IMAGE</p>
            <SingleImageInput
              value={form.coverImage || ''}
              onChange={(url: string) => setForm((f: any) => ({ ...f, coverImage: url }))}
              folder="drops"
            />
            <p className="text-[10px] italic text-mitti/70 mt-2">
              Wide, atmospheric image. Used as the hero on the drop landing page.
            </p>
          </div>

          <div className="bg-beige/30 p-5">
            <p className="label text-madder mb-3">PIECES IN THIS DROP</p>
            {products.length === 0 ? (
              <p className="text-sm italic text-mitti mb-3">No pieces added yet.</p>
            ) : (
              <div className="space-y-2 mb-3">
                {products.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 p-2 bg-ivory border border-mitti/20">
                    {p.images?.[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.images[0]} alt={p.name} className="w-12 h-12 object-cover" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-kohl text-sm truncate">{p.name}</p>
                      <p className="text-[10px] uppercase tracking-widest text-mitti">
                        {p.fulfilmentMode || 'IN_STOCK'} · {p.status}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const next = form.productIds.filter((id: string) => id !== p.id);
                        setForm((f: any) => ({ ...f, productIds: next }));
                        setProducts(products.filter(x => x.id !== p.id));
                      }}
                      className="text-madder hover:opacity-70"
                      title="Remove from drop"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setProductPickerOpen(true)}
              className="w-full px-3 py-2 border border-dashed border-mitti/40 text-mitti text-xs uppercase tracking-widest hover:border-madder hover:text-madder inline-flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add pieces
            </button>
          </div>

          <div className="bg-beige/30 p-5">
            <p className="label text-madder mb-3">SEO</p>
            <label className="label text-mitti block">SEO title</label>
            <input
              value={form.seoTitle || ''}
              onChange={e => setForm((f: any) => ({ ...f, seoTitle: e.target.value }))}
              className="w-full p-2 bg-ivory border border-mitti/20 text-sm mt-1 mb-3"
            />
            <label className="label text-mitti block">SEO description</label>
            <textarea
              value={form.seoDesc || ''}
              onChange={e => setForm((f: any) => ({ ...f, seoDesc: e.target.value }))}
              rows={2}
              className="w-full p-2 bg-ivory border border-mitti/20 text-sm mt-1"
            />
          </div>
        </div>

        <aside className="space-y-4">
          <div className="bg-beige/30 p-5 sticky top-4">
            <p className="label text-madder mb-3">STATUS</p>
            <div className="space-y-2 mb-4">
              {STATUS_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => setForm((f: any) => ({ ...f, status: s }))}
                  className={`w-full text-left p-2 text-[11px] uppercase tracking-widest transition-colors ${
                    form.status === s ? 'bg-madder text-ivory' : 'bg-ivory text-kohl border border-mitti/30 hover:border-madder'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="text-[10px] italic text-mitti/70">
              DRAFT: hidden. SCHEDULED: countdown shown. LIVE: pieces buyable. CLOSED: closed message.
            </p>

            <div className="border-t border-mitti/15 mt-4 pt-4">
              <label className="label text-mitti block">Starts at</label>
              <input
                type="datetime-local"
                value={form.startsAt || ''}
                onChange={e => setForm((f: any) => ({ ...f, startsAt: e.target.value }))}
                className="w-full p-2 bg-ivory border border-mitti/20 text-sm mt-1 mb-3"
              />
              <label className="label text-mitti block">Ends at (optional)</label>
              <input
                type="datetime-local"
                value={form.endsAt || ''}
                onChange={e => setForm((f: any) => ({ ...f, endsAt: e.target.value }))}
                className="w-full p-2 bg-ivory border border-mitti/20 text-sm mt-1"
              />
            </div>
          </div>
        </aside>
      </div>

      {productPickerOpen && (
        <ProductPickerModal
          existing={form.productIds}
          onClose={() => setProductPickerOpen(false)}
          onPick={(picked) => {
            const merged = [...form.productIds, ...picked.filter(id => !form.productIds.includes(id))];
            setForm((f: any) => ({ ...f, productIds: merged }));
            setProductPickerOpen(false);
            // Optimistically refetch products
            setTimeout(load, 100);
          }}
        />
      )}
    </div>
  );
}

function ProductPickerModal({ existing, onClose, onPick }: { existing: string[]; onClose: () => void; onPick: (ids: string[]) => void }) {
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/admin/products?status=ALL', { credentials: 'include', cache: 'no-store' })
      .then(r => r.json())
      .then(d => setProducts(d.products || []));
  }, []);

  const filtered = products.filter(p =>
    !existing.includes(p.id) &&
    (search === '' || p.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 bg-kohl/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-ivory border border-mitti/30 max-w-2xl w-full p-6 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl text-kohl">Add pieces</h2>
          <button onClick={onClose} className="text-mitti"><X className="w-5 h-5" /></button>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="w-full p-2 bg-beige/30 border border-mitti/20 text-sm mb-4"
        />
        <div className="flex-1 overflow-y-auto space-y-1 mb-4">
          {filtered.map(p => {
            const isSel = selected.has(p.id);
            return (
              <button
                key={p.id}
                onClick={() => {
                  const s = new Set(selected);
                  if (s.has(p.id)) s.delete(p.id); else s.add(p.id);
                  setSelected(s);
                }}
                className={`w-full flex items-center gap-3 p-2 border text-left transition-colors ${
                  isSel ? 'bg-madder/10 border-madder' : 'bg-ivory border-mitti/20 hover:border-madder/40'
                }`}
              >
                {p.images?.[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.images[0]} alt={p.name} className="w-10 h-10 object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-kohl truncate">{p.name}</p>
                  <p className="text-[10px] uppercase tracking-widest text-mitti">{p.status} · {p.fulfilmentMode || 'IN_STOCK'}</p>
                </div>
                {isSel && <span className="text-madder text-xs">✓ Selected</span>}
              </button>
            );
          })}
          {filtered.length === 0 && <p className="text-sm italic text-mitti text-center py-8">No matches.</p>}
        </div>
        <button
          onClick={() => onPick(Array.from(selected))}
          disabled={selected.size === 0}
          className="px-4 py-2 bg-kohl text-ivory text-xs uppercase tracking-widest hover:bg-madder disabled:opacity-40"
        >
          Add {selected.size} piece{selected.size === 1 ? '' : 's'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Master "DRAFT WHOLE DROP" button — one click fills title + subtitle +
// description + founder note in a single OpenAI call (~5 s, ~$0.01).
function DraftDropWithAI({ form, setForm }: { form: any; setForm: (f: any) => void }) {
  const [running, setRunning] = useState(false);
  const run = async () => {
    setRunning(true);
    try {
      // 1. dropAnnouncement → title + subtitle + body
      const a = await fetch('/api/ai/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          field: 'dropAnnouncement',
          name: form.title || 'a NEEJEE drop',
          releaseDate: form.startsAt || null,
          notes: form.notes || null,
        }),
      });
      const ja = await a.json();
      if (!a.ok) { alert(ja.error || 'AI failed'); return; }
      const drop = ja.json || {};

      // 2. cmsFounderNote → founder note
      const b = await fetch('/api/ai/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          field: 'cmsFounderNote',
          campaign: drop.title || form.title || 'a NEEJEE drop',
        }),
      });
      const jb = await b.json();
      const founderText = jb?.text || '';

      setForm((f: any) => ({ ...f,
        title:       drop.title    ?? f.title,
        subtitle:    drop.subtitle ?? f.subtitle,
        description: drop.body     ?? f.description,
        founderNote: founderText   || f.founderNote,
      }));
    } catch (e: any) {
      alert(e?.message || 'AI failed');
    } finally {
      setRunning(false);
    }
  };
  return (
    <button type="button" onClick={run} disabled={running}
      className="inline-flex items-center gap-1.5 text-xs font-ui tracking-widest text-madder hover:text-kohl border border-madder/40 hover:bg-madder/10 px-2.5 py-1 rounded transition-colors disabled:opacity-50">
      {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
      {running ? 'DRAFTING…' : 'DRAFT WHOLE DROP WITH AI'}
    </button>
  );
}
