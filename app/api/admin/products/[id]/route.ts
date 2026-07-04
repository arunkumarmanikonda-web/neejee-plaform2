// Admin single product endpoint - GET, PATCH, DELETE
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CANONICAL_STOCK_VISIBILITY = [
  'IN_STOCK_ONLY',
  'SHOW_ALL',
  'HIDE_STOCK',
] as const;

type CanonicalStockVisibility =
  (typeof CANONICAL_STOCK_VISIBILITY)[number];

function normalizeText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function parseOptionalInt(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
}

function parseOptionalFloat(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return 0;
  const n = Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

function parseOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function asBoolean(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function firstDefined<T>(...values: T[]): T | undefined {
  for (const value of values) {
    if (value !== undefined) return value;
  }
  return undefined;
}

function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeStockVisibility(
  value: unknown
): CanonicalStockVisibility {
  const raw = normalizeText(value)?.toUpperCase();

  if (!raw) return 'IN_STOCK_ONLY';
  if (raw === 'SHOW_ALL' || raw === 'SHOW_EXACT') return 'SHOW_ALL';
  if (raw === 'HIDE_STOCK') return 'HIDE_STOCK';
  if (raw === 'LOW_STOCK_BADGE' || raw === 'IN_STOCK_ONLY') return 'IN_STOCK_ONLY';

  return 'IN_STOCK_ONLY';
}

function normalizeProductForAdmin(product: any) {
  return {
    ...product,
    catalogueStockVisibility: normalizeStockVisibility(
      product?.catalogueStockVisibility
    ),
    aiRoomEligible: !!product?.aiRoomEligible,
    aiStylistEligible: !!product?.aiRoomEligible,
    editionSize: product?.editionSize ?? null,
    editionTotal: product?.editionSize ?? null,
  };
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await getSession();

  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json(
      { error: 'Unauthorized — sign in as ADMIN/SUPER_ADMIN/CONTENT_EDITOR' },
      { status: 401 }
    );
  }

  const key = String(params.id || '').trim();
  if (!key) {
    return NextResponse.json({ error: 'Missing product identifier' }, { status: 400 });
  }

  try {
    const product = await prisma.product.findFirst({
      where: {
        OR: [
          { id: key },
          { slug: key },
          { slug: key.toLowerCase() },
          { sku: key },
          { sku: key.toUpperCase() },
        ],
      },
      include: {
        category: true,
        variants: { orderBy: { sku: 'asc' } },
        seller: true,
      },
    });

    if (!product) {
      const recent = await prisma.product.findFirst({
        where: {
          OR: [
            { id: { startsWith: key.slice(0, 6) } },
            { slug: { contains: key.slice(0, 6), mode: 'insensitive' } },
          ],
        },
        select: { id: true, slug: true, status: true },
      });

      console.warn(
        `[admin.products.GET] not found for key="${key}". Nearest match:`,
        recent || 'none'
      );

      return NextResponse.json(
        {
          error: `No product matches id/slug/sku "${key}"`,
          searched: key,
          nearest: recent || null,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      product: normalizeProductForAdmin(product),
      readModel: {
        stockVisibility: CANONICAL_STOCK_VISIBILITY,
      },
    });
  } catch (e: any) {
    console.error(
      `[admin.products.GET] error for key="${key}":`,
      e?.message,
      e?.stack
    );

    return NextResponse.json(
      {
        error: e.message || 'Database error',
        type: e?.code || e?.name || 'UnknownError',
        searched: key,
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await getSession();

  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const lookupKey = String(params.id || '').trim();

    const existing = await prisma.product.findFirst({
      where: {
        OR: [
          { id: lookupKey },
          { slug: lookupKey },
          { slug: lookupKey.toLowerCase() },
          { sku: lookupKey },
          { sku: lookupKey.toUpperCase() },
        ],
      },
      select: { id: true, slug: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const stringFields = [
      'name',
      'shortName',
      'description',
      'craft',
      'region',
      'state',
      'cluster',
      'artisanName',
      'material',
      'technique',
      'occasion',
      'hsnCode',
      'categoryId',
      'poeticLine',
      'story',
      'craftNote',
      'careInstructions',
      'sustainabilityNote',
      'returnPolicy',
      'seoTitle',
      'seoDesc',
      'status',
      'fulfilmentMode',
      'cataloguePreferredImage',
      'catalogueAudienceTag',
      'catalogueCtaMode',
      'catalogueStoryBlock',
    ] as const;

    const arrayFields = ['images', 'badges'] as const;

    const boolFields = [
      'aiTryOnEligible',
      'arTryOnEligible',
      'codEligible',
      'returnEligible',
      'catalogueFeatured',
      'catalogueBestseller',
      'catalogueEditorial',
      'cataloguePinHero',
      'catalogueExclude',
      'catalogueImageApproved',
    ] as const;

    const data: Record<string, any> = {};

    for (const key of stringFields) {
      if (body[key] !== undefined) {
        data[key] = body[key] === '' ? null : body[key];
      }
    }

    if (body.slug !== undefined) {
      if (body.slug === '') {
        data.slug = null;
      } else {
        const cleaned = sanitizeSlug(String(body.slug));
        data.slug = cleaned || null;
      }
    }

    if (body.mrp !== undefined) {
      data.mrp = parseOptionalInt(body.mrp);
    }

    if (body.sellingPrice !== undefined) {
      data.sellingPrice = parseOptionalInt(body.sellingPrice);
    }

    if (body.salePrice !== undefined) {
      data.salePrice = parseOptionalInt(body.salePrice);
    }

    if (body.depositPercent !== undefined) {
      data.depositPercent = parseOptionalInt(body.depositPercent);
    }

    if (body.editionSold !== undefined) {
      data.editionSold = parseOptionalInt(body.editionSold);
    }

    if (body.catalogueImageQualityScore !== undefined) {
      data.catalogueImageQualityScore = parseOptionalInt(
        body.catalogueImageQualityScore
      );
    }

    const editionSizeInput = firstDefined(body.editionSize, body.editionTotal);
    if (editionSizeInput !== undefined) {
      data.editionSize = parseOptionalInt(editionSizeInput);
    }

    if (body.gstRate !== undefined) {
      data.gstRate = parseOptionalFloat(body.gstRate);
    }

    if (body.saleStartsAt !== undefined) {
      data.saleStartsAt = parseOptionalDate(body.saleStartsAt);
    }

    if (body.saleEndsAt !== undefined) {
      data.saleEndsAt = parseOptionalDate(body.saleEndsAt);
    }

    if (body.releaseDate !== undefined) {
      data.releaseDate = parseOptionalDate(body.releaseDate);
    }

    for (const key of arrayFields) {
      if (Array.isArray(body[key])) {
        data[key] = body[key];
      }
    }

    for (const key of boolFields) {
      if (body[key] !== undefined) {
        data[key] = !!body[key];
      }
    }

    const aiRoomEligibleInput = firstDefined(
      body.aiRoomEligible,
      body.aiStylistEligible
    );
    if (aiRoomEligibleInput !== undefined) {
      data.aiRoomEligible = asBoolean(aiRoomEligibleInput);
    }

    if (body.catalogueStockVisibility !== undefined) {
      data.catalogueStockVisibility = normalizeStockVisibility(
        body.catalogueStockVisibility
      );
    }

    if (data.name === null || data.name === '') {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    }

    if (
      data.slug !== undefined &&
      data.slug !== null &&
      String(data.slug).trim() === ''
    ) {
      return NextResponse.json({ error: 'Slug cannot be empty' }, { status: 400 });
    }

    if (
      data.catalogueStockVisibility &&
      !CANONICAL_STOCK_VISIBILITY.includes(data.catalogueStockVisibility)
    ) {
      return NextResponse.json(
        { error: 'Invalid catalogueStockVisibility value' },
        { status: 400 }
      );
    }

    const updated = await prisma.product.update({
      where: { id: existing.id },
      data,
      include: {
        category: true,
        variants: { orderBy: { sku: 'asc' } },
        seller: true,
      },
    });

    return NextResponse.json({
      success: true,
      product: normalizeProductForAdmin(updated),
      readModel: {
        stockVisibility: CANONICAL_STOCK_VISIBILITY,
      },
    });
  } catch (e: any) {
    const message =
      e?.code === 'P2002'
        ? 'SKU or slug already exists'
        : e?.message || 'Failed to update product';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const user = await getSession();

  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const lookupKey = String(params.id || '').trim();

    const existing = await prisma.product.findFirst({
      where: {
        OR: [
          { id: lookupKey },
          { slug: lookupKey },
          { slug: lookupKey.toLowerCase() },
          { sku: lookupKey },
          { sku: lookupKey.toUpperCase() },
        ],
      },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.product.update({
      where: { id: existing.id },
      data: { status: 'ARCHIVED' },
    });

    return NextResponse.json({ success: true, archived: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
