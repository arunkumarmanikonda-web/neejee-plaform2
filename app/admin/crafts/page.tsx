'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, X, Save, Loader2 } from 'lucide-react';
import AiAssistField from '@/components/admin/AiAssistField';

interface Craft {
  id: string;
  slug: string;
  name: string;
  region?: string | null;
  state?: string | null;
  description?: string | null;
  longStory?: string | null;
  image?: string | null;
  thumbnail?: string | null;
  seoTitle?: string | null;
  seoDesc?: string | null;
  featured: boolean;
  active: boolean;
  order: number;
  productCount?: number;
}

export default function AdminCraftsPage() {
  const [crafts, setCrafts] = useState<Craft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Craft | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/crafts', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Load failed');
      setCrafts(data.crafts || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function createCraft(payload: any) {
    const res = await fetch('/api/admin/crafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Create failed'); return; }
    setCreating(false);
    await load();
  }

  async function updateCraft(id: string, patch: any) {
    const res = await fetch(`/api/admin/crafts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Update failed'); return; }
    await load();
  }

  async function deleteCraft(id: string) {
    if (!confirm('Delete this craft? Products that reference its name will keep their string value.')) return;
    const res = await fetch(`/api/admin/crafts/${id}`, { method: 'DELETE', credentials: 'include' });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Delete failed'); return; }
    await load();
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="label text-madder">CATALOG · TAXONOMY</p>
          <h1 className="font-display text-3xl text-kohl">Crafts</h1>
          <p className="font-italic italic text-mitti mt-1">
            The curated list of craft traditions on NEEJEE. Each craft gets its own landing page at <span className="font-mono">/crafts/[slug]</span>.
            Products link to a craft via the <strong>craft</strong> field on the product (matched by name).
          </p>
        </div>
        <button onClick={() => setCreating(true)} className="bg-madder text-ivory px-4 py-2 font-ui text-xs tracking-widest hover:bg-kohl inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> NEW CRAFT
        </button>
      </div>

      {error && <div className="border border-madder bg-madder/10 text-madder p-3 mb-4 font-ui text-sm">{error}</div>}

      {loading ? <p className="italic text-mitti">Loading…</p> : (
        <div className="grid lg:grid-cols-2 gap-4">
          {crafts.length === 0 && (
            <div className="col-span-2 border border-mitti/20 bg-beige p-8 text-center text-mitti">
              No crafts yet. After running the migration, your existing product crafts are auto-imported as inactive rows — turn them ACTIVE and add details.
            </div>
          )}
          {crafts.map(c => (
            <div key={c.id} className={`border ${c.active ? 'border-mitti/20' : 'border-stone-300 opacity-70'} bg-ivory p-3 flex gap-3`}>
              {c.thumbnail || c.image ? (
                <img src={c.thumbnail || c.image || ''} alt="" className="w-20 h-20 object-cover border border-mitti/15 flex-shrink-0" />
              ) : (
                <div className="w-20 h-20 bg-beige flex-shrink-0 flex items-center justify-center text-mitti text-[10px] italic">no img</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-display text-kohl truncate">{c.name}</p>
                  {c.featured && <span className="bg-madder/15 text-madder text-[10px] font-ui tracking-widest px-2 py-0.5">FEATURED</span>}
                  {!c.active && <span className="bg-stone-300 text-stone-700 text-[10px] font-ui tracking-widest px-2 py-0.5">INACTIVE</span>}
                </div>
                <p className="text-[11px] text-mitti font-mono">/crafts/{c.slug}</p>
                {(c.region || c.state) && <p className="text-xs text-mitti mt-1">{[c.region, c.state].filter(Boolean).join(', ')}</p>}
                {c.description && <p className="text-xs text-mitti mt-1 line-clamp-2">{c.description}</p>}
                <p className="text-[11px] text-mitti mt-1">{c.productCount ?? 0} product(s) linked</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <label className="text-[10px] font-ui inline-flex items-center gap-1">
                  <input type="checkbox" checked={c.featured} onChange={e => updateCraft(c.id, { featured: e.target.checked })} /> FEATURED
                </label>
                <label className="text-[10px] font-ui inline-flex items-center gap-1">
                  <input type="checkbox" checked={c.active} onChange={e => updateCraft(c.id, { active: e.target.checked })} /> ACTIVE
                </label>
                <div className="flex gap-1 mt-1">
                  <button onClick={() => setEditing(c)} className="text-xs font-ui px-2 py-1 border border-kohl/40 text-kohl hover:bg-kohl hover:text-ivory tracking-widest">EDIT</button>
                  <button onClick={() => deleteCraft(c.id)} className="text-monsoon hover:text-madder p-1" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <CraftFormModal
          initial={editing || undefined}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSave={async (payload) => {
            if (editing) await updateCraft(editing.id, payload);
            else await createCraft(payload);
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
function CraftFormModal({ initial, onClose, onSave }: { initial?: Craft; onClose: () => void; onSave: (p: any) => Promise<void> }) {
  const [v, setV] = useState<any>({
    name: initial?.name || '',
    slug: initial?.slug || '',
    region: initial?.region || '',
    state: initial?.state || '',
    description: initial?.description || '',
    longStory: initial?.longStory || '',
    image: initial?.image || '',
    thumbnail: initial?.thumbnail || '',
    seoTitle: initial?.seoTitle || '',
    seoDesc: initial?.seoDesc || '',
    order: initial?.order ?? 0,
    active: initial?.active !== false,
    featured: !!initial?.featured,
  });
  const [saving, setSaving] = useState(false);
  const isNew = !initial;

  const submit = async () => {
    setSaving(true);
    try {
      await onSave({ ...v, order: parseInt(v.order) || 0 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-kohl/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-ivory border border-mitti/30 max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl text-kohl">{isNew ? 'New craft' : 'Edit craft'}</h2>
          <button onClick={onClose} className="text-mitti hover:text-kohl"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-mitti">Name *</label>
              <input value={v.name} onChange={e => setV({ ...v, name: e.target.value })}
                placeholder="e.g. Banarasi" className="w-full p-2 bg-ivory border border-mitti/20 mt-1" />
            </div>
            <div>
              <label className="label text-mitti">Slug (auto if blank)</label>
              <input value={v.slug} onChange={e => setV({ ...v, slug: e.target.value })}
                className="w-full p-2 bg-ivory border border-mitti/20 mt-1 font-mono text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-mitti">Region</label>
              <input value={v.region} onChange={e => setV({ ...v, region: e.target.value })}
                placeholder="e.g. Varanasi" className="w-full p-2 bg-ivory border border-mitti/20 mt-1" />
            </div>
            <div>
              <label className="label text-mitti">State</label>
              <input value={v.state} onChange={e => setV({ ...v, state: e.target.value })}
                placeholder="e.g. Uttar Pradesh" className="w-full p-2 bg-ivory border border-mitti/20 mt-1" />
            </div>
          </div>

          <AiAssistField
            label="Short description"
            field="categoryShortDescription"
            value={v.description || ''}
            onChange={text => setV({ ...v, description: text })}
            brief={{ name: v.name, craft: v.name, region: v.region }}
            buttonLabel="DRAFT SHORT"
            multiline rows={2}
            inputClassName="w-full p-2 bg-ivory border border-mitti/20 text-sm"
          />

          <AiAssistField
            label="Long story (shown on /crafts/[slug])"
            field="categoryIntro"
            value={v.longStory || ''}
            onChange={text => setV({ ...v, longStory: text })}
            brief={{ name: v.name, craft: v.name, region: v.region, state: v.state }}
            buttonLabel="DRAFT STORY"
            multiline rows={6}
            inputClassName="w-full p-2 bg-ivory border border-mitti/20 text-sm"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-mitti">Hero image URL</label>
              <input value={v.image} onChange={e => setV({ ...v, image: e.target.value })}
                className="w-full p-2 bg-ivory border border-mitti/20 mt-1 text-xs font-mono" />
              {v.image && <img src={v.image} alt="" className="mt-2 w-full aspect-video object-cover border border-mitti/15" />}
            </div>
            <div>
              <label className="label text-mitti">Thumbnail URL (cards)</label>
              <input value={v.thumbnail} onChange={e => setV({ ...v, thumbnail: e.target.value })}
                className="w-full p-2 bg-ivory border border-mitti/20 mt-1 text-xs font-mono" />
              {v.thumbnail && <img src={v.thumbnail} alt="" className="mt-2 w-24 h-24 object-cover border border-mitti/15" />}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-mitti">SEO title</label>
              <input value={v.seoTitle} onChange={e => setV({ ...v, seoTitle: e.target.value })}
                className="w-full p-2 bg-ivory border border-mitti/20 mt-1" />
            </div>
            <div>
              <label className="label text-mitti">Display order</label>
              <input type="number" value={v.order} onChange={e => setV({ ...v, order: parseInt(e.target.value) || 0 })}
                className="w-full p-2 bg-ivory border border-mitti/20 mt-1" />
            </div>
          </div>
          <AiAssistField
            label="SEO description"
            field="seo"
            value={v.seoDesc || ''}
            onChange={text => setV({ ...v, seoDesc: text })}
            onApplyJson={d => setV((cur: any) => ({ ...cur, seoTitle: d.seoTitle || cur.seoTitle, seoDesc: d.seoDesc || cur.seoDesc }))}
            brief={{ name: v.name, craft: v.name, region: v.region }}
            buttonLabel="DRAFT SEO"
            multiline rows={2}
            inputClassName="w-full p-2 bg-ivory border border-mitti/20 text-sm"
          />

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={v.active} onChange={e => setV({ ...v, active: e.target.checked })} /> Active
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={v.featured} onChange={e => setV({ ...v, featured: e.target.checked })} /> Featured (homepage rail)
            </label>
          </div>
        </div>
        <div className="flex gap-2 mt-5 pt-4 border-t border-mitti/15">
          <button onClick={submit} disabled={saving || !v.name.trim()}
            className="flex-1 bg-kohl text-ivory text-xs tracking-widest px-4 py-2 hover:bg-madder disabled:opacity-40 inline-flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isNew ? 'CREATE CRAFT' : 'SAVE CHANGES'}
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-mitti/30 text-mitti text-xs tracking-widest hover:bg-mitti/10">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
