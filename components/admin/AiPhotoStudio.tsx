'use client';
// AiPhotoStudio — embeddable component for the admin product editor.
// Lets the admin upload raw phone-shot images, pick options, and start a
// generation job. On completion, shows the 6 variants in a 2×3 grid for
// review and one-click apply (auto-replace product images per locked spec).

import { useEffect, useState } from 'react';
import { Loader2, Sparkles, Camera, RefreshCw, Check, X } from 'lucide-react';

export type AiPhotoStudioProps = {
  productId: string;            // required: we need a saved product to attach images to
  productName?: string;
  categoryName?: string;
  categorySlug?: string;
  initialImages?: string[];     // current Product.images for context
  // Called after admin clicks APPLY and the server confirms.
  // newImages = the full new images array now stored on Product.images.
  onApplied?: (newImages: string[]) => void;
};

type Variant = {
  id: string;
  url: string;
  sceneType: string;
  sceneNote: string | null;
  decision: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
};

type Job = {
  id: string;
  strategy: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  errorMessage: string | null;
  sourceImageUrls: string[];
  imagePrompt: string | null;
  modelArchetype: string | null;
  stylePreset: string | null;
  variants: Variant[];
  createdAt: string;
};

const STYLE_OPTIONS = [
  { value: 'editorial', label: 'Editorial' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'festive', label: 'Festive' },
  { value: 'heritage', label: 'Heritage' },
];

const MODEL_OPTIONS = [
  { value: 'mixed', label: 'Mixed (combination of all)' },
  { value: 'warm', label: 'Warm — wheat-toned model' },
  { value: 'cool', label: 'Cool — fair-toned model' },
  { value: 'festive', label: 'Festive — bridal look' },
  { value: 'mannequin', label: 'Mannequin only (no human)' },
];

const STRATEGY_OPTIONS = [
  { value: '', label: 'Auto-detect from category (recommended)' },
  { value: 'SAREE_ON_MODEL',              label: 'Saree / dupatta — draped on model' },
  { value: 'LEHENGA_ON_MODEL',            label: 'Lehenga / sharara — twirling pose' },
  { value: 'KURTA_ON_MODEL',              label: 'Kurta / suit / blouse — on model + flat-lay' },
  { value: 'JEWELLERY_NECKLACE_ON_MODEL', label: 'Necklace / mala / pendant — décolletage' },
  { value: 'JEWELLERY_EARRING_ON_MODEL',  label: 'Earrings / jhumka — ear close-up' },
  { value: 'JEWELLERY_BANGLE_ON_MODEL',   label: 'Bangle / kada / bracelet — wrist' },
  { value: 'JEWELLERY_RING_ON_HAND',      label: 'Ring — hand close-up' },
  { value: 'FURNITURE_IN_ROOM',           label: 'Furniture — styled room' },
  { value: 'LAMP_ON_CONSOLE',             label: 'Lamp / lantern — console / bedside' },
  { value: 'DECOR_ON_SHELF',              label: 'Decor / artefact — shelf vignette' },
  { value: 'POTTERY_TABLE_SETTING',       label: 'Pottery / kitchenware — table setting' },
  { value: 'RUG_FLOOR_TOP_DOWN',          label: 'Rug / dhurrie — top-down floor' },
  { value: 'PAINTING_ON_WALL',            label: 'Painting / wall art — hung on wall' },
  { value: 'GENERIC_LIFESTYLE',           label: 'Generic — clean studio + lifestyle' },
];

