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

import { intakePrefix, reviewedImages } from '@/lib/catalog/creation-intake';
import { uploadFile } from '@/lib/storage';
import { prisma } from '@/lib/prisma';
import { runCreativeImages } from '@/lib/ai/creative-images';
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

// Stock photos are fetched only from provider-owned image hosts, then retained with the SKU.
async function storeIntakeImage(raw: string, productId: string, jobId: string, index: number) {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || !(url.hostname === 'fal.media' || url.hostname.endsWith('.fal.media'))) {
    throw new Error('The provider returned an unrecognised image host.');
  }
  const response = await fetch(url, {redirect:'error', signal:AbortSignal.timeout(30000)});
  if (!response.ok || !response.body) throw new Error('The generated photograph could not be downloaded.');
  const reader=response.body.getReader(), chunks:Uint8Array[]=[];
  let bytes=0;
  try {
    while (true) {
      const part=await reader.read();
      if (part.done) break;
      bytes+=part.value.byteLength;
      if (bytes>15*1024*1024) { await reader.cancel(); throw new Error('Generated photograph exceeds the file limit.'); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const jpeg=Buffer.concat(chunks);
  if (jpeg.length<4 || jpeg[0]!==255 || jpeg[1]!==216 || jpeg.at(-2)!==255 || jpeg.at(-1)!==217) {
    throw new Error('The generated image is not a complete JPEG.');
  }
  return (await uploadFile('products/'+productId+'/creatives/'+jobId+'-'+index+'.jpg',jpeg,'image/jpeg')).url;
}

// Both the editor and the scheduled worker may see a queued job. Only one can claim it.
export async function runAiPhotoJob(jobId: string): Promise<RunJobResult> {
  const claim = await prisma.aiPhotoJob.updateMany({where:{id:jobId,status:'QUEUED'},
    data:{status:'RUNNING',startedAt:new Date(),completedAt:null,errorMessage:null}});
  if (!claim.count) return {ok:false,variantCount:0,failedCount:0,firstError:'Already claimed or finished'};
  try { return await generateClaimedJob(jobId); }
  catch (error) {
    const message=error instanceof Error ? error.message.slice(0,500) : 'Photo generation did not finish.';
    await prisma.aiPhotoJob.updateMany({where:{id:jobId,status:'RUNNING'},data:{status:'FAILED',completedAt:new Date(),errorMessage:message}});
    return {ok:false,variantCount:0,failedCount:1,firstError:message};
  }
}
async function generateClaimedJob(jobId: string): Promise<RunJobResult> {
  const job = await prisma.aiPhotoJob.findUnique({
    where: { id: jobId },
    include: {
      product: { select: { name: true, craft: true, category: { select: { name: true, slug: true } } } },
      // v23.29 — variant scope: pulls colour/size so the prompt can anchor on them
      variant: { select: { color: true, colorHex: true, size: true, material: true, sku: true } },
    },
  });
  if (!job) throw new Error('Job not found');
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
    scenes.map(async (scene, index) => {
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

      try {
        const intake = jobId.startsWith(intakePrefix) && job.productId;
        const r = await runCreativeImages({
          folder: 'catalogue-photography',
          aspect: scene.aspectRatio,
          objectPath: intake ? 'products/'+job.productId+'/creatives/'+jobId+'-'+index+'.jpg' : undefined,
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

        let url: string | undefined = r.data?.images?.[0]?.url;
        if (r.ok && url && !r.stored && intake && job.productId) {
          url=await storeIntakeImage(url,job.productId,jobId,index);
        }
        return { scene, ok: r.ok && !!url, url, error: r.error, prompt };
      } catch (error) {
        return {scene,ok:false,url:undefined,error:error instanceof Error ? error.message : 'Photo generation failed.',prompt};
      }
    })
  );

  const generated = results.flatMap(r => r.ok && r.url ? [{
    jobId, url:r.url, sceneType:r.scene.sceneType, sceneNote:r.scene.sceneNote, decision:'PENDING' as const,
  }] : []);
  const failed = results.filter(result=>!result.ok);
  const firstError = failed[0]?.error || (failed.length ? 'The provider could not render this scene.' : undefined);
  await prisma.$transaction(async tx => {
    if (generated.length) await tx.aiPhotoVariant.createMany({data:generated});
    await tx.aiPhotoJob.update({where:{id:jobId},data:{
      imagePrompt:results[0]?.prompt?.slice(0,4000) || null,
      status:generated.length ? 'COMPLETED' : 'FAILED', completedAt:new Date(), errorMessage:firstError || null,
    }});
  });
  return {ok:!!generated.length,variantCount:generated.length,failedCount:failed.length,firstError};
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
  const targetProductId = job.productId;
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

  const newImageUrls = reviewedImages(job.id, sorted.map(v => v.url), job.sourceImageUrls);

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
  const targetProductId = job.productId;

  const approvedVariants = job.variants.filter(v => approvedVariantIds.includes(v.id));
  if (approvedVariants.length === 0) throw new Error('No variants selected');

  // Order: hero first, then lifestyle, then detail, then scale
  const sceneOrder: Record<string, number> = { hero: 0, lifestyle: 1, detail: 2, scale: 3 };
  approvedVariants.sort((a, b) => (sceneOrder[a.sceneType] ?? 9) - (sceneOrder[b.sceneType] ?? 9));

  if (approvedVariants.length !== new Set(approvedVariantIds).size) throw new Error('An image does not belong to this photo job.');
  const newImageUrls = reviewedImages(job.id, approvedVariants.map(v => v.url), job.sourceImageUrls);

  await prisma.$transaction(async tx => {
    // Variant-scoped → write to Variant.images. Otherwise → Product.images.
    if (job.variantId && job.variant) {
      await tx.variant.update({
        where: { id: job.variantId },
        data: { images: newImageUrls },
      });
    } else {
      await tx.product.update({
        where: { id: targetProductId },
        data: { images: newImageUrls },
      });
    }

    // Mark approved variants
    const now = new Date();
    await tx.aiPhotoVariant.updateMany({
      where: { jobId, id: { in: approvedVariants.map(v=>v.id) } },
      data: { decision: 'APPROVED', decidedAt: now, decidedByUserId: actorUserId },
    });
    // Reject the rest
    const rejectedIds = job.variants
      .filter(v => !approvedVariantIds.includes(v.id) && v.decision === 'PENDING')
      .map(v => v.id);
    if (rejectedIds.length > 0) {
      await tx.aiPhotoVariant.updateMany({
        where: { id: { in: rejectedIds } },
        data: { decision: 'REJECTED', decidedAt: now, decidedByUserId: actorUserId },
      });
    }

    // Set productImageIndex for approved (in order)
    for (let i = 0; i < approvedVariants.length; i++) {
      await tx.aiPhotoVariant.update({
        where: { id: approvedVariants[i].id },
        data: { productImageIndex: i },
      });
    }
  });

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
