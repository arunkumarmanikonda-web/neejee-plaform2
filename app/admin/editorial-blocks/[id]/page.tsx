'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

type BlockStatus = 'DRAFT' | 'PREVIEW' | 'PUBLISHED' | 'ARCHIVED';

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

const EMPTY_FORM: EditorialBlockForm = {
  title: '',
  slug: '',
  blockType: 'RICH_TEXT',
  body: '',
  subhead: '',
  kicker: '',
  audienceTag: '',
  ctaLabel: '',
  ctaHref: '',
  coverImage: '',
  tags: '',
  placement: '',
  status: 'DRAFT',
  previewToken: '',
  publishedAt: null,
  updatedAt: '',
};

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

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function splitTags(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

export default function AdminEditorialBlockDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const blockId = String(params?.id || '');

  const [form, setForm] = useState<EditorialBlockForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [generatingText, setGeneratingText] = useState(false);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const previewUrl = useMemo(() => {
    if (!form.previewToken) return '';
    return `/api/admin/editorial-blocks/preview/${form.previewToken}`;
  }, [form.previewToken]);

  const load = useCallback(async () => {
    if (!blockId) return;

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`/api/admin/editorial-blocks/${blockId}`, {
        credentials: 'include',
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error ?? 'Failed to load editorial block');
      }

      const block = json?.block;
      if (!block) {
        throw new Error('Editorial block not found');
      }

      setForm({
        title: block.title ?? '',
        slug: block.slug ?? '',
        blockType: block.blockType ?? 'RICH_TEXT',
        body: block.body ?? '',
        subhead: block.subhead ?? '',
        kicker: block.kicker ?? '',
        audienceTag: block.audienceTag ?? '',
        ctaLabel: block.ctaLabel ?? '',
        ctaHref: block.ctaHref ?? '',
        coverImage: block.coverImage ?? '',
        tags: Array.isArray(block.tags) ? block.tags.join(', ') : '',
        placement: block.placement ?? '',
        status: (block.status ?? 'DRAFT') as BlockStatus,
        previewToken: block.previewToken ?? '',
        publishedAt: block.publishedAt ?? null,
        updatedAt: block.updatedAt ?? '',
      });
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load editorial block');
    } finally {
      setLoading(false);
    }
  }, [blockId]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = useCallback(
    async (statusOverride?: BlockStatus, regeneratePreviewToken = false) => {
      if (!blockId) return;

      setSaving(true);
      setError('');
      setMessage('');

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
          throw new Error(json?.error ?? 'Failed to update editorial block');
        }

        const block = json?.block;
        if (!block) {
          throw new Error('Editorial block updated but no block returned');
        }

        setForm({
          title: block.title ?? '',
          slug: block.slug ?? '',
          blockType: block.blockType ?? 'RICH_TEXT',
          body: block.body ?? '',
          subhead: block.subhead ?? '',
          kicker: block.kicker ?? '',
          audienceTag: block.audienceTag ?? '',
          ctaLabel: block.ctaLabel ?? '',
          ctaHref: block.ctaHref ?? '',
          coverImage: block.coverImage ?? '',
          tags: Array.isArray(block.tags) ? block.tags.join(', ') : '',
          placement: block.placement ?? '',
          status: (block.status ?? 'DRAFT') as BlockStatus,
          previewToken: block.previewToken ?? '',
          publishedAt: block.publishedAt ?? null,
          updatedAt: block.updatedAt ?? '',
        });

        setMessage(
          regeneratePreviewToken
            ? 'Preview token regenerated'
            : statusOverride === 'PUBLISHED'
            ? 'Editorial block published'
            : statusOverride === 'ARCHIVED'
            ? 'Editorial block archived'
            : 'Draft saved'
        );
      } catch (err: any) {
        setError(err?.message ?? 'Failed to update editorial block');
      } finally {
        setSaving(false);
      }
    },
    [blockId, form]
  );

  const remove = useCallback(async () => {
    if (!blockId) return;

    const confirmed = window.confirm(
      'Delete this editorial block permanently? This cannot be undone.'
    );
    if (!confirmed) return;

    setDeleting(true);
    setError('');
    setMessage('');

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
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to delete editorial block');
    } finally {
      setDeleting(false);
    }
  }, [blockId, router]);

  const generateCopy = useCallback(async () => {
    setGeneratingText(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/admin/editorial-blocks/generate', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'text',
          title: form.title,
          blockType: form.blockType,
          body: form.body,
          subhead: form.subhead,
          kicker: form.kicker,
          audienceTag: form.audienceTag,
          placement: form.placement,
          ctaLabel: form.ctaLabel,
          ctaHref: form.ctaHref,
          tags: splitTags(form.tags),
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error ?? 'Generate copy failed');
      }

      const configured = json?.configured;
      if (configured === false) {
        throw new Error(json?.message ?? 'AI text generation is not configured');
      }

      const copy = json?.result?.copy;
      if (!copy) {
        throw new Error('No copy returned');
      }

      setForm((current) => ({
        ...current,
        title: copy.title ?? current.title,
        kicker: copy.kicker ?? '',
        subhead: copy.subhead ?? '',
        body: copy.body ?? current.body,
        audienceTag: copy.audienceTag ?? '',
        placement: copy.placement ?? current.placement,
        ctaLabel: copy.ctaLabel ?? '',
        ctaHref: copy.ctaHref ?? '',
        tags: Array.isArray(copy.tags) ? copy.tags.join(', ') : current.tags,
      }));

      setMessage('AI copy generated');
    } catch (err: any) {
      setError(err?.message ?? 'Generate copy failed');
    } finally {
      setGeneratingText(false);
    }
  }, [form]);

  const generateCover = useCallback(async () => {
    setGeneratingCover(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/admin/editorial-blocks/generate', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'cover',
          title: form.title,
          body: form.body,
          coverImagePrompt: [
            form.kicker,
            form.subhead,
            form.title,
            form.body,
            form.audienceTag,
            form.placement,
          ]
            .filter(Boolean)
            .join(' · '),
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error ?? 'Generate cover failed');
      }

      const imageUrl = json?.result?.imageUrl;
      if (!imageUrl) {
        throw new Error('No image URL returned');
      }

      setForm((current) => ({
        ...current,
        coverImage: imageUrl,
      }));

      setMessage('AI cover generated');
    } catch (err: any) {
      setError(err?.message ?? 'Generate cover failed');
    } finally {
      setGeneratingCover(false);
    }
  }, [form]);

  if (loading) {
    return (
      <div className="p-6 md:p-8">
        <div className="text-sm text-stone-500">Loading editorial block…</div>
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

          <p className="label text-madder mt-4 mb-1">EDITORIAL BLOCK</p>
          <h1 className="text-3xl font-semibold text-stone-900">
            {form.title || 'Untitled block'}
          </h1>
          <p className="mt-2 text-sm text-stone-600 max-w-3xl">
            Edit reusable editorial copy, manage preview access, and publish to
            merchandising surfaces.
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
            onClick={() => void generateCopy()}
            disabled={generatingText}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50 disabled:opacity-60"
          >
            {generatingText ? 'Generating copy…' : 'Generate Copy'}
          </button>

          <button
            onClick={() => void generateCover()}
            disabled={generatingCover}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50 disabled:opacity-60"
          >
            {generatingCover ? 'Generating cover…' : 'Generate Cover'}
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

      {(error || message) && (
        <div className="mt-6 space-y-3">
          {error ? (
            <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="rounded-2xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              {message}
            </div>
          ) : null}
        </div>
      )}

      <div className="grid xl:grid-cols-[1.3fr,0.9fr] gap-6 mt-6">
        <div className="bg-white rounded-3xl border border-stone-200 p-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wide text-stone-500 mb-2">
                Title
              </label>
              <input
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none focus:border-stone-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-stone-500 mb-2">
                Slug
              </label>
              <input
                value={form.slug}
                onChange={(event) =>
                  setForm((current) => ({ ...current, slug: event.target.value }))
                }
                className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none focus:border-stone-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-stone-500 mb-2">
                Block type
              </label>
              <select
                value={form.blockType}
                onChange={(event) =>
                  setForm((current) => ({ ...current, blockType: event.target.value }))
                }
                className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none focus:border-stone-500 bg-white"
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
                Audience tag
              </label>
              <input
                value={form.audienceTag}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    audienceTag: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none focus:border-stone-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-stone-500 mb-2">
                Kicker
              </label>
              <input
                value={form.kicker}
                onChange={(event) =>
                  setForm((current) => ({ ...current, kicker: event.target.value }))
                }
                className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none focus:border-stone-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-stone-500 mb-2">
                Subhead
              </label>
              <input
                value={form.subhead}
                onChange={(event) =>
                  setForm((current) => ({ ...current, subhead: event.target.value }))
                }
                className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none focus:border-stone-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-stone-500 mb-2">
                Placement
              </label>
              <input
                value={form.placement}
                onChange={(event) =>
                  setForm((current) => ({ ...current, placement: event.target.value }))
                }
                className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none focus:border-stone-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-stone-500 mb-2">
                Tags
              </label>
              <input
                value={form.tags}
                onChange={(event) =>
                  setForm((current) => ({ ...current, tags: event.target.value }))
                }
                placeholder="festive, gifting, luxury-home"
                className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none focus:border-stone-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-stone-500 mb-2">
                CTA label
              </label>
              <input
                value={form.ctaLabel}
                onChange={(event) =>
                  setForm((current) => ({ ...current, ctaLabel: event.target.value }))
                }
                className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none focus:border-stone-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-stone-500 mb-2">
                CTA href
              </label>
              <input
                value={form.ctaHref}
                onChange={(event) =>
                  setForm((current) => ({ ...current, ctaHref: event.target.value }))
                }
                className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none focus:border-stone-500 bg-white"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-xs uppercase tracking-wide text-stone-500 mb-2">
              Cover image URL
            </label>
            <input
              value={form.coverImage}
              onChange={(event) =>
                setForm((current) => ({ ...current, coverImage: event.target.value }))
              }
              className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none focus:border-stone-500 bg-white"
            />
          </div>

          <div className="mt-4">
            <label className="block text-xs uppercase tracking-wide text-stone-500 mb-2">
              Body
            </label>
            <textarea
              value={form.body}
              onChange={(event) =>
                setForm((current) => ({ ...current, body: event.target.value }))
              }
              rows={12}
              className="w-full rounded-3xl border border-stone-300 px-4 py-4 outline-none focus:border-stone-500 bg-white resize-y"
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-stone-200 p-6">
            <p className="label text-madder mb-1">METADATA</p>
            <div className="space-y-3 text-sm text-stone-700">
              <div className="flex items-start justify-between gap-4">
                <span className="text-stone-500">Status</span>
                <span className="font-medium">{form.status}</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-stone-500">Updated</span>
                <span className="font-medium">{formatDate(form.updatedAt)}</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-stone-500">Published</span>
                <span className="font-medium">{formatDate(form.publishedAt)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-stone-200 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="label text-madder mb-1">PREVIEW</p>
                <h2 className="text-xl font-semibold text-stone-900">
                  Preview token
                </h2>
              </div>

              <button
                onClick={() => void patch(undefined, true)}
                disabled={saving}
                className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50 disabled:opacity-60"
              >
                Regenerate
              </button>
            </div>

            <div className="mt-4 rounded-2xl bg-stone-50 border border-stone-200 px-4 py-3 text-sm break-all text-stone-700">
              {form.previewToken || 'No preview token'}
            </div>

            {previewUrl ? (
              <div className="mt-4">
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-full border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50"
                >
                  Open Preview
                </a>
              </div>
            ) : null}
          </div>

          <div className="bg-white rounded-3xl border border-stone-200 p-6">
            <p className="label text-madder mb-1">VISUAL</p>
            <h2 className="text-xl font-semibold text-stone-900">Cover image</h2>

            <div className="mt-4">
              {form.coverImage ? (
                <img
                  src={form.coverImage}
                  alt={form.title || 'Editorial block cover'}
                  className="w-full rounded-3xl border border-stone-200 object-cover"
                />
              ) : (
                <div className="rounded-3xl border border-dashed border-stone-300 bg-stone-50 p-8 text-sm text-stone-500 text-center">
                  No cover image yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
