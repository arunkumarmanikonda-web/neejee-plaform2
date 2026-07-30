'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Wand2, CheckCircle2, FolderTree, ArrowRight, Plus, RefreshCcw } from 'lucide-react';

type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  level: number;
  path: string | null;
  active: boolean;
  hidden: boolean;
  gender: string | null;
  aiGenerated: boolean;
  _count?: { products: number; children: number };
};

type TaxonomyPlan = {
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
};

type PlanResponse = {
  ok?: boolean;
  configured?: boolean;
  plan?: TaxonomyPlan;
  error?: string;
};

export const dynamic = 'force-dynamic';

export default function TaxonomyAiPlannerPage() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [objective, setObjective] = useState('');
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [plan, setPlan] = useState<TaxonomyPlan | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/taxonomy', { credentials: 'include', cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load taxonomy');
      setCategories(data.categories || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load taxonomy');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const parent = useMemo(
    () => plan?.parentId ? categories.find(c => c.id === plan.parentId) || null : null,
    [plan, categories]
  );

  const generatePlan = async () => {
    setGenerating(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/admin/taxonomy/ai-plan', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objective,
          categories: categories.map(c => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            parentId: c.parentId,
            level: c.level,
            path: c.path,
            active: c.active,
            hidden: c.hidden,
            gender: c.gender,
          })),
        }),
      });
      const data = (await res.json()) as PlanResponse;
      if (!res.ok) throw new Error(data?.error || 'AI taxonomy planning failed');
      setPlan(data.plan || null);
      setNotice(
        data?.configured
          ? 'AI taxonomy plan ready.'
          : 'Fallback taxonomy plan ready. Add OPENAI_API_KEY for model-generated planning.'
      );
    } catch (e: any) {
      setError(e?.message || 'AI taxonomy planning failed');
    } finally {
      setGenerating(false);
    }
  };

  const createSuggestedCategory = async () => {
    if (!plan) return;
    setCreating(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/admin/taxonomy', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: plan.name,
          parentId: plan.parentId,
          gender: plan.gender || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to create suggested category');
      setNotice(`Created category: ${data?.category?.name || plan.name}`);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to create suggested category');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label text-madder">TAXONOMY AI PLANNER</p>
          <h1 className="font-display text-4xl text-kohl mt-2 flex items-center gap-3">
            <Sparkles className="w-7 h-7 text-madder" /> Taxonomy AI Planner
          </h1>
          <p className="font-ui text-sm text-mitti mt-3 max-w-4xl leading-7">
            Plan new taxonomy nodes with suggested parent, level, gender, slug direction, and starter child ideas —
            without touching product or catalogue flows.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/admin/ai" className="px-4 py-2 border border-kohl/15 bg-white text-kohl text-sm tracking-wider hover:bg-beige/40">
            AI MANAGER
          </Link>
          <Link href="/admin/taxonomy" className="px-4 py-2 border border-kohl/15 bg-white text-kohl text-sm tracking-wider hover:bg-beige/40">
            TAXONOMY
          </Link>
          <Link href="/admin/cms" className="px-4 py-2 border border-kohl/15 bg-white text-kohl text-sm tracking-wider hover:bg-beige/40">
            CMS
          </Link>
          <Link href="/admin/seo" className="px-4 py-2 border border-kohl/15 bg-white text-kohl text-sm tracking-wider hover:bg-beige/40">
            SEO
          </Link>
        </div>
      </div>

      <section className="rounded-2xl border border-mitti/15 bg-gradient-to-br from-madder/10 to-banarasi/10 p-6">
        <div className="flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-madder" />
          <p className="label text-madder">PLAN A CATEGORY</p>
        </div>

        <div className="grid xl:grid-cols-[1.1fr_0.9fr] gap-6 mt-5">
          <div>
            <label className="label text-mitti">OBJECTIVE</label>
            <textarea
              value={objective}
              onChange={e => setObjective(e.target.value)}
              rows={6}
              placeholder="Example: create a new gifting-led taxonomy surface for founder-picked wedding favours, with room for subcategories and a clean top-level placement."
              className="w-full mt-2 p-4 bg-ivory border border-mitti/20 rounded-xl"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={generatePlan}
                disabled={loading || generating}
                className="bg-madder text-ivory px-5 py-3 text-sm tracking-wider hover:bg-madder/90 disabled:opacity-50 inline-flex items-center gap-2"
              >
                <Wand2 className="w-4 h-4" />
                {generating ? 'GENERATING PLAN...' : 'GENERATE AI TAXONOMY PLAN'}
              </button>
              <button
                onClick={() => void load()}
                disabled={loading}
                className="bg-white border border-kohl/15 text-kohl px-5 py-3 text-sm tracking-wider hover:bg-beige/30 disabled:opacity-50 inline-flex items-center gap-2"
              >
                <RefreshCcw className="w-4 h-4" />
                REFRESH TAXONOMY
              </button>
            </div>

            {error && <div className="mt-4 bg-haldi/20 text-haldi p-3 text-sm rounded-lg">{error}</div>}
            {notice && <div className="mt-4 bg-neem/10 text-neem p-3 text-sm rounded-lg">{notice}</div>}
          </div>

          <div className="bg-ivory border border-mitti/15 rounded-2xl p-5">
            <p className="label text-madder">TAXONOMY SNAPSHOT</p>
            <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
              <div className="bg-white border border-mitti/10 rounded-xl p-3">
                <p className="label text-mitti">TOTAL</p>
                <p className="mt-2 text-kohl">{categories.length}</p>
              </div>
              <div className="bg-white border border-mitti/10 rounded-xl p-3">
                <p className="label text-mitti">ROOTS</p>
                <p className="mt-2 text-kohl">{categories.filter(c => c.level === 1).length}</p>
              </div>
              <div className="bg-white border border-mitti/10 rounded-xl p-3">
                <p className="label text-mitti">ACTIVE</p>
                <p className="mt-2 text-kohl">{categories.filter(c => c.active).length}</p>
              </div>
              <div className="bg-white border border-mitti/10 rounded-xl p-3">
                <p className="label text-mitti">AI-GENERATED FLAGGED</p>
                <p className="mt-2 text-kohl">{categories.filter(c => c.aiGenerated).length}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-mitti/15 bg-white p-6">
        <div className="flex items-center gap-2">
          <FolderTree className="w-5 h-5 text-madder" />
          <p className="label text-madder">PLAN OUTPUT</p>
        </div>

        {!plan ? (
          <p className="text-sm text-mitti mt-4">No taxonomy plan yet. Generate one to get a suggested category structure.</p>
        ) : (
          <div className="grid xl:grid-cols-[1fr_0.9fr] gap-6 mt-5">
            <div className="space-y-5">
              <div>
                <h2 className="font-display text-3xl text-kohl">{plan.name}</h2>
                <p className="text-sm text-mitti mt-2">Slug direction: <span className="text-kohl">{plan.slug}</span></p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-beige rounded-xl p-4 border border-mitti/10">
                  <p className="label text-madder">PARENT</p>
                  <p className="text-kohl mt-2">{plan.parentName || 'ROOT LEVEL'}</p>
                </div>
                <div className="bg-beige rounded-xl p-4 border border-mitti/10">
                  <p className="label text-madder">LEVEL</p>
                  <p className="text-kohl mt-2">{plan.level}</p>
                </div>
                <div className="bg-beige rounded-xl p-4 border border-mitti/10">
                  <p className="label text-madder">GENDER</p>
                  <p className="text-kohl mt-2">{plan.gender || 'None'}</p>
                </div>
                <div className="bg-beige rounded-xl p-4 border border-mitti/10">
                  <p className="label text-madder">CURRENT MATCH</p>
                  <p className="text-kohl mt-2">{parent ? parent.name : 'No exact parent match loaded'}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="label text-madder">REASONING</p>
                {plan.reasoning.map((item, idx) => (
                  <div key={`${item}-${idx}`} className="flex gap-2 text-sm text-kohl">
                    <span className="text-madder mt-[2px]">-</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <p className="label text-madder">SAMPLE CHILDREN</p>
                {plan.sampleChildren.map((item, idx) => (
                  <div key={`${item}-${idx}`} className="flex items-center gap-2 text-sm text-kohl">
                    <ArrowRight className="w-4 h-4 text-madder shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  onClick={createSuggestedCategory}
                  disabled={creating}
                  className="bg-kohl text-ivory px-5 py-3 text-sm tracking-wider hover:bg-kohl/90 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {creating ? 'CREATING CATEGORY...' : 'CREATE SUGGESTED CATEGORY'}
                </button>
                <Link href="/admin/taxonomy" className="px-5 py-3 border border-kohl/15 bg-white text-kohl text-sm tracking-wider hover:bg-beige/30">
                  OPEN TAXONOMY EDITOR
                </Link>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-beige rounded-2xl p-5 border border-mitti/10">
                <p className="label text-madder">SEO STARTER</p>
                <p className="text-sm text-kohl mt-3"><span className="font-semibold">Title:</span> {plan.seoTitle}</p>
                <p className="text-sm text-kohl mt-3 leading-6"><span className="font-semibold">Description:</span> {plan.seoDescription}</p>
              </div>

              <div className="bg-ivory rounded-2xl p-5 border border-mitti/10">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-neem" />
                  <p className="label text-madder">SAFE BATCH BEHAVIOR</p>
                </div>
                <p className="text-sm text-mitti mt-3 leading-6">
                  This planner suggests taxonomy structure and can create only the one proposed category.
                  It does not modify products, catalogue data, or existing category assignments.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}