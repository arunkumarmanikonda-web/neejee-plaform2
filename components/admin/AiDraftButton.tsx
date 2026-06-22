'use client';
// AiDraftButton — modal-based AI content drafting for banners, badges, CMS, and other
// editor surfaces. Lets the editor pick an INTENT and optionally type a brief, then
// fills the parent fields via onApply.
//
// Usage:
//   <AiDraftButton
//     field="banner"
//     context={{ position: 'hero' }}                  // banner position / extra hints
//     onApply={(data) => setForm({ ...form, ...data })}
//     label="DRAFT WITH AI"
//   />

import { useState } from 'react';
import { Sparkles, Loader2, X, RefreshCw } from 'lucide-react';

type Field = 'banner' | 'badge' | 'cmsHero' | 'cmsText' | 'cmsQuote' | 'cmsFounderNote'
           | 'cmsJournal' | 'cmsTestimonial' | 'cmsFaq' | 'cmsFeatures' | 'cmsCta'
           | 'emailSubject' | 'emailBody' | 'imagePrompt';

type Intent = 'seasonal_sale' | 'new_arrival' | 'product_spotlight' | 'restock'
            | 'founder_note' | 'free_text';

interface Props {
  field: Field;
  context?: {
    position?: string;                           // banner position
    productContext?: { name?: string; craft?: string; region?: string; sellingPrice?: number; story?: string };
    [k: string]: any;
  };
  onApply: (data: any) => void;
  label?: string;
  // For Image-prompt-only field, the modal is much simpler
  className?: string;
}

const INTENT_OPTIONS: { v: Intent; l: string; desc: string }[] = [
  { v: 'seasonal_sale', l: 'Seasonal moment', desc: 'Diwali, monsoon, wedding season' },
  { v: 'new_arrival', l: 'New arrivals', desc: 'A fresh collection or piece' },
  { v: 'product_spotlight', l: 'Product spotlight', desc: 'Highlight one piece' },
  { v: 'restock', l: 'Restock', desc: 'Something popular is back' },
  { v: 'founder_note', l: 'Founder voice', desc: 'Personal note from Nidhi' },
  { v: 'free_text', l: 'Free-text brief', desc: 'You describe it' },
];

