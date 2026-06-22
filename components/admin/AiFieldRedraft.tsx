'use client';
// AiFieldRedraft \u2014 inline "\u21bb" button next to a single field. Opens a small
// popover with a feedback textarea so the admin can ask AI to redraft THIS
// field with specific guidance.
//
// Different from AiCopyButton: that one drafts from scratch with no feedback
// input. This one is the "redraft with feedback" variant.

import { useState } from 'react';
import { RefreshCw, Loader2, X } from 'lucide-react';

interface Props {
  field:
    | 'productName'
    | 'shortName'
    | 'poeticLine'
    | 'description'
    | 'story'
    | 'craftNote'
    | 'careInstructions'
    | 'sustainabilityNote'
    | 'material'
    | 'technique'
    | 'occasion'
    | 'seo'
    | 'returnPolicy';
  brief: {
    name?: string;
    craft?: string;
    region?: string;
    artisanName?: string;
    material?: string;
    technique?: string;
    occasion?: string;
    currentValue?: string;
  };
  onApply: (text: string) => void;
  // Optional: label override
  buttonLabel?: string;
}

export default function AiFieldRedraft({ field, brief, onApply, buttonLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          field,
          ...brief,
          // Feedback signal: the AI route will pick this up if it exists
          feedback: feedback.trim() || undefined,
          // Current value gives the model something to "react against"
          previousDraft: brief.currentValue || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Redraft failed');
        return;
      }
      if (data.configured === false) {
        alert('OpenAI not configured.');
        return;
      }
      const text = data.text || data.seoTitle || JSON.stringify(data.json || '');
      if (text) {
        onApply(text);
        setOpen(false);
        setFeedback('');
      }
    } catch (e: any) {
      alert(`Error: ${e?.message || 'Unknown'}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title="Redraft this field with feedback"
        className="text-[10px] tracking-widest text-mitti hover:text-madder inline-flex items-center gap-1"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
        {buttonLabel || 'REDRAFT'}
      </button>

      {open && (
        <div className="absolute right-0 top-5 z-30 w-80 bg-ivory border border-mitti/30 shadow-lg p-3 rounded">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase text-mitti">Redraft with feedback</span>
            <button onClick={() => setOpen(false)} className="text-mitti hover:text-madder">
              <X className="w-3 h-3" />
            </button>
          </div>
          <textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="e.g. shorter, more sensory, mention the artisan\u2019s hands, less formal\u2026"
            className="w-full p-2 text-xs border border-mitti/20 bg-beige"
            autoFocus
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-[10px] text-charcoal/50">{feedback.length}/500</span>
            <button
              type="button"
              onClick={run}
              disabled={loading}
              className="btn-primary text-[11px] inline-flex items-center gap-1 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              {loading ? 'DRAFTING\u2026' : 'REDRAFT'}
            </button>
          </div>
          <p className="text-[10px] text-charcoal/50 mt-2">
            Leave guidance blank to just regenerate with the same prompt.
          </p>
        </div>
      )}
    </div>
  );
}
