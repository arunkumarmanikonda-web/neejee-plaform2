'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Loader2,
  FileText,
  CheckCircle2,
  Eye,
  Plus,
  Trash2,
  ImageIcon,
  Upload,
  Wand2,
  FilePenLine,
} from 'lucide-react';

interface StoryImageInput {
  url: string;
  caption: string;
  alt: string;
}

interface DraftRow {
  id: string;
  title: string;
  excerpt: string | null;
  coverImage: string | null;
  coverImagePrompt?: string | null;
  tags: string[];
  seedTheme: string | null;
  seedRef: string | null;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'PUBLISHED';
  createdByCron: boolean;
  createdAt: string;
  reviewedAt: string | null;
  publishedPageId: string | null;
  storyImages?: StoryImageInput[] | null;
}

const THEMES = [
  '',
  'artisan-spotlight',
  'craft-technique',
  'product-spotlight',
  'regional-dispatch',
  'material-meditation',
  'founder-letter',
];

const STATUS_COLOURS: Record<DraftRow['status'], string> = {
  DRAFT: 'bg-mitti/10 text-mitti',
  PENDING_REVIEW: 'bg-madder/15 text-madder',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-stone-200 text-stone-700',
  PUBLISHED: 'bg-kohl text-ivory',
};

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

function splitTags(value: string): string[] {
  return String(value || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

export default function AdminJournalPage() {
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [theme, setTheme] = useState('');
  const [textPrompt, setTextPrompt] = useState('');
  const [coverImagePrompt, setCoverImagePrompt] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');

  const [storyImages, setStoryImages] = useState<StoryImageInput[]>([
    emptyStoryImage(),
  ]);

  const [manualTitle, setManualTitle] = useState('');
  const [manualExcerpt, setManualExcerpt] = useState('');
  const [manualBody, setManualBody] = useState('');
  const [manualTags, setManualTags] = useState('');

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const cleanedStoryImages = useMemo(
    () => sanitizeStoryImages(storyImages),
    [storyImages]
  );

  async function load() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/journal/drafts', {
        credentials: 'include',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load');
      }

      setDrafts(data.drafts || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function updateStoryImage(
    index: number,
    key: keyof StoryImageInput,
    value: string
  ) {
    setStoryImages((current) =>
      current.map((item, i) => (i === index ? { ...item, [key]: value } : item))
    );
  }

  function addStoryImage() {
    setStoryImages((current) => [...current, emptyStoryImage()]);
  }

  function removeStoryImage(index: number) {
    setStoryImages((current) => {
      const next = current.filter((_, i) => i !== index);
      return next.length > 0 ? next : [emptyStoryImage()];
    });
  }

  async function uploadImage(file: File): Promise<string> {
    const form = new FormData();
    form.append('file', file);
    form.append('folder', 'journal');

    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      credentials: 'include',
      body: form,
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
    if (!file) return;

    setBusy(true);
    setError('');
    setInfo('');

    try {
      const url = await uploadImage(file);
      setCoverImageUrl(url);
      setInfo('Cover image uploaded.');
    } catch (e: any) {
      setError(e.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function onStoryUpload(index: number, file: File | null) {
    if (!file) return;

    setBusy(true);
    setError('');
    setInfo('');

    try {
      const url = await uploadImage(file);
      updateStoryImage(index, 'url', url);
      setInfo(`Story image ${index + 1} uploaded.`);
    } catch (e: any) {
      setError(e.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function generateTextOnly() {
    setBusy(true);
    setError('');
    setInfo('');

    try {
      const res = await fetch('/api/admin/journal/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          theme: theme || undefined,
          textPrompt,
          coverImagePrompt,
          storyImages: cleanedStoryImages,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Text generation failed');
      }

      const result = data.result || {};

      setManualTitle(String(result.title || ''));
      setManualExcerpt(String(result.excerpt || ''));
      setManualBody(String(result.body || ''));
      setManualTags(Array.isArray(result.tags) ? result.tags.join(', ') : '');
      setCoverImagePrompt(String(result.coverImagePrompt || coverImagePrompt || ''));
      setInfo('Generated text loaded into manual fields.');
    } catch (e: any) {
      setError(e.message || 'Text generation failed');
    } finally {
      setBusy(false);
    }
  }

  async function generateCoverOnly() {
    setBusy(true);
    setError('');
    setInfo('');

    try {
      const prompt = coverImagePrompt.trim();
      if (!prompt) {
        throw new Error('Enter a cover image prompt first.');
      }

      const res = await fetch('/api/admin/journal/generate-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Cover generation failed');
      }

      setCoverImageUrl(String(data.imageUrl || ''));
      setInfo('Cover image generated.');
    } catch (e: any) {
      setError(e.message || 'Cover generation failed');
    } finally {
      setBusy(false);
    }
  }

  async function createDraft() {
    setBusy(true);
    setError('');
    setInfo('');

    try {
      const res = await fetch('/api/admin/journal/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          theme: theme || undefined,
          textPrompt,
          coverImagePrompt,
          coverImageUrl: coverImageUrl.trim() || undefined,
          storyImages: cleanedStoryImages,
          manualTitle: manualTitle.trim() || undefined,
          manualExcerpt: manualExcerpt.trim() || undefined,
          manualBody: manualBody.trim() || undefined,
          manualTags: splitTags(manualTags),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Draft creation failed');
      }

      setInfo(
        `✓ Draft created: "${data.draft.title}". Email sent to ${data.email?.sent ?? 0} reviewer(s).`
      );

      await load();
    } catch (e: any) {
      setError(e.message || 'Draft creation failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="grid xl:grid-cols-[1.25fr_1fr] gap-6 mb-6">
        <div>
          <p className="label text-madder mb-1">CONTENT · WEEKLY JOURNAL</p>
          <h1 className="font-serif text-3xl text-kohl">
            The Journal · editorial generation
          </h1>
          <p className="italic text-mitti mt-1">
            Auto-generate, prompt-guide, upload images, type manually, then review
            before publish.
          </p>
        </div>

        <div className="border border-mitti/20 bg-ivory p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="label text-madder">CREATE OR GUIDE A DRAFT</p>
            <p className="text-[11px] text-mitti">text + image + manual</p>
          </div>

          <div>
            <label className="label text-mitti">THEME</label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              disabled={busy}
              className="w-full border border-mitti/30 bg-ivory p-2 text-sm font-ui"
            >
              {THEMES.map((t) => (
                <option key={t} value={t}>
                  {t || '(auto-pick theme)'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label text-mitti">TEXT PROMPT</label>
            <textarea
              value={textPrompt}
              onChange={(e) => setTextPrompt(e.target.value)}
              rows={4}
              disabled={busy}
              placeholder="Optional editorial direction for tone, angle, product focus, founder note, sequencing..."
              className="w-full p-2 bg-ivory border border-mitti/20 text-sm"
            />
          </div>

          <div>
            <label className="label text-mitti">COVER IMAGE PROMPT</label>
            <textarea
              value={coverImagePrompt}
              onChange={(e) => setCoverImagePrompt(e.target.value)}
              rows={3}
              disabled={busy}
              placeholder="Optional direct art direction for the cover image"
              className="w-full p-2 bg-ivory border border-mitti/20 text-sm"
            />
          </div>

          <div>
            <label className="label text-mitti">MANUAL COVER IMAGE URL</label>

            {coverImageUrl ? (
              <img
                src={coverImageUrl}
                alt="cover preview"
                className="w-full aspect-video object-cover border border-mitti/20 mb-2"
              />
            ) : (
              <div className="w-full aspect-video border border-dashed border-mitti/20 bg-beige flex items-center justify-center text-mitti text-sm mb-2">
                No cover yet
              </div>
            )}

            <input
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              disabled={busy}
              placeholder="https://..."
              className="w-full p-2 bg-ivory border border-mitti/20 text-xs font-mono"
            />

            <label className="mt-2 inline-flex items-center gap-2 text-xs text-madder cursor-pointer">
              <Upload className="w-4 h-4" />
              Upload cover image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onCoverUpload(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="label text-mitti">STORY IMAGES</label>
              <button
                type="button"
                onClick={addStoryImage}
                disabled={busy}
                className="text-xs font-ui text-madder hover:underline inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> ADD IMAGE
              </button>
            </div>

            {storyImages.map((item, index) => (
              <div
                key={index}
                className="border border-mitti/15 bg-beige p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[11px] tracking-widest text-mitti font-ui">
                    IMAGE {index + 1}
                  </p>

                  <button
                    type="button"
                    onClick={() => removeStoryImage(index)}
                    disabled={busy}
                    className="text-xs font-ui text-kohl hover:text-madder inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> REMOVE
                  </button>
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
                  disabled={busy}
                  placeholder="Image URL"
                  className="w-full p-2 bg-ivory border border-mitti/20 text-xs font-mono"
                />

                <input
                  value={item.caption}
                  onChange={(e) =>
                    updateStoryImage(index, 'caption', e.target.value)
                  }
                  disabled={busy}
                  placeholder="Caption"
                  className="w-full p-2 bg-ivory border border-mitti/20 text-sm"
                />

                <input
                  value={item.alt}
                  onChange={(e) => updateStoryImage(index, 'alt', e.target.value)}
                  disabled={busy}
                  placeholder="Alt text"
                  className="w-full p-2 bg-ivory border border-mitti/20 text-sm"
                />

                <label className="inline-flex items-center gap-2 text-xs text-madder cursor-pointer">
                  <Upload className="w-4 h-4" />
                  Upload image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onStoryUpload(index, e.target.files?.[0] || null)}
                  />
                </label>
              </div>
            ))}
          </div>

          <div className="border-t border-mitti/15 pt-4 space-y-3">
            <p className="label text-madder">MANUAL TEXT OVERRIDE</p>

            <input
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              disabled={busy}
              placeholder="Title"
              className="w-full p-2 bg-ivory border border-mitti/20 font-serif"
            />

            <textarea
              value={manualExcerpt}
              onChange={(e) => setManualExcerpt(e.target.value)}
              disabled={busy}
              rows={3}
              placeholder="Excerpt"
              className="w-full p-2 bg-ivory border border-mitti/20 italic"
            />

            <textarea
              value={manualBody}
              onChange={(e) => setManualBody(e.target.value)}
              disabled={busy}
              rows={10}
              placeholder="Body — type manually here, or click Generate Text first and edit the result"
              className="w-full p-2 bg-ivory border border-mitti/20 font-serif leading-relaxed"
            />

            <input
              value={manualTags}
              onChange={(e) => setManualTags(e.target.value)}
              disabled={busy}
              placeholder="tags, comma, separated"
              className="w-full p-2 bg-ivory border border-mitti/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={generateTextOnly}
              disabled={busy}
              className="border border-kohl text-kohl px-4 py-3 font-ui text-xs tracking-widest hover:bg-kohl hover:text-ivory disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FilePenLine className="w-4 h-4" />
              )}
              GENERATE TEXT
            </button>

            <button
              onClick={generateCoverOnly}
              disabled={busy}
              className="border border-kohl text-kohl px-4 py-3 font-ui text-xs tracking-widest hover:bg-kohl hover:text-ivory disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4" />
              )}
              GENERATE COVER
            </button>
          </div>

          <button
            onClick={createDraft}
            disabled={busy}
            className="w-full bg-madder text-ivory px-5 py-3 font-ui text-xs tracking-widest hover:bg-kohl transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            CREATE DRAFT
          </button>
        </div>
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

      {loading ? (
        <p className="text-mitti italic">Loading drafts...</p>
      ) : drafts.length === 0 ? (
        <div className="border border-mitti/20 bg-beige p-8 text-center">
          <FileText className="w-10 h-10 text-mitti mx-auto mb-3" />
          <p className="text-kohl">No drafts yet. Create the first one above.</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {drafts.map((d) => (
            <div key={d.id} className="border border-mitti/20 bg-ivory">
              <div className="flex gap-4 p-4">
                {d.coverImage ? (
                  <img
                    src={d.coverImage}
                    alt=""
                    className="w-32 h-32 object-cover flex-shrink-0 border border-mitti/10"
                  />
                ) : (
                  <div className="w-32 h-32 bg-beige flex-shrink-0 flex items-center justify-center text-mitti italic text-xs">
                    no cover
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-ui tracking-widest ${STATUS_COLOURS[d.status]}`}
                    >
                      {d.status}
                    </span>

                    {d.createdByCron && (
                      <span className="text-[10px] text-mitti font-ui tracking-widest">
                        CRON
                      </span>
                    )}

                    {d.seedTheme && (
                      <span className="text-[10px] text-mitti font-ui">
                        · {d.seedTheme}
                      </span>
                    )}

                    {Array.isArray(d.storyImages) && d.storyImages.length > 0 && (
                      <span className="text-[10px] text-mitti font-ui">
                        · {d.storyImages.length} story image
                        {d.storyImages.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>

                  <h3 className="font-serif text-lg text-kohl truncate">{d.title}</h3>

                  {d.excerpt && (
                    <p className="text-sm text-mitti mt-1 line-clamp-2">{d.excerpt}</p>
                  )}

                  <p className="text-[11px] text-mitti mt-2">
                    Created {new Date(d.createdAt).toLocaleDateString()}
                    {d.reviewedAt &&
                      ` · Reviewed ${new Date(d.reviewedAt).toLocaleDateString()}`}
                  </p>

                  <div className="flex gap-2 mt-3">
                    <Link
                      href={`/admin/journal/${d.id}`}
                      className="text-xs font-ui text-madder hover:underline inline-flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" /> OPEN
                    </Link>

                    {d.publishedPageId && (
                      <a
                        href="/journal"
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-ui text-kohl hover:underline inline-flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" /> VIEW LIVE
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
