// Admin products list endpoint
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  try {
    const where: any = {};
    if (status && status !== 'ALL') where.status = status;
    const products = await prisma.product.findMany({
      where, take: 200, orderBy: { createdAt: 'desc' },
      include: {
        category: { select: { name: true, slug: true } },
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
        mrp: p.mrp,
        sellingPrice: p.sellingPrice,
        salePrice: p.salePrice,
        saleStartsAt: p.saleStartsAt,
        saleEndsAt: p.saleEndsAt,
        status: p.status,
        image: (() => {
          const base = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
          if (base.length > 0) return base[0];
          for (const v of (p.variants || [])) {
            const vi = Array.isArray((v as any).images) ? (v as any).images.filter(Boolean) : [];
            if (vi.length > 0) return vi[0];
          }
          return null;
        })(),
        totalInventory: p.variants.reduce((s: number, v: any) => s + (v.inventory || 0), 0),
        variantCount: p.variants.length,
        lowStock: p.variants.some((v: any) => v.inventory <= (v.lowStockThreshold || 3) && v.inventory > 0),
      })),
      statusCounts,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, products: [], statusCounts: {} }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    // SKU is auto-generated if not provided.
    const required = ['name', 'mrp', 'sellingPrice', 'categoryId'];
    for (const f of required) {
      if (!body[f]) return NextResponse.json({ error: `Missing field: ${f}` }, { status: 400 });
    }
    // Slug: prefer user-supplied, else derive from name. Strip stray edges.
    let slug: string = (body.slug || '').toString().trim();
    if (!slug || slug.length < 2) {
      slug = body.name.toLowerCase().trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }
    // If slug already exists, append a numeric suffix until unique (up to -50)
    const baseSlug = slug;
    let suffix = 2;
    while (await prisma.product.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${suffix++}`;
      if (suffix > 50) { slug = `${baseSlug}-${Date.now()}`; break; }
    }

    // Auto-generate SKU if not supplied. Retry up to 3 times on P2002 collision.
    let sku: string = (body.sku || '').toString().trim();
    if (!sku) {
      const { nextSku } = await import('@/lib/sku-generator');
      const cat = await prisma.category.findUnique({
        where: { id: body.categoryId },
        select: { name: true },
      });
      sku = await nextSku({ craft: body.craft, categoryName: cat?.name });
    }

    // Create with up to 3 retries on SKU collision (P2002).
    // Only retries when SKU was auto-generated (not user-supplied).
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
            mrp: parseInt(body.mrp),
            sellingPrice: parseInt(body.sellingPrice),
            images: body.images || [],
            status: body.status || 'DRAFT',
            seoTitle: body.seoTitle || null,
            seoDesc: body.seoDesc || null,
          },
        });
        break;
      } catch (e: any) {
        lastErr = e;
        const target = (e?.meta?.target as any);
        const isSkuCollision  = e?.code === 'P2002' && target?.includes?.('sku');
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
          // Append timestamp suffix on stubborn slug collision (race with another create)
          slug = `${slug}-${Date.now()}`;
          continue;
        }
        throw e;
      }
    }
    if (!product) throw lastErr || new Error('Failed to create product');
    return NextResponse.json({ success: true, product });
  } catch (e: any) {
    const msg = e.code === 'P2002' ? 'SKU or slug already exists' : e.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
