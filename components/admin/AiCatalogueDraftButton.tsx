'use client';

import { useState } from 'react';
import { Sparkles, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

type CatalogueDraft = {
  catalogueStoryBlock?: string;
  catalogueAudienceTag?: string;
  catalogueCtaMode?: string;
  catalogueImageQualityScore?: number | null;
  catalogueFeatured?: boolean;
  catalogueBestseller?: boolean;
  catalogueEditorial?: boolean;
  cataloguePinHero?: boolean;
  catalogueStockVisibility?: 'IN_STOCK_ONLY' | 'SHOW_ALL' | 'HIDE_STOCK';
  cataloguePreferredImage?: string | null;
};

type CatalogueBrief = {
  name?: string;
  shortName?: string;
  description?: string;
  poeticLine?: string;
  story?: string;
  craft?: string;
  region?: string;
  material?: string;
  technique?: string;
  occasion?: string;
  categoryName?: string;
  images?: string[];
  catalogueStoryBlock?: string;
  catalogueAudienceTag?: string;
  catalogueCtaMode?: string;
  catalogueImageQualityScore?: number | null;
  catalogueFeatured?: boolean;
  catalogueBestseller?: boolean;
  catalogueEditorial?: boolean;
  cataloguePinHero?: boolean;
  catalogueStockVisibility?: 'IN_STOCK_ONLY' | 'SHOW_ALL' | 'HIDE_STOCK';
  cataloguePreferredImage?: string | null;
};

type DraftResult = {
  ok: boolean;
  configured?: boolean;
  draft?: CatalogueDraft;
  message?: string;
  error?: string;
};

interface Props {
  form: CatalogueBrief;
  onApply: (draft: CatalogueDraft) => void;
  className?: string;
}

export default function AiCatalogueDraftButton({ form, onApply, className }: Props) {
  const [loading, setLoading] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [lastResult, setLastResult] = useState<DraftResult | null>(null);

  async function run() {
    if (!form.name && !form.description && !form.story && !form.categoryName) {
      alert('Add at least a product name, description, story, or category before drafting catalogue fields.');
      return;
    }

    setLoading(true);
    setLastResult(null);

    try {
      const res = await fetch('/api/admin/products/ai-draft-catalogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...form, overwrite, feedback: feedback.trim() || undefined }),
      });

      const data: DraftResult = await res.json();
      setLastResult(data);

      if (!res.ok || !data.ok) {
        alert(data.error || 'AI catalogue draft failed. Check server logs.');
        return;
      }

      if (data.configured === false) {
        alert(data.message || 'OpenAI not configured.');
        return;
      }

      if (data.draft) {
        onApply(data.draft);
      }

      setShowOptions(false);
      setFeedback('');
    } catch (e: any) {
      alert(`Error: ${e?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`inline-flex flex-col items-end gap-2 ${className || ''}`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowOptions(o => !o)}
          className="text-[10px] tracking-widest text-mitti hover:text-madder underline"
        >
          {showOptions ? 'HIDE OPTIONS' : 'OPTIONS'}
        </button>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? 'DRAFTING…' : 'DRAFT CATALOGUE WITH AI'}
        </button>
      </div>

      {showOptions && (
        <div className="bg-beige/60 border border-mitti/20 p-3 rounded w-96 text-left space-y-2">
          <label className="text-[11px] flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={e => setOverwrite(e.target.checked)}
              className="rounded"
            />
            <span>Overwrite already-filled catalogue fields</span>
          </label>
          <div>
            <label className="text-[10px] uppercase text-mitti block mb-1">Guidance (optional)</label>
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="e.g. make it more editorial, gifting-focused, hero-worthy, or keep it subtle and premium..."
              className="w-full p-2 text-xs border border-mitti/20 bg-ivory"
            />
            <p className="text-[10px] text-charcoal/50 mt-1">
              Generates suggestions only. Review and edit before clicking Save Changes.
            </p>
          </div>
        </div>
      )}

      {lastResult && lastResult.ok && (
        <div className="text-[11px] bg-emerald-50 border border-emerald-200 px-3 py-2 rounded inline-flex items-center gap-2 text-emerald-800">
          <CheckCircle2 className="w-3 h-3" />
          Catalogue draft applied to the form
        </div>
      )}

      {lastResult && lastResult.error && (
        <div className="text-[11px] bg-rose-50 border border-rose-200 px-3 py-2 rounded inline-flex items-center gap-2 text-rose-800">
          <AlertCircle className="w-3 h-3" />
          {lastResult.error}
        </div>
      )}
    </div>
  );
}
