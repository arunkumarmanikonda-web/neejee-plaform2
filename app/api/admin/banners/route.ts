// Admin Banner API — list, create, update, delete
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_POSITIONS = ['announcement', 'hero', 'footer'];

// v23.40.24 — If banner is linked to a specific product, ALWAYS adopt the product's
// primary image as banner.image. Non-negotiable: we never alter the core product visual.
async function enforceProductImage(body: any): Promise<string | null | undefined> {
  if (body.linkType !== 'product' || !body.linkProductId) return undefined;
  try {
    const p = await prisma.product.findUnique({
      where: { id: body.linkProductId },
      select: { images: true, variants: { select: { images: true }, take: 1 } },
    });
    if (!p) return undefined;
    const primary = (Array.isArray(p.images) && p.images[0])
      || (p.variants?.[0]?.images?.[0])
      || null;
    return primary;
  } catch (e) {
    console.warn('[banners.enforceProductImage]', e);
    return undefined;
  }
}

// v23.40.23 — build a clean URL from the structured link fields.
// Falls back to the raw ctaUrl if no link target is set.
async function resolveLinkUrl(body: any): Promise<string | null> {
  const type = body.linkType;
  if (!type || type === 'url') return body.ctaUrl || null;
  try {
    if (type === 'product' && body.linkProductId) {
      const p = await prisma.product.findUnique({
        where: { id: body.linkProductId },
        select: { slug: true },
      });
      if (p?.slug) return `/products/${p.slug}`;
    }
    if (type === 'category' && body.linkCategoryId) {
      const c = await prisma.category.findUnique({
        where: { id: body.linkCategoryId },
        select: { slug: true },
      });
      if (c?.slug) return `/categories/${c.slug}`;
    }
    if (type === 'collection' && body.linkCollectionTag) {
      // collection = a badge tag. Storefront filters by ?badge=<tag>
      return `/products?badge=${encodeURIComponent(body.linkCollectionTag)}`;
    }
    if (type === 'drop' && body.linkDropSlug) {
      return `/drops/${body.linkDropSlug}`;
    }
    if (type === 'page' && body.linkPageSlug) {
      return `/p/${body.linkPageSlug}`;
    }
  } catch (e) {
    console.warn('[banners.resolveLinkUrl]', e);
  }
  return body.ctaUrl || null;
}

export async function GET(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(request.url);
  const position = url.searchParams.get('position');

  try {
    const banners = await prisma.banner.findMany({
      where: position ? { position } : undefined,
      orderBy: [{ position: 'asc' }, { order: 'asc' }],
    });
    return NextResponse.json({ banners });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, banners: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    if (!body.position || !VALID_POSITIONS.includes(body.position)) {
      return NextResponse.json({ error: 'Position must be one of: ' + VALID_POSITIONS.join(', ') }, { status: 400 });
    }

    // v23.40.23 — derive ctaUrl from link target if specified
    const computedCtaUrl = (await resolveLinkUrl(body)) || body.ctaUrl || null;
    // v23.40.24 — enforce product image if linked to a product
    const productImage = await enforceProductImage(body);
    const finalImage = productImage !== undefined ? productImage : (body.image || null);

    const banner = await prisma.banner.create({
      data: {
        position: body.position,
        title: body.title || null,
        subtitle: body.subtitle || null,
        image: finalImage,
        video: body.video || null,
        ctaText: body.ctaText || null,
        ctaUrl: computedCtaUrl,
        // v23.40.23 link targets
        linkType: body.linkType || null,
        linkProductId: body.linkProductId || null,
        linkCategoryId: body.linkCategoryId || null,
        linkCollectionTag: body.linkCollectionTag || null,
        linkDropSlug: body.linkDropSlug || null,
        linkPageSlug: body.linkPageSlug || null,
        textColor: body.textColor || null,
        bgColor: body.bgColor || null,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        active: body.active !== false,
        order: typeof body.order === 'number' ? body.order : 0,
      } as any,
    });

    return NextResponse.json({ banner });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id, ...updates } = await request.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const data: any = {};
    const allowed = [
      'position', 'title', 'subtitle', 'image', 'video', 'ctaText', 'ctaUrl', 'textColor', 'bgColor', 'active', 'order',
      // v23.40.23 link target fields
      'linkType', 'linkProductId', 'linkCategoryId', 'linkCollectionTag', 'linkDropSlug', 'linkPageSlug',
    ];
    for (const k of allowed) if (k in updates) data[k] = updates[k];
    if ('startsAt' in updates) data.startsAt = updates.startsAt ? new Date(updates.startsAt) : null;
    if ('endsAt' in updates) data.endsAt = updates.endsAt ? new Date(updates.endsAt) : null;

    // v23.40.23 — recompute ctaUrl if link target was touched
    if (data.linkType || data.linkProductId || data.linkCategoryId || data.linkCollectionTag || data.linkDropSlug || data.linkPageSlug) {
      const merged = { ...updates };
      const url = await resolveLinkUrl(merged);
      if (url) data.ctaUrl = url;
      // v23.40.24 — if now linked to a product, enforce its image
      const productImage = await enforceProductImage(merged);
      if (productImage !== undefined) data.image = productImage;
    }

    const banner = await prisma.banner.update({ where: { id }, data });
    return NextResponse.json({ banner });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await prisma.banner.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
