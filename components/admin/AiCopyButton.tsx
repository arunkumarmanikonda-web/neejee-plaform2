'use client';
// Small inline button that calls /api/ai/content to draft copy for a field.
// On success, fills the field via onApply. Shows graceful message if AI not configured.
import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

interface Props {
  field:
    | 'poeticLine'
    | 'description'
    | 'story'
    | 'craftNote'
    | 'careInstructions'
    | 'seo'
    | 'returnPolicy'
    | 'productName'
    | 'shortName'
    | 'material'
    | 'technique'
    | 'occasion'
    | 'sustainabilityNote';
  brief: {
    name: string;
    craft?: string;
    region?: string;
    artisanName?: string;
    material?: string;
    technique?: string;
    occasion?: string;
    returnEligible?: boolean;
    // open-ended additional context fields
    [key: string]: any;
  };
  onApply: (data: any) => void;  // called with { text } or { seoTitle, seoDesc }
  label?: string;
}

export function AiCopyButton({ field, brief, onApply, label = 'DRAFT WITH AI' }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    // productName + shortName + material etc. can be drafted before name exists
    const needsName = !['productName', 'shortName', 'material', 'technique', 'occasion'].includes(field);
    if (needsName && !brief.name) { setError('Add product name first'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/ai/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...brief, field }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'AI request failed');
      if (j.configured === false) {
        setError('AI is being prepared. Add OPENAI_API_KEY to activate.');
        return;
      }
      if (field === 'seo') {
        onApply({ seoTitle: j.seoTitle, seoDesc: j.seoDesc });
      } else {
        onApply({ text: j.text });
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setTimeout(() => setError(''), 5000);
    }
  };

  return (
    <div className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="text-[10px] tracking-[0.2em] text-madder hover:text-kohl flex items-center gap-1.5 disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
        {loading ? 'DRAFTING…' : label}
      </button>
      {error && <span className="text-[10px] text-madder mt-1">{error}</span>}
    </div>
  );
}
