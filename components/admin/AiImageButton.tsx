'use client';
// v23.40.22 — Reusable AI image generation button for any admin surface.
// Sits next to a SingleImageInput / URL field. Opens a modal with prompt
// builder, calls /api/admin/ai/generate-image, shows preview, and on apply
// fires `onApply(url)` so the parent can stuff the URL into its form.
//
// Usage:
//   <AiImageButton
//     onApply={(url) => setForm({ ...form, image: url })}
//     initialPrompt={form.aiImagePrompt}     // optional, prefilled
//     aspectRatio="16:9"                     // default '16:9'
//     folder="banners/hero"                  // supabase folder
//     filenameHint="hero-banner"
//     label="GENERATE WITH AI"
//   />

import { useState } from 'react';
import { Sparkles, Loader2, X, RefreshCw, Image as ImageIcon, Check } from 'lucide-react';

const ASPECTS = [
  { v: '16:9', l: '16:9 — wide hero / banner' },
  { v: '4:3', l: '4:3 — classic landscape' },
  { v: '1:1', l: '1:1 — square (Instagram / product)' },
  { v: '3:4', l: '3:4 — portrait card' },
  { v: '9:16', l: '9:16 — story / reel' },
  { v: '21:9', l: '21:9 — cinematic ultra-wide' },
] as const;

const MODELS = [
  { v: 'nano-banana-pro', l: 'Nano Banana Pro', sub: 'highest quality · ~30s', recommended: true },
  { v: 'flux-schnell',    l: 'Flux Schnell',    sub: 'fast · ~5s · best for seals/icons' },
] as const;

interface Props {
  onApply: (imageUrl: string) => void;
  initialPrompt?: string;
  aspectRatio?: '16:9' | '4:3' | '1:1' | '3:4' | '9:16' | '21:9';
  folder?: string;
  filenameHint?: string;
  label?: string;
  className?: string;
  /** Restrict aspect ratio (don't let editor change). */
  lockAspect?: boolean;
  /** Optional brand style hint added to every prompt. */
  brandStyleSuffix?: string;
}

const DEFAULT_BRAND_STYLE = ' Style: NEEJEE craft brand — ivory paper background (#F4EFE6), madder red (#8B2E2A) and banarasi gold (#B8923B) accents, slow editorial, museum-quality, no neon, no modern gradients, no embedded text unless the prompt explicitly requests it.';

