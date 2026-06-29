// Admin products list endpoint
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function choosePrimaryImage(p: any): string | null {
  const base = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
  const preferred = p.cataloguePreferredImage || null;

  if (preferred && base.includes(preferred)) return preferred;
  if (base.length > 0) return base[0];

  for (const v of p.variants || []) {
    const vi = Array.isArray(v.images) ? v.images.filter(Boolean) : [];
    if (preferred && vi.includes(preferred)) return preferred;
    if (vi.length > 0) return vi[0];
  }

  return preferred || null;
}

export async function GET(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const audience = url.searchParams.get('audience');
  const excluded = url.searchParams.get('excluded');
  const hero = url.searchParams.get('hero');

  try {
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
        category: { select: { id: true, name: true, slug: true, level: true, path: true } },
        variants: { select: { id: true, inventory: true, lowStockThreshold: true, images: true } },
      },
    });

    const counts = await prisma.product.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    const statusCounts = counts.reduce((acc: any, c: any) => {
      acc[c.status] = c._count._all;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      products: products.map((p: any) => ({
        id: p.id,
        slug: p.slug,
        sku: p.sku,
        name: p.name,
        craft: p.craft,
        region: p.region,
        category: p.category?.name,
        categorySlug: p.category?.slug,
        categoryPath: p.category?.path || null,
        mrp: p.mrp,
        sellingPrice: p.sellingPrice,
        salePrice: p.salePrice,
        saleStartsAt: p.saleStartsAt,
        saleEndsAt: p.saleEndsAt,
        status: p.status,
        image: choosePrimaryImage(p),
        totalInventory: p.variants.reduce((s: number, v: any) => s + (v.inventory || 0), 0),
        variantCount: p.variants.length,
        lowStock: p.variants.some((v: any) => v.inventory <= (v.lowStockThreshold || 3) && v.inventory > 0),

        catalogueFeatured: !!p.catalogueFeatured,
        catalogueBestseller: !!p.catalogueBestseller,
        catalogueEditorial: !!p.catalogueEditorial,
        cataloguePinHero: !!p.cataloguePinHero,
        catalogueExclude: !!p.catalogueExclude,
        cataloguePreferredImage: p.cataloguePreferredImage || null,
        catalogueAudienceTag: p.catalogueAudienceTag || null,
        catalogueCtaMode: p.catalogueCtaMode || null,
        catalogueImageApproved: !!p.catalogueImageApproved,
        catalogueImageQualityScore: p.catalogueImageQualityScore ?? null,
        catalogueStockVisibility: p.catalogueStockVisibility || 'IN_STOCK_ONLY',
      })),
      statusCounts,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message, products: [], statusCounts: {} },
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

    const required = ['name', 'mrp', 'sellingPrice', 'categoryId'];
    for (const f of required) {
      if (!body[f]) {
        return NextResponse.json({ error: `Missing field: ${f}` }, { status: 400 });
      }
    }

    let slug: string = (body.slug || '').toString().trim();
    if (!slug || slug.length < 2) {
      slug = body.name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
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

    let sku: string = (body.sku || '').toString().trim();
    if (!sku) {
      const { nextSku } = await import('@/lib/sku-generator');
      const cat = await prisma.category.findUnique({
        where: { id: body.categoryId },
        select: { name: true },
      });
      sku = await nextSku({ craft: body.craft, categoryName: cat?.name });
    }

    const userSuppliedSku = !!(body.sku && String(body.sku).trim());

    let product: any = null;
    let lastErr: any = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        product = await prisma.product.create({
          data: {
            name: body.name,
            slug,
            sku,
            shortName: body.shortName || null,
            poeticLine: body.poeticLine || null,
            description: body.description || null,
            story: body.story || null,
            craftNote: body.craftNote || null,
            careInstructions: body.careInstructions || null,
            sustainabilityNote: body.sustainabilityNote || null,
            craft: body.craft || null,
            region: body.region || null,
            cluster: body.cluster || null,
            artisanName: body.artisanName || null,
            material: body.material || null,
            technique: body.technique || null,
            occasion: body.occasion || null,
            categoryId: body.categoryId,
            mrp: parseInt(body.mrp, 10),
            sellingPrice: parseInt(body.sellingPrice, 10),
            salePrice: body.salePrice ? parseInt(body.salePrice, 10) : null,
            images: body.images || [],
            status: body.status || 'DRAFT',
            seoTitle: body.seoTitle || null,
            seoDesc: body.seoDesc || null,

            catalogueFeatured: !!body.catalogueFeatured,
            catalogueBestseller: !!body.catalogueBestseller,
            catalogueEditorial: !!body.catalogueEditorial,
            cataloguePinHero: !!body.cataloguePinHero,
            catalogueExclude: !!body.catalogueExclude,
            cataloguePreferredImage: body.cataloguePreferredImage || null,
            catalogueAudienceTag: body.catalogueAudienceTag || null,
            catalogueCtaMode: body.catalogueCtaMode || null,
            catalogueStoryBlock: body.catalogueStoryBlock || null,
            catalogueImageApproved: !!body.catalogueImageApproved,
            catalogueImageQualityScore:
              body.catalogueImageQualityScore === null ||
              body.catalogueImageQualityScore === undefined ||
              body.catalogueImageQualityScore === ''
                ? null
                : parseInt(body.catalogueImageQualityScore, 10),
            catalogueStockVisibility: body.catalogueStockVisibility || 'IN_STOCK_ONLY',
          },
        });

        break;
      } catch (e: any) {
        lastErr = e;
        const target = e?.meta?.target as any;
        const isSkuCollision = e?.code === 'P2002' && target?.includes?.('sku');
        const isSlugCollision = e?.code === 'P2002' && target?.includes?.('slug');

        if (isSkuCollision && !userSuppliedSku) {
          const { nextSku } = await import('@/lib/sku-generator');
          const cat = await prisma.category.findUnique({
            where: { id: body.categoryId },
            select: { name: true },
          });
          sku = await nextSku({ craft: body.craft, categoryName: cat?.name });
          continue;
        }

        if (isSlugCollision) {
          slug = `${slug}-${Date.now()}`;
          continue;
        }

        throw e;
      }
    }

    if (!product) {
      throw lastErr || new Error('Failed to create product');
    }

    return NextResponse.json({ success: true, product });
  } catch (e: any) {
    const msg = e.code === 'P2002' ? 'SKU or slug already exists' : e.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
// Admin products list endpoint
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function choosePrimaryImage(p: any): string | null {
  const base = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
  const preferred = p.cataloguePreferredImage || null;

  if (preferred && base.includes(preferred)) return preferred;
  if (base.length > 0) return base[0];

  for (const v of p.variants || []) {
    const vi = Array.isArray(v.images) ? v.images.filter(Boolean) : [];
    if (preferred && vi.includes(preferred)) return preferred;
    if (vi.length > 0) return vi[0];
  }

  return preferred || null;
}

export async function GET(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const audience = url.searchParams.get('audience');
  const excluded = url.searchParams.get('excluded');
  const hero = url.searchParams.get('hero');

  try {
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
        category: { select: { id: true, name: true, slug: true, level: true, path: true } },
        variants: { select: { id: true, inventory: true, lowStockThreshold: true, images: true } },
      },
    });

    const counts = await prisma.product.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    const statusCounts = counts.reduce((acc: any, c: any) => {
      acc[c.status] = c._count._all;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      products: products.map((p: any) => ({
        id: p.id,
        slug: p.slug,
        sku: p.sku,
        name: p.name,
        craft: p.craft,
        region: p.region,
        category: p.category?.name,
        categorySlug: p.category?.slug,
        categoryPath: p.category?.path || null,
        mrp: p.mrp,
        sellingPrice: p.sellingPrice,
        salePrice: p.salePrice,
        saleStartsAt: p.saleStartsAt,
        saleEndsAt: p.saleEndsAt,
        status: p.status,
        image: choosePrimaryImage(p),
        totalInventory: p.variants.reduce((s: number, v: any) => s + (v.inventory || 0), 0),
        variantCount: p.variants.length,
        lowStock: p.variants.some((v: any) => v.inventory <= (v.lowStockThreshold || 3) && v.inventory > 0),

        catalogueFeatured: !!p.catalogueFeatured,
        catalogueBestseller: !!p.catalogueBestseller,
        catalogueEditorial: !!p.catalogueEditorial,
        cataloguePinHero: !!p.cataloguePinHero,
        catalogueExclude: !!p.catalogueExclude,
        cataloguePreferredImage: p.cataloguePreferredImage || null,
        catalogueAudienceTag: p.catalogueAudienceTag || null,
        catalogueCtaMode: p.catalogueCtaMode || null,
        catalogueImageApproved: !!p.catalogueImageApproved,
        catalogueImageQualityScore: p.catalogueImageQualityScore ?? null,
        catalogueStockVisibility: p.catalogueStockVisibility || 'IN_STOCK_ONLY',
      })),
      statusCounts,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message, products: [], statusCounts: {} },
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

    const required = ['name', 'mrp', 'sellingPrice', 'categoryId'];
    for (const f of required) {
      if (!body[f]) {
        return NextResponse.json({ error: `Missing field: ${f}` }, { status: 400 });
      }
    }

    let slug: string = (body.slug || '').toString().trim();
    if (!slug || slug.length < 2) {
      slug = body.name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
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

    let sku: string = (body.sku || '').toString().trim();
    if (!sku) {
      const { nextSku } = await import('@/lib/sku-generator');
      const cat = await prisma.category.findUnique({
        where: { id: body.categoryId },
        select: { name: true },
      });
      sku = await nextSku({ craft: body.craft, categoryName: cat?.name });
    }

    const userSuppliedSku = !!(body.sku && String(body.sku).trim());

    let product: any = null;
    let lastErr: any = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        product = await prisma.product.create({
          data: {
            name: body.name,
            slug,
            sku,
            shortName: body.shortName || null,
            poeticLine: body.poeticLine || null,
            description: body.description || null,
            story: body.story || null,
            craftNote: body.craftNote || null,
            careInstructions: body.careInstructions || null,
            sustainabilityNote: body.sustainabilityNote || null,
            craft: body.craft || null,
            region: body.region || null,
            cluster: body.cluster || null,
            artisanName: body.artisanName || null,
            material: body.material || null,
            technique: body.technique || null,
            occasion: body.occasion || null,
            categoryId: body.categoryId,
            mrp: parseInt(body.mrp, 10),
            sellingPrice: parseInt(body.sellingPrice, 10),
            salePrice: body.salePrice ? parseInt(body.salePrice, 10) : null,
            images: body.images || [],
            status: body.status || 'DRAFT',
            seoTitle: body.seoTitle || null,
            seoDesc: body.seoDesc || null,

            catalogueFeatured: !!body.catalogueFeatured,
            catalogueBestseller: !!body.catalogueBestseller,
            catalogueEditorial: !!body.catalogueEditorial,
            cataloguePinHero: !!body.cataloguePinHero,
            catalogueExclude: !!body.catalogueExclude,
            cataloguePreferredImage: body.cataloguePreferredImage || null,
            catalogueAudienceTag: body.catalogueAudienceTag || null,
            catalogueCtaMode: body.catalogueCtaMode || null,
            catalogueStoryBlock: body.catalogueStoryBlock || null,
            catalogueImageApproved: !!body.catalogueImageApproved,
            catalogueImageQualityScore:
              body.catalogueImageQualityScore === null ||
              body.catalogueImageQualityScore === undefined ||
              body.catalogueImageQualityScore === ''
                ? null
                : parseInt(body.catalogueImageQualityScore, 10),
            catalogueStockVisibility: body.catalogueStockVisibility || 'IN_STOCK_ONLY',
          },
        });

        break;
      } catch (e: any) {
        lastErr = e;
        const target = e?.meta?.target as any;
        const isSkuCollision = e?.code === 'P2002' && target?.includes?.('sku');
        const isSlugCollision = e?.code === 'P2002' && target?.includes?.('slug');

        if (isSkuCollision && !userSuppliedSku) {
          const { nextSku } = await import('@/lib/sku-generator');
          const cat = await prisma.category.findUnique({
            where: { id: body.categoryId },
            select: { name: true },
          });
          sku = await nextSku({ craft: body.craft, categoryName: cat?.name });
          continue;
        }

        if (isSlugCollision) {
          slug = `${slug}-${Date.now()}`;
          continue;
        }

        throw e;
      }
    }

    if (!product) {
      throw lastErr || new Error('Failed to create product');
    }

    return NextResponse.json({ success: true, product });
  } catch (e: any) {
    const msg = e.code === 'P2002' ? 'SKU or slug already exists' : e.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
