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

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
}

function parseRequiredInt(value: unknown, field: string): number {
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid integer for ${field}`);
  }
  return n;
}

function parseOptionalInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : undefined;
}

function parseOptionalFloat(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : undefined;
}

function parseOptionalDate(value: unknown): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? undefined : d;
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

function normalizeStockVisibility(value: unknown): CanonicalStockVisibility {
  const raw = normalizeText(value)?.toUpperCase();

  if (!raw) return 'IN_STOCK_ONLY';
  if (raw === 'SHOW_ALL' || raw === 'SHOW_EXACT') return 'SHOW_ALL';
  if (raw === 'HIDE_STOCK') return 'HIDE_STOCK';
  if (raw === 'LOW_STOCK_BADGE' || raw === 'IN_STOCK_ONLY') return 'IN_STOCK_ONLY';

  return 'IN_STOCK_ONLY';
}

function choosePrimaryImage(product: any): string | null {
  const preferred = product?.cataloguePreferredImage || null;

  const productImages = Array.isArray(product?.images)
    ? product.images.filter(Boolean)
    : [];

  if (preferred && productImages.includes(preferred)) return preferred;
  if (productImages.length > 0) return productImages[0];

  for (const variant of product?.variants || []) {
    const variantImages = Array.isArray(variant?.images)
      ? variant.images.filter(Boolean)
      : [];

    if (preferred && variantImages.includes(preferred)) return preferred;
    if (variantImages.length > 0) return variantImages[0];
  }

  return preferred || null;
}

async function buildUniqueSlug(name: string, incomingSlug?: unknown): Promise<string> {
  let slug = sanitizeSlug(String(incomingSlug || '').trim());

  if (!slug) {
    slug = sanitizeSlug(name);
  }

  if (!slug) {
    slug = `product-${Date.now()}`;
  }

  const baseSlug = slug;
  let suffix = 2;

  while (await prisma.product.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix++}`;
    if (suffix > 50) {
      slug = `${baseSlug}-${Date.now()}`;
      break;
    }
  }

  return slug;
}

async function buildSku(body: any): Promise<string> {
  const supplied = String(body?.sku || '').trim();
  if (supplied) return supplied;

  const { nextSku } = await import('@/lib/sku-generator');
  const category = await prisma.category.findUnique({
    where: { id: String(body.categoryId) },
    select: { name: true },
  });

  return nextSku({
    craft: body?.craft || undefined,
    categoryName: category?.name || undefined,
  });
}

function setIfPresent(target: Record<string, any>, key: string, value: unknown) {
  if (value !== undefined && value !== null && value !== '') {
    target[key] = value;
  }
}

