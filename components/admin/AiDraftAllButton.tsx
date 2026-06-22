'use client';
// AiDraftAllButton \u2014 master "DRAFT WITH AI" button for product pages.
// Fills all draftable text fields in a single OpenAI call.
//
// Usage:
//   <AiDraftAllButton
//     form={form}
//     onApply={(draft) => setForm({...form, ...draft})}
//   />

import { useState } from 'react';
import { Sparkles, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

type Brief = {
  // Existing values (for skip-or-overwrite decision). All of these are
  // candidates for AI to fill EXCEPT artisanName (manual per founder spec).
  name?: string;
  shortName?: string;
  poeticLine?: string;
  description?: string;
  story?: string;
  craftNote?: string;
  careInstructions?: string;
  sustainabilityNote?: string;
  craft?: string;
  region?: string;
  state?: string;
  cluster?: string;
  material?: string;
  technique?: string;
  occasion?: string;
  seoTitle?: string;
  seoDesc?: string;
  // Manual-only (AI never writes here):
  artisanName?: string;
  // Seed context:
  categoryName?: string;
};

type DraftResult = {
  ok: boolean;
  configured?: boolean;
  draft?: Partial<Brief>;
  filled?: string[];
  skipped?: string[];
  message?: string;
  error?: string;
};

interface Props {
  form: Brief;
  onApply: (draft: Partial<Brief>) => void;
  className?: string;
}

export default function AiDraftAllButton({ form, onApply, className }: Props) {
  const [loading, setLoading] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [lastResult, setLastResult] = useState<DraftResult | null>(null);

  async function run() {
    // v26.1.2 — the working product name now also counts as an anchor.
    if (!form.craft && !form.categoryName && !form.region && !form.name) {
      alert(
        'Add at least a working product name, Craft, Region, or Category first so the AI has something to anchor on.\nExample: Name = "Banarsi silk saree".'
      );
      return;
    }
    if (
      !overwrite &&
      form.name &&
      form.description &&
      form.story &&
      !confirm('Most fields already have values. Toggle "Overwrite filled fields" if you want to redraft them. Continue with skip mode?')
    ) {
      return;
    }

    setLoading(true);
    setLastResult(null);
    try {
      const res = await fetch('/api/admin/products/ai-draft-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...form, overwrite, feedback: feedback.trim() || undefined }),
      });
      const data: DraftResult = await res.json();
      setLastResult(data);

      if (!res.ok || !data.ok) {
        alert(data.error || 'AI draft failed. Check Vercel logs.');
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
      alert(`Error: ${e?.message || 'Unknown'}`);
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
          {loading ? 'DRAFTING\u2026' : 'DRAFT WITH AI'}
        </button>
      </div>

      {showOptions && (
        <div className="bg-beige/60 border border-mitti/20 p-3 rounded w-80 text-left space-y-2">
          <label className="text-[11px] flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={e => setOverwrite(e.target.checked)}
              className="rounded"
            />
            <span>Overwrite already-filled fields (re-draft everything)</span>
          </label>
          <div>
            <label className="text-[10px] uppercase text-mitti block mb-1">Guidance (optional)</label>
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="e.g. make it more sensory, less formal, mention the artisan's hands\u2026"
              className="w-full p-2 text-xs border border-mitti/20 bg-ivory"
            />
            <p className="text-[10px] text-charcoal/50 mt-1">
              This guidance is applied to ALL drafted fields. For per-field feedback, use the \u21bb icon on each field.
            </p>
          </div>
        </div>
      )}

      {lastResult && lastResult.ok && (
        <div className="text-[11px] bg-emerald-50 border border-emerald-200 px-3 py-2 rounded inline-flex items-center gap-2 text-emerald-800">
          <CheckCircle2 className="w-3 h-3" />
          Filled {lastResult.filled?.length || 0} field(s)
          {lastResult.skipped && lastResult.skipped.length > 0 && (
            <span className="text-emerald-700/70">\u00b7 skipped {lastResult.skipped.length}</span>
          )}
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