export function AiImageButton({
  onApply,
  initialPrompt = '',
  aspectRatio = '16:9',
  folder = 'cms',
  filenameHint = 'image',
  label = 'GENERATE WITH AI',
  className,
  lockAspect = false,
  brandStyleSuffix = DEFAULT_BRAND_STYLE,
}: Props) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [aspect, setAspect] = useState<string>(aspectRatio);
  const [model, setModel] = useState<string>('nano-banana-pro');
  const [includeBrandStyle, setIncludeBrandStyle] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  // Update internal prompt when prop changes (e.g. AiDraftButton applies an imagePrompt)
  function openModal() {
    setPrompt(initialPrompt || prompt);
    setError('');
    setResultUrl(null);
    setOpen(true);
  }

  async function generate() {
    if (!prompt.trim()) {
      setError('Please describe the image you want.');
      return;
    }
    setLoading(true);
    setError('');
    setResultUrl(null);
    try {
      const finalPrompt = includeBrandStyle ? prompt.trim() + brandStyleSuffix : prompt.trim();
      const res = await fetch('/api/admin/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          prompt: finalPrompt,
          aspectRatio: aspect,
          model,
          folder,
          filenameHint,
        }),
      });
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch { data = { error: text }; }
      if (!res.ok) {
        throw new Error(data.error || `${res.status} ${res.statusText}`);
      }
      if (data.configured === false) {
        throw new Error('AI image generation is not configured. Set FAL_KEY in Vercel env vars.');
      }
      if (!data.ok || !data.imageUrl) {
        throw new Error(data.error || 'No image returned');
      }
      setResultUrl(data.imageUrl);
    } catch (e: any) {
      setError(e?.message || 'Generation failed');
    } finally {
      setLoading(false);
    }
  }

  function apply() {
    if (!resultUrl) return;
    onApply(resultUrl);
    setOpen(false);
    setResultUrl(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={className || 'inline-flex items-center gap-1.5 text-xs font-ui tracking-widest text-banarasi hover:text-kohl border border-banarasi/40 hover:bg-banarasi/10 px-2.5 py-1.5 rounded transition-colors'}
      >
        <Sparkles className="w-3 h-3" /> {label}
      </button>

      {open && (
        <div className="fixed inset-0 bg-kohl/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div
            className="bg-ivory rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-ivory border-b border-mitti/20 p-5 flex items-center justify-between z-10">
              <div>
                <h3 className="font-display text-xl text-kohl flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-banarasi" />
                  Generate image with AI
                </h3>
                <p className="text-mitti text-xs mt-0.5">
                  Describe what you want, pick a model, and we'll generate then save it to your media library.
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-mitti hover:text-kohl">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Prompt */}
              <div>
                <label className="label text-banarasi mb-1.5 block">PROMPT</label>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  rows={4}
                  placeholder="e.g. A flat-lay of Banarasi katan silk saree folded on khadi paper, soft morning light, hand-spun yarn beside it, restrained composition…"
                  className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-beige/30"
                />
                <label className="flex items-center gap-2 mt-2 text-xs text-mitti cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeBrandStyle}
                    onChange={e => setIncludeBrandStyle(e.target.checked)}
                  />
                  Append NEEJEE brand style (ivory paper, madder red, banarasi gold, slow editorial)
                </label>
              </div>

              {/* Model + Aspect */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label text-banarasi mb-1.5 block">MODEL</label>
                  <div className="space-y-1.5">
                    {MODELS.map(m => (
                      <button
                        type="button"
                        key={m.v}
                        onClick={() => setModel(m.v)}
                        className={`w-full text-left p-2.5 border rounded transition-colors ${
                          model === m.v ? 'border-kohl bg-beige/40' : 'border-mitti/20 hover:border-kohl/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-display text-sm text-kohl">{m.l}</p>
                          {(m as any).recommended && (
                            <span className="text-[9px] tracking-wider text-banarasi bg-banarasi/10 px-1.5 py-0.5">RECOMMENDED</span>
                          )}
                        </div>
                        <p className="text-[11px] text-mitti">{m.sub}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label text-banarasi mb-1.5 block">ASPECT RATIO</label>
                  {lockAspect ? (
                    <div className="px-3 py-2 border border-mitti/20 bg-beige/30 text-sm text-kohl">
                      {aspect} <span className="text-xs text-mitti">(locked)</span>
                    </div>
                  ) : (
                    <select
                      value={aspect}
                      onChange={e => setAspect(e.target.value)}
                      className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-beige/30"
                    >
                      {ASPECTS.map(a => (
                        <option key={a.v} value={a.v}>{a.l}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {error && (
                <div className="bg-madder/10 border border-madder/30 p-3 text-madder text-xs flex items-center justify-between">
                  <span>{error}</span>
                  <button onClick={generate} className="ml-2 px-2 py-1 bg-madder text-ivory inline-flex items-center gap-1 text-[10px]">
                    <RefreshCw className="w-3 h-3" /> Retry
                  </button>
                </div>
              )}

              {/* Preview */}
              {resultUrl && (
                <div className="border border-mitti/20 rounded p-3 bg-beige/30">
                  <p className="label text-banarasi mb-2">PREVIEW</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={resultUrl} alt="AI generated" className="w-full max-h-96 object-contain bg-mitti/10" />
                  <p className="text-[11px] text-mitti mt-2 break-all">{resultUrl}</p>
                </div>
              )}

              {loading && (
                <div className="text-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-banarasi mx-auto" />
                  <p className="text-xs text-mitti mt-2">
                    {model === 'nano-banana-pro' ? 'Generating with Nano Banana Pro — usually 20-40 seconds…' : 'Generating with Flux Schnell — usually 3-8 seconds…'}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-mitti/10 sticky bottom-0 bg-ivory">
                {!resultUrl ? (
                  <button
                    onClick={generate}
                    disabled={loading || !prompt.trim()}
                    className="flex-1 bg-kohl text-ivory px-5 py-2.5 font-ui text-xs tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading
                      ? <><Loader2 className="w-3 h-3 animate-spin" /> GENERATING…</>
                      : <><Sparkles className="w-3 h-3" /> GENERATE</>}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={generate}
                      disabled={loading}
                      className="border border-banarasi text-banarasi px-4 py-2 font-ui text-xs tracking-widest flex items-center gap-1 disabled:opacity-50"
                    >
                      <RefreshCw className="w-3 h-3" /> REGENERATE
                    </button>
                    <button
                      onClick={apply}
                      className="flex-1 bg-kohl text-ivory px-5 py-2.5 font-ui text-xs tracking-widest flex items-center justify-center gap-2"
                    >
                      <Check className="w-3 h-3" /> USE THIS IMAGE
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
