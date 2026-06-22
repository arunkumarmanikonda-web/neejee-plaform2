// /api/admin/ai-photo-studio/jobs
// GET  - list jobs (filterable by productId, status)
// POST - create a job and run it inline (admin only)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { runAiPhotoJob } from '@/lib/ai-photo-studio/generate';
import { detectStrategy, STRATEGIES, type StrategyKey } from '@/lib/ai-photo-studio/category-strategies';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// 6 variants × up to 180s each (in parallel, so wall clock ~3 min)
export const maxDuration = 300;

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];

async function gate() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!ADMIN_ROLES.includes(session.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { session };
}

export async function GET(req: NextRequest) {
  const g = await gate();
  if (g.error) return g.error;
  const url = new URL(req.url);
  const productId = url.searchParams.get('productId') || undefined;
  const variantId = url.searchParams.get('variantId') || undefined;
  const status = url.searchParams.get('status') || undefined;

  const jobs = await prisma.aiPhotoJob.findMany({
    where: {
      ...(productId ? { productId } : {}),
      ...(variantId ? { variantId } : {}),
      ...(status ? { status: status as any } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      variants: { orderBy: { createdAt: 'asc' } },
      product: { select: { id: true, name: true, slug: true } },
    },
    take: 100,
  });
  return NextResponse.json({ jobs });
}

export async function POST(req: NextRequest) {
  const g = await gate();
  if (g.error) return g.error;
  try {
    const body = await req.json();
    const productId: string | null = body.productId || null;
    const variantId: string | null = body.variantId || null;   // v23.29 — optional variant scope
    const sourceImageUrls: string[] = Array.isArray(body.sourceImageUrls) ? body.sourceImageUrls : [];
    if (sourceImageUrls.length === 0) {
      return NextResponse.json({ error: 'sourceImageUrls is required (≥1 phone shot)' }, { status: 400 });
    }
    // If a variantId was supplied, verify it belongs to the product
    if (variantId) {
      const v = await prisma.variant.findUnique({
        where: { id: variantId },
        select: { productId: true },
      });
      if (!v || (productId && v.productId !== productId)) {
        return NextResponse.json({ error: 'Variant does not belong to this product' }, { status: 400 });
      }
    }

    // Resolve strategy
    let strategy: StrategyKey | null = body.strategy && STRATEGIES[body.strategy as StrategyKey]
      ? (body.strategy as StrategyKey)
      : null;

    let categorySlug: string | null = body.categorySlug || null;

    if (!strategy && productId) {
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
        categorySlug = categorySlug || product.category?.slug || null;
        strategy = detectStrategy({
          categorySlug: product.category?.slug,
          categoryName: product.category?.name,
          productName: product.name,
          productDescription: product.description,
          craft: product.craft,
        });
      }
    }
    if (!strategy) {
      strategy = detectStrategy({
        categorySlug,
        categoryName: body.categoryName,
        productName: body.productName,
        productDescription: body.productDescription,
        craft: body.craft,
      });
    }

    const variantCount = Math.min(Math.max(Number(body.variantCount || 6), 1), 6);
    const modelArchetype = body.modelArchetype || 'mixed';
    const stylePreset = body.stylePreset || 'editorial';
    const addScaleShot = !!body.addScaleShot;

    // Create the job row
    const job = await prisma.aiPhotoJob.create({
      data: {
        productId,
        variantId,    // v23.29 — null when shared/product-level, set when per-variant
        categorySlug,
        strategy: strategy as any,
        sourceImageUrls,
        variantCount,
        modelArchetype,
        stylePreset,
        addScaleShot,
        requestedByUserId: g.session!.id,
        status: 'QUEUED',
      },
    });

    // Run it inline (within maxDuration). For very long jobs we could use
    // a queue, but Vercel's 300s ceiling handles 6 parallel calls.
    const result = await runAiPhotoJob(job.id);

    return NextResponse.json({ ok: true, jobId: job.id, result, strategy });
  } catch (e: any) {
    console.error('[ai-photo-studio/jobs] error:', e);
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
