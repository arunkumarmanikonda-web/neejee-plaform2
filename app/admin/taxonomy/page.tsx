'use client';
// v23.40.26.0 — Taxonomy admin tree
// Three-level hierarchical UI with toggle on/off, rename, drag-reorder, add new.
import { useEffect, useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, Plus, Eye, EyeOff, Pencil, Save, X, Trash2, Sparkles } from 'lucide-react';

type Cat = {
  id: string; slug: string; name: string; parentId: string | null;
  level: number; path: string | null; active: boolean; hidden: boolean;
  featured: boolean; gender: string | null; aiGenerated: boolean; order: number;
  _count: { products: number; children: number };
};

export default function TaxonomyAdminPage() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [adding, setAdding] = useState<string | null>(null); // parent id, or 'ROOT'
  const [addName, setAddName] = useState('');
  const [addGender, setAddGender] = useState<string>('');
  const [msg, setMsg] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/admin/taxonomy', { cache: 'no-store' });
    const d = await r.json();
    if (d.ok) setCats(d.categories);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => {
    const n = new Set(expanded);
    if (n.has(id)) n.delete(id); else n.add(id);
    setExpanded(n);
  };

  const patch = async (id: string, body: any) => {
    const r = await fetch(`/api/admin/taxonomy?id=${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (d.ok) { setMsg('Updated'); load(); }
    else setMsg(`Error: ${d.error}`);
    setTimeout(() => setMsg(''), 3000);
  };

  const create = async () => {
    if (!addName.trim()) return;
    const r = await fetch('/api/admin/taxonomy', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: addName.trim(),
        parentId: adding === 'ROOT' ? null : adding,
        gender: addGender || undefined,
      }),
    });
    const d = await r.json();
    if (d.ok) {
      setMsg(`Created: ${d.category.name}`);
      setAddName(''); setAdding(null); setAddGender('');
      load();
    } else setMsg(`Error: ${d.error}`);
    setTimeout(() => setMsg(''), 3000);
  };

  const del = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}? (Soft-delete if it has products/children, hard-delete otherwise.)`)) return;
    const r = await fetch(`/api/admin/taxonomy?id=${id}`, { method: 'DELETE' });
    const d = await r.json();
    if (d.ok) { setMsg(`Deleted (${d.deleted})`); load(); }
    else setMsg(`Error: ${d.error}`);
    setTimeout(() => setMsg(''), 3000);
  };

  const tree = buildTree(cats);

  if (loading) return <div className="p-8">Loading taxonomy…</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-kohl">Taxonomy</h1>
          <p className="text-sm text-mitti mt-1">
            {cats.length} categories · {cats.filter(c => c.level === 1).length} main · {cats.filter(c => c.level === 2).length} sub · {cats.filter(c => c.level === 3).length} leaf
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/admin/taxonomy/migrate"
            className="bg-madder text-ivory px-4 py-2 rounded-sm flex items-center gap-2 hover:bg-madder/90 text-xs tracking-widest"
          >
            <Sparkles className="w-4 h-4" /> AI MIGRATE PRODUCTS
          </a>
          <button onClick={() => { setAdding('ROOT'); setAddName(''); setAddGender(''); }}
            className="bg-kohl text-ivory px-4 py-2 rounded-sm flex items-center gap-2 hover:bg-kohl/90">
            <Plus className="w-4 h-4" /> Add main category
          </button>
        </div>
      </div>

      {msg && (
        <div className="mb-4 px-3 py-2 bg-beige text-sm text-kohl border-l-2 border-madder">{msg}</div>
      )}

      {adding === 'ROOT' && (
        <AddForm
          name={addName} setName={setAddName}
          gender={addGender} setGender={setAddGender}
          onCreate={create} onCancel={() => setAdding(null)}
          showGender={false}
        />
      )}

      <ul className="space-y-1">
        {tree.map(node => (
          <TreeNode
            key={node.id} node={node}
            depth={0}
            expanded={expanded} onToggle={toggle}
            editing={editing} setEditing={setEditing}
            editName={editName} setEditName={setEditName}
            adding={adding} setAdding={setAdding}
            addName={addName} setAddName={setAddName}
            addGender={addGender} setAddGender={setAddGender}
            onPatch={patch} onCreate={create} onDelete={del}
          />
        ))}
      </ul>
    </div>
  );
}

function buildTree(cats: Cat[]): (Cat & { children: any[] })[] {
  const byId: Record<string, any> = {};
  cats.forEach(c => { byId[c.id] = { ...c, children: [] }; });
  const roots: any[] = [];
  cats.forEach(c => {
    if (c.parentId && byId[c.parentId]) byId[c.parentId].children.push(byId[c.id]);
    else roots.push(byId[c.id]);
  });
  return roots;
}

