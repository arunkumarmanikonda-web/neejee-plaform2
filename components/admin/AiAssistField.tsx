'use client';
// AiAssistField — a universal field wrapper that adds a small ↻ AI button
// to any text input or textarea. The button calls /api/ai/content with the
// configured field key and applies the returned text to the field.
//
// Designed for surfaces where a full DRAFT modal would be overkill:
// coupon names, drop announcements, loyalty perks, category intros, etc.
//
// Usage:
//   <AiAssistField
//     label="Coupon name"
//     field="couponName"
//     value={form.name}
//     onChange={v => setForm(f => ({ ...f, name: v }))}
//     brief={{ code: form.code, discount: form.discount }}
//   />
//
// For multi-key returns (e.g. couponBanner returns { headline, subtitle, ctaText }),
// supply an onApplyJson callback to receive the whole object.

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

interface Props {
  label?: string;
  field: string;
  value: string;
  onChange: (v: string) => void;
  brief?: Record<string, any>;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  help?: string;
  className?: string;
  inputClassName?: string;
  // When the AI returns structured JSON, the caller gets the whole object
  onApplyJson?: (data: any) => void;
  // Visible label for the AI button. Defaults to "AI".
  buttonLabel?: string;
  disabled?: boolean;
}

export default function AiAssistField({
  label,
  field,
  value,
  onChange,
  brief,
  multiline,
  rows = 3,
  placeholder,
  help,
  className,
  inputClassName,
  onApplyJson,
  buttonLabel = 'AI',
  disabled,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ai/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ field, ...(brief || {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'AI failed');
      if (data.configured === false) {
        setError('AI not configured (OPENAI_API_KEY missing).');
        return;
      }
      // Prefer json then text
      if (data.json) {
        if (onApplyJson) onApplyJson(data.json);
        else {
          // Best-effort: pick the first string field of the json
          const firstStr = Object.values(data.json).find(v => typeof v === 'string') as string | undefined;
          if (firstStr) onChange(firstStr);
        }
      } else if (data.text) {
        onChange(String(data.text).trim());
      }
    } catch (e: any) {
      setError(e.message || 'AI failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <label className="label text-mitti">{label}</label>
          <button
            type="button"
            onClick={run}
            disabled={loading || disabled}
            className="text-[10px] tracking-widest text-madder hover:text-kohl inline-flex items-center gap-1 disabled:opacity-50"
            title="Draft with AI"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {loading ? 'DRAFTING…' : buttonLabel}
          </button>
        </div>
      )}
      {multiline ? (
        <textarea
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          disabled={disabled}
          className={inputClassName || 'w-full p-2 bg-ivory border border-mitti/20 text-sm'}
        />
      ) : (
        <input
          type="text"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={inputClassName || 'w-full p-2 bg-ivory border border-mitti/20 text-sm'}
        />
      )}
      {!label && (
        <div className="mt-1">
          <button
            type="button"
            onClick={run}
            disabled={loading || disabled}
            className="text-[10px] tracking-widest text-madder hover:text-kohl inline-flex items-center gap-1 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {loading ? 'DRAFTING…' : `✦ ${buttonLabel}`}
          </button>
        </div>
      )}
      {help && <p className="text-[10px] text-mitti/70 mt-1">{help}</p>}
      {error && <p className="text-[10px] text-madder mt-1">{error}</p>}
    </div>
  );
}