function buildCreateData(body: any, slug: string, sku: string): any {
  const editionSizeInput = firstDefined(body.editionSize, body.editionTotal);
  const aiRoomEligibleInput = firstDefined(body.aiRoomEligible, body.aiStylistEligible);

  const data: Record<string, any> = {
    name: String(body.name).trim(),
    slug,
    sku,
    categoryId: String(body.categoryId),

    mrp: parseRequiredInt(body.mrp, 'mrp'),
    sellingPrice: parseRequiredInt(body.sellingPrice, 'sellingPrice'),

    images: normalizeStringArray(body.images),
    badges: normalizeStringArray(body.badges),

    status: normalizeText(body.status) || 'DRAFT',

    aiTryOnEligible: asBoolean(body.aiTryOnEligible),
    aiRoomEligible: asBoolean(aiRoomEligibleInput),
    arTryOnEligible: asBoolean(body.arTryOnEligible),
    codEligible: asBoolean(body.codEligible),
    returnEligible: asBoolean(body.returnEligible),

    catalogueFeatured: asBoolean(body.catalogueFeatured),
    catalogueBestseller: asBoolean(body.catalogueBestseller),
    catalogueEditorial: asBoolean(body.catalogueEditorial),
    cataloguePinHero: asBoolean(body.cataloguePinHero),
    catalogueExclude: asBoolean(body.catalogueExclude),
    catalogueImageApproved: asBoolean(body.catalogueImageApproved),
    catalogueStockVisibility: normalizeStockVisibility(body.catalogueStockVisibility),
  };

  setIfPresent(data, 'shortName', normalizeText(body.shortName));
  setIfPresent(data, 'poeticLine', normalizeText(body.poeticLine));
  setIfPresent(data, 'description', normalizeText(body.description));
  setIfPresent(data, 'story', normalizeText(body.story));
  setIfPresent(data, 'craftNote', normalizeText(body.craftNote));
  setIfPresent(data, 'careInstructions', normalizeText(body.careInstructions));
  setIfPresent(data, 'sustainabilityNote', normalizeText(body.sustainabilityNote));

  setIfPresent(data, 'craft', normalizeText(body.craft));
  setIfPresent(data, 'region', normalizeText(body.region));
  setIfPresent(data, 'state', normalizeText(body.state));
  setIfPresent(data, 'cluster', normalizeText(body.cluster));
  setIfPresent(data, 'artisanName', normalizeText(body.artisanName));
  setIfPresent(data, 'material', normalizeText(body.material));
  setIfPresent(data, 'technique', normalizeText(body.technique));
  setIfPresent(data, 'occasion', normalizeText(body.occasion));

  setIfPresent(data, 'salePrice', parseOptionalInt(body.salePrice));
  setIfPresent(data, 'saleStartsAt', parseOptionalDate(body.saleStartsAt));
  setIfPresent(data, 'saleEndsAt', parseOptionalDate(body.saleEndsAt));

  setIfPresent(data, 'gstRate', parseOptionalFloat(body.gstRate));
  setIfPresent(data, 'hsnCode', normalizeText(body.hsnCode));

  setIfPresent(data, 'video', normalizeText(body.video));

  setIfPresent(data, 'seoTitle', normalizeText(body.seoTitle));
  setIfPresent(data, 'seoDesc', normalizeText(body.seoDesc));

  setIfPresent(data, 'returnPolicy', normalizeText(body.returnPolicy));
  setIfPresent(data, 'fulfilmentMode', normalizeText(body.fulfilmentMode));
  setIfPresent(data, 'depositPercent', parseOptionalInt(body.depositPercent));
  setIfPresent(data, 'releaseDate', parseOptionalDate(body.releaseDate));
  setIfPresent(data, 'editionSize', parseOptionalInt(editionSizeInput));
  setIfPresent(data, 'editionSold', parseOptionalInt(body.editionSold));

  setIfPresent(
    data,
    'cataloguePreferredImage',
    normalizeText(body.cataloguePreferredImage)
  );
  setIfPresent(data, 'catalogueAudienceTag', normalizeText(body.catalogueAudienceTag));
  setIfPresent(data, 'catalogueCtaMode', normalizeText(body.catalogueCtaMode));
  setIfPresent(data, 'catalogueStoryBlock', normalizeText(body.catalogueStoryBlock));
  setIfPresent(
    data,
    'catalogueImageQualityScore',
    parseOptionalInt(body.catalogueImageQualityScore)
  );

  return data;
}

export async function GET(request: Request) {
  const user = await getSession();

  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const audience = url.searchParams.get('audience');
    const excluded = url.searchParams.get('excluded');
    const hero = url.searchParams.get('hero');

    const where: any = {};

    if (status && status !== 'ALL') where.status = status;
    if (audience) where.catalogueAudienceTag = audience;
    if (excluded === 'true') where.catalogueExclude = true;
    if (excluded === 'false') where.catalogueExclude = false;
    if (hero === 'true') where.cataloguePinHero = true;

    const products = await prisma.product.findMany({
      where,
      take: 200,
      orderBy: [{ cataloguePinHero: 'desc' }, { createdAt: 'desc' }],
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            level: true,
            path: true,
          },
        },
        variants: {
          select: {
            id: true,
            inventory: true,
            lowStockThreshold: true,
            images: true,
          },
        },
      },
    });

    const counts = await prisma.product.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    const statusCounts = counts.reduce((acc, row) => {
      acc[row.status] = row._count._all;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      products: products.map((p: any) => ({
        id: p.id,
        slug: p.slug,
        sku: p.sku,
        name: p.name,
        shortName: p.shortName,
        craft: p.craft,
        region: p.region,
        material: p.material,
        occasion: p.occasion,

        category: p.category?.name || null,
        categoryId: p.category?.id || null,
        categorySlug: p.category?.slug || null,
        categoryPath: p.category?.path || null,
        categoryLevel: p.category?.level ?? null,

        mrp: p.mrp,
        sellingPrice: p.sellingPrice,
        salePrice: p.salePrice,
        saleStartsAt: p.saleStartsAt,
        saleEndsAt: p.saleEndsAt,
        status: p.status,

        image: choosePrimaryImage(p),
        totalInventory: (p.variants || []).reduce(
          (sum: number, v: any) => sum + (v.inventory || 0),
          0
        ),
        variantCount: (p.variants || []).length,
        lowStock: (p.variants || []).some(
          (v: any) => v.inventory > 0 && v.inventory <= (v.lowStockThreshold || 3)
        ),

        aiTryOnEligible: !!p.aiTryOnEligible,
        aiRoomEligible: !!p.aiRoomEligible,
        aiStylistEligible: !!p.aiRoomEligible,
        arTryOnEligible: !!p.arTryOnEligible,

        catalogueFeatured: !!p.catalogueFeatured,
        catalogueBestseller: !!p.catalogueBestseller,
        catalogueEditorial: !!p.catalogueEditorial,
        cataloguePinHero: !!p.cataloguePinHero,
        catalogueExclude: !!p.catalogueExclude,
        cataloguePreferredImage: p.cataloguePreferredImage || null,
        catalogueAudienceTag: p.catalogueAudienceTag || null,
        catalogueCtaMode: p.catalogueCtaMode || null,
        catalogueStoryBlock: p.catalogueStoryBlock || null,
        catalogueImageApproved: !!p.catalogueImageApproved,
        catalogueImageQualityScore: p.catalogueImageQualityScore ?? null,
        catalogueStockVisibility: normalizeStockVisibility(
          p.catalogueStockVisibility
        ),

        fulfilmentMode: p.fulfilmentMode || null,
        depositPercent: p.depositPercent ?? null,
        releaseDate: p.releaseDate ?? null,
        editionSize: p.editionSize ?? null,
        editionTotal: p.editionSize ?? null,
        editionSold: p.editionSold ?? null,
      })),
      statusCounts,
      readModel: {
        stockVisibility: CANONICAL_STOCK_VISIBILITY,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || 'Failed to load products',
        products: [],
        statusCounts: {},
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const user = await getSession();

  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (!normalizeText(body.name)) {
      return NextResponse.json({ error: 'Missing field: name' }, { status: 400 });
    }

    if (body.mrp === undefined || body.mrp === null || body.mrp === '') {
      return NextResponse.json({ error: 'Missing field: mrp' }, { status: 400 });
    }

    if (
      body.sellingPrice === undefined ||
      body.sellingPrice === null ||
      body.sellingPrice === ''
    ) {
      return NextResponse.json(
        { error: 'Missing field: sellingPrice' },
        { status: 400 }
      );
    }

    if (!normalizeText(body.categoryId)) {
      return NextResponse.json(
        { error: 'Missing field: categoryId' },
        { status: 400 }
      );
    }

    let slug = await buildUniqueSlug(String(body.name), body.slug);
    let sku = await buildSku(body);
    const userSuppliedSku = !!normalizeText(body.sku);

    let createdProduct: any = null;
    let lastError: any = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const data: any = buildCreateData(body, slug, sku);
        createdProduct = await prisma.product.create({ data });
        break;
      } catch (error: any) {
        lastError = error;

        const target = error?.meta?.target;
        const targetText = Array.isArray(target) ? target.join(',') : String(target || '');

        const isSkuCollision = error?.code === 'P2002' && targetText.includes('sku');
        const isSlugCollision = error?.code === 'P2002' && targetText.includes('slug');

        if (isSkuCollision && !userSuppliedSku) {
          sku = await buildSku(body);
          continue;
        }

        if (isSlugCollision) {
          slug = `${sanitizeSlug(String(body.name))}-${Date.now()}`;
          continue;
        }

        throw error;
      }
    }

    if (!createdProduct) {
      throw lastError || new Error('Failed to create product');
    }

    return NextResponse.json({
      success: true,
      product: createdProduct,
    });
  } catch (error: any) {
    const message =
      error?.code === 'P2002'
        ? 'SKU or slug already exists'
        : error?.message || 'Failed to create product';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
