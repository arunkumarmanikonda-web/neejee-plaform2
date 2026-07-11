'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Save,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
  Upload,
  ImageIcon,
  Plus,
  Trash2,
  Wand2,
  FilePenLine,
} from 'lucide-react';

interface StoryImageInput {
  url: string;
  caption: string;
  alt: string;
}

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
  status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'PUBLISHED' | string;
  reviewerNote: string | null;
  reviewedAt: string | null;
  publishedPageId: string | null;
  createdAt: string;
  storyImages?: StoryImageInput[] | null;
}

interface DraftForm {
  title: string;
  excerpt: string;
  body: string;
  coverImage: string;
  coverImagePrompt: string;
  tags: string;
  storyImages: StoryImageInput[];
}

function emptyStoryImage(): StoryImageInput {
  return { url: '', caption: '', alt: '' };
}

function sanitizeStoryImages(items: StoryImageInput[]): StoryImageInput[] {
  return items
    .map((item) => ({
      url: String(item.url || '').trim(),
      caption: String(item.caption || '').trim(),
      alt: String(item.alt || '').trim(),
    }))
    .filter((item) => item.url);
}

function toForm(draft: Draft): DraftForm {
  return {
    title: draft.title || '',
    excerpt: draft.excerpt || '',
    body: draft.body || '',
    coverImage: draft.coverImage || '',
    coverImagePrompt: draft.coverImagePrompt || '',
    tags: (draft.tags || []).join(', '),
    storyImages:
      Array.isArray(draft.storyImages) && draft.storyImages.length > 0
        ? draft.storyImages.map((item) => ({
            url: String(item.url || ''),
            caption: String(item.caption || ''),
            alt: String(item.alt || ''),
          }))
        : [emptyStoryImage()],
  };
}