export function AiDraftButton({ field, context = {}, onApply, label = 'DRAFT WITH AI', className }: Props) {
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<Intent>('seasonal_sale');
  const [freeText, setFreeText] = useState('');
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const [error, setError] = useState('');

  const generate = async () => {
    setLoading(true); setError(''); setDraft(null);
    try {
      const r = await fetch('/api/ai/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field,
          intent,
          freeText: intent === 'free_text' ? freeText : undefined,
          ...context,
        }),
      });
      const t = await r.text();
      let j: any = {}; try { j = JSON.parse(t); } catch {}
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      if (j.configured === false) {
        setError('AI is not yet configured. Add OPENAI_API_KEY to activate.');
        return;
      }
      // The API returns either { text: "..." } or { json: { ... } } depending on field
      setDraft(j.json || j.data || j.text || j);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const apply = () => {
    if (!draft) return;
    // If draft is a string and field is imagePrompt, pass as { imagePrompt: text }
    if (typeof draft === 'string') {
      onApply(field === 'imagePrompt' ? { imagePrompt: draft } : { text: draft });
    } else {
      onApply(draft);
    }
    setOpen(false);
    setDraft(null);
    setFreeText('');
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className={className || 'inline-flex items-center gap-1.5 text-xs font-ui tracking-widest text-banarasi hover:text-kohl border border-banarasi/40 hover:bg-banarasi/10 px-2.5 py-1 rounded transition-colors'}>
        <Sparkles className="w-3 h-3" /> {label}
      </button>

      {open && (
        <div className="fixed inset-0 bg-kohl/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-ivory rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-ivory border-b border-mitti/20 p-5 flex items-center justify-between">
              <div>
                <h3 className="font-display text-xl text-kohl flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-banarasi" />
                  AI draft — {FIELD_LABELS[field] || field}
                </h3>
                <p className="text-mitti text-xs mt-0.5">Pick an intent and let the model do a first pass. You can edit before applying.</p>
              </div>
              <button onClick={() => { setOpen(false); setDraft(null); }} className="text-mitti hover:text-kohl">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Intent picker */}
              {!draft && (
                <>
                  <div>
                    <p className="label text-banarasi mb-2">INTENT</p>
                    <div className="grid grid-cols-2 gap-2">
                      {INTENT_OPTIONS.map(o => (
                        <button key={o.v} type="button" onClick={() => setIntent(o.v)}
                          className={`text-left p-3 rounded border transition-colors ${
                            intent === o.v
                              ? 'border-kohl bg-beige/40'
                              : 'border-mitti/20 hover:border-kohl/50'
                          }`}>
                          <p className="font-display text-sm text-kohl">{o.l}</p>
                          <p className="text-xs text-mitti mt-0.5">{o.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {intent === 'free_text' && (
                    <div>
                      <p className="label text-banarasi mb-1">YOUR BRIEF</p>
                      <textarea value={freeText} onChange={e => setFreeText(e.target.value)}
                        rows={3}
                        placeholder="e.g. We're celebrating 100 sarees sold from our Banarasi atelier. Make it warm and gratitude-forward."
                        className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory" />
                    </div>
                  )}

                  {context.position && (
                    <div className="bg-beige/40 p-3 rounded text-xs text-mitti">
                      <span className="font-display text-kohl">Context:</span> Banner position is <strong>{context.position}</strong>.
                    </div>
                  )}
                  {context.productContext?.name && (
                    <div className="bg-beige/40 p-3 rounded text-xs text-mitti">
                      <span className="font-display text-kohl">Product context:</span> <strong>{context.productContext.name}</strong>
                      {context.productContext.craft && <> · {context.productContext.craft}</>}
                    </div>
                  )}
                </>
              )}

              {error && <div className="bg-madder/10 border border-madder p-3 text-madder text-sm">{error}</div>}

              {/* Draft preview */}
              {draft && (
                <div>
                  <p className="label text-banarasi mb-2">PROPOSED DRAFT</p>
                  <DraftPreview field={field} draft={draft} />
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-mitti/10 sticky bottom-0 bg-ivory">
                {!draft ? (
                  <button onClick={generate} disabled={loading || (intent === 'free_text' && !freeText.trim())}
                    className="flex-1 bg-kohl text-ivory px-5 py-2.5 font-ui text-xs tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
                    {loading
                      ? <><Loader2 className="w-3 h-3 animate-spin" /> GENERATING…</>
                      : <><Sparkles className="w-3 h-3" /> GENERATE DRAFT</>}
                  </button>
                ) : (
                  <>
                    <button onClick={generate} disabled={loading}
                      className="border border-banarasi text-banarasi px-4 py-2 font-ui text-xs tracking-widest flex items-center gap-1 disabled:opacity-50">
                      <RefreshCw className="w-3 h-3" /> REGENERATE
                    </button>
                    <button onClick={apply}
                      className="flex-1 bg-kohl text-ivory px-5 py-2.5 font-ui text-xs tracking-widest">
                      APPLY TO FORM
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const FIELD_LABELS: Record<string, string> = {
  banner: 'banner',
  badge: 'authenticity badge',
  cmsHero: 'CMS hero',
  cmsText: 'CMS text block',
  cmsQuote: 'CMS quote',
  cmsFounderNote: 'founder note',
  cmsJournal: 'journal entry',
  cmsTestimonial: 'testimonial',
  cmsFaq: 'FAQ block',
  cmsFeatures: 'features grid',
  cmsCta: 'CTA block',
  emailSubject: 'email subject',
  emailBody: 'email body',
  imagePrompt: 'image prompt',
};

function DraftPreview({ field, draft }: { field: Field; draft: any }) {
  // Render a friendly preview based on field shape
  if (field === 'banner') {
    return (
      <div className="border border-mitti/20 rounded p-4 bg-beige/30">
        <p className="font-display text-xl text-kohl">{draft.title}</p>
        {draft.subtitle && <p className="text-mitti italic mt-1">{draft.subtitle}</p>}
        {draft.ctaText && (
          <div className="mt-3 flex items-center gap-3">
            <span className="bg-kohl text-ivory px-3 py-1 text-xs tracking-widest">{draft.ctaText}</span>
            {draft.ctaUrl && <span className="text-xs text-mitti">→ {draft.ctaUrl}</span>}
          </div>
        )}
        {draft.imagePrompt && (
          <div className="mt-4 pt-3 border-t border-mitti/10">
            <p className="label text-banarasi text-[10px] mb-1">SUGGESTED IMAGE PROMPT</p>
            <p className="text-xs text-mitti italic">{draft.imagePrompt}</p>
          </div>
        )}
      </div>
    );
  }
  if (field === 'badge') {
    return (
      <div className="border border-mitti/20 rounded p-4 bg-beige/30">
        <p className="font-display text-base text-kohl">{draft.label}</p>
        <p className="text-mitti text-sm mt-1">{draft.description}</p>
        <p className="text-xs text-mitti/60 mt-2">Group: {draft.group}</p>
      </div>
    );
  }
  if (typeof draft === 'string') {
    return <div className="border border-mitti/20 rounded p-4 bg-beige/30 text-mitti whitespace-pre-wrap">{draft}</div>;
  }
  // Generic JSON preview for everything else
  return (
    <pre className="border border-mitti/20 rounded p-4 bg-beige/30 text-xs text-kohl overflow-auto max-h-64 whitespace-pre-wrap">
      {JSON.stringify(draft, null, 2)}
    </pre>
  );
}
