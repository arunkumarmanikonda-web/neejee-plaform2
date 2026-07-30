'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

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
  updatedAt?: string;
};

type FailedItem = {
  index: number;
  brief: string;
  audience: string;
  goal: string;
  error: string;
};

type HistoryItem = {
  id: string;
  title: string;
  slug: string;
  status: string;
  updatedAt: string;
  seoTitle?: string | null;
  seoDesc?: string | null;
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

function serializeBatchItems(items: BatchInputItem[]) {
  return items
    .map((item) => [item.brief, item.audience || 'NEEJEE customers', item.goal || 'inform and invite'].join(' | '))
    .join('\n');
}

export default function AdminCmsAiBatchWorkbenchPage() {
  const [batchText, setBatchText] = useState([
    'Banarasi silk gift guide landing page | festive shoppers | drive discovery and gifting intent',
    'Kanchipuram bridal landing page | wedding shoppers | build trust and category exploration',
    'Founders notes journal hub | returning customers | deepen brand voice and repeat engagement',
  ].join('\n'));

  const [running, setRunning] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [created, setCreated] = useState<CreatedPage[]>([]);
  const [failed, setFailed] = useState<FailedItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const items = useMemo(() => parseBatchText(batchText), [batchText]);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/admin/cms/ai-batch', {
        cache: 'no-store',
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not load history');
      setHistory(Array.isArray(json.recent) ? json.recent : []);
      if (typeof json.configured === 'boolean') setConfigured(json.configured);
    } catch (e: any) {
      setError(e.message || 'Could not load history');
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    try {
      const storedText = window.sessionStorage.getItem('cms-ai-batch-text');
      const storedFailed = window.sessionStorage.getItem('cms-ai-batch-failed');
      if (storedText) setBatchText(storedText);
      if (storedFailed) {
        const parsed = JSON.parse(storedFailed);
        if (Array.isArray(parsed)) setFailed(parsed);
      }
    } catch {}
    void loadHistory();
  }, []);

  useEffect(() => {
    try {
      window.sessionStorage.setItem('cms-ai-batch-text', batchText);
    } catch {}
  }, [batchText]);

  async function runBatchWithItems(itemsToRun: BatchInputItem[]) {
    setError('');
    setNotice('');
    setCreated([]);
    setFailed([]);

    if (itemsToRun.length === 0) {
      setError('Add at least one valid brief. Use one line per page: brief | audience | goal');
      return;
    }

    setRunning(true);
    try {
      const res = await fetch('/api/admin/cms/ai-batch', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToRun }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Batch generation failed');

      const nextCreated = Array.isArray(json.created) ? json.created : [];
      const nextFailed = Array.isArray(json.failed) ? json.failed : [];
      const nextHistory = Array.isArray(json.recent) ? json.recent : [];

      setConfigured(!!json.configured);
      setCreated(nextCreated);
      setFailed(nextFailed);
      setHistory(nextHistory);
      setNotice(`Created ${nextCreated.length} draft(s). Failed ${nextFailed.length}.`);

      try {
        window.sessionStorage.setItem('cms-ai-batch-failed', JSON.stringify(nextFailed));
      } catch {}
    } catch (e: any) {
      setError(e.message || 'Batch generation failed');
    } finally {
      setRunning(false);
    }
  }

  async function retryFailedOnly() {
    const retryItems = failed.map((item) => ({
      brief: item.brief,
      audience: item.audience || 'NEEJEE customers',
      goal: item.goal || 'inform and invite',
    }));
    await runBatchWithItems(retryItems);
  }

  function useFailedAsInput() {
    if (failed.length === 0) {
      setError('No failed items available.');
      return;
    }
    const retryText = serializeBatchItems(
      failed.map((item) => ({
        brief: item.brief,
        audience: item.audience || 'NEEJEE customers',
        goal: item.goal || 'inform and invite',
      }))
    );
    setBatchText(retryText);
    setNotice('Failed items copied back into the batch editor.');
  }

  function clearAll() {
    setBatchText('');
    setCreated([]);
    setFailed([]);
    setError('');
    setNotice('');
    setConfigured(null);
    try {
      window.sessionStorage.removeItem('cms-ai-batch-text');
      window.sessionStorage.removeItem('cms-ai-batch-failed');
    } catch {}
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
          <Link href="/admin/settings#ai-recovery" className="border border-kohl/20 px-4 py-2 rounded-sm text-sm font-medium text-kohl bg-white">
            AI SETTINGS
          </Link>
        </div>
      </div>

      <section className="rounded-2xl border border-kohl/10 bg-beige p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="label text-madder">AI RECOVERY LINKS</p>
            <p className="font-ui text-sm text-mitti mt-2 max-w-4xl leading-7">
              If a direct admin route is blocked, use the AI Manager recovery surfaces while continuing CMS drafting work.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/admin/ai?surface=taxonomy" className="border border-kohl/20 px-4 py-2 rounded-sm text-xs font-medium text-kohl bg-white">
              TAXONOMY RECOVERY
            </Link>
            <Link href="/admin/ai?surface=meta" className="border border-kohl/20 px-4 py-2 rounded-sm text-xs font-medium text-kohl bg-white">
              META RECOVERY
            </Link>
          </div>
        </div>
      </section>

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

        <div className="grid md:grid-cols-4 gap-4 mt-5">
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
            <p className="label text-madder">FAILED COUNT</p>
            <p className="font-display text-3xl text-kohl mt-2">{failed.length}</p>
          </div>
          <div className="rounded-xl border border-mitti/15 bg-beige p-4">
            <p className="label text-madder">HISTORY SIZE</p>
            <p className="font-display text-3xl text-kohl mt-2">{history.length}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-6">
          <button
            type="button"
            onClick={() => void runBatchWithItems(items)}
            disabled={running}
            className="bg-kohl text-ivory px-5 py-3 rounded-sm text-sm font-medium disabled:opacity-60"
          >
            {running ? 'RUNNING AI BATCH' : 'GENERATE CMS AI BATCH'}
          </button>

          <button
            type="button"
            onClick={() => void retryFailedOnly()}
            disabled={running || failed.length === 0}
            className="border border-kohl/20 px-5 py-3 rounded-sm text-sm font-medium text-kohl bg-white disabled:opacity-50"
          >
            RETRY FAILED ONLY
          </button>

          <button
            type="button"
            onClick={() => void loadHistory()}
            disabled={historyLoading}
            className="border border-kohl/20 px-5 py-3 rounded-sm text-sm font-medium text-kohl bg-white disabled:opacity-50"
          >
            {historyLoading ? 'LOADING HISTORY' : 'LOAD HISTORY'}
          </button>

          <button
            type="button"
            onClick={useFailedAsInput}
            disabled={failed.length === 0}
            className="border border-kohl/20 px-5 py-3 rounded-sm text-sm font-medium text-kohl bg-white disabled:opacity-50"
          >
            USE FAILED AS INPUT
          </button>

          <button
            type="button"
            onClick={clearAll}
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

        {notice ? (
          <div className="mt-5 rounded-xl border border-neem/20 bg-neem/5 p-4 text-sm text-neem">
            {notice}
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
                  <p className="font-ui text-xs text-mitti mt-2">
                    {page.updatedAt ? new Date(page.updatedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                  </p>
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
                  <p className="font-ui text-xs text-mitti mt-2">Audience: {item.audience || 'NEEJEE customers'}</p>
                  <p className="font-ui text-xs text-mitti mt-1">Goal: {item.goal || 'inform and invite'}</p>
                  <p className="font-ui text-sm text-madder mt-3">{item.error}</p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => void runBatchWithItems([{ brief: item.brief, audience: item.audience || 'NEEJEE customers', goal: item.goal || 'inform and invite' }])}
                      disabled={running}
                      className="bg-kohl text-ivory px-3 py-2 rounded-sm text-xs font-medium disabled:opacity-50"
                    >
                      RETRY THIS ITEM
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBatchText([item.brief, item.audience || 'NEEJEE customers', item.goal || 'inform and invite'].join(' | '));
                        setNotice('Failed item copied into the batch editor.');
                      }}
                      className="border border-kohl/20 px-3 py-2 rounded-sm text-xs font-medium text-kohl bg-white"
                    >
                      COPY TO INPUT
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-mitti/15 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="label text-madder">RECENT CMS DRAFT HISTORY</p>
            <p className="font-ui text-sm text-mitti mt-2 leading-7">
              Recent draft pages saved through CMS flows, refreshed from the server. Use this history to reopen drafts after a batch run.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadHistory()}
            disabled={historyLoading}
            className="border border-kohl/20 px-4 py-2 rounded-sm text-sm font-medium text-kohl bg-white disabled:opacity-50"
          >
            {historyLoading ? 'LOADING HISTORY' : 'REFRESH HISTORY'}
          </button>
        </div>

        {history.length === 0 ? (
          <p className="font-ui text-sm text-mitti mt-4">No recent drafts found.</p>
        ) : (
          <div className="space-y-3 mt-5">
            {history.map((page) => (
              <div key={page.id} className="rounded-xl border border-kohl/10 bg-beige/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-xl text-kohl">{page.title}</p>
                    <p className="font-ui text-xs text-mitti mt-2">/{page.slug}</p>
                    <p className="font-ui text-xs text-mitti mt-2">
                      {page.updatedAt ? new Date(page.updatedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                    </p>
                  </div>
                  <p className="label text-madder">{page.status}</p>
                </div>

                {page.seoTitle ? (
                  <p className="font-ui text-xs text-kohl mt-3">SEO: {page.seoTitle}</p>
                ) : null}

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
      </section>

      <section className="rounded-2xl border border-mitti/15 bg-beige p-6">
        <p className="label text-madder">NOTES</p>
        <ul className="mt-4 space-y-3 text-sm text-mitti leading-7 list-disc pl-5">
          <li>Each generated page is saved as a CMS draft.</li>
          <li>Slug collisions are automatically resolved by suffixing the slug.</li>
          <li>If OpenAI is unavailable, the batch still creates sensible fallback draft structures.</li>
          <li>History is loaded from the server, while failed-item retry helpers are preserved in the browser for quick reruns.</li>
        </ul>
      </section>
    </div>
  );
}