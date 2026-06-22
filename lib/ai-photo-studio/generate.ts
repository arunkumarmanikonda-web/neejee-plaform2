// AI Photo Studio orchestrator.
//
// Given an AiPhotoJob row (already persisted with sourceImageUrls + strategy):
//   1. Resolve strategy → ordered list of N scene presets
//   2. For each scene, call fal-ai/nano-banana-pro/edit with the source
//      image(s) as Kontext reference + a strict-preservation prompt
//   3. Persist each output as AiPhotoVariant (decision=PENDING)
//   4. Update job status COMPLETED / FAILED
//
// We use fal-ai/nano-banana-pro/edit (multi-reference) because:
//   - It accepts an array of `image_urls` as design references
//   - It's significantly better at preserving the reference than text-only
//   - It still respects aspect ratio + composition prompts

import { prisma } from '@/lib/prisma';
import { falRun } from '@/lib/ai';
import { STRATEGIES, type StrategyKey } from './category-strategies';
import { buildFullPrompt } from './preserve-prompts';

// fal-ai/nano-banana-pro/edit supports these aspect ratios:
//   auto, 21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16
// Our scene presets are already restricted to this set.

const FAL_ENDPOINT = 'fal-ai/nano-banana-pro/edit';

export type RunJobResult = {
  ok: boolean;
  variantCount: number;
  failedCount: number;
  firstError?: string;
};

/**
 * Run a queued AiPhotoJob. Idempotent-ish: if called twice, you'll get
 * additional variants (which is fine — admin picks the best).
 */
