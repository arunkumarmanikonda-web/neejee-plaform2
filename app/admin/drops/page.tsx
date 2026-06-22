'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, X, Loader2, Eye, ExternalLink, Trash2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Drop {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  startsAt: string;
  endsAt?: string | null;
  productIds: string[];
  status: 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'CLOSED';
  coverImage?: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-mitti/20 text-mitti',
  SCHEDULED: 'bg-haldi/30 text-kohl',
  LIVE: 'bg-madder text-ivory',
  CLOSED: 'bg-kohl/20 text-kohl',
};

export default function AdminDropsPage() {
  const [drops, setDrops] = useState<Drop[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/admin/drops', { credentials: 'include', cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d.drops) setDrops(d.drops); })
      .catch(() => setError('Failed to load drops'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const create = async (form: any) => {
    setError(null);
    try {
      const res = await fetch('/api/admin/drops', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'Failed'); return; }
      setCreating(false);
      load();
    } catch (e: any) { setError(e.message); }
  };

  const remove = async (drop: Drop) => {
    if (!confirm(`Delete the drop "${drop.title}"? This cannot be undone.`)) return;
    await fetch(`/api/admin/drops/${drop.id}`, { method: 'DELETE', credentials: 'include' });
    load();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-kohl mb-1">Drops</h1>
          <p className="text-mitti text-sm">
            Curated micro-collections released at a specific moment. Each drop gets its own
            countdown page at <code>/drops/[slug]</code>.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="px-4 py-2 bg-kohl text-ivory text-xs uppercase tracking-wider hover:bg-madder inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New drop
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-madder/10 border border-madder text-madder text-sm">{error}</div>}

      {loading ? (
        <div className="text-center py-12 text-mitti">Loading…</div>
      ) : drops.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-mitti/30 bg-beige/20">
          <p className="font-display text-xl text-mitti mb-2">No drops yet.</p>
          <p className="text-sm text-mitti/80">Create your first drop above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {drops.map(d => (
            <div key={d.id} className="flex items-center gap-4 p-4 bg-beige/30 border border-mitti/20">
              {d.coverImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.coverImage} alt={d.title} className="w-20 h-20 object-cover" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-display text-xl text-kohl">{d.title}</h2>
                  <span className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-widest ${STATUS_COLOR[d.status]}`}>
                    {d.status}
                  </span>
                </div>
                {d.subtitle && <p className="italic text-sm text-mitti mt-1">{d.subtitle}</p>}
                <p className="text-[11px] text-mitti mt-1">
                  Starts {new Date(d.startsAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                  {' · '}
                  {d.productIds.length} piece{d.productIds.length === 1 ? '' : 's'}
                  {' · '}
                  /drops/{d.slug}
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/admin/drops/${d.id}`}
                  className="px-3 py-1.5 border border-mitti/30 text-mitti text-[10px] uppercase tracking-widest hover:bg-mitti/10"
                >
                  Edit
                </Link>
                <a
                  href={`/drops/${d.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 border border-mitti/30 text-mitti text-[10px] uppercase tracking-widest hover:bg-mitti/10 inline-flex items-center gap-1"
                  title="View live"
                >
                  <ExternalLink className="w-3 h-3" /> View
                </a>
                <button
                  onClick={() => remove(d)}
                  className="px-3 py-1.5 border border-madder/30 text-madder text-[10px] uppercase tracking-widest hover:bg-madder/10"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && <NewDropModal onClose={() => setCreating(false)} onCreate={create} />}
    </div>
  );
}

function NewDropModal({ onClose, onCreate }: { onClose: () => void; onCreate: (f: any) => void }) {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="fixed inset-0 bg-kohl/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-ivory border border-mitti/30 max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl text-kohl">New drop</h2>
          <button onClick={onClose} className="text-mitti hover:text-kohl"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-mitti">Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="The Diwali Edit, Volume 01"
              className="w-full p-2 bg-ivory border border-mitti/20 text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-mitti">Subtitle</label>
            <input
              value={subtitle}
              onChange={e => setSubtitle(e.target.value)}
              placeholder="A small, numbered drop of five pieces"
              className="w-full p-2 bg-ivory border border-mitti/20 text-sm mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-mitti">Starts at *</label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={e => setStartsAt(e.target.value)}
                className="w-full p-2 bg-ivory border border-mitti/20 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-mitti">Ends at</label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={e => setEndsAt(e.target.value)}
                className="w-full p-2 bg-ivory border border-mitti/20 text-sm mt-1"
              />
            </div>
          </div>
          <p className="text-[10px] italic text-mitti/70">
            You can add cover image, founder note, and products after creation in the editor.
          </p>
        </div>

        <div className="flex gap-2 mt-6 pt-4 border-t border-mitti/15">
          <button
            onClick={async () => {
              if (!title || !startsAt) return;
              setSubmitting(true);
              await onCreate({ title, subtitle, startsAt, endsAt: endsAt || undefined });
              setSubmitting(false);
            }}
            disabled={!title || !startsAt || submitting}
            className="flex-1 px-4 py-2 bg-kohl text-ivory text-xs uppercase tracking-wider hover:bg-madder disabled:opacity-40 inline-flex items-center justify-center gap-2"
          >
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : 'Create drop'}
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
