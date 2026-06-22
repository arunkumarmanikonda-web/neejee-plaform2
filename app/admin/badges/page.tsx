'use client';
import { useEffect, useState } from 'react';
import { AiDraftButton } from '@/components/admin/AiDraftButton';
import { Plus, Trash2, X, Sparkles, Loader2, RefreshCw, Power } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface BadgeRow {
  id?: string;
  key: string;
  label: string;
  description: string;
  group: 'editorial' | 'craft' | 'trust';
  imageUrl?: string | null;
  active?: boolean;
  sortOrder?: number;
}

const GROUPS: { key: BadgeRow['group']; label: string }[] = [
  { key: 'editorial', label: 'Editorial' },
  { key: 'craft', label: 'Craft' },
  { key: 'trust', label: 'Trust' },
];

export default function AdminBadgesPage() {
  const [badges, setBadges] = useState<BadgeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<BadgeRow | null>(null);
  const [generating, setGenerating] = useState<string | null>(null); // badge id
  const [error, setError] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);

  const load = () => {
    setLoading(true);
    fetch('/api/admin/badges', { credentials: 'include', cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.badges) setBadges(d.badges);
        // If any badge has an id, the DB has been seeded
        setSeeded((d.badges || []).some((b: BadgeRow) => !!b.id));
      })
      .catch(() => setError('Failed to load badges'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const seed = async () => {
    setSeeding(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/badges/seed', {
        method: 'POST',
        credentials: 'include',
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || 'Seed failed');
      } else {
        load();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSeeding(false);
    }
  };

  const save = async (b: BadgeRow) => {
    setError(null);
    try {
      const isNew = !b.id;
      const url = isNew ? '/api/admin/badges' : `/api/admin/badges/${b.id}`;
      const method = isNew ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(b),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || 'Save failed');
        return;
      }
      setEditing(null);
      setCreating(false);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const remove = async (b: BadgeRow) => {
    if (!b.id) return;
    if (!confirm(`Delete "${b.label}"? This removes the badge from all products that use it. This cannot be undone.`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/badges/${b.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || 'Delete failed');
        return;
      }
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const toggleActive = async (b: BadgeRow) => {
    if (!b.id) return;
    await fetch(`/api/admin/badges/${b.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !b.active }),
    });
    load();
  };

  const generateSeal = async (b: BadgeRow) => {
    if (!b.id) return;
    setGenerating(b.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/badges/${b.id}/generate-seal`, {
        method: 'POST',
        credentials: 'include',
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || 'Seal generation failed');
        return;
      }
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-kohl mb-1">Seals &amp; Badges</h1>
          <p className="text-mitti text-sm">
            Vintage thappa-seal taxonomy. Each badge can be added to products from the product editor.
            Generate AI seal artwork in NEEJEE&apos;s madder-on-ivory letterpress style.
          </p>
        </div>
        <div className="flex gap-2">
          {!seeded && badges.length > 0 && (
            <button
              onClick={seed}
              disabled={seeding}
              className="px-3 py-2 border border-mitti/30 text-mitti text-xs uppercase tracking-wider hover:bg-mitti/10 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Seed Defaults to DB
            </button>
          )}
          <button
            onClick={() => setCreating(true)}
            className="px-4 py-2 bg-kohl text-ivory text-xs uppercase tracking-wider hover:bg-madder inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Badge
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-madder/10 border border-madder text-madder text-sm">
          {error}
        </div>
      )}

      {!seeded && badges.length > 0 && (
        <div className="mb-6 p-4 bg-haldi/20 border border-haldi text-kohl text-sm">
          <strong>Showing default catalog (in-memory).</strong> Click <em>Seed Defaults to DB</em> above to save
          these eight badges to the database so you can edit, delete, or generate seal artwork for them.
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-mitti">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {badges.map(b => (
            <div
              key={b.key}
              className={`p-4 border ${b.active === false ? 'border-mitti/20 opacity-50' : 'border-mitti/30'} bg-ivory`}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-20 h-20 flex-shrink-0 bg-beige/30 flex items-center justify-center">
                  {b.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.imageUrl} alt={b.label} className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-16 h-16 rounded-full border-2 border-madder/70 flex items-center justify-center text-center p-1">
                      <span className="font-display text-[8px] tracking-wider uppercase text-madder leading-tight">
                        {b.label}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-kohl text-lg leading-tight">{b.label}</div>
                  <div className="text-[10px] uppercase tracking-wider text-mitti mt-0.5">
                    {b.group} · {b.key}
                  </div>
                  <p className="text-xs text-mitti mt-2 line-clamp-3">{b.description}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-3 border-t border-mitti/15">
                <button
                  onClick={() => generateSeal(b)}
                  disabled={!b.id || generating === b.id}
                  className="flex-1 px-2 py-1.5 bg-madder text-ivory text-[10px] uppercase tracking-wider hover:opacity-90 disabled:opacity-40 inline-flex items-center justify-center gap-1"
                  title={!b.id ? 'Seed defaults first' : 'Generate AI seal'}
                >
                  {generating === b.id ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Generating…</>
                  ) : (
                    <><Sparkles className="w-3 h-3" /> {b.imageUrl ? 'Regenerate' : 'Generate Seal'}</>
                  )}
                </button>
                <button
                  onClick={() => setEditing(b)}
                  disabled={!b.id}
                  className="px-2 py-1.5 border border-mitti/30 text-mitti text-[10px] uppercase tracking-wider hover:bg-mitti/10 disabled:opacity-40"
                >
                  Edit
                </button>
                <button
                  onClick={() => toggleActive(b)}
                  disabled={!b.id}
                  className="px-2 py-1.5 border border-mitti/30 text-mitti text-[10px] uppercase tracking-wider hover:bg-mitti/10 disabled:opacity-40 inline-flex items-center gap-1"
                  title={b.active === false ? 'Activate' : 'Deactivate'}
                >
                  <Power className="w-3 h-3" /> {b.active === false ? 'On' : 'Off'}
                </button>
                <button
                  onClick={() => remove(b)}
                  disabled={!b.id}
                  className="px-2 py-1.5 border border-madder/30 text-madder text-[10px] uppercase tracking-wider hover:bg-madder/10 disabled:opacity-40"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <BadgeEditor
          initial={editing || { key: '', label: '', description: '', group: 'editorial', active: true }}
          isNew={creating}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSave={save}
        />
      )}
    </div>
  );
}