function TreeNode(props: any): JSX.Element {
  const { node, depth, expanded, onToggle, editing, setEditing, editName, setEditName,
    adding, setAdding, addName, setAddName, addGender, setAddGender, onPatch, onCreate, onDelete } = props;
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const isEditing = editing === node.id;
  const isAddingHere = adding === node.id;
  const canAddChild = node.level < 3;
  const isAccessoriesBranch = node.path?.startsWith('accessories') || node.slug === 'accessories';

  return (
    <li>
      <div
        className={`flex items-center gap-2 py-2 px-2 rounded-sm hover:bg-beige/50 ${node.hidden ? 'opacity-50' : ''} ${!node.active ? 'line-through opacity-40' : ''}`}
        style={{ paddingLeft: `${depth * 24 + 8}px` }}
      >
        {hasChildren ? (
          <button onClick={() => onToggle(node.id)} className="text-mitti hover:text-kohl">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : (
          <span className="w-4" />
        )}

        <span className={`px-1.5 py-0.5 text-[10px] tracking-widest rounded-sm ${
          node.level === 1 ? 'bg-madder text-ivory' :
          node.level === 2 ? 'bg-kohl/20 text-kohl' : 'bg-beige text-mitti'
        }`}>L{node.level}</span>

        {isEditing ? (
          <>
            <input value={editName} onChange={e => setEditName(e.target.value)}
              className="flex-1 px-2 py-1 border border-kohl/20 text-sm" autoFocus />
            <button onClick={() => { onPatch(node.id, { name: editName }); setEditing(null); }}
              className="text-madder hover:text-kohl"><Save className="w-4 h-4" /></button>
            <button onClick={() => setEditing(null)} className="text-mitti hover:text-kohl">
              <X className="w-4 h-4" /></button>
          </>
        ) : (
          <>
            <span className="flex-1 font-body text-kohl">{node.name}</span>
            {node.gender && (
              <span className="text-[10px] tracking-widest text-mitti uppercase">{node.gender}</span>
            )}
            <span className="text-xs text-mitti">{node._count.products} products</span>
            {node.aiGenerated && <Sparkles className="w-3 h-3 text-banarasi" />}
            <button onClick={() => onPatch(node.id, { hidden: !node.hidden })}
              title={node.hidden ? 'Unhide' : 'Hide'}
              className="text-mitti hover:text-kohl">
              {node.hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button onClick={() => { setEditing(node.id); setEditName(node.name); }}
              className="text-mitti hover:text-kohl"><Pencil className="w-4 h-4" /></button>
            {canAddChild && (
              <button onClick={() => { setAdding(node.id); setAddName(''); setAddGender(''); }}
                title="Add subcategory" className="text-mitti hover:text-kohl">
                <Plus className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => onDelete(node.id, node.name)}
              className="text-mitti hover:text-madder"><Trash2 className="w-4 h-4" /></button>
          </>
        )}
      </div>

      {isAddingHere && (
        <div style={{ paddingLeft: `${(depth + 1) * 24 + 8}px` }}>
          <AddForm
            name={addName} setName={setAddName}
            gender={addGender} setGender={setAddGender}
            onCreate={onCreate} onCancel={() => setAdding(null)}
            showGender={isAccessoriesBranch}
          />
        </div>
      )}

      {hasChildren && isExpanded && (
        <ul>{node.children.map((c: any) => (
          <TreeNode key={c.id} {...props} node={c} depth={depth + 1} />
        ))}</ul>
      )}
    </li>
  );
}

function AddForm({ name, setName, gender, setGender, onCreate, onCancel, showGender }: any) {
  return (
    <div className="flex items-center gap-2 my-2 p-2 bg-beige/50 border-l-2 border-madder">
      <input value={name} onChange={e => setName(e.target.value)}
        placeholder="Category name…"
        className="flex-1 px-2 py-1 border border-kohl/20 text-sm bg-ivory" autoFocus
        onKeyDown={e => { if (e.key === 'Enter') onCreate(); if (e.key === 'Escape') onCancel(); }}
      />
      {showGender && (
        <select value={gender} onChange={e => setGender(e.target.value)}
          className="px-2 py-1 border border-kohl/20 text-sm bg-ivory">
          <option value="">— gender —</option>
          <option value="women">Women</option>
          <option value="men">Men</option>
          <option value="unisex">Unisex</option>
        </select>
      )}
      <button onClick={onCreate} className="bg-kohl text-ivory px-3 py-1 text-sm">Add</button>
      <button onClick={onCancel} className="text-mitti px-2 py-1 text-sm">Cancel</button>
    </div>
  );
}
