'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

type BlockStatus = 'DRAFT' | 'PREVIEW' | 'PUBLISHED' | 'ARCHIVED';

type EditorialBlockListItem = {
  id: string;
  slug: string;
  title: string;
  blockType: string;
  status: BlockStatus;
  placement: string | null;
  audienceTag: string | null;
  updatedAt: string;
  publishedAt: string | null;
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

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default function AdminEditorialBlocksPage() {
  const router = useRouter();

  const [blocks, setBlocks] = useState<EditorialBlockListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string>('');

  const [title, setTitle] = useState('');
  const [blockType, setBlockType] = useState('RICH_TEXT');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/editorial-blocks', {
        credentials: 'include',
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error ?? 'Failed to load editorial blocks');
      }

      setBlocks(Array.isArray(json?.blocks) ? json.blocks : []);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load editorial blocks');
      setBlocks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createBlock = useCallback(async () => {
    if (!title.trim()) {
      setError('Title required');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const response = await fetch('/api/admin/editorial-blocks', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          blockType,
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error ?? 'Failed to create editorial block');
      }

      const id = json?.block?.id;
      if (!id) {
        throw new Error('Editorial block created but no id returned');
      }

      router.push(`/admin/editorial-blocks/${id}`);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create editorial block');
    } finally {
      setCreating(false);
    }
  }, [blockType, router, title]);

  const totalPublished = useMemo(
    () => blocks.filter(block => block.status === 'PUBLISHED').length,
    [blocks]
  );

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="label text-madder mb-1">EDITORIAL BLOCKS</p>
          <h1 className="text-3xl font-semibold text-stone-900">
            Editorial Copy Blocks
          </h1>
          <p className="mt-2 text-sm text-stone-600 max-w-3xl">
            Write, preview, and publish reusable editorial copy blocks for
            catalogue storytelling, campaigns, and merchandising surfaces.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => void load()}
            className="px-4 py-2 rounded-full border border-stone-300 text-sm font-medium hover:bg-stone-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[420px,1fr] gap-6 mt-6">
        <div className="bg-beige rounded-3xl border border-stone-200 p-6">
          <p className="label text-madder mb-1">NEW BLOCK</p>
          <h2 className="text-xl font-semibold text-stone-900">
            Create editorial block
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            Start with a draft block, then open the editor to preview and publish.
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wide text-stone-500 mb-2">
                Title
              </label>
              <input
                value={title}
                onChange={event => setTitle(event.target.value)}
                placeholder="Example: Housewarming Luxury Lead"
                className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none focus:border-stone-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-stone-500 mb-2">
                Block type
              </label>
              <select
                value={blockType}
                onChange={event => setBlockType(event.target.value)}
                className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none focus:border-stone-500 bg-white"
              >
                <option value="RICH_TEXT">RICH_TEXT</option>
                <option value="HERO_COPY">HERO_COPY</option>
                <option value="PRODUCT_STORY">PRODUCT_STORY</option>
                <option value="CAMPAIGN_MESSAGE">CAMPAIGN_MESSAGE</option>
                <option value="CTA_STRIP">CTA_STRIP</option>
              </select>
            </div>

            <button
              onClick={() => void createBlock()}
              disabled={creating}
              className="w-full rounded-full bg-stone-900 text-white px-5 py-3 text-sm font-medium disabled:opacity-60"
            >
              {creating ? 'Creating…' : 'Create Draft Block'}
            </button>

            {error ? (
              <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-stone-200 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="label text-madder mb-1">LIBRARY</p>
              <h2 className="text-xl font-semibold text-stone-900">
                Existing blocks
              </h2>
            </div>

            <div className="text-sm text-stone-600">
              {blocks.length} total · {totalPublished} published
            </div>
          </div>

          {loading ? (
            <div className="p-6 text-sm text-stone-500">Loading editorial blocks…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="bg-stone-50">
                  <tr className="text-left text-xs uppercase tracking-wide text-stone-500">
                    <th className="px-6 py-4">Title</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Placement</th>
                    <th className="px-6 py-4">Audience</th>
                    <th className="px-6 py-4">Updated</th>
                    <th className="px-6 py-4">Published</th>
                    <th className="px-6 py-4">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {blocks.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-6 py-10 text-sm text-stone-500 text-center"
                      >
                        No editorial blocks yet.
                      </td>
                    </tr>
                  ) : (
                    blocks.map(block => (
                      <tr key={block.id} className="border-t border-stone-100">
                        <td className="px-6 py-4 align-top">
                          <div className="font-medium text-stone-900">
                            {block.title}
                          </div>
                          <div className="text-xs text-stone-500 mt-1">
                            /{block.slug}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-stone-700">
                          {block.blockType}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusClassName(
                              block.status
                            )}`}
                          >
                            {block.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-stone-700">
                          {block.placement ?? '—'}
                        </td>
                        <td className="px-6 py-4 text-sm text-stone-700">
                          {block.audienceTag ?? '—'}
                        </td>
                        <td className="px-6 py-4 text-sm text-stone-700">
                          {formatDate(block.updatedAt)}
                        </td>
                        <td className="px-6 py-4 text-sm text-stone-700">
                          {formatDate(block.publishedAt)}
                        </td>
                        <td className="px-6 py-4">
                          <Link
                            href={`/admin/editorial-blocks/${block.id}`}
                            className="inline-flex rounded-full border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50"
                          >
                            Edit
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