export default function JournalDraftEditor() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [draft, setDraft] = useState<Draft | null>(null);
  const [form, setForm] = useState<DraftForm>({
    title: '',
    excerpt: '',
    body: '',
    coverImage: '',
    coverImagePrompt: '',
    tags: '',
    storyImages: [emptyStoryImage()],
  });

  const [textPrompt, setTextPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingText, setGeneratingText] = useState(false);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingStoryIndex, setUploadingStoryIndex] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [rejectNote, setRejectNote] = useState('');

  const readonly = draft?.status === 'PUBLISHED' || draft?.status === 'REJECTED';

  const cleanedStoryImages = useMemo(
    () => sanitizeStoryImages(form.storyImages),
    [form.storyImages]
  );

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/journal/drafts/${id}`, {
          credentials: 'include',
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Load failed');
        }

        const nextDraft = data.draft as Draft;
        setDraft(nextDraft);
        setForm(toForm(nextDraft));
      } catch (e: any) {
        setError(e.message || 'Load failed');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  function updateStoryImage(
    index: number,
    key: keyof StoryImageInput,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      storyImages: current.storyImages.map((item, i) =>
        i === index ? { ...item, [key]: value } : item
      ),
    }));
  }

  function addStoryImage() {
    setForm((current) => ({
      ...current,
      storyImages: [...current.storyImages, emptyStoryImage()],
    }));
  }

  function removeStoryImage(index: number) {
    setForm((current) => {
      const next = current.storyImages.filter((_, i) => i !== index);
      return {
        ...current,
        storyImages: next.length > 0 ? next : [emptyStoryImage()],
      };
    });
  }

  async function uploadImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'journal');

    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Upload failed');
    }

    const url = data?.files?.[0]?.url;
    if (!url) {
      throw new Error('Upload returned no URL');
    }

    return url;
  }

  async function onCoverUpload(file: File | null) {
    if (!file || readonly) return;

    setUploadingCover(true);
    setError('');
    setInfo('');

    try {
      const url = await uploadImage(file);
      setForm((current) => ({ ...current, coverImage: url }));
      setInfo('Cover image uploaded.');
    } catch (e: any) {
      setError(e.message || 'Upload failed');
    } finally {
      setUploadingCover(false);
    }
  }

  async function onStoryUpload(index: number, file: File | null) {
    if (!file || readonly) return;

    setUploadingStoryIndex(index);
    setError('');
    setInfo('');

    try {
      const url = await uploadImage(file);
      updateStoryImage(index, 'url', url);
      setInfo(`Story image ${index + 1} uploaded.`);
    } catch (e: any) {
      setError(e.message || 'Upload failed');
    } finally {
      setUploadingStoryIndex(null);
    }
  }

  async function persistDraft(showInfo = true) {
    const res = await fetch(`/api/admin/journal/drafts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        title: form.title,
        excerpt: form.excerpt,
        body: form.body,
        coverImage: form.coverImage,
        coverImagePrompt: form.coverImagePrompt,
        tags: String(form.tags || '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        storyImages: cleanedStoryImages,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Save failed');
    }

    const nextDraft = data.draft as Draft;
    setDraft(nextDraft);
    setForm(toForm(nextDraft));

    if (showInfo) {
      setInfo('Saved.');
    }

    return nextDraft;
  }

  async function save() {
    if (readonly) return;

    setSaving(true);
    setError('');
    setInfo('');

    try {
      await persistDraft(true);
    } catch (e: any) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function regenerateText() {
    if (readonly) return;

    setGeneratingText(true);
    setError('');
    setInfo('');

    try {
      const res = await fetch(`/api/admin/journal/drafts/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'regenerate_text',
          textPrompt,
          coverImagePrompt: form.coverImagePrompt,
          storyImages: cleanedStoryImages,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Text regeneration failed');
      }

      const nextDraft = data.draft as Draft;
      setDraft(nextDraft);
      setForm(toForm(nextDraft));
      setInfo('Text regenerated.');
    } catch (e: any) {
      setError(e.message || 'Text regeneration failed');
    } finally {
      setGeneratingText(false);
    }
  }

  async function regenerateCover() {
    if (readonly) return;

    setGeneratingCover(true);
    setError('');
    setInfo('');

    try {
      const res = await fetch(`/api/admin/journal/drafts/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'regenerate_cover',
          coverImagePrompt: form.coverImagePrompt,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Cover regeneration failed');
      }

      const nextDraft = data.draft as Draft;
      setDraft(nextDraft);
      setForm(toForm(nextDraft));
      setInfo('Cover regenerated.');
    } catch (e: any) {
      setError(e.message || 'Cover regeneration failed');
    } finally {
      setGeneratingCover(false);
    }
  }

  async function publish() {
    if (readonly) return;
    if (!confirm('Publish this journal entry now? It will appear on /journal immediately.')) {
      return;
    }

    setSaving(true);
    setError('');
    setInfo('');

    try {
      await persistDraft(false);

      const res = await fetch(`/api/admin/journal/drafts/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'publish' }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Publish failed');
      }

      setInfo(`Published. View at /journal/${data.slug}`);
      setTimeout(() => router.push('/admin/journal'), 1500);
    } catch (e: any) {
      setError(e.message || 'Publish failed');
    } finally {
      setSaving(false);
    }
  }

  async function reject() {
    if (readonly) return;
    if (
      !confirm(
        'Reject this draft? It will move to REJECTED status and remain editable only as history.'
      )
    ) {
      return;
    }

    setSaving(true);
    setError('');
    setInfo('');

    try {
      const res = await fetch(`/api/admin/journal/drafts/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'reject',
          note: rejectNote,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Reject failed');
      }

      setInfo('Rejected.');
      setTimeout(() => router.push('/admin/journal'), 1200);
    } catch (e: any) {
      setError(e.message || 'Reject failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8 italic text-mitti">
        Loading...
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8 text-madder">
        {error || 'Not found'}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <Link
        href="/admin/journal"
        className="text-mitti hover:text-madder inline-flex items-center gap-2 text-sm font-ui mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> ALL DRAFTS
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="label text-madder mb-1">JOURNAL DRAFT · {draft.status}</p>
          <h1 className="font-serif text-2xl text-kohl">{draft.title}</h1>
          <p className="italic text-mitti mt-1">
            Theme: {draft.seedTheme || '—'}
            {draft.seedRef ? ` · ${draft.seedRef}` : ''}
            {` · Created ${new Date(draft.createdAt).toLocaleString()}`}
          </p>
        </div>

        {!readonly && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={save}
              disabled={saving || generatingText || generatingCover}
              className="border border-kohl text-kohl px-4 py-2 font-ui text-xs tracking-widest hover:bg-kohl hover:text-ivory disabled:opacity-50 inline-flex items-center gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              SAVE
            </button>

            <button
              onClick={publish}
              disabled={saving || generatingText || generatingCover}
              className="bg-madder text-ivory px-4 py-2 font-ui text-xs tracking-widest hover:bg-kohl disabled:opacity-50 inline-flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              APPROVE & PUBLISH
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="border border-madder bg-madder/10 text-madder p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {info && (
        <div className="border border-emerald-500 bg-emerald-50 text-emerald-700 p-3 mb-4 text-sm">
          {info}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div>
            <label className="label text-mitti">TITLE</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              disabled={readonly}
              className="w-full p-2 bg-ivory border border-mitti/20 font-serif text-lg"
            />
          </div>

          <div>
            <label className="label text-mitti">EXCERPT</label>
            <textarea
              value={form.excerpt}
              onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
              disabled={readonly}
              rows={3}
              className="w-full p-2 bg-ivory border border-mitti/20 italic"
            />
          </div>

          <div>
            <label className="label text-mitti">TEXT PROMPT</label>
            <textarea
              value={textPrompt}
              onChange={(e) => setTextPrompt(e.target.value)}
              disabled={readonly || generatingText}
              rows={4}
              placeholder="Guide the rewrite: change tone, angle, product focus, founder note, sequencing..."
              className="w-full p-2 bg-ivory border border-mitti/20 text-sm"
            />
            {!readonly && (
              <button
                onClick={regenerateText}
                disabled={generatingText || saving || generatingCover}
                className="mt-2 border border-kohl text-kohl px-4 py-2 font-ui text-xs tracking-widest hover:bg-kohl hover:text-ivory disabled:opacity-50 inline-flex items-center gap-2"
              >
                {generatingText ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FilePenLine className="w-4 h-4" />
                )}
                GENERATE TEXT
              </button>
            )}
          </div>

          <div>
            <label className="label text-mitti">BODY</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              disabled={readonly}
              rows={20}
              className="w-full p-2 bg-ivory border border-mitti/20 font-serif leading-relaxed"
            />
            <p className="text-[11px] text-mitti mt-1">
              Paragraphs are separated by blank lines. Keep one natural mention of Nidhi.
            </p>
          </div>

          <div>
            <label className="label text-mitti">TAGS (comma-separated)</label>
            <input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              disabled={readonly}
              className="w-full p-2 bg-ivory border border-mitti/20"
            />
          </div>

          <div className="border border-mitti/20 bg-ivory p-4 space-y-4">
            <div className="flex items-center justify-between">
              <label className="label text-madder">STORY IMAGES</label>
              {!readonly && (
                <button
                  type="button"
                  onClick={addStoryImage}
                  className="text-xs font-ui text-madder hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> ADD IMAGE
                </button>
              )}
            </div>

            {form.storyImages.map((item, index) => (
              <div key={index} className="border border-mitti/15 bg-beige p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] tracking-widest text-mitti font-ui">
                    IMAGE {index + 1}
                  </p>

                  {!readonly && (
                    <button
                      type="button"
                      onClick={() => removeStoryImage(index)}
                      className="text-xs font-ui text-kohl hover:text-madder inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> REMOVE
                    </button>
                  )}
                </div>

                {item.url ? (
                  <img
                    src={item.url}
                    alt={item.alt || `Story image ${index + 1}`}
                    className="w-full aspect-video object-cover border border-mitti/20"
                  />
                ) : (
                  <div className="w-full aspect-video border border-dashed border-mitti/20 bg-ivory flex items-center justify-center text-mitti text-sm">
                    <ImageIcon className="w-4 h-4 mr-2" />
                    No image yet
                  </div>
                )}

                <input
                  value={item.url}
                  onChange={(e) => updateStoryImage(index, 'url', e.target.value)}
                  disabled={readonly}
                  placeholder="Image URL"
                  className="w-full p-2 bg-ivory border border-mitti/20 text-xs font-mono"
                />

                <input
                  value={item.caption}
                  onChange={(e) => updateStoryImage(index, 'caption', e.target.value)}
                  disabled={readonly}
                  placeholder="Caption"
                  className="w-full p-2 bg-ivory border border-mitti/20 text-sm"
                />

                <input
                  value={item.alt}
                  onChange={(e) => updateStoryImage(index, 'alt', e.target.value)}
                  disabled={readonly}
                  placeholder="Alt text"
                  className="w-full p-2 bg-ivory border border-mitti/20 text-sm"
                />

                {!readonly && (
                  <label className="inline-flex items-center gap-2 text-xs text-madder cursor-pointer">
                    <Upload className="w-4 h-4" />
                    {uploadingStoryIndex === index ? 'Uploading...' : 'Upload image'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => onStoryUpload(index, e.target.files?.[0] || null)}
                    />
                  </label>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="border border-mitti/20 bg-ivory p-4">
            <label className="label text-mitti">COVER IMAGE URL</label>

            {form.coverImage ? (
              <img
                src={form.coverImage}
                alt="cover"
                className="w-full aspect-video object-cover border border-mitti/20 mb-2"
              />
            ) : (
              <div className="aspect-video bg-beige flex items-center justify-center text-mitti italic mb-2">
                no cover yet
              </div>
            )}

            <input
              value={form.coverImage}
              onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
              disabled={readonly}
              className="w-full p-2 bg-ivory border border-mitti/20 text-xs font-mono"
              placeholder="https://..."
            />

            {!readonly && (
              <label className="mt-2 inline-flex items-center gap-2 text-xs text-madder cursor-pointer">
                <Upload className="w-4 h-4" />
                {uploadingCover ? 'Uploading...' : 'Upload cover image'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onCoverUpload(e.target.files?.[0] || null)}
                />
              </label>
            )}
          </div>

          <div className="border border-mitti/20 bg-ivory p-4">
            <label className="label text-mitti">COVER IMAGE PROMPT</label>
            <textarea
              value={form.coverImagePrompt}
              onChange={(e) =>
                setForm({ ...form, coverImagePrompt: e.target.value })
              }
              disabled={readonly}
              rows={5}
              placeholder="Direct art direction for the cover image"
              className="w-full p-2 bg-ivory border border-mitti/20 text-sm"
            />

            {!readonly && (
              <button
                onClick={regenerateCover}
                disabled={generatingCover || saving || generatingText}
                className="mt-2 border border-kohl text-kohl px-4 py-2 font-ui text-xs tracking-widest hover:bg-kohl hover:text-ivory disabled:opacity-50 inline-flex items-center gap-2"
              >
                {generatingCover ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4" />
                )}
                GENERATE COVER
              </button>
            )}
          </div>

          {!readonly && (
            <div className="border border-mitti/20 p-4 bg-beige">
              <p className="label text-madder mb-2">REJECT THIS DRAFT</p>
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={3}
                placeholder="Optional note (wrong tone, factual error, off-brand, etc.)"
                className="w-full p-2 bg-ivory border border-mitti/20 text-sm mb-2"
              />
              <button
                onClick={reject}
                disabled={saving}
                className="w-full bg-kohl text-ivory px-4 py-2 font-ui text-xs tracking-widest hover:bg-madder disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                <XCircle className="w-4 h-4" /> REJECT
              </button>
            </div>
          )}

          {draft.publishedPageId && (
            <div className="border border-emerald-500 bg-emerald-50 p-3 text-sm text-emerald-700">
              Published as CmsPage{' '}
              <span className="font-mono text-[11px]">{draft.publishedPageId}</span>
            </div>
          )}

          {draft.reviewerNote && (
            <div className="border border-mitti/20 bg-beige p-3 text-sm text-kohl">
              <p className="label text-mitti mb-1">REVIEWER NOTE</p>
              <p className="italic">{draft.reviewerNote}</p>
            </div>
          )}

          {draft.reviewedAt && (
            <div className="border border-mitti/20 bg-ivory p-3 text-sm text-mitti">
              Reviewed {new Date(draft.reviewedAt).toLocaleString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
