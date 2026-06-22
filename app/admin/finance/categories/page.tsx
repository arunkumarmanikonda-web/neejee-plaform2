'use client';
import { useEffect, useState } from 'react';
import { Loader2, Check, X, Plus } from 'lucide-react';
import { formatINR } from '@/lib/money';

type Category = {
  id: string;
  code: string;
  label: string;
  group: string;
  approvalThresholdPaise: number | null;
  isMarketingChannel: boolean;
  gstInputClaimable: boolean;
  isActive: boolean;
};

const GROUPS = [
  { v: 'COGS_DIRECT',       l: 'COGS' },
  { v: 'OPEX_MARKETING',    l: 'Marketing' },
  { v: 'OPEX_COMMUNICATION',l: 'Communication' },
  { v: 'OPEX_SHIPPING',     l: 'Shipping' },
  { v: 'OPEX_PAYMENT',      l: 'Payment' },
  { v: 'OPEX_PLATFORM',     l: 'Platform & SaaS' },
  { v: 'OPEX_PEOPLE',       l: 'People' },
  { v: 'OPEX_OFFICE',       l: 'Office' },
  { v: 'OPEX_PROFESSIONAL', l: 'Professional' },
  { v: 'OPEX_TAX_OTHER',    l: 'Tax / Other' },
  { v: 'OPEX_OTHER',        l: 'Misc' },
  { v: 'WRITE_OFF',         l: 'Write-offs' },
];