function BadgeEditor({
  initial,
  isNew,
  onClose,
  onSave,
}: {
  initial: BadgeRow;
  isNew: boolean;
  onClose: () => void;
  onSave: (b: BadgeRow) => void;
}) {
  const [form, setForm] = useState<BadgeRow>(initial);

  return (
    <div className="fixed inset-0 bg-kohl/60 z-50 flex items-center justify-center p-4">
      <div className="bg-ivory border border-mitti/30 max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl text-kohl">
            {isNew ? 'New Badge' : 'Edit Badge'}
          </h2>
          <button onClick={onClose} className="text-mitti hover:text-kohl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex justify-end">
            <AiDraftButton
              field="badge"
              onApply={(d) => setForm({
                ...form,
                label:       d.label       ?? form.label,
                description: d.description ?? form.description,
                group:       (d.group as BadgeRow['group']) ?? form.group,
              })}
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-mitti">Label *</label>
            <input
              type="text"
              value={form.label}
              onChange={e => setForm({ ...form, label: e.target.value })}
              placeholder="Founder’s Edit"
              className="w-full p-2 bg-ivory border border-mitti/20 text-sm mt-1"
              maxLength={40}
            />
            <p className="text-[10px] text-mitti/70 mt-1">
              Appears on the seal. Max 28 characters render cleanly.
            </p>
          </div>

          {isNew && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-mitti">Key (auto)</label>
              <input
                type="text"
                value={form.key}
                onChange={e => setForm({ ...form, key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_') })}
                placeholder="FOUNDERS_EDIT (auto-generated from label)"
                className="w-full p-2 bg-ivory border border-mitti/20 text-sm mt-1 font-mono"
                maxLength={60}
              />
              <p className="text-[10px] text-mitti/70 mt-1">
                Internal slug. Leave blank to auto-generate from label.
              </p>
            </div>
          )}

          <div>
            <label className="text-[10px] uppercase tracking-wider text-mitti">Description *</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Personally chosen by Nidhi for this season’s edit."
              rows={3}
              className="w-full p-2 bg-ivory border border-mitti/20 text-sm mt-1"
              maxLength={200}
            />
            <p className="text-[10px] text-mitti/70 mt-1">
              Shown as a tooltip on the seal.
            </p>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-mitti">Group</label>
            <select
              value={form.group}
              onChange={e => setForm({ ...form, group: e.target.value as BadgeRow['group'] })}
              className="w-full p-2 bg-ivory border border-mitti/20 text-sm mt-1"
            >
              {GROUPS.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-mitti">Sort order</label>
            <input
              type="number"
              value={form.sortOrder ?? 999}
              onChange={e => setForm({ ...form, sortOrder: parseInt(e.target.value) || 999 })}
              className="w-full p-2 bg-ivory border border-mitti/20 text-sm mt-1"
            />
          </div>

          <label className="flex items-center gap-2 text-sm font-ui">
            <input
              type="checkbox"
              checked={form.active !== false}
              onChange={e => setForm({ ...form, active: e.target.checked })}
            />
            Active (visible to admins and on products)
          </label>
        </div>

        <div className="flex gap-2 mt-6 pt-4 border-t border-mitti/15">
          <button
            onClick={() => onSave(form)}
            disabled={!form.label.trim() || !form.description.trim()}
            className="flex-1 px-4 py-2 bg-kohl text-ivory text-xs uppercase tracking-wider hover:bg-madder disabled:opacity-40"
          >
            {isNew ? 'Create badge' : 'Save changes'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-mitti/30 text-mitti text-xs uppercase tracking-wider hover:bg-mitti/10"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
