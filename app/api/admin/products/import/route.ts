// Bulk-import draft products + variants from a .xlsx workbook.
// All imported products land as DRAFT \u2014 admin reviews and publishes manually.
// Variant rows attach to the most recent preceding PRODUCT row (or to an
// explicit Parent SKU if provided).
import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseInventoryWorkbook } from '@/lib/inventory-io';
import { generateSku, generateSlug } from '@/lib/sku';
import { resolveCategory, generateSkuFor, invalidateTreeCache } from '@/lib/taxonomy/resolver';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

interface RowResult {
  rowIndex: number;
  rowType: 'PRODUCT' | 'VARIANT';
  status: 'created' | 'skipped' | 'error';
  message?: string;
  productId?: string;
  sku?: string;
  variantSku?: string;
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  let rows;
  try {
    rows = await parseInventoryWorkbook(buf);
  } catch (e: any) {
    return NextResponse.json({ error: `Failed to read workbook: ${e.message}` }, { status: 400 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: 'No rows found in the file. Make sure you used the Products sheet.' }, { status: 400 });
  }

  // Preload categories for slug lookup
  const cats = await prisma.category.findMany({
    select: { id: true, slug: true, name: true },
  });
  const catBySlug = new Map(cats.map(c => [c.slug.toLowerCase(), c]));

  const results: RowResult[] = [];

  // Tracks the most recently created PRODUCT so VARIANT rows can attach to it
  let currentParent: { id: string; sku: string; name: string } | null = null;
  // For variants that name an explicit Parent SKU, look up that product on demand
  const productBySkuCache = new Map<string, { id: string; sku: string; name: string }>();

  for (const row of rows) {
    // Parsing errors collected at parse time
    if (row.errors.length > 0) {
      results.push({ rowIndex: row.rowIndex, rowType: row.rowType, status: 'error', message: row.errors.join('; ') });
      continue;
    }

    // ─────────── PRODUCT row ───────────
    if (row.rowType === 'PRODUCT') {
      const d = row.data;
      // First try exact slug match (existing behaviour). If that fails, fall back
      // to the AI resolver which can map free-text categories OR auto-create the
      // right sub/leaf using the product's name + craft + material.
      let cat: { id: string; slug: string; name: string } | null =
        catBySlug.get((d.category || '').toLowerCase()) || null;
      let aiCreated: string[] = [];
      if (!cat) {
        const r = await resolveCategory({
          query: d.category || d.craft || null,
          product: {
            name: d.name,
            description: d.shortDescription,
            craft: d.craft,
            region: d.region,
            material: d.material,
          },
          allowAi: true,
          allowCreate: true,
        });
        if (r.ok && r.categoryId) {
          cat = { id: r.categoryId, slug: r.slug || '', name: r.name || '' };
          aiCreated = r.created || [];
          // refresh in-memory map
          catBySlug.set(cat.slug.toLowerCase(), cat);
          if (aiCreated.length) invalidateTreeCache();
        }
      }
      if (!cat) {
        results.push({
          rowIndex: row.rowIndex,
          rowType: 'PRODUCT',
          status: 'error',
          message: `Could not resolve category "${d.category}" (AI fallback also failed).`,
        });
        currentParent = null;
        continue;
      }

      try {
        let sku = (d.sku || '').trim();
        if (sku) {
          const dup = await prisma.product.findUnique({ where: { sku } });
          if (dup) {
            sku = await generateSkuFor(cat.id);
          }
        } else {
          sku = await generateSkuFor(cat.id);
        }

        const slug = await generateSlug(d.name!);

        const created = await prisma.product.create({
          data: {
            name: d.name!,
            slug,
            sku,
            categoryId: cat.id,
            craft: d.craft || null,
            region: d.region || null,
            material: d.material || null,
            mrp: Math.round((d.mrp || 0) * 100),           // rupees -> paise
            sellingPrice: Math.round((d.sellingPrice || 0) * 100),
            description: d.shortDescription || '',
            status: 'DRAFT',
            images: [],
            badges: [],
            gstRate: 5.0,
            codEligible: true,
            returnEligible: true,
            aiTryOnEligible: false,
            aiRoomEligible: false,
          },
        });

        currentParent = { id: created.id, sku: created.sku, name: created.name };
        productBySkuCache.set(created.sku, currentParent);

        results.push({
          rowIndex: row.rowIndex,
          rowType: 'PRODUCT',
          status: 'created',
          productId: created.id,
          sku: created.sku,
          message: aiCreated.length
            ? `AI created new sub-category: ${aiCreated.join(', ')}`
            : undefined,
        });
      } catch (e: any) {
        results.push({
          rowIndex: row.rowIndex,
          rowType: 'PRODUCT',
          status: 'error',
          message: e.message || 'Unknown error creating product',
        });
        currentParent = null;
      }
      continue;
    }

    // ─────────── VARIANT row ───────────
    const d = row.data;

    // Resolve parent: explicit Parent SKU OR most recent PRODUCT
    let parent: { id: string; sku: string; name: string } | null = null;
    if (d.parentSku) {
      parent = productBySkuCache.get(d.parentSku) || null;
      if (!parent) {
        const found = await prisma.product.findUnique({
          where: { sku: d.parentSku },
          select: { id: true, sku: true, name: true },
        });
        if (found) {
          parent = found;
          productBySkuCache.set(found.sku, found);
        }
      }
    } else {
      parent = currentParent;
    }

    if (!parent) {
      results.push({
        rowIndex: row.rowIndex,
        rowType: 'VARIANT',
        status: 'error',
        message: 'Variant row has no parent. Either place it under a PRODUCT row or fill the Parent SKU column.',
      });
      continue;
    }

    try {
      // Auto-generate a unique variant SKU: {parentSku}-{shortTag}
      const tag = (d.variantSize || d.variantColor || d.variantMaterial || 'var')
        .toString()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 6) || 'VAR';
      let variantSku = `${parent.sku}-${tag}`;
      // Ensure uniqueness
      let suffix = 1;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const dup = await prisma.variant.findUnique({ where: { sku: variantSku } });
        if (!dup) break;
        suffix++;
        variantSku = `${parent.sku}-${tag}${suffix}`;
        if (suffix > 50) {
          variantSku = `${parent.sku}-${tag}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
          break;
        }
      }

      const created = await prisma.variant.create({
        data: {
          productId: parent.id,
          sku: variantSku,
          size: d.variantSize || null,
          color: d.variantColor || null,
          material: d.variantMaterial || null,
          inventory: typeof d.variantInventory === 'number' ? Math.max(0, Math.round(d.variantInventory)) : 0,
          sellingPrice: d.variantPrice ? Math.round(d.variantPrice * 100) : null,
        },
      });

      results.push({
        rowIndex: row.rowIndex,
        rowType: 'VARIANT',
        status: 'created',
        productId: parent.id,
        sku: parent.sku,
        variantSku: created.sku,
      });
    } catch (e: any) {
      results.push({
        rowIndex: row.rowIndex,
        rowType: 'VARIANT',
        status: 'error',
        message: e.message || 'Unknown error creating variant',
      });
    }
  }

  const created = results.filter(r => r.status === 'created' && r.rowType === 'PRODUCT').length;
  const variantsCreated = results.filter(r => r.status === 'created' && r.rowType === 'VARIANT').length;
  const errored = results.filter(r => r.status === 'error').length;

  return NextResponse.json({
    ok: true,
    summary: {
      total: rows.length,
      productsCreated: created,
      variantsCreated,
      errored,
    },
    results,
  });
}
