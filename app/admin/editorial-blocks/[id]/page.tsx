'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

type BlockStatus = 'DRAFT' | 'PREVIEW' | 'PUBLISHED' | 'ARCHIVED';

type EditorialBlock = {
  id: string;
  slug: string;
  title: string;
  blockType: string;
  body: string;
  subhead: string | null;
  kicker: string | null;
  audienceTag: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  coverImage: string | null;
  tags: string[];
  placement: string | null;
  status: BlockStatus;
  previewToken: string | null;
  publishedAt: string | null;
  updatedAt: string;
};

type EditorialBlockForm = {
  title: string;
  slug: string;
  blockType: string;
  body: string;
  subhead: string;
  kicker: string;
  audienceTag: string;
  ctaLabel: string;
  ctaHref: string;
  coverImage: string;
  tags: string;
  placement: string;
  status: BlockStatus;
  previewToken: string;
  publishedAt: string | null;
  updatedAt: string;
};

function toForm(block: EditorialBlock): EditorialBlockForm {
  return {
    title: block.title,
    slug: block.slug,
    blockType: block.blockType,
    body: block.body,
    subhead: block.subhead ?? '',
    kicker: block.kicker ?? '',
    audienceTag: block.audienceTag ?? '',
    ctaLabel: block.ctaLabel ?? '',
    ctaHref: block.ctaHref ?? '',
    coverImage: block.coverImage ?? '',
    tags: block.tags.join(', '),
    placement: block.placement ?? '',
    status: block.status,
    previewToken: block.previewToken ?? '',
    publishedAt: block.publishedAt,
    updatedAt: block.updatedAt,
  };
}

function splitTags(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
    )
  );
}

