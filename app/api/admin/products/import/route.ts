import { draftMerchandise } from '@/lib/catalog/narrative-service';
import { workbookColours } from '@/lib/catalog/workbook-colours';
// Bulk-import draft products + variants from a .xlsx workbook.
// All imported products land as DRAFT \u2014 admin reviews and publishes manually.
// Variant rows attach to the most recent preceding PRODUCT row (or to an
// explicit Parent SKU if provided).
import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseInventoryWorkbook } from '@/lib/inventory-io';
import { createHash } from 'node:crypto';
import { generateSlug } from '@/lib/sku';
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

  const colours=workbookColours(rows);
  const results: RowResult[] = [];

  type Parent = { id: string; sku: string; name: string };
  const parents = new Map<number, Parent>();
  const parentRow = new Map<number, number>();
  const declared = new Map<string, number>();
  const productBySkuCache = new Map<string, Parent>();
  const occurrences = new Map<string, number>();
  const rowId = (kind: string, key: string) => 'c' + createHash('sha256').update('neejee-inventory-v1/' + kind + '/' + key).digest('hex').slice(0, 24);
  let preceding = 0;
  for (const row of rows) {
    if (row.rowType === 'PRODUCT') {
      preceding = row.rowIndex;
      if (row.data.sku) declared.set(row.data.sku, (declared.get(row.data.sku) || 0) + 1);
    } else parentRow.set(row.rowIndex, preceding);
  }
  // Resolve product rows first, including explicit references to a later row.
  for (const row of [...rows.filter(r => r.rowType === 'PRODUCT'), ...rows.filter(r => r.rowType === 'VARIANT')]) {
    // Parsing errors collected at parse time
    if (row.errors.length > 0) {
      results.push({ rowIndex: row.rowIndex, rowType: row.rowType, status: 'error', message: row.errors.join('; ') });
      continue;
    }

    // ─────────── PRODUCT row ───────────
    if (row.rowType === 'PRODUCT') {
      const d = row.data;
      if (d.sku && declared.get(d.sku)! > 1) {
        results.push({rowIndex:row.rowIndex,rowType:'PRODUCT',status:'error',message:'This SKU appears on multiple product rows. Give each piece a unique SKU.'});
        continue;
      }
      const identity = d.sku || JSON.stringify(d);
      const occurrence = (occurrences.get(identity) || 0) + 1;
      occurrences.set(identity, occurrence);
      const importId = rowId('product', JSON.stringify([identity, occurrence]));
      const recordParent = (parent: Parent, status: 'created'|'skipped', message?:string) => {
        parents.set(row.rowIndex, parent);
        productBySkuCache.set(parent.sku, parent);
        results.push({rowIndex:row.rowIndex,rowType:'PRODUCT',status,productId:parent.id,sku:parent.sku,message});
      };
      const replay = await prisma.product.findUnique({where:{id:importId},select:{id:true,sku:true,name:true}});
      if (replay) { recordParent(replay,'skipped','Product already imported. Existing catalogue details were preserved.'); continue; }
      if (d.sku && await prisma.product.findUnique({where:{sku:d.sku},select:{id:true}})) {
        results.push({rowIndex:row.rowIndex,rowType:'PRODUCT',status:'error',message:'SKU already exists. Edit the existing product or enter a unique SKU.'});
        continue;
      }
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
        }).catch(() => null);
        if (r?.ok && r.categoryId) {
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
        continue;
      }

      try {
        const sku = d.sku || await generateSkuFor(cat.id);

        const {draft}=await draftMerchandise({...d, description:d.shortDescription, categoryName:cat.name, colours:colours.get(row.rowIndex)}, {useAI:false});
        const slug = await generateSlug(draft.name);

        const created = await prisma.product.create({
          data: {
            ...draft,
            id: importId,
            slug,
            sku,
            categoryId: cat.id,
            craft: d.craft || null,
            region: d.region || null,
            material: d.material || null,
            mrp: Math.round((d.mrp || 0) * 100),           // rupees -> paise
            sellingPrice: Math.round((d.sellingPrice || 0) * 100),
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

        recordParent(created, 'created', aiCreated.length ? 'Created sub-category: ' + aiCreated.join(', ') : undefined);
      } catch (e: any) {
        if (e?.code === 'P2002') {
          const concurrent = await prisma.product.findUnique({where:{id:importId},select:{id:true,sku:true,name:true}});
          if (concurrent) { recordParent(concurrent,'skipped','Product already imported.'); continue; }
        }
        results.push({
          rowIndex: row.rowIndex,
          rowType: 'PRODUCT',
          status: 'error',
          message: e.message || 'Unknown error creating product',
        });
      }
      continue;
    }

    // ─────────── VARIANT row ───────────
    const d = row.data;

    // Resolve parent: explicit Parent SKU OR most recent PRODUCT
    let parent: { id: string; sku: string; name: string } | null = null;
    if (d.parentSku) {
      parent = productBySkuCache.get(d.parentSku) || null;
      if (!parent && !declared.has(d.parentSku)) {
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
      parent = parents.get(parentRow.get(row.rowIndex) || 0) || null;
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

    const size = d.variantSize || null;
    const color = d.variantColor || null;
    const material = d.variantMaterial || null;
    const variantId = rowId('variant', JSON.stringify([parent.id, size, color, material]));
    const parentId = parent.id;
    const parentSku = parent.sku;
    const reportedReplay = (existing: {sku: string; inventory: number; sellingPrice: number | null}) => {
      const differs = existing.inventory !== (d.variantInventory || 0) ||
        existing.sellingPrice !== (d.variantPrice ? Math.round(d.variantPrice * 100) : null);
      results.push({
        rowIndex: row.rowIndex, rowType: 'VARIANT', status: differs ? 'error' : 'skipped',
        productId: parentId, sku: parentSku, variantSku: existing.sku,
        message: differs ? 'This variant exists with different stock or price. Review it in Products.' : 'Variant already exists.',
      });
    };
    // Historical variants have generated IDs. Match the actual options too.
    const previous = await prisma.variant.findFirst({
      where: { productId: parentId, size, color, material },
      select: { sku: true, inventory: true, sellingPrice: true },
    });
    if (previous) { reportedReplay(previous); continue; }
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
          id: variantId,
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
      if (e?.code === 'P2002') {
        const concurrent = await prisma.variant.findUnique({where:{id:variantId},select:{sku:true,inventory:true,sellingPrice:true}});
        if (concurrent) { reportedReplay(concurrent); continue; }
      }
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
    results: results.sort((a,b) => a.rowIndex-b.rowIndex),
  });
}