export default function CategoriesPage() {
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string>('');
  const [editVal, setEditVal] = useState<string>('');
  // v23.39.1: inline create form
  const [showNew, setShowNew] = useState(false);
  const [newCat, setNewCat] = useState({ code: '', label: '', group: 'OPEX_OTHER', approvalThresholdRupees: '', gstInputClaimable: true });
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState('');

  const createCategory = async () => {
    setCreateErr(''); setCreating(true);
    try {
      // Auto-uppercase + snake_case for code
      const code = newCat.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_').replace(/_+/g, '_');
      if (!code || !newCat.label.trim()) throw new Error('Code and label are required');
      const r = await fetch('/api/admin/finance/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          label: newCat.label.trim(),
          group: newCat.group,
          approvalThresholdPaise:
            newCat.approvalThresholdRupees === '' ? null :
            newCat.approvalThresholdRupees === '0' ? 0 :
            Math.round(parseFloat(newCat.approvalThresholdRupees) * 100),
          gstInputClaimable: newCat.gstInputClaimable,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Create failed');
      setNewCat({ code: '', label: '', group: 'OPEX_OTHER', approvalThresholdRupees: '', gstInputClaimable: true });
      setShowNew(false);
      await load();
    } catch (e: any) {
      setCreateErr(e.message);
    } finally {
      setCreating(false);
    }
  };

  const load = async () => {
    setLoading(true);
    const r = await fetch('/api/admin/finance/categories');
    const j = await r.json();
    setCats(j.categories || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const seed = async () => {
    if (!confirm('Seed default chart of accounts? Existing categories are skipped.')) return;
    const r = await fetch('/api/admin/finance/seed-categories', { method: 'POST' });
    const j = await r.json();
    alert(j.message || 'Done');
    load();
  };

  const saveThreshold = async (id: string) => {
    const v = editVal.trim();
    const paise = v === '' ? null : v === '0' ? 0 : Math.round(parseFloat(v) * 100);
    const r = await fetch(`/api/admin/finance/categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvalThresholdPaise: paise }),
    });
    if (r.ok) { setEditing(''); load(); }
  };

  const toggle = async (id: string, field: 'isActive' | 'isMarketingChannel' | 'gstInputClaimable', curr: boolean) => {
    const r = await fetch(`/api/admin/finance/categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: !curr }),
    });
    if (r.ok) load();
  };

  // Group by group
  const groups: Record<string, Category[]> = {};
  for (const c of cats) {
    if (!groups[c.group]) groups[c.group] = [];
    groups[c.group].push(c);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-display text-2xl text-kohl">Chart of accounts</h2>
          <p className="text-mitti text-sm">
            {cats.length} categories · threshold controls maker-checker queue
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowNew(s => !s)} className="flex items-center gap-1 bg-madder text-ivory px-4 py-2 font-ui text-xs tracking-widest">
            <Plus className="w-3 h-3" /> NEW CATEGORY
          </button>
          <button onClick={seed} className="bg-kohl text-ivory px-4 py-2 font-ui text-xs tracking-widest">
            {cats.length === 0 ? 'SEED DEFAULTS' : 'RE-SEED MISSING'}
          </button>
        </div>
      </div>

      {showNew && (
        <div className="bg-beige p-5 border border-madder/20">
          <h3 className="font-display text-lg text-kohl mb-3">Add new category</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="label text-banarasi mb-1">CODE (uppercase, no spaces)</p>
              <input value={newCat.code} onChange={e => setNewCat({ ...newCat, code: e.target.value })}
                placeholder="e.g. MKT_INFLUENCER_NEW"
                className="w-full border border-mitti/30 px-3 py-2 font-mono text-sm bg-ivory" />
            </div>
            <div>
              <p className="label text-banarasi mb-1">LABEL</p>
              <input value={newCat.label} onChange={e => setNewCat({ ...newCat, label: e.target.value })}
                placeholder="e.g. Influencer marketing — micro"
                className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory" />
            </div>
            <div>
              <p className="label text-banarasi mb-1">GROUP</p>
              <select value={newCat.group} onChange={e => setNewCat({ ...newCat, group: e.target.value })}
                className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory">
                {GROUPS.map(g => <option key={g.v} value={g.v}>{g.l}</option>)}
              </select>
            </div>
            <div>
              <p className="label text-banarasi mb-1">APPROVAL THRESHOLD (₹ — blank = always auto, 0 = always approve)</p>
              <input value={newCat.approvalThresholdRupees} onChange={e => setNewCat({ ...newCat, approvalThresholdRupees: e.target.value })}
                placeholder="e.g. 10000" type="number"
                className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory" />
            </div>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input type="checkbox" checked={newCat.gstInputClaimable} onChange={e => setNewCat({ ...newCat, gstInputClaimable: e.target.checked })} />
              <span>GST input credit can be claimed on this category</span>
            </label>
          </div>
          {createErr && <p className="text-madder text-xs mt-3">{createErr}</p>}
          <div className="flex gap-2 mt-4">
            <button onClick={createCategory} disabled={creating}
              className="bg-kohl text-ivory px-5 py-2 font-ui text-xs tracking-widest disabled:opacity-50">
              {creating ? 'CREATING…' : 'CREATE'}
            </button>
            <button onClick={() => { setShowNew(false); setCreateErr(''); }}
              className="px-5 py-2 border border-mitti/30 text-mitti font-ui text-xs tracking-widest">
              CANCEL
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-mitti py-12 text-center"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>
      ) : (
        <div className="space-y-6">
          {GROUPS.filter(g => groups[g.v]?.length).map(g => (
            <div key={g.v} className="bg-ivory border border-mitti/20 rounded overflow-hidden">
              <div className="bg-beige/50 px-4 py-2">
                <p className="font-display text-lg text-kohl">{g.l}</p>
                <p className="text-xs text-mitti">{groups[g.v].length} categories</p>
              </div>
              <table className="w-full font-ui text-sm">
                <thead className="text-mitti text-xs label">
                  <tr className="border-b border-mitti/10">
                    <th className="text-left p-2 pl-4">LABEL</th>
                    <th className="text-left p-2">CODE</th>
                    <th className="text-right p-2">APPROVAL THRESHOLD</th>
                    <th className="text-center p-2">MKT CH?</th>
                    <th className="text-center p-2">GST CLAIMABLE?</th>
                    <th className="text-center p-2">ACTIVE</th>
                  </tr>
                </thead>
                <tbody>
                  {groups[g.v].map(c => (
                    <tr key={c.id} className="border-b border-mitti/5">
                      <td className="p-2 pl-4 text-kohl">{c.label}</td>
                      <td className="p-2 text-xs text-mitti/60 font-mono">{c.code}</td>
                      <td className="p-2 text-right">
                        {editing === c.id ? (
                          <div className="flex gap-1 justify-end">
                            <input value={editVal} onChange={e => setEditVal(e.target.value)}
                              placeholder="null/0/amount"
                              className="border border-mitti/30 px-2 py-1 text-xs w-32 text-right" />
                            <button onClick={() => saveThreshold(c.id)}
                              className="px-2 bg-emerald-600 text-white"><Check className="w-3 h-3" /></button>
                            <button onClick={() => setEditing('')}
                              className="px-2 bg-mitti/20"><X className="w-3 h-3" /></button>
                          </div>
                        ) : (
                          <button onClick={() => {
                            setEditing(c.id);
                            setEditVal(c.approvalThresholdPaise === null ? '' : String(c.approvalThresholdPaise / 100));
                          }}
                            className="text-mitti hover:text-kohl text-xs">
                            {c.approvalThresholdPaise === null ? (
                              <span title="No approval needed">auto-approve</span>
                            ) : c.approvalThresholdPaise === 0 ? (
                              <span className="text-banarasi" title="Always pending">always pending</span>
                            ) : (
                              <span>≤ {formatINR(c.approvalThresholdPaise)}</span>
                            )}
                          </button>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        <button onClick={() => toggle(c.id, 'isMarketingChannel', c.isMarketingChannel)}
                          className={`px-2 py-0.5 rounded text-xs ${c.isMarketingChannel ? 'bg-banarasi/20 text-banarasi' : 'text-mitti/40'}`}>
                          {c.isMarketingChannel ? 'YES' : '—'}
                        </button>
                      </td>
                      <td className="p-2 text-center">
                        <button onClick={() => toggle(c.id, 'gstInputClaimable', c.gstInputClaimable)}
                          className={`px-2 py-0.5 rounded text-xs ${c.gstInputClaimable ? 'bg-emerald-100 text-emerald-800' : 'text-mitti/40'}`}>
                          {c.gstInputClaimable ? 'YES' : 'NO'}
                        </button>
                      </td>
                      <td className="p-2 text-center">
                        <button onClick={() => toggle(c.id, 'isActive', c.isActive)}
                          className={`px-2 py-0.5 rounded text-xs ${c.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-mitti/10 text-mitti'}`}>
                          {c.isActive ? 'ACTIVE' : 'ARCHIVED'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      <div className="bg-beige/30 p-4 text-xs text-mitti rounded">
        <strong>Threshold logic:</strong> <code>auto-approve</code> = no approval needed. <code>always pending</code> = every entry needs a checker. <code>≤ ₹X</code> = entries up to ₹X auto-approve, above goes to PENDING.
      </div>
    </div>
  );
}
