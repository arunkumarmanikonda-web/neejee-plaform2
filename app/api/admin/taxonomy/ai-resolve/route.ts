/**
 * POST /api/admin/taxonomy/ai-resolve
 *
 * Body:
 *   {
 *     query?: string,              // free text the user typed
 *     product?: { name, description, craft, region, material, tags },
 *     allowCreate?: boolean,       // default true — auto-create sub / leaf if missing
 *     allowAi?: boolean            // default true
 *   }
 *
 * Response:
 *   { ok, categoryId, slug, path, name, level, breadcrumb, created[], matchedBy }
 *
 * Used by:
 *   - product create/edit "Resolve with AI" button
 *   - bulk import parser (per-row)
 *   - migrate-products endpoint (batched)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { resolveCategory, generateSkuFor, invalidateTreeCache } from '@/lib/taxonomy/resolver';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ['ADMIN', 'SUPER_ADMIN', 'SELLER'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const result = await resolveCategory({
    query: body.query,
    product: body.product,
    allowAi: body.allowAi !== false,
    allowCreate: body.allowCreate !== false,
  });
  if (!result.ok) {
    return NextResponse.json(result, { status: 422 });
  }
  if (result.created && result.created.length) {
    invalidateTreeCache();
  }
  // also return a suggested SKU for convenience
  const sku = result.categoryId ? await generateSkuFor(result.categoryId) : null;
  return NextResponse.json({ ...result, suggestedSku: sku });
}