export async function runAiPhotoJob(jobId: string): Promise<RunJobResult> {
  const job = await prisma.aiPhotoJob.findUnique({
    where: { id: jobId },
    include: {
      product: { select: { name: true, craft: true, category: { select: { name: true, slug: true } } } },
      // v23.29 — variant scope: pulls colour/size so the prompt can anchor on them
      variant: { select: { color: true, colorHex: true, size: true, material: true, sku: true } },
    },
  });
  if (!job) throw new Error('Job not found');
  if (job.status === 'RUNNING') {
    return { ok: false, variantCount: 0, failedCount: 0, firstError: 'Job already running' };
  }
  if (!job.sourceImageUrls || job.sourceImageUrls.length === 0) {
    await prisma.aiPhotoJob.update({
      where: { id: jobId },
      data: { status: 'FAILED', errorMessage: 'No source images provided' },
    });
    return { ok: false, variantCount: 0, failedCount: 0, firstError: 'No source images' };
  }

  const strategy = STRATEGIES[job.strategy as StrategyKey];
  if (!strategy) {
    await prisma.aiPhotoJob.update({
      where: { id: jobId },
      data: { status: 'FAILED', errorMessage: `Unknown strategy: ${job.strategy}` },
    });
    return { ok: false, variantCount: 0, failedCount: 0, firstError: 'Unknown strategy' };
  }

  // Build the list of scenes to generate.
  // Strategy provides N scenes; we use the first `variantCount`.
  const scenes = strategy.scenes.slice(0, Math.min(job.variantCount, strategy.scenes.length));
  if (job.addScaleShot && strategy.scaleShot) {
    // Replace the last scene with the scale shot if requested
    scenes[scenes.length - 1] = strategy.scaleShot;
  }

  await prisma.aiPhotoJob.update({
    where: { id: jobId },
    data: { status: 'RUNNING', startedAt: new Date() },
  });

  const productLabel = job.product?.name || 'craft product';
  const craft = job.product?.craft || job.product?.category?.name || null;

  // When the job is scoped to a variant, build a colour/material anchor that
  // gets appended to every prompt and to the preserve-header. This forces the
  // model to use THIS variant's exact colour, not a generic version.
  const variantAnchor = job.variant
    ? `This particular piece is the ${[
        job.variant.color,
        job.variant.size,
        job.variant.material,
      ].filter(Boolean).join(' / ')} variant${job.variant.colorHex ? ` (approx ${job.variant.colorHex})` : ''}. Reproduce EXACTLY the colour, finish, and material shown in the reference images for this variant. Do NOT shift to a different colour even slightly.`
    : null;

  // Generate all scenes in parallel
  const results = await Promise.all(
    scenes.map(async scene => {
      const effectiveModel = scene.modelOverride ?? job.modelArchetype ?? 'warm';
      // Merge any per-variant anchor into the regeneration-feedback channel,
      // which buildFullPrompt already weaves into the tail of the prompt.
      const combinedFeedback = [variantAnchor, (job as any).regenerationFeedback]
        .filter(Boolean)
        .join('\n\n');

      const prompt = buildFullPrompt({
        composition: scene.composition,
        modelArchetype: effectiveModel,
        stylePreset: job.stylePreset,
        productName: productLabel,
        craft,
        strategyKey: job.strategy,
        regenerationFeedback: combinedFeedback || null,
      });

      const r = await falRun({
        endpoint: FAL_ENDPOINT,
        input: {
          prompt,
          // Multi-reference: pass ALL source images so the model has full design context
          image_urls: job.sourceImageUrls,
          num_images: 1,
          aspect_ratio: scene.aspectRatio,
          output_format: 'jpeg',
          resolution: '2K',
          // safety_tolerance: '4' is default
        },
        timeoutMs: 180_000,
      });

      const url: string | undefined = r.data?.images?.[0]?.url;
      return { scene, ok: r.ok && !!url, url, error: r.error, prompt };
    })
  );

  // Save the prompt used (first scene's preserve-header is the same for all — we save the first)
  await prisma.aiPhotoJob.update({
    where: { id: jobId },
    data: { imagePrompt: results[0]?.prompt?.slice(0, 4000) || null },
  });

  let succeeded = 0;
  let failed = 0;
  let firstError: string | undefined;

  for (const r of results) {
    if (r.ok && r.url) {
      await prisma.aiPhotoVariant.create({
        data: {
          jobId,
          url: r.url,
          sceneType: r.scene.sceneType,
          sceneNote: r.scene.sceneNote,
          decision: 'PENDING',
        },
      });
      succeeded++;
    } else {
      failed++;
      if (!firstError) firstError = r.error || 'Unknown error';
    }
  }

  // Final status
  const finalStatus = succeeded > 0 ? 'COMPLETED' : 'FAILED';
  await prisma.aiPhotoJob.update({
    where: { id: jobId },
    data: {
      status: finalStatus,
      completedAt: new Date(),
      errorMessage: finalStatus === 'FAILED' ? firstError || 'All variants failed' : null,
    },
  });

  return { ok: succeeded > 0, variantCount: succeeded, failedCount: failed, firstError };
}

/**
 * After admin approves variants, swap them into Product.images.
 * Default behaviour (per locked spec): AUTO-REPLACE — AI variants become the
 * product images, raw shots are archived (their variant rows get decision=ARCHIVED
 * but the URLs are still in sourceImageUrls).
 */
/**
 * Re-apply ALL currently-APPROVED variants of a job back into Product.images
 * (or Variant.images when the job is scoped to a variant).
 * Use when admin previously approved variants but Product.images was left empty
 * (e.g. due to an earlier apply call that failed silently), or when admin wants
 * to revert to a previous approved set without regenerating.
 *
 * No new variant decisions are made — we just re-push the URLs.
 */