function statusClassName(status: BlockStatus): string {
  switch (status) {
    case 'PUBLISHED':
      return 'bg-green-100 text-green-700';
    case 'PREVIEW':
      return 'bg-blue-100 text-blue-700';
    case 'ARCHIVED':
      return 'bg-stone-200 text-stone-700';
    case 'DRAFT':
    default:
      return 'bg-amber-100 text-amber-700';
  }
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default function AdminEditorialBlockDetailPage() {
  const router = useRouter();
  const params = useParams();

  const blockId = useMemo(() => {
    const raw = params?.id;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [block, setBlock] = useState<EditorialBlock | null>(null);
  const [form, setForm] = useState<EditorialBlockForm | null>(null);

  const load = useCallback(async () => {
    if (!blockId) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/admin/editorial-blocks/${blockId}`, {
        credentials: 'include',
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error ?? 'Failed to load editorial block');
      }

      const nextBlock = json?.block as EditorialBlock;
      setBlock(nextBlock);
      setForm(toForm(nextBlock));
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load editorial block');
      setBlock(null);
      setForm(null);
    } finally {
      setLoading(false);
    }
  }, [blockId]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = useCallback(
    async (statusOverride?: BlockStatus, regeneratePreviewToken = false) => {
      if (!blockId || !form) return;

      setSaving(true);
      setError('');

      try {
        const response = await fetch(`/api/admin/editorial-blocks/${blockId}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: form.title,
            slug: form.slug,
            blockType: form.blockType,
            body: form.body,
            subhead: form.subhead || null,
            kicker: form.kicker || null,
            audienceTag: form.audienceTag || null,
            ctaLabel: form.ctaLabel || null,
            ctaHref: form.ctaHref || null,
            coverImage: form.coverImage || null,
            tags: splitTags(form.tags),
            placement: form.placement || null,
            ...(statusOverride ? { status: statusOverride } : {}),
            ...(regeneratePreviewToken ? { regeneratePreviewToken: true } : {}),
          }),
        });

        const json = await response.json();

        if (!response.ok) {
          throw new Error(json?.error ?? 'Failed to save editorial block');
        }

        const nextBlock = json?.block as EditorialBlock;
        setBlock(nextBlock);
        setForm(toForm(nextBlock));
      } catch (err: any) {
        setError(err?.message ?? 'Failed to save editorial block');
      } finally {
        setSaving(false);
      }
    },
    [blockId, form]
  );

  const remove = useCallback(async () => {
    if (!blockId) return;
    const confirmed = window.confirm(
      'Delete this editorial block permanently?'
    );
    if (!confirmed) return;

    setDeleting(true);
    setError('');

    try {
      const response = await fetch(`/api/admin/editorial-blocks/${blockId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error ?? 'Failed to delete editorial block');
      }

      router.push('/admin/editorial-blocks');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to delete editorial block');
      setDeleting(false);
    }
  }, [blockId, router]);

  if (loading || !form) {
    return (
      <div className="p-6 md:p-8">
        <div className="rounded-3xl border border-stone-200 bg-white p-6 text-sm text-stone-500">
          Loading editorial block…
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/admin/editorial-blocks"
            className="text-sm text-stone-500 hover:text-stone-800"
          >
            ← Back to editorial blocks
          </Link>
          <p className="label text-madder mt-3 mb-1">EDITORIAL BLOCK EDITOR</p>
          <h1 className="text-3xl font-semibold text-stone-900">
            {form.title || 'Untitled editorial block'}
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            Edit reusable editorial copy, preview it live, and publish when ready.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusClassName(
              form.status
            )}`}
          >
            {form.status}
          </span>

          <button
            onClick={() => void patch('DRAFT')}
            disabled={saving}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Draft'}
          </button>

          <button
            onClick={() => void patch('PUBLISHED')}
            disabled={saving}
            className="rounded-full bg-stone-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            Publish
          </button>

          <button
            onClick={() => void patch('ARCHIVED')}
            disabled={saving}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50 disabled:opacity-60"
          >
            Archive
          </button>

          <button
            onClick={() => void remove()}
            disabled={deleting}
            className="rounded-full border border-red-300 text-red-700 px-4 py-2 text-sm font-medium hover:bg-red-50 disabled:opacity-60"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <div className="space-y-6">
          <div className="bg-beige rounded-3xl border border-stone-200 p-6">
            <p className="label text-madder mb-4">CONTENT</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wide text-stone-500 mb-2">
                  Title
                </label>
                <input
                  value={form.title}
                  onChange={event =>
                    setForm(current => current && { ...current, title: event.target.value })
                  }
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 bg-white outline-none focus:border-stone-500"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wide text-stone-500 mb-2">
                  Slug
                </label>
                <input
                  value={form.slug}
                  onChange={event =>
                    setForm(current => current && { ...current, slug: event.target.value })
                  }
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 bg-white outline-none focus:border-stone-500"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wide text-stone-500 mb-2">
                  Block type
                </label>
                <select
                  value={form.blockType}
                  onChange={event =>
                    setForm(current => current && { ...current, blockType: event.target.value })
                  }
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 bg-white outline-none focus:border-stone-500"
                >
                  <option value="RICH_TEXT">RICH_TEXT</option>
                  <option value="HERO_COPY">HERO_COPY</option>
                  <option value="PRODUCT_STORY">PRODUCT_STORY</option>
                  <option value="CAMPAIGN_MESSAGE">CAMPAIGN_MESSAGE</option>
                  <option value="CTA_STRIP">CTA_STRIP</option>
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wide text-stone-500 mb-2">
                  Kicker
                </label>
                <input
                  value={form.kicker}
                  onChange={event =>
                    setForm(current => current && { ...current, kicker: event.target.value })
                  }
                  placeholder="Optional small lead-in label"
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 bg-white outline-none focus:border-stone-500"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wide text-stone-500 mb-2">
                  Subhead
                </label>
                <input
                  value={form.subhead}
                  onChange={event =>
                    setForm(current => current && { ...current, subhead: event.target.value })
                  }
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 bg-white outline-none focus:border-stone-500"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wide text-stone-500 mb-2">
                  Body
                </label>
                <textarea
                  value={form.body}
                  onChange={event =>
                    setForm(current => current && { ...current, body: event.target.value })
                  }
                  rows={10}
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 bg-white outline-none focus:border-stone-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-stone-200 p-6">
            <p className="label text-madder mb-4">PLACEMENT & CTA</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wide text-stone-500 mb-2">
                  Placement
                </label>
                <input
                  value={form.placement}
                  onChange={event =>
                    setForm(current => current && { ...current, placement: event.target.value })
                  }
                  placeholder="Example: catalogue.hero / gifting.spotlight"
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 bg-white outline-none focus:border-stone-500"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wide text-stone-500 mb-2">
                  Audience tag
                </label>
                <input
                  value={form.audienceTag}
                  onChange={event =>
                    setForm(current => current && { ...current, audienceTag: event.target.value })
                  }
                  placeholder="Example: HOUSEWARMING|LUXURY_HOME"
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 bg-white outline-none focus:border-stone-500"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wide text-stone-500 mb-2">
                    CTA label
                  </label>
                  <input
                    value={form.ctaLabel}
                    onChange={event =>
                      setForm(current => current && { ...current, ctaLabel: event.target.value })
                    }
                    className="w-full rounded-2xl border border-stone-300 px-4 py-3 bg-white outline-none focus:border-stone-500"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wide text-stone-500 mb-2">
                    CTA href
                  </label>
                  <input
                    value={form.ctaHref}
                    onChange={event =>
                      setForm(current => current && { ...current, ctaHref: event.target.value })
                    }
                    className="w-full rounded-2xl border border-stone-300 px-4 py-3 bg-white outline-none focus:border-stone-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wide text-stone-500 mb-2">
                  Cover image
                </label>
                <input
                  value={form.coverImage}
                  onChange={event =>
                    setForm(current => current && { ...current, coverImage: event.target.value })
                  }
                  placeholder="https://..."
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 bg-white outline-none focus:border-stone-500"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wide text-stone-500 mb-2">
                  Tags
                </label>
                <input
                  value={form.tags}
                  onChange={event =>
                    setForm(current => current && { ...current, tags: event.target.value })
                  }
                  placeholder="luxury, housewarming, launch"
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 bg-white outline-none focus:border-stone-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-stone-200 p-6">
            <p className="label text-madder mb-4">PUBLISHING</p>

            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="rounded-2xl bg-stone-50 px-4 py-3">
                <div className="text-stone-500">Preview token</div>
                <div className="mt-1 break-all text-stone-900">
                  {form.previewToken || '—'}
                </div>
              </div>

              <div className="rounded-2xl bg-stone-50 px-4 py-3">
                <div className="text-stone-500">Published at</div>
                <div className="mt-1 text-stone-900">
                  {formatDate(form.publishedAt)}
                </div>
              </div>

              <div className="rounded-2xl bg-stone-50 px-4 py-3">
                <div className="text-stone-500">Updated at</div>
                <div className="mt-1 text-stone-900">
                  {formatDate(form.updatedAt)}
                </div>
              </div>

              <div className="rounded-2xl bg-stone-50 px-4 py-3 flex items-end justify-between gap-4">
                <div>
                  <div className="text-stone-500">Preview token controls</div>
                  <div className="mt-1 text-stone-900">
                    Regenerate if you need a fresh preview reference.
                  </div>
                </div>
                <button
                  onClick={() => void patch(undefined, true)}
                  disabled={saving}
                  className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-100 disabled:opacity-60"
                >
                  Regenerate
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-stone-200 p-6 lg:sticky lg:top-6 h-fit">
          <p className="label text-madder mb-4">LIVE PREVIEW</p>

          <div className="overflow-hidden rounded-[28px] border border-stone-200 bg-stone-950 text-white">
            {form.coverImage ? (
              <img
                src={form.coverImage}
                alt={form.title || 'Editorial cover'}
                className="w-full h-64 object-cover"
              />
            ) : (
              <div className="h-40 flex items-center justify-center text-sm text-stone-400 border-b border-white/10">
                No cover image
              </div>
            )}

            <div className="p-8">
              {form.kicker ? (
                <p className="text-xs uppercase tracking-[0.24em] text-stone-300 mb-3">
                  {form.kicker}
                </p>
              ) : null}

              <h2 className="text-3xl font-semibold leading-tight">
                {form.title || 'Untitled editorial block'}
              </h2>

              {form.subhead ? (
                <p className="mt-3 text-lg text-stone-300">{form.subhead}</p>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-2">
                {form.blockType ? (
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-stone-200">
                    {form.blockType}
                  </span>
                ) : null}
                {form.placement ? (
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-stone-200">
                    {form.placement}
                  </span>
                ) : null}
                {form.audienceTag ? (
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-stone-200">
                    {form.audienceTag}
                  </span>
                ) : null}
              </div>

              <div className="mt-6 whitespace-pre-wrap text-stone-200 leading-7">
                {form.body || 'No body copy yet.'}
              </div>

              {form.tags ? (
                <div className="mt-6 flex flex-wrap gap-2">
                  {splitTags(form.tags).map(tag => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/15 px-3 py-1 text-xs text-stone-300"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}

              {form.ctaLabel ? (
                <div className="mt-8">
                  <a
                    href={form.ctaHref || '#'}
                    className="inline-flex rounded-full bg-white text-stone-950 px-5 py-3 text-sm font-medium"
                  >
                    {form.ctaLabel}
                  </a>
                </div>
              ) : null}
            </div>
          </div>

          {block ? (
            <div className="mt-4 text-xs text-stone-500">
              Block ID: {block.id}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
