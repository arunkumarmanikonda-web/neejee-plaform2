'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

type BatchInputItem = {
  brief: string;
  audience: string;
  goal: string;
};

type CreatedPage = {
  id: string;
  title: string;
  slug: string;
  status?: string;
  configured?: boolean;
};

type FailedItem = {
  index: number;
  brief: string;
  error: string;
};

function parseBatchText(text: string): BatchInputItem[] {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('|').map(part => part.trim());
      return {
        brief: parts[0] || '',
        audience: parts[1] || 'NEEJEE customers',
        goal: parts[2] || 'inform and invite',
      };
    })
    .filter(item => item.brief.length >= 5);
}

export default function AdminCmsAiBatchWorkbenchPage() {
  const [batchText, setBatchText] = useState([
    'Banarasi silk gift guide landing page | festive shoppers | drive discovery and gifting intent',
    'Kanchipuram bridal landing page | wedding shoppers | build trust and category exploration',
    'Founders notes journal hub | returning customers | deepen brand voice and repeat engagement',
  ].join('\n'));

  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [created, setCreated] = useState<CreatedPage[]>([]);
  const [failed, setFailed] = useState<FailedItem[]>([]);

  const items = useMemo(() => parseBatchText(batchText), [batchText]);

  async function runBatch() {
    setError('');
    setCreated([]);
    setFailed([]);
    if (items.length === 0) {
      setError('Add at least one valid brief. Use one line per page: brief | audience | goal');
      return;
    }

    setRunning(true);
    try {
      const res = await fetch('/api/admin/cms/ai-batch', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Batch generation failed');

      setConfigured(!!json.configured);
      setCreated(Array.isArray(json.created) ? json.created : []);
      setFailed(Array.isArray(json.failed) ? json.failed : []);
    } catch (e: any) {
      setError(e.message || 'Batch generation failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label text-madder">CMS AI BATCH WORKBENCH</p>
          <h1 className="font-display text-4xl text-kohl mt-2">AI page drafting at batch scale</h1>
          <p className="font-ui text-sm text-mitti mt-3 max-w-4xl leading-7">
            Create multiple CMS draft pages in one pass. Enter one line per page using:
            <span className="font-medium text-kohl"> brief | audience | goal</span>.
            The workbench scaffolds each page and immediately saves it as a CMS draft.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/admin/ai" className="bg-kohl text-ivory px-4 py-2 rounded-sm text-sm font-medium">
            AI MANAGER
          </Link>
          <Link href="/admin/cms" className="border border-kohl/20 px-4 py-2 rounded-sm text-sm font-medium text-kohl bg-white">
            CMS ROOT
          </Link>
          <Link href="/admin/settings" className="border border-kohl/20 px-4 py-2 rounded-sm text-sm font-medium text-kohl bg-white">
            SETTINGS
          </Link>
        </div>
      </div>

      <section className="rounded-2xl border border-mitti/15 bg-white p-6">
        <p className="label text-madder">INPUT FORMAT</p>
        <p className="font-ui text-sm text-mitti mt-3 leading-7">
          One line per page. Use the pipe character to separate the fields:
          <span className="font-medium text-kohl"> brief | audience | goal</span>.
        </p>

        <textarea
          value={batchText}
          onChange={(e) => setBatchText(e.target.value)}
          className="mt-4 min-h-[240px] w-full rounded-xl border border-kohl/10 bg-beige/30 p-4 font-ui text-sm text-kohl outline-none focus:border-kohl/30"
          placeholder="Banarasi edit page | festive shoppers | drive exploration and add-to-cart intent"
        />

        <div className="grid md:grid-cols-3 gap-4 mt-5">
          <div className="rounded-xl border border-mitti/15 bg-beige p-4">
            <p className="label text-madder">VALID ITEMS</p>
            <p className="font-display text-3xl text-kohl mt-2">{items.length}</p>
          </div>
          <div className="rounded-xl border border-mitti/15 bg-beige p-4">
            <p className="label text-madder">OPENAI STATUS</p>
            <p className="font-display text-3xl text-kohl mt-2">
              {configured === null ? '—' : configured ? 'AI' : 'FALLBACK'}
            </p>
          </div>
          <div className="rounded-xl border border-mitti/15 bg-beige p-4">
            <p className="label text-madder">SAVE MODE</p>
            <p className="font-display text-3xl text-kohl mt-2">DRAFT</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-6">
          <button
            type="button"
            onClick={runBatch}
            disabled={running}
            className="bg-kohl text-ivory px-5 py-3 rounded-sm text-sm font-medium disabled:opacity-60"
          >
            {running ? 'RUNNING AI BATCH…' : 'GENERATE CMS AI BATCH'}
          </button>

          <button
            type="button"
            onClick={() => {
              setBatchText('');
              setCreated([]);
              setFailed([]);
              setError('');
              setConfigured(null);
            }}
            className="border border-kohl/20 px-5 py-3 rounded-sm text-sm font-medium text-kohl bg-white"
          >
            CLEAR
          </button>
        </div>

        {error ? (
          <div className="mt-5 rounded-xl border border-madder/20 bg-madder/5 p-4 text-sm text-madder">
            {error}
          </div>
        ) : null}
      </section>

      <section className="grid xl:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-mitti/15 bg-white p-6">
          <p className="label text-madder">CREATED DRAFTS</p>
          {created.length === 0 ? (
            <p className="font-ui text-sm text-mitti mt-4">No drafts created yet.</p>
          ) : (
            <div className="space-y-3 mt-4">
              {created.map((page) => (
                <div key={page.id} className="rounded-xl border border-kohl/10 bg-beige/20 p-4">
                  <p className="font-display text-xl text-kohl">{page.title}</p>
                  <p className="font-ui text-xs text-mitti mt-2">/{page.slug}</p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    <Link href={`/admin/cms/${page.id}`} className="bg-kohl text-ivory px-3 py-2 rounded-sm text-xs font-medium">
                      OPEN DRAFT
                    </Link>
                    <Link href="/admin/cms" className="border border-kohl/20 px-3 py-2 rounded-sm text-xs font-medium text-kohl bg-white">
                      CMS ROOT
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-mitti/15 bg-white p-6">
          <p className="label text-madder">FAILED ITEMS</p>
          {failed.length === 0 ? (
            <p className="font-ui text-sm text-mitti mt-4">No failures.</p>
          ) : (
            <div className="space-y-3 mt-4">
              {failed.map((item) => (
                <div key={`${item.index}-${item.brief}`} className="rounded-xl border border-madder/20 bg-madder/5 p-4">
                  <p className="font-display text-lg text-kohl">Line {item.index + 1}</p>
                  <p className="font-ui text-sm text-kohl mt-2">{item.brief}</p>
                  <p className="font-ui text-sm text-madder mt-3">{item.error}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-mitti/15 bg-beige p-6">
        <p className="label text-madder">NOTES</p>
        <ul className="mt-4 space-y-3 text-sm text-mitti leading-7 list-disc pl-5">
          <li>Each generated page is saved as a CMS draft.</li>
          <li>Slug collisions are automatically resolved by suffixing the slug.</li>
          <li>If OpenAI is unavailable, the batch still creates sensible fallback draft structures.</li>
        </ul>
      </section>
    </div>
  );
}