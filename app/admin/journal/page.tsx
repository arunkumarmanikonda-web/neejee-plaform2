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

export default function AdminJournalPage() {
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [theme, setTheme] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [storyImages, setStoryImages] = useState<StoryImageInput[]>([
    emptyStoryImage(),
  ]);
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
      const res = await fetch('/api/admin/journal/drafts', { credentials: 'include' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load');
      }

      setDrafts(data.drafts || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function updateStoryImage(index: number, key: keyof StoryImageInput, value: string) {
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

  async function generateNow() {
    setGenerating(true);
    setError('');
    setInfo('');

    try {
      const payload: any = {};

      if (theme) payload.theme = theme;
      if (coverImageUrl.trim()) payload.coverImageUrl = coverImageUrl.trim();
      if (cleanedStoryImages.length > 0) payload.storyImages = cleanedStoryImages;

      const res = await fetch('/api/admin/journal/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Generate failed');
      }

      setInfo(
        `✓ New draft created: "${data.draft.title}". Email sent to ${data.email?.sent ?? 0} reviewer(s).`
      );

      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="grid xl:grid-cols-[1.3fr_1fr] gap-6 mb-6">
        <div>
          <p className="label text-madder mb-1">CONTENT · WEEKLY JOURNAL</p>
          <h1 className="font-serif text-3xl text-kohl">The Journal · auto-curation</h1>
          <p className="font-italic italic text-mitti mt-1">
            A new draft is generated every Monday at 09:00 IST and emailed to Nidhi and admins for review.
            Nothing publishes without approval.
          </p>
        </div>

        <div className="border border-mitti/20 bg-ivory p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="label text-madder">MANUAL GENERATION</p>
            <p className="text-[11px] text-mitti">~60–120 s</p>
          </div>

          <div>
            <label className="label text-mitti">THEME</label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              disabled={generating}
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
            <label className="label text-mitti">MANUAL COVER IMAGE URL</label>
            {coverImageUrl ? (
              <img
                src={coverImageUrl}
                alt="cover preview"
                className="w-full aspect-video object-cover border border-mitti/20 mb-2"
              />
            ) : (
              <div className="w-full aspect-video border border-dashed border-mitti/20 bg-beige flex items-center justify-center text-mitti text-sm mb-2">
                No manual cover supplied
              </div>
            )}
            <input
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              disabled={generating}
              placeholder="https://..."
              className="w-full p-2 bg-ivory border border-mitti/20 text-xs font-mono"
            />
            <p className="text-[11px] text-mitti mt-1">
              Leave blank to let the system generate the cover image automatically.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="label text-mitti">STORY IMAGES</label>
              <button
                type="button"
                onClick={addStoryImage}
                disabled={generating}
                className="text-xs font-ui text-madder hover:underline inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> ADD IMAGE
              </button>
            </div>

            {storyImages.map((item, index) => (
              <div key={index} className="border border-mitti/15 bg-beige p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] tracking-widest text-mitti font-ui">
                    IMAGE {index + 1}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeStoryImage(index)}
                    disabled={generating}
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
                    No image URL
                  </div>
                )}

                <input
                  value={item.url}
                  onChange={(e) => updateStoryImage(index, 'url', e.target.value)}
                  disabled={generating}
                  placeholder="Image URL"
                  className="w-full p-2 bg-ivory border border-mitti/20 text-xs font-mono"
                />

                <input
                  value={item.caption}
                  onChange={(e) => updateStoryImage(index, 'caption', e.target.value)}
                  disabled={generating}
                  placeholder="Caption"
                  className="w-full p-2 bg-ivory border border-mitti/20 text-sm"
                />

                <input
                  value={item.alt}
                  onChange={(e) => updateStoryImage(index, 'alt', e.target.value)}
                  disabled={generating}
                  placeholder="Alt text"
                  className="w-full p-2 bg-ivory border border-mitti/20 text-sm"
                />
              </div>
            ))}

            <p className="text-[11px] text-mitti">
              These images are stored on the draft and carried into the published journal entry.
            </p>
          </div>

          <button
            onClick={generateNow}
            disabled={generating}
            className="w-full bg-madder text-ivory px-5 py-3 font-ui text-xs tracking-widest hover:bg-kohl transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? 'GENERATING...' : 'GENERATE NOW'}
          </button>
        </div>
      </div>

      {error && (
        <div className="border border-madder bg-madder/10 text-madder p-3 mb-4 font-ui text-sm">
          {error}
        </div>
      )}

      {info && (
        <div className="border border-emerald-500 bg-emerald-50 text-emerald-700 p-3 mb-4 font-ui text-sm">
          {info}
        </div>
      )}

      {loading ? (
        <p className="text-mitti italic">Loading drafts...</p>
      ) : drafts.length === 0 ? (
        <div className="border border-mitti/20 bg-beige p-8 text-center">
          <FileText className="w-10 h-10 text-mitti mx-auto mb-3" />
          <p className="text-kohl">
            No drafts yet. Click <strong>GENERATE NOW</strong> to create the first one.
          </p>
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
                    <span className={`px-2 py-0.5 text-[10px] font-ui tracking-widest ${STATUS_COLOURS[d.status]}`}>
                      {d.status}
                    </span>
                    {d.createdByCron && (
                      <span className="text-[10px] text-mitti font-ui tracking-widest">CRON</span>
                    )}
                    {d.seedTheme && (
                      <span className="text-[10px] text-mitti font-ui">· {d.seedTheme}</span>
                    )}
                    {Array.isArray(d.storyImages) && d.storyImages.length > 0 && (
                      <span className="text-[10px] text-mitti font-ui">
                        · {d.storyImages.length} story image{d.storyImages.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>

                  <h3 className="font-serif text-lg text-kohl truncate">{d.title}</h3>

                  {d.excerpt && (
                    <p className="text-sm text-mitti mt-1 line-clamp-2">{d.excerpt}</p>
                  )}

                  <p className="text-[11px] text-mitti mt-2">
                    Created {new Date(d.createdAt).toLocaleDateString()}
                    {d.reviewedAt && ` · Reviewed ${new Date(d.reviewedAt).toLocaleDateString()}`}
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
                        href={`/journal`}
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