export default function AiPhotoStudio({ productId, productName, categoryName, categorySlug, onApplied }: AiPhotoStudioProps) {
  const [sourceUrls, setSourceUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [modelArchetype, setModelArchetype] = useState('mixed');
  const [stylePreset, setStylePreset] = useState('editorial');
  const [addScaleShot, setAddScaleShot] = useState(false);
  const [variantCount, setVariantCount] = useState(6);
  const [strategyOverride, setStrategyOverride] = useState('');

  // Regenerate-with-feedback state
  const [regenFeedback, setRegenFeedback] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [reapplying, setReapplying] = useState(false);

  const [running, setRunning] = useState(false);
  const [latestJob, setLatestJob] = useState<Job | null>(null);
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);

  // Load most recent job for this product
  async function loadLatestJob() {
    try {
      const res = await fetch(`/api/admin/ai-photo-studio/jobs?productId=${productId}`);
      const data = await res.json();
      if (data.jobs && data.jobs.length > 0) {
        setLatestJob(data.jobs[0]);
      }
    } catch {}
  }
  useEffect(() => {
    loadLatestJob();
  }, [productId]);

  async function uploadRawImage(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'ai-photo-studio/raw');
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd, credentials: 'include' });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        alert(data?.error || `Upload failed (HTTP ${res.status}). Phone shots above 15 MB are rejected — use a smaller image.`);
        return;
      }
      // The admin upload endpoint returns { success, files: [{ url, ... }] }.
      // The vendor upload endpoint returns { success, url } directly.
      // Handle both shapes defensively so future endpoint swaps don't silently fail.
      const uploadedUrl: string | undefined =
        data?.url ||
        data?.files?.[0]?.url ||
        (Array.isArray(data?.files) && data.files.length > 0 ? data.files[0].url : undefined);
      if (uploadedUrl) {
        setSourceUrls(prev => [...prev, uploadedUrl]);
      } else {
        console.error('[AiPhotoStudio] Upload returned no URL:', data);
        alert('Upload succeeded but no URL returned. Check Vercel logs.');
      }
    } catch (e: any) {
      console.error('[AiPhotoStudio] Upload error:', e);
      alert(`Upload error: ${e?.message || 'unknown'}`);
    } finally {
      setUploading(false);
    }
  }

  async function startGeneration() {
    if (sourceUrls.length === 0) {
      alert('Upload at least one raw phone shot first.');
      return;
    }
    if (!confirm(`Generate ${variantCount} AI photo variants? Costs ~$0.04 per variant (~$${(variantCount * 0.04).toFixed(2)} total). Takes 2–3 minutes.`)) {
      return;
    }
    setRunning(true);
    try {
      const res = await fetch('/api/admin/ai-photo-studio/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          sourceImageUrls: sourceUrls,
          categorySlug,
          categoryName,
          productName,
          variantCount,
          modelArchetype,
          stylePreset,
          addScaleShot,
          strategy: strategyOverride || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data.error || data.result?.firstError || 'Generation failed');
        return;
      }
      // Reload to pick up the new job with its variants
      loadLatestJob();
    } finally {
      setRunning(false);
    }
  }

  function toggleVariant(id: string) {
    setSelectedVariantIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /**
   * Re-apply the currently APPROVED variants to Product.images.
   * Free — no AI calls, no credit cost. Recovers from a failed previous apply
   * or restores product images that were accidentally cleared.
   */
  async function reapplyApproved() {
    if (!latestJob) return;
    const approvedCount = latestJob.variants.filter(v => v.decision === 'APPROVED').length;
    if (approvedCount === 0) {
      alert('No APPROVED variants on this job. Select variants and click APPLY first.');
      return;
    }
    if (!confirm(`Re-apply the ${approvedCount} already-approved variants to this product? This will replace the current product images with those AI photos. No new generation, no credit cost.`)) {
      return;
    }
    setReapplying(true);
    try {
      const res = await fetch(`/api/admin/ai-photo-studio/jobs/${latestJob.id}/reapply`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data.error || 'Re-apply failed');
        return;
      }
      const newImages: string[] = Array.isArray(data.newImages) ? data.newImages : [];
      console.log('[AiPhotoStudio] Re-apply succeeded — new product images:', newImages);
      if (newImages.length === 0) {
        alert('Re-apply ran but returned no images. Please refresh.');
      } else {
        alert(`✅ Re-applied ${data.applied || 0} approved variants to the product. Scroll up — the product image grid is now updated.`);
      }
      onApplied?.(newImages);
      loadLatestJob();
    } catch (e: any) {
      alert(`Error: ${e?.message || 'Unknown'}`);
    } finally {
      setReapplying(false);
    }
  }

  async function applySelected() {
    if (!latestJob) return;
    if (selectedVariantIds.size === 0) {
      alert('Select at least one variant to apply.');
      return;
    }
    if (!confirm(`Replace this product's images with the ${selectedVariantIds.size} selected variant(s)? This is non-destructive — raw shots are kept in the job history.`)) {
      return;
    }
    setApplying(true);
    try {
      const res = await fetch(`/api/admin/ai-photo-studio/jobs/${latestJob.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedVariantIds: Array.from(selectedVariantIds) }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data.error || 'Apply failed');
        return;
      }
      // The backend now returns the full new images array.
      // Pass it to the parent so the product image grid updates without a hard reload.
      const newImages: string[] = Array.isArray(data.newImages) ? data.newImages : [];
      console.log('[AiPhotoStudio] Apply succeeded — new product images:', newImages);
      if (newImages.length === 0) {
        alert('Apply ran but the backend returned no images. Please refresh the page to verify.');
      } else {
        alert(`✅ Replaced ${data.replaced || 0} old images with ${data.applied || 0} AI variants. Scroll up — the product image grid is now updated.`);
      }
      onApplied?.(newImages);
      // Clear selection + refresh the job to show APPROVED/REJECTED decisions
      setSelectedVariantIds(new Set());
      loadLatestJob();
    } finally {
      setApplying(false);
    }
  }

  // (pendingVariants previously here — removed since variants of any decision
  // can now be selected and applied. APPROVED count is computed inline.)
  const isCurrentJobRunning = latestJob?.status === 'RUNNING' || running;

  return (
    <div className="border border-mitti/20 bg-ivory">
      <div className="px-4 py-3 border-b border-mitti/15 bg-beige/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-mitti" />
          <h3 className="font-display text-base text-kohl uppercase tracking-wider">AI Photo Studio</h3>
        </div>
        <span className="text-[10px] text-mitti uppercase">Powered by nano-banana-pro</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Step 1: upload raw shots */}
        <section>
          <div className="text-xs uppercase text-charcoal/60 mb-2">Step 1 — Upload raw phone shots</div>
          <div className="grid grid-cols-4 gap-2">
            {sourceUrls.map((url, i) => (
              <div key={i} className="relative group">
                <img src={url} alt="" className="w-full aspect-square object-cover border border-mitti/20" />
                <button
                  onClick={() => setSourceUrls(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-1 right-1 bg-black/60 text-white p-1 opacity-0 group-hover:opacity-100"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <label className="aspect-square border-2 border-dashed border-mitti/30 flex flex-col items-center justify-center text-xs text-mitti hover:border-madder cursor-pointer">
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Camera className="w-4 h-4 mb-1" />
                  <span>Add</span>
                </>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) uploadRawImage(f);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
          <p className="text-[11px] text-charcoal/50 mt-2">
            Upload 1–4 phone shots (max 15 MB each, JPG/PNG/WEBP). The AI uses these as the absolute design reference.
            Good shots: well-lit, in-focus, full product visible, plain background helps.
          </p>
        </section>

        {/* Step 2: options */}
        <section className="space-y-3">
          <label className="text-xs uppercase block">
            Strategy (scene type)
            <select
              value={strategyOverride}
              onChange={e => setStrategyOverride(e.target.value)}
              className={`w-full mt-1 p-2 border text-sm normal-case ${
                strategyOverride
                  ? 'border-mitti bg-beige'
                  : 'border-mitti/20 bg-beige'
              }`}
            >
              {STRATEGY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="text-[10px] text-charcoal/50 block mt-1">
              Auto-detect reads the product&apos;s name, description, craft, and category. If the last job ran as <strong>GENERIC LIFESTYLE</strong> when you expected something specific (e.g. <strong>BANGLE ON MODEL</strong>), override here.
            </span>
            {latestJob?.strategy === 'GENERIC_LIFESTYLE' && !strategyOverride && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                <strong>Heads up:</strong> the last job used the generic strategy. If your product is a saree, bangle, necklace, lamp, etc., pick a specific strategy above and regenerate for much better results.
              </div>
            )}
          </label>
        </section>
        <section className="grid md:grid-cols-3 gap-3">
          <label className="text-xs uppercase block">
            Model archetype
            <select
              value={modelArchetype}
              onChange={e => setModelArchetype(e.target.value)}
              className="w-full mt-1 p-2 border border-mitti/20 text-sm normal-case bg-beige"
            >
              {MODEL_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs uppercase block">
            Style preset
            <select
              value={stylePreset}
              onChange={e => setStylePreset(e.target.value)}
              className="w-full mt-1 p-2 border border-mitti/20 text-sm normal-case bg-beige"
            >
              {STYLE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs uppercase block">
            Variants
            <select
              value={variantCount}
              onChange={e => setVariantCount(Number(e.target.value))}
              className="w-full mt-1 p-2 border border-mitti/20 text-sm normal-case bg-beige"
            >
              <option value={3}>3 (~$0.12)</option>
              <option value={4}>4 (~$0.16)</option>
              <option value={6}>6 (~$0.24) — recommended</option>
            </select>
          </label>
          <label className="text-xs flex items-center gap-2 md:col-span-3">
            <input
              type="checkbox"
              checked={addScaleShot}
              onChange={e => setAddScaleShot(e.target.checked)}
            />
            Add a size-scale shot (replaces the last variant with a hand-for-scale composition)
          </label>
        </section>

        {/* Step 3: generate */}
        <section>
          <button
            onClick={startGeneration}
            disabled={isCurrentJobRunning || sourceUrls.length === 0}
            className="btn-primary inline-flex items-center gap-2"
          >
            {isCurrentJobRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isCurrentJobRunning ? 'GENERATING…' : 'GENERATE'}
          </button>
          {isCurrentJobRunning && (
            <p className="text-xs text-charcoal/60 mt-2">
              Calling nano-banana-pro with strict design preservation. Takes 2–3 minutes. You can leave this page open.
            </p>
          )}
        </section>

        {/* Latest job results */}
        {latestJob && (
          <section>
            <div className="flex justify-between items-center mb-2">
              <div className="text-xs uppercase text-charcoal/60">
                Latest job — {latestJob.strategy.replace(/_/g, ' ').toLowerCase()} ·{' '}
                <span
                  className={`px-2 py-0.5 ${
                    latestJob.status === 'COMPLETED'
                      ? 'bg-emerald-100 text-emerald-700'
                      : latestJob.status === 'RUNNING'
                      ? 'bg-amber-100 text-amber-700'
                      : latestJob.status === 'FAILED'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-charcoal/10'
                  }`}
                >
                  {latestJob.status}
                </span>
              </div>
              <button onClick={loadLatestJob} className="text-xs underline inline-flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>

            {latestJob.errorMessage && (
              <div className="bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 mb-3">
                <strong>Error:</strong> {latestJob.errorMessage}
              </div>
            )}

            {latestJob.variants.length > 0 && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {latestJob.variants.map(v => {
                    const sel = selectedVariantIds.has(v.id);
                    return (
                      <div
                        key={v.id}
                        onClick={() => toggleVariant(v.id)}
                        className={`relative cursor-pointer border-2 ${
                          sel ? 'border-madder' : 'border-mitti/20 hover:border-mitti'
                        }`}
                      >
                        <img src={v.url} alt={v.sceneNote || ''} className="w-full aspect-[4/5] object-cover" />
                        <div className="absolute top-2 left-2 bg-kohl/80 text-ivory text-[10px] tracking-widest px-2 py-0.5 uppercase">
                          {v.sceneType}
                        </div>
                        {sel && (
                          <div className="absolute top-2 right-2 bg-madder text-ivory p-1 rounded-full">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                        <div className="p-2 text-[11px] text-charcoal/70 bg-beige/40">{v.sceneNote}</div>
                        {v.decision !== 'PENDING' && (
                          <div className="absolute bottom-2 right-2 text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5">
                            {v.decision}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/*
                  Apply bar — always shown when there's at least 1 variant.
                  Admin can:
                  • Pick any variants (PENDING or previously decided) and click APPLY — those become Product.images
                  • Click RE-APPLY APPROVED — re-push the currently-APPROVED variants without picking anything (recovery from a failed earlier apply)
                */}
                <div className="mt-4 p-3 bg-beige/40 border border-mitti/15 space-y-2">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-xs text-charcoal/70 flex-1 min-w-[200px]">
                      {selectedVariantIds.size > 0 ? (
                        <><strong>{selectedVariantIds.size}</strong> of {latestJob.variants.length} variants selected. Clicking APPLY replaces this product&apos;s current images with the selected variants.</>
                      ) : (
                        <>Click any variant tile to select it. Or use <strong>RE-APPLY APPROVED</strong> to recover the previously-approved set without regenerating.</>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={reapplyApproved}
                        disabled={applying || reapplying || latestJob.variants.filter(v => v.decision === 'APPROVED').length === 0}
                        className="btn-outline text-xs inline-flex items-center gap-1 disabled:opacity-50"
                        title="Re-push the currently-APPROVED variants to product images. No new generation, no credit cost."
                      >
                        {reapplying ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        RE-APPLY APPROVED ({latestJob.variants.filter(v => v.decision === 'APPROVED').length})
                      </button>
                      <button
                        type="button"
                        onClick={applySelected}
                        disabled={applying || reapplying || selectedVariantIds.size === 0}
                        className="btn-primary text-xs inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        {applying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        APPLY {selectedVariantIds.size > 0 ? `(${selectedVariantIds.size})` : ''}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Regenerate-with-feedback */}
            {latestJob.status === 'COMPLETED' && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200">
                <div className="text-xs uppercase text-amber-800 mb-2">Not quite right? Regenerate with feedback</div>
                <textarea
                  value={regenFeedback}
                  onChange={e => setRegenFeedback(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="Tell the AI what went wrong, e.g. 'The pallu border colour shifted from indigo to navy — keep it true indigo'."
                  className="w-full p-2 text-sm border border-amber-300 bg-white"
                />
                <div className="flex justify-between items-center mt-2">
                  <span className="text-[10px] text-amber-700">
                    Costs another ~${(variantCount * 0.04).toFixed(2)}. Same source images, same strategy, with your feedback added to the prompt.
                  </span>
                  <button
                    onClick={async () => {
                      if (!latestJob || !regenFeedback.trim()) {
                        alert('Please describe what to fix.');
                        return;
                      }
                      if (!confirm(`Regenerate ${variantCount} variants with this feedback?`)) return;
                      setRegenerating(true);
                      try {
                        const res = await fetch(`/api/admin/ai-photo-studio/jobs/${latestJob.id}/regenerate`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            feedback: regenFeedback,
                            variantCount,
                            modelArchetype,
                            stylePreset,
                            addScaleShot,
                            strategy: strategyOverride || undefined,
                          }),
                        });
                        const data = await res.json();
                        if (!res.ok || !data.ok) {
                          alert(data.error || data.result?.firstError || 'Regenerate failed');
                          return;
                        }
                        setRegenFeedback('');
                        loadLatestJob();
                      } finally {
                        setRegenerating(false);
                      }
                    }}
                    disabled={regenerating || !regenFeedback.trim()}
                    className="btn-outline text-xs inline-flex items-center gap-1"
                  >
                    {regenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    REGENERATE
                  </button>
                </div>
              </div>
            )}

            {latestJob.imagePrompt && (
              <details className="mt-3 text-[11px]">
                <summary className="cursor-pointer text-charcoal/50">Prompt used (for audit / re-runs)</summary>
                <pre className="bg-beige/40 p-2 mt-1 whitespace-pre-wrap font-mono">{latestJob.imagePrompt}</pre>
              </details>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
