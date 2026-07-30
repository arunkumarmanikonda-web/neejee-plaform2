'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  parentId?: string | null;
  level?: number;
  path?: string | null;
  active?: boolean;
  hidden?: boolean;
  featured?: boolean;
  aiGenerated?: boolean;
  gender?: string | null;
  _count?: { products?: number; children?: number };
};

type TaxonomyPlan = {
  objective: string;
  name: string;
  slug: string;
  parentId: string | null;
  parentName: string | null;
  level: number;
  gender: string | null;
  reasoning: string[];
  sampleChildren: string[];
  seoTitle: string;
  seoDescription: string;
  createStatus?: 'pending' | 'created' | 'failed';
  createdCategoryId?: string;
  createError?: string;
};

type FailedItem = {
  index: number;
  objective: string;
  error: string;
};

type HistoryItem = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  parentName: string | null;
  level: number;
  path: string | null;
  gender: string | null;
  aiGenerated: boolean;
  active: boolean;
  hidden: boolean;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
};

function parseObjectives(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.length >= 5)
    .slice(0, 8);
}

function serializeObjectives(values: string[]) {
  return values.join('\n');
}

export default function TaxonomyAiWorkbenchPage() {
  const [objectiveText, setObjectiveText] = useState([
    'Create a gifting-led taxonomy surface for handcrafted wedding return gifts',
    'Plan a bridal silk category branch under women for Kanchipuram discovery',
    'Add a founder-led festive edit branch for Banarasi and artisan gifting',
  ].join('\n'));

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [plans, setPlans] = useState<TaxonomyPlan[]>([]);
  const [failed, setFailed] = useState<FailedItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);

  const [loadingTaxonomy, setLoadingTaxonomy] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [creatingAll, setCreatingAll] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const objectives = useMemo(() => parseObjectives(objectiveText), [objectiveText]);

  const snapshot = useMemo(() => {
    const total = categories.length;
    const roots = categories.filter((c) => (c.level || 1) === 1).length;
    const active = categories.filter((c) => c.active !== false).length;
    const aiGenerated = categories.filter((c) => !!c.aiGenerated).length;
    return { total, roots, active, aiGenerated };
  }, [categories]);

  async function loadTaxonomy() {
    setLoadingTaxonomy(true);
    try {
      const res = await fetch('/api/admin/taxonomy', {
        cache: 'no-store',
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not load taxonomy');
      setCategories(Array.isArray(json.categories) ? json.categories : []);
    } catch (e: any) {
      setError(e.message || 'Could not load taxonomy');
    } finally {
      setLoadingTaxonomy(false);
    }
  }

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/admin/taxonomy/ai-batch', {
        cache: 'no-store',
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not load taxonomy AI history');
      setHistory(Array.isArray(json.recent) ? json.recent : []);
      if (typeof json.configured === 'boolean') setConfigured(json.configured);
    } catch (e: any) {
      setError(e.message || 'Could not load taxonomy AI history');
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    try {
      const storedText = window.sessionStorage.getItem('taxonomy-ai-objectives');
      const storedFailed = window.sessionStorage.getItem('taxonomy-ai-failed');
      if (storedText) setObjectiveText(storedText);
      if (storedFailed) {
        const parsed = JSON.parse(storedFailed);
        if (Array.isArray(parsed)) setFailed(parsed);
      }
    } catch {}
    void loadTaxonomy();
    void loadHistory();
  }, []);

  useEffect(() => {
    try {
      window.sessionStorage.setItem('taxonomy-ai-objectives', objectiveText);
    } catch {}
  }, [objectiveText]);

  async function runPlanBatch(values: string[]) {
    setError('');
    setNotice('');
    setPlans([]);
    setFailed([]);

    if (values.length === 0) {
      setError('Add at least one valid objective.');
      return;
    }

    setPlanning(true);
    try {
      const res = await fetch('/api/admin/taxonomy/ai-batch', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'plan',
          items: values.map((objective) => ({ objective })),
          categories,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Taxonomy AI batch failed');

      const nextPlans = Array.isArray(json.plans) ? json.plans : [];
      const nextFailed = Array.isArray(json.failed) ? json.failed : [];
      const nextHistory = Array.isArray(json.recent) ? json.recent : [];

      setConfigured(!!json.configured);
      setPlans(nextPlans);
      setFailed(nextFailed);
      setHistory(nextHistory);
      setNotice(`Planned ${nextPlans.length} node(s). Failed ${nextFailed.length}.`);

      try {
        window.sessionStorage.setItem('taxonomy-ai-failed', JSON.stringify(nextFailed));
      } catch {}
    } catch (e: any) {
      setError(e.message || 'Taxonomy AI batch failed');
    } finally {
      setPlanning(false);
    }
  }

  async function createPlans(items: TaxonomyPlan[]) {
    if (items.length === 0) {
      setError('No planned items are available to create.');
      return;
    }

    setError('');
    setNotice('');
    setCreatingAll(true);

    try {
      const res = await fetch('/api/admin/taxonomy/ai-batch', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'create',
          items: items.map((plan) => ({
            objective: plan.objective,
            plan,
          })),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Taxonomy category creation failed');

      const created = Array.isArray(json.created) ? json.created : [];
      const createFailed = Array.isArray(json.failed) ? json.failed : [];
      const nextHistory = Array.isArray(json.recent) ? json.recent : [];

      setPlans((prev) =>
        prev.map((plan) => {
          const success = created.find((item: any) => item.objective === plan.objective);
          if (success) {
            return {
              ...plan,
              createStatus: 'created',
              createdCategoryId: success.id,
              createError: '',
            };
          }

          const fail = createFailed.find((item: any) => item.objective === plan.objective);
          if (fail) {
            return {
              ...plan,
              createStatus: 'failed',
              createError: fail.error || 'Creation failed',
            };
          }

          return plan;
        })
      );

      setHistory(nextHistory);
      setNotice(`Created ${created.length} categor${created.length === 1 ? 'y' : 'ies'}. Failed ${createFailed.length}.`);
      await loadTaxonomy();
    } catch (e: any) {
      setError(e.message || 'Taxonomy category creation failed');
    } finally {
      setCreatingAll(false);
    }
  }

  async function retryFailedOnly() {
    const retryObjectives = failed.map((item) => item.objective).filter(Boolean);
    await runPlanBatch(retryObjectives);
  }

  function useFailedAsInput() {
    if (failed.length === 0) {
      setError('No failed items available.');
      return;
    }
    const text = serializeObjectives(failed.map((item) => item.objective).filter(Boolean));
    setObjectiveText(text);
    setNotice('Failed objectives copied back into the planner.');
  }

  function clearAll() {
    setObjectiveText('');
    setPlans([]);
    setFailed([]);
    setError('');
    setNotice('');
    setConfigured(null);
    try {
      window.sessionStorage.removeItem('taxonomy-ai-objectives');
      window.sessionStorage.removeItem('taxonomy-ai-failed');
    } catch {}
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label text-madder">TAXONOMY AI WORKBENCH</p>
          <h1 className="font-display text-4xl text-kohl mt-2">Batch planning, review, and approval</h1>
          <p className="font-ui text-sm text-mitti mt-3 max-w-4xl leading-7">
            Plan multiple taxonomy nodes, review parent placement and starter SEO, then approve and create only the categories you want.
            This workbench does not touch products or catalogue assignments.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/admin/ai" className="bg-kohl text-ivory px-4 py-2 rounded-sm text-sm font-medium">
            AI MANAGER
          </Link>
          <Link href="/admin/taxonomy" className="border border-kohl/20 px-4 py-2 rounded-sm text-sm font-medium text-kohl bg-white">
            TAXONOMY ROOT
          </Link>
          <Link href="/admin/settings#ai-recovery" className="border border-kohl/20 px-4 py-2 rounded-sm text-sm font-medium text-kohl bg-white">
            AI SETTINGS
          </Link>
          <Link href="/admin/cms/ai" className="border border-kohl/20 px-4 py-2 rounded-sm text-sm font-medium text-kohl bg-white">
            CMS AI BATCH
          </Link>
        </div>
      </div>

      <section className="rounded-2xl border border-kohl/10 bg-beige p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="label text-madder">AI RECOVERY LINKS</p>
            <p className="font-ui text-sm text-mitti mt-2 max-w-4xl leading-7">
              Use the live AI Manager recovery routes while direct taxonomy routes remain inconsistent in production.
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
        <p className="label text-madder">PLAN A CATEGORY BATCH</p>
        <p className="font-ui text-sm text-mitti mt-3 leading-7">
          Enter one objective per line. Example: create a gifting-led taxonomy surface for handcrafted wedding return gifts.
        </p>

        <textarea
          value={objectiveText}
          onChange={(e) => setObjectiveText(e.target.value)}
          className="mt-4 min-h-[240px] w-full rounded-xl border border-kohl/10 bg-beige/30 p-4 font-ui text-sm text-kohl outline-none focus:border-kohl/30"
          placeholder="Create a founder-led festive edit category branch"
        />

        <div className="grid md:grid-cols-5 gap-4 mt-5">
          <div className="rounded-xl border border-mitti/15 bg-beige p-4">
            <p className="label text-madder">VALID OBJECTIVES</p>
            <p className="font-display text-3xl text-kohl mt-2">{objectives.length}</p>
          </div>
          <div className="rounded-xl border border-mitti/15 bg-beige p-4">
            <p className="label text-madder">OPENAI STATUS</p>
            <p className="font-display text-3xl text-kohl mt-2">
              {configured === null ? 'â€”' : configured ? 'AI' : 'FALLBACK'}
            </p>
          </div>
          <div className="rounded-xl border border-mitti/15 bg-beige p-4">
            <p className="label text-madder">TOTAL</p>
            <p className="font-display text-3xl text-kohl mt-2">{snapshot.total}</p>
          </div>
          <div className="rounded-xl border border-mitti/15 bg-beige p-4">
            <p className="label text-madder">ROOTS</p>
            <p className="font-display text-3xl text-kohl mt-2">{snapshot.roots}</p>
          </div>
          <div className="rounded-xl border border-mitti/15 bg-beige p-4">
            <p className="label text-madder">AI-GENERATED</p>
            <p className="font-display text-3xl text-kohl mt-2">{snapshot.aiGenerated}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-6">
          <button
            type="button"
            onClick={() => void runPlanBatch(objectives)}
            disabled={planning}
            className="bg-kohl text-ivory px-5 py-3 rounded-sm text-sm font-medium disabled:opacity-60"
          >
            {planning ? 'RUNNING TAXONOMY AI BATCH' : 'GENERATE TAXONOMY AI BATCH'}
          </button>

          <button
            type="button"
            onClick={() => void createPlans(plans.filter((plan) => plan.createStatus !== 'created'))}
            disabled={creatingAll || plans.length === 0}
            className="border border-kohl/20 px-5 py-3 rounded-sm text-sm font-medium text-kohl bg-white disabled:opacity-50"
          >
            {creatingAll ? 'CREATING APPROVED CATEGORIES' : 'APPROVE & CREATE ALL'}
          </button>

          <button
            type="button"
            onClick={() => void retryFailedOnly()}
            disabled={planning || failed.length === 0}
            className="border border-kohl/20 px-5 py-3 rounded-sm text-sm font-medium text-kohl bg-white disabled:opacity-50"
          >
            RETRY FAILED ONLY
          </button>

          <button
            type="button"
            onClick={() => void loadTaxonomy()}
            disabled={loadingTaxonomy}
            className="border border-kohl/20 px-5 py-3 rounded-sm text-sm font-medium text-kohl bg-white disabled:opacity-50"
          >
            {loadingTaxonomy ? 'REFRESHING TAXONOMY' : 'REFRESH TAXONOMY'}
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
          <p className="label text-madder">PLAN OUTPUT</p>
          {plans.length === 0 ? (
            <p className="font-ui text-sm text-mitti mt-4">No plan output yet.</p>
          ) : (
            <div className="space-y-4 mt-4">
              {plans.map((plan, index) => (
                <div key={`${plan.objective}-${index}`} className="rounded-xl border border-kohl/10 bg-beige/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-xl text-kohl">{plan.name}</p>
                      <p className="font-ui text-xs text-mitti mt-2">Objective: {plan.objective}</p>
                      <p className="font-ui text-xs text-mitti mt-1">Slug: {plan.slug}</p>
                      <p className="font-ui text-xs text-mitti mt-1">Parent: {plan.parentName || 'Root'}</p>
                      <p className="font-ui text-xs text-mitti mt-1">Level: {plan.level}</p>
                      <p className="font-ui text-xs text-mitti mt-1">Gender: {plan.gender || 'None'}</p>
                    </div>
                    <p className={`label ${plan.createStatus === 'created' ? 'text-neem' : plan.createStatus === 'failed' ? 'text-madder' : 'text-kohl'}`}>
                      {plan.createStatus === 'created' ? 'CREATED' : plan.createStatus === 'failed' ? 'CREATE FAILED' : 'PLANNED'}
                    </p>
                  </div>

                  <div className="mt-4">
                    <p className="label text-madder">REASONING</p>
                    <ul className="mt-2 space-y-2 text-sm text-mitti leading-7 list-disc pl-5">
                      {(plan.reasoning || []).map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                  </div>

                  <div className="mt-4">
                    <p className="label text-madder">SAMPLE CHILDREN</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(plan.sampleChildren || []).map((item, i) => (
                        <span key={i} className="px-3 py-1 border border-kohl/15 bg-white text-xs text-kohl rounded-sm">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="label text-madder">STARTER SEO</p>
                    <p className="font-ui text-xs text-kohl mt-2">Title: {plan.seoTitle}</p>
                    <p className="font-ui text-xs text-mitti mt-2 leading-6">Description: {plan.seoDescription}</p>
                  </div>

                  {plan.createError ? (
                    <div className="mt-4 rounded-xl border border-madder/20 bg-madder/5 p-3 text-sm text-madder">
                      {plan.createError}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => void createPlans([plan])}
                      disabled={creatingAll || plan.createStatus === 'created'}
                      className="bg-kohl text-ivory px-3 py-2 rounded-sm text-xs font-medium disabled:opacity-50"
                    >
                      {plan.createStatus === 'created' ? 'CATEGORY CREATED' : 'APPROVE & CREATE'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void runPlanBatch([plan.objective])}
                      disabled={planning}
                      className="border border-kohl/20 px-3 py-2 rounded-sm text-xs font-medium text-kohl bg-white disabled:opacity-50"
                    >
                      REGENERATE
                    </button>
                    <Link href="/admin/taxonomy" className="border border-kohl/20 px-3 py-2 rounded-sm text-xs font-medium text-kohl bg-white">
                      OPEN TAXONOMY EDITOR
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-mitti/15 bg-white p-6">
          <p className="label text-madder">FAILED OBJECTIVES</p>
          {failed.length === 0 ? (
            <p className="font-ui text-sm text-mitti mt-4">No failed objectives.</p>
          ) : (
            <div className="space-y-3 mt-4">
              {failed.map((item) => (
                <div key={`${item.index}-${item.objective}`} className="rounded-xl border border-madder/20 bg-madder/5 p-4">
                  <p className="font-display text-lg text-kohl">Line {item.index + 1}</p>
                  <p className="font-ui text-sm text-kohl mt-2">{item.objective}</p>
                  <p className="font-ui text-sm text-madder mt-3">{item.error}</p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => void runPlanBatch([item.objective])}
                      disabled={planning}
                      className="bg-kohl text-ivory px-3 py-2 rounded-sm text-xs font-medium disabled:opacity-50"
                    >
                      RETRY THIS OBJECTIVE
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setObjectiveText(item.objective);
                        setNotice('Failed objective copied into the planner.');
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
            <p className="label text-madder">RECENT AI-GENERATED CATEGORY HISTORY</p>
            <p className="font-ui text-sm text-mitti mt-2 leading-7">
              Recent AI-generated category approvals saved to taxonomy. Use this history to audit new nodes and reopen the taxonomy editor.
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
          <p className="font-ui text-sm text-mitti mt-4">No AI-generated category history yet.</p>
        ) : (
          <div className="space-y-3 mt-5">
            {history.map((item) => (
              <div key={item.id} className="rounded-xl border border-kohl/10 bg-beige/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-xl text-kohl">{item.name}</p>
                    <p className="font-ui text-xs text-mitti mt-2">Slug: {item.slug}</p>
                    <p className="font-ui text-xs text-mitti mt-1">Path: {item.path || item.slug}</p>
                    <p className="font-ui text-xs text-mitti mt-1">Parent: {item.parentName || 'Root'}</p>
                    <p className="font-ui text-xs text-mitti mt-1">Level: {item.level}</p>
                    <p className="font-ui text-xs text-mitti mt-1">
                      Updated: {new Date(item.updatedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="label text-madder">{item.aiGenerated ? 'AI-GENERATED' : 'MANUAL'}</p>
                    <p className="font-ui text-xs text-mitti mt-2">{item.gender || 'None'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  <Link href="/admin/taxonomy" className="bg-kohl text-ivory px-3 py-2 rounded-sm text-xs font-medium">
                    OPEN TAXONOMY EDITOR
                  </Link>
                  <Link href="/admin/ai?surface=taxonomy" className="border border-kohl/20 px-3 py-2 rounded-sm text-xs font-medium text-kohl bg-white">
                    TAXONOMY RECOVERY
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-mitti/15 bg-beige p-6">
        <p className="label text-madder">SAFE BATCH BEHAVIOR</p>
        <ul className="mt-4 space-y-3 text-sm text-mitti leading-7 list-disc pl-5">
          <li>The workbench plans taxonomy nodes only. It does not modify products, listings, or catalogue assignments.</li>
          <li>Approve and create is separate from planning so operators can review parent placement before writing to taxonomy.</li>
          <li>History is server-backed, while failed objectives are preserved in the browser for rapid reruns.</li>
        </ul>
      </section>
    </div>
  );
}