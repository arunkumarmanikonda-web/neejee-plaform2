// /api/admin/ai-photo-studio/bulk-variants
// POST - generate AI photos for MULTIPLE variants in parallel (one job per variant).
//
// Body:
//   {
//     productId: string,
//     variants: [{ variantId: string, sourceImageUrls: string[] }, ...],
//     // Shared options applied to ALL variant jobs:
//     variantCount?: number,        // default 6 photos per variant
//     modelArchetype?: string,
//     stylePreset?: string,
//     strategy?: string,            // override auto-detect for all
//     addScaleShot?: boolean,
//   }
//
// Returns: { ok, jobs: [{ variantId, jobId, ok, variantCount, firstError }] }
//
// All variant jobs run in parallel within Vercel's maxDuration ceiling.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { runAiPhotoJob } from '@/lib/ai-photo-studio/generate';
import { detectStrategy, STRATEGIES, type StrategyKey } from '@/lib/ai-photo-studio/category-strategies';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// N variants in parallel = N x (single job time). 6 colours x 6 photos = 36
// nano-banana-pro calls. We allow up to 5 minutes wall clock.
export const maxDuration = 300;

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ADMIN_ROLES.includes(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const productId = String(body.productId || '').trim();
    if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 });
    const variants = Array.isArray(body.variants) ? body.variants : [];
    if (variants.length === 0) {
      return NextResponse.json({ error: 'At least one variant required' }, { status: 400 });
    }

    // Auto-detect strategy once from the product (shared across all variant jobs)
    let strategy: StrategyKey | null =
      body.strategy && STRATEGIES[body.strategy as StrategyKey]
        ? (body.strategy as StrategyKey)
        : null;

    if (!strategy) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: {
          name: true,
          description: true,
          craft: true,
          category: { select: { slug: true, name: true } },
        },
      });
      if (product) {
        strategy = detectStrategy({
          categorySlug: product.category?.slug,
          categoryName: product.category?.name,
          productName: product.name,
          productDescription: product.description,
          craft: product.craft,
        });
      }
    }
    if (!strategy) strategy = 'GENERIC_LIFESTYLE';

    const variantCount = Math.min(Math.max(Number(body.variantCount || 6), 1), 6);
    const modelArchetype = body.modelArchetype || 'mixed';
    const stylePreset = body.stylePreset || 'editorial';
    const addScaleShot = !!body.addScaleShot;

    // Create + run one job per variant in PARALLEL.
    // Each job is independent and may succeed / fail on its own.
    const jobPromises = variants.map(async (v: any) => {
      const variantId = String(v.variantId || '').trim();
      const sources: string[] = Array.isArray(v.sourceImageUrls) ? v.sourceImageUrls : [];
      if (!variantId || sources.length === 0) {
        return { variantId, jobId: null, ok: false, firstError: 'Missing variantId or sourceImageUrls' };
      }
      // Verify variant belongs to product
      const variant = await prisma.variant.findUnique({
        where: { id: variantId },
        select: { productId: true, color: true, sku: true },
      });
      if (!variant || variant.productId !== productId) {
        return { variantId, jobId: null, ok: false, firstError: 'Variant not in this product' };
      }

      const job = await prisma.aiPhotoJob.create({
        data: {
          productId,
          variantId,
          strategy: strategy as any,
          sourceImageUrls: sources,
          variantCount,
          modelArchetype,
          stylePreset,
          addScaleShot,
          requestedByUserId: session.id,
          status: 'QUEUED',
        },
      });
      const result = await runAiPhotoJob(job.id);
      return {
        variantId,
        variantLabel: variant.color || variant.sku,
        jobId: job.id,
        ok: result.ok,
        variantCount: result.variantCount,
        firstError: result.firstError,
      };
    });

    const jobs = await Promise.all(jobPromises);
    const okCount = jobs.filter(j => j.ok).length;
    return NextResponse.json({
      ok: okCount > 0,
      strategy,
      jobs,
      summary: `${okCount}/${jobs.length} variant jobs succeeded`,
    });
  } catch (e: any) {
    console.error('[bulk-variants]', e);
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