export async function reapplyApprovedVariantsToProduct(jobId: string) {
  const job = await prisma.aiPhotoJob.findUnique({
    where: { id: jobId },
    include: {
      variants: { where: { decision: 'APPROVED' } },
      product: { select: { id: true, images: true } },
      variant: { select: { id: true, images: true, color: true, sku: true } },
    },
  });
  if (!job) throw new Error('Job not found');
  if (!job.productId || !job.product) throw new Error('Job has no product attached');
  if (job.variants.length === 0) throw new Error('No APPROVED variants found on this job. Select and apply variants first.');

  // Use the same ordering rule as the initial apply
  const sceneOrder: Record<string, number> = { hero: 0, lifestyle: 1, detail: 2, scale: 3 };
  const sorted = [...job.variants].sort(
    (a, b) => (sceneOrder[a.sceneType] ?? 9) - (sceneOrder[b.sceneType] ?? 9)
  );
  // Honour any stored productImageIndex from the original apply (if present)
  sorted.sort((a, b) => {
    if (a.productImageIndex != null && b.productImageIndex != null) {
      return a.productImageIndex - b.productImageIndex;
    }
    return 0;
  });

  const newImageUrls = sorted.map(v => v.url);

  // Variant-scoped job → write to Variant.images. Otherwise → Product.images.
  if (job.variantId && job.variant) {
    await prisma.variant.update({
      where: { id: job.variantId },
      data: { images: newImageUrls },
    });
    return {
      applied: sorted.length,
      replaced: job.variant.images.length,
      newImages: newImageUrls,
      scope: 'variant' as const,
      variantId: job.variantId,
      variantLabel: job.variant.color || job.variant.sku,
    };
  }

  await prisma.product.update({
    where: { id: job.productId },
    data: { images: newImageUrls },
  });
  return {
    applied: sorted.length,
    replaced: job.product.images.length,
    newImages: newImageUrls,
    scope: 'product' as const,
  };
}

export async function applyApprovedVariantsToProduct(jobId: string, approvedVariantIds: string[], actorUserId: string) {
  const job = await prisma.aiPhotoJob.findUnique({
    where: { id: jobId },
    include: {
      variants: true,
      product: { select: { id: true, images: true } },
      variant: { select: { id: true, images: true, color: true, sku: true } },
    },
  });
  if (!job) throw new Error('Job not found');
  if (!job.productId || !job.product) throw new Error('Job has no product attached');

  const approvedVariants = job.variants.filter(v => approvedVariantIds.includes(v.id));
  if (approvedVariants.length === 0) throw new Error('No variants selected');

  // Order: hero first, then lifestyle, then detail, then scale
  const sceneOrder: Record<string, number> = { hero: 0, lifestyle: 1, detail: 2, scale: 3 };
  approvedVariants.sort((a, b) => (sceneOrder[a.sceneType] ?? 9) - (sceneOrder[b.sceneType] ?? 9));

  const newImageUrls = approvedVariants.map(v => v.url);

  // Variant-scoped → write to Variant.images. Otherwise → Product.images.
  if (job.variantId && job.variant) {
    await prisma.variant.update({
      where: { id: job.variantId },
      data: { images: newImageUrls },
    });
  } else {
    await prisma.product.update({
      where: { id: job.productId },
      data: { images: newImageUrls },
    });
  }

  // Mark approved variants
  const now = new Date();
  await prisma.aiPhotoVariant.updateMany({
    where: { id: { in: approvedVariantIds } },
    data: { decision: 'APPROVED', decidedAt: now, decidedByUserId: actorUserId },
  });
  // Reject the rest
  const rejectedIds = job.variants
    .filter(v => !approvedVariantIds.includes(v.id) && v.decision === 'PENDING')
    .map(v => v.id);
  if (rejectedIds.length > 0) {
    await prisma.aiPhotoVariant.updateMany({
      where: { id: { in: rejectedIds } },
      data: { decision: 'REJECTED', decidedAt: now, decidedByUserId: actorUserId },
    });
  }

  // Set productImageIndex for approved (in order)
  for (let i = 0; i < approvedVariants.length; i++) {
    await prisma.aiPhotoVariant.update({
      where: { id: approvedVariants[i].id },
      data: { productImageIndex: i },
    });
  }

  return {
    applied: approvedVariants.length,
    replaced: job.variantId && job.variant
      ? job.variant.images.length
      : job.product.images.length,
    newImages: newImageUrls,
    scope: job.variantId ? ('variant' as const) : ('product' as const),
    variantId: job.variantId || undefined,
    variantLabel: job.variant?.color || job.variant?.sku || undefined,
  };
}
