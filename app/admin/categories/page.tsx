'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, X, Save, ChevronRight, Loader2 } from 'lucide-react';
import AiAssistField from '@/components/admin/AiAssistField';

interface Category {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  parent?: { id: string; name: string; slug: string } | null;
  description?: string | null;
  image?: string | null;
  seoTitle?: string | null;
  seoDesc?: string | null;
  order: number;
  active: boolean;
  featured: boolean;
  _count?: { products: number; children: number };
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/categories?rich=1', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Load failed');
      setCategories(data.categories || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function createCategory(payload: any) {
    const res = await fetch('/api/admin/categories', {
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

  async function updateCategory(id: string, patch: any) {
    const res = await fetch(`/api/admin/categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Update failed'); return; }
    await load();
  }

  async function deleteCategory(id: string) {
    if (!confirm('Delete this category? Products must be moved first.')) return;
    const res = await fetch(`/api/admin/categories/${id}`, { method: 'DELETE', credentials: 'include' });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Delete failed'); return; }
    await load();
  }

  // Build a tree: root categories at the top, children nested
  const roots = categories.filter(c => !c.parentId);
  const childrenOf = (parentId: string) => categories.filter(c => c.parentId === parentId);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="label text-madder">CATALOG · TAXONOMY</p>
          <h1 className="font-display text-3xl text-kohl">Categories</h1>
          <p className="font-italic italic text-mitti mt-1">
            Organise the catalogue. Top-level groups → sub-categories. Mark categories featured to show them on the homepage.
          </p>
        </div>
        <button onClick={() => setCreating(true)} className="bg-madder text-ivory px-4 py-2 font-ui text-xs tracking-widest hover:bg-kohl inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> NEW CATEGORY
        </button>
      </div>

      {error && <div className="border border-madder bg-madder/10 text-madder p-3 mb-4 font-ui text-sm">{error}</div>}

      {loading ? <p className="italic text-mitti">Loading…</p> : (
        <div className="space-y-2">
          {roots.length === 0 && (
            <div className="border border-mitti/20 bg-beige p-8 text-center text-mitti">
              No categories yet.
            </div>
          )}
          {roots.map(root => (
            <div key={root.id}>
              <CategoryRow c={root} onEdit={() => setEditing(root)} onUpdate={p => updateCategory(root.id, p)} onDelete={() => deleteCategory(root.id)} depth={0} />
              {childrenOf(root.id).map(child => (
                <CategoryRow key={child.id} c={child} onEdit={() => setEditing(child)} onUpdate={p => updateCategory(child.id, p)} onDelete={() => deleteCategory(child.id)} depth={1} />
              ))}
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <CategoryFormModal
          initial={editing || undefined}
          allCategories={categories}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSave={async (payload) => {
            if (editing) await updateCategory(editing.id, payload);
            else await createCategory(payload);
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
function CategoryRow({ c, onEdit, onUpdate, onDelete, depth }: { c: Category; onEdit: () => void; onUpdate: (p: any) => void; onDelete: () => void; depth: number }) {
  return (
    <div className={`border ${c.active ? 'border-mitti/20' : 'border-stone-300'} bg-ivory p-3 flex items-center gap-3`} style={{ marginLeft: depth * 32 }}>
      {depth > 0 && <ChevronRight className="w-4 h-4 text-mitti/40" />}
      {c.image ? (
        <img src={c.image} alt="" className="w-10 h-10 object-cover border border-mitti/15" />
      ) : (
        <div className="w-10 h-10 bg-beige flex items-center justify-center text-mitti text-[10px] italic">no img</div>
      )}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-display text-kohl">{c.name}</p>
          {c.featured && <span className="bg-madder/15 text-madder text-[10px] font-ui tracking-widest px-2 py-0.5">FEATURED</span>}
          {!c.active && <span className="bg-stone-300 text-stone-700 text-[10px] font-ui tracking-widest px-2 py-0.5">INACTIVE</span>}
        </div>
        <p className="text-[11px] text-mitti font-mono">/{c.slug}</p>
      </div>
      <div className="text-xs text-mitti text-right">
        <p>{c._count?.products ?? 0} products</p>
        {(c._count?.children ?? 0) > 0 && <p>{c._count!.children} sub-categories</p>}
      </div>
      <div className="flex items-center gap-1">
        <label className="text-[10px] font-ui inline-flex items-center gap-1 mr-2">
          <input type="checkbox" checked={c.featured} onChange={e => onUpdate({ featured: e.target.checked })} /> FEATURED
        </label>
        <label className="text-[10px] font-ui inline-flex items-center gap-1 mr-2">
          <input type="checkbox" checked={c.active} onChange={e => onUpdate({ active: e.target.checked })} /> ACTIVE
        </label>
        <button onClick={onEdit} className="text-xs font-ui px-2 py-1 border border-kohl/40 text-kohl hover:bg-kohl hover:text-ivory tracking-widest">EDIT</button>
        <button onClick={onDelete} className="text-monsoon hover:text-madder p-1" title="Delete">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
function CategoryFormModal({ initial, allCategories, onClose, onSave }: {
  initial?: Category;
  allCategories: Category[];
  onClose: () => void;
  onSave: (p: any) => Promise<void>;
}) {
  const [v, setV] = useState<any>({
    name: initial?.name || '',
    slug: initial?.slug || '',
    description: initial?.description || '',
    image: initial?.image || '',
    seoTitle: initial?.seoTitle || '',
    seoDesc: initial?.seoDesc || '',
    order: initial?.order ?? 0,
    active: initial?.active !== false,
    featured: !!initial?.featured,
    parentId: initial?.parentId || '',
  });
  const [saving, setSaving] = useState(false);
  const isNew = !initial;

  const submit = async () => {
    setSaving(true);
    try {
      await onSave({
        ...v,
        order: parseInt(v.order) || 0,
        parentId: v.parentId || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-kohl/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-ivory border border-mitti/30 max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl text-kohl">{isNew ? 'New category' : 'Edit category'}</h2>
          <button onClick={onClose} className="text-mitti hover:text-kohl"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-mitti">Name *</label>
              <input value={v.name} onChange={e => setV({ ...v, name: e.target.value })}
                className="w-full p-2 bg-ivory border border-mitti/20 mt-1" />
            </div>
            <div>
              <label className="label text-mitti">Slug (auto if blank)</label>
              <input value={v.slug} onChange={e => setV({ ...v, slug: e.target.value })}
                className="w-full p-2 bg-ivory border border-mitti/20 mt-1 font-mono text-xs" />
            </div>
          </div>
          <div>
            <label className="label text-mitti">Parent (optional)</label>
            <select value={v.parentId} onChange={e => setV({ ...v, parentId: e.target.value })}
              className="w-full p-2 bg-ivory border border-mitti/20 mt-1">
              <option value="">— None (top-level) —</option>
              {allCategories.filter(c => c.id !== initial?.id && !c.parentId).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <AiAssistField
            label="Short description"
            field="categoryShortDescription"
            value={v.description || ''}
            onChange={text => setV({ ...v, description: text })}
            brief={{ name: v.name, category: v.name }}
            buttonLabel="DRAFT SHORT"
            multiline rows={2}
            inputClassName="w-full p-2 bg-ivory border border-mitti/20 text-sm"
          />

          <div>
            <label className="label text-mitti">Hero image URL</label>
            <input value={v.image} onChange={e => setV({ ...v, image: e.target.value })}
              placeholder="https://… or paste from Asset Library"
              className="w-full p-2 bg-ivory border border-mitti/20 mt-1 text-xs font-mono" />
            {v.image && <img src={v.image} alt="" className="mt-2 w-32 h-32 object-cover border border-mitti/15" />}
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
            field="categoryIntro"
            value={v.seoDesc || ''}
            onChange={text => setV({ ...v, seoDesc: text })}
            brief={{ name: v.name, category: v.name }}
            buttonLabel="DRAFT SEO"
            multiline rows={2}
            inputClassName="w-full p-2 bg-ivory border border-mitti/20 text-sm"
          />

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={v.active} onChange={e => setV({ ...v, active: e.target.checked })} /> Active
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={v.featured} onChange={e => setV({ ...v, featured: e.target.checked })} /> Featured (show on homepage)
            </label>
          </div>
        </div>
        <div className="flex gap-2 mt-5 pt-4 border-t border-mitti/15">
          <button onClick={submit} disabled={saving || !v.name.trim()}
            className="flex-1 bg-kohl text-ivory text-xs tracking-widest px-4 py-2 hover:bg-madder disabled:opacity-40 inline-flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isNew ? 'CREATE CATEGORY' : 'SAVE CHANGES'}
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-mitti/30 text-mitti text-xs tracking-widest hover:bg-mitti/10">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
