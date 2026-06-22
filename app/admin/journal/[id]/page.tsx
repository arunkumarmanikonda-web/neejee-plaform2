'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Save, CheckCircle2, XCircle, Loader2, ArrowLeft } from 'lucide-react';

interface Draft {
  id: string;
  title: string;
  excerpt: string | null;
  body: string;
  coverImage: string | null;
  coverImagePrompt: string | null;
  tags: string[];
  seedTheme: string | null;
  seedRef: string | null;
  status: string;
  reviewerNote: string | null;
  reviewedAt: string | null;
  publishedPageId: string | null;
  createdAt: string;
}

export default function JournalDraftEditor() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [form, setForm] = useState<any>({});
  const [rejectNote, setRejectNote] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/journal/drafts/${id}`, { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Load failed');
        setDraft(data.draft);
        setForm({
          title: data.draft.title || '',
          excerpt: data.draft.excerpt || '',
          body: data.draft.body || '',
          coverImage: data.draft.coverImage || '',
          tags: (data.draft.tags || []).join(', '),
        });
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function save() {
    setSaving(true);
    setError('');
    setInfo('');
    try {
      const res = await fetch(`/api/admin/journal/drafts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: form.title,
          excerpt: form.excerpt,
          body: form.body,
          coverImage: form.coverImage,
          tags: String(form.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setDraft(data.draft);
      setInfo('Saved.');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!confirm('Publish this journal entry now? It will appear on /journal immediately.')) return;
    setSaving(true);
    setError('');
    try {
      // Save edits first
      await save();
      const res = await fetch(`/api/admin/journal/drafts/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'publish' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Publish failed');
      setInfo(`Published. View at /journal/${data.slug}`);
      setTimeout(() => router.push('/admin/journal'), 1500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function reject() {
    if (!confirm('Reject this draft? It will be moved to REJECTED status. A new draft will be created next Monday.')) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/journal/drafts/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'reject', note: rejectNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reject failed');
      setInfo('Rejected.');
      setTimeout(() => router.push('/admin/journal'), 1200);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="max-w-5xl mx-auto px-6 py-8 italic text-mitti">Loading...</div>;
  if (!draft) return <div className="max-w-5xl mx-auto px-6 py-8 text-madder">{error || 'Not found'}</div>;

  const readonly = draft.status === 'PUBLISHED' || draft.status === 'REJECTED';

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <Link href="/admin/journal" className="text-mitti hover:text-madder inline-flex items-center gap-2 text-sm font-ui mb-4">
        <ArrowLeft className="w-4 h-4" /> ALL DRAFTS
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="label text-madder mb-1">JOURNAL DRAFT · {draft.status}</p>
          <h1 className="font-serif text-2xl text-kohl">{draft.title}</h1>
          <p className="font-italic italic text-mitti mt-1">
            Theme: {draft.seedTheme || '—'}{draft.seedRef ? ` · ${draft.seedRef}` : ''} · Created {new Date(draft.createdAt).toLocaleString()}
          </p>
        </div>
        {!readonly && (
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="border border-kohl text-kohl px-4 py-2 font-ui text-xs tracking-widest hover:bg-kohl hover:text-ivory disabled:opacity-50 inline-flex items-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} SAVE
            </button>
            <button onClick={publish} disabled={saving} className="bg-madder text-ivory px-4 py-2 font-ui text-xs tracking-widest hover:bg-kohl disabled:opacity-50 inline-flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> APPROVE &amp; PUBLISH
            </button>
          </div>
        )}
      </div>

      {error && <div className="border border-madder bg-madder/10 text-madder p-3 mb-4 font-ui text-sm">{error}</div>}
      {info && <div className="border border-emerald-500 bg-emerald-50 text-emerald-700 p-3 mb-4 font-ui text-sm">{info}</div>}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div>
            <label className="label text-mitti">TITLE</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} disabled={readonly}
              className="w-full p-2 bg-ivory border border-mitti/20 font-serif text-lg" />
          </div>
          <div>
            <label className="label text-mitti">EXCERPT</label>
            <textarea value={form.excerpt} onChange={e => setForm({ ...form, excerpt: e.target.value })} disabled={readonly}
              rows={3} className="w-full p-2 bg-ivory border border-mitti/20 italic" />
          </div>
          <div>
            <label className="label text-mitti">BODY</label>
            <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} disabled={readonly}
              rows={20} className="w-full p-2 bg-ivory border border-mitti/20 font-serif leading-relaxed" />
            <p className="text-[11px] text-mitti mt-1">Paragraphs are separated by blank lines. Remember to mention Nidhi.</p>
          </div>
          <div>
            <label className="label text-mitti">TAGS (comma-separated)</label>
            <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} disabled={readonly}
              className="w-full p-2 bg-ivory border border-mitti/20" />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label text-mitti">COVER IMAGE URL</label>
            {form.coverImage ? (
              <img src={form.coverImage} alt="cover" className="w-full border border-mitti/20 mb-2" />
            ) : (
              <div className="aspect-video bg-beige flex items-center justify-center text-mitti italic mb-2">no cover yet</div>
            )}
            <input value={form.coverImage} onChange={e => setForm({ ...form, coverImage: e.target.value })} disabled={readonly}
              className="w-full p-2 bg-ivory border border-mitti/20 text-xs font-mono" />
            {draft.coverImagePrompt && (
              <details className="mt-2 text-xs text-mitti">
                <summary className="cursor-pointer hover:text-kohl">Cover image prompt</summary>
                <pre className="whitespace-pre-wrap mt-1 p-2 bg-beige border border-mitti/10">{draft.coverImagePrompt}</pre>
              </details>
            )}
          </div>

          {!readonly && (
            <div className="border border-mitti/20 p-4 bg-beige">
              <p className="label text-madder mb-2">REJECT THIS DRAFT</p>
              <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={3}
                placeholder="Optional note (e.g. wrong tone, factual error)" className="w-full p-2 bg-ivory border border-mitti/20 text-sm mb-2" />
              <button onClick={reject} disabled={saving}
                className="w-full bg-kohl text-ivory px-4 py-2 font-ui text-xs tracking-widest hover:bg-madder disabled:opacity-50 inline-flex items-center justify-center gap-2">
                <XCircle className="w-4 h-4" /> REJECT
              </button>
            </div>
          )}

          {draft.publishedPageId && (
            <div className="border border-emerald-500 bg-emerald-50 p-3 text-sm text-emerald-700">
              ✓ Published as CmsPage <span className="font-mono text-[11px]">{draft.publishedPageId}</span>
            </div>
          )}
          {draft.reviewerNote && (
            <div className="border border-mitti/20 bg-beige p-3 text-sm text-kohl">
              <p className="label text-mitti mb-1">REVIEWER NOTE</p>
              <p className="italic">{draft.reviewerNote}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
