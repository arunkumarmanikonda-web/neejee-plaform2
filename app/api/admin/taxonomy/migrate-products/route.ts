/**
 * POST /api/admin/taxonomy/migrate-products  — v26.1.8
 *
 * Body: { dryRun?: boolean, limit?: number, onlyMissingLeaf?: boolean, regenerateSku?: boolean }
 *
 * In dry-run mode the resolver returns a "virtual" leaf showing what WOULD be
 * created, so admins can review the full migration plan before committing.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import { resolveCategory, generateSkuFor, invalidateTreeCache } from '@/lib/taxonomy/resolver';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const dryRun = body.dryRun === true;
  const limit = Math.min(Math.max(Number(body.limit) || 25, 1), 200);
  const onlyMissingLeaf = body.onlyMissingLeaf !== false;
  const regenerateSku = body.regenerateSku === true;

  // v26.1.6 — Product.categoryId is required, status is an enum.
  const products = await prisma.product.findMany({
    where: {
      status: { in: ['ACTIVE', 'DRAFT', 'PENDING_QC'] },
      ...(onlyMissingLeaf
        ? { category: { is: { level: { lt: 3 } } } }
        : {}),
    },
    include: { category: true },
    take: limit,
    orderBy: { updatedAt: 'desc' },
  });

  const items: any[] = [];
  let updated = 0;
  let skipped = 0;
  const allCreated = new Set<string>();

  for (const p of products) {
    const result = await resolveCategory({
      query: (p as any).craft || (p as any).category?.name || null,
      product: {
        name: p.name,
        description: (p as any).description || null,
        craft: (p as any).craft || null,
        region: (p as any).region || null,
        material: (p as any).material || null,
        tags: (p as any).tags || null,
      },
      allowAi: true,
      allowCreate: !dryRun,
      // v26.1.8 — in dry-run still show what WOULD be created.
      previewCreate: dryRun,
    });

    if (!result.ok || !result.categoryId) {
      skipped++;
      items.push({
        productId: p.id,
        sku: p.sku,
        oldCategory: p.category?.path || p.category?.slug || null,
        error: result.error,
      });
      continue;
    }

    // v26.1.8 — preview IDs are virtual; skip DB writes and SKU regen.
    const isVirtual = result.categoryId.startsWith('__preview_');
    const newSku = regenerateSku && !isVirtual ? await generateSkuFor(result.categoryId) : null;

    if (!dryRun && !isVirtual) {
      await prisma.product.update({
        where: { id: p.id },
        data: {
          categoryId: result.categoryId,
          ...(newSku ? { sku: newSku } : {}),
        },
      });
    }
    if (result.created) result.created.forEach((s) => allCreated.add(s));
    updated++;
    items.push({
      productId: p.id,
      sku: p.sku,
      oldCategory: p.category?.path || p.category?.slug || null,
      newCategory: result.path,
      newCategoryName: result.breadcrumb?.map((b) => b.name).join(' / '),
      newSku,
      matchedBy: result.matchedBy,
      createdHere: result.created || [],
    });
  }

  if (allCreated.size) invalidateTreeCache();

  return NextResponse.json({
    ok: true,
    dryRun,
    processed: products.length,
    updated,
    skipped,
    createdCategories: Array.from(allCreated),
    items,
  });
}