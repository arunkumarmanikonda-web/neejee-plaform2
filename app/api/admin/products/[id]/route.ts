// Admin single product endpoint - GET, PATCH, DELETE
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

      console.warn(`[admin.products.GET] not found for key="${key}". Nearest match:`, recent || 'none');

      return NextResponse.json(
        {
          error: `No product matches id/slug/sku "${key}"`,
          searched: key,
          nearest: recent || null,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ product });
  } catch (e: any) {
    console.error(`[admin.products.GET] error for key="${key}":`, e?.message, e?.stack);
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

    const existing = await prisma.product.findFirst({
      where: { OR: [{ id: params.id }, { slug: params.id }, { sku: params.id }] },
      select: { id: true, slug: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const intFields = [
      'mrp',
      'sellingPrice',
      'salePrice',
      'depositPercent',
      'editionSize',
      'editionSold',
      'catalogueImageQualityScore',
    ];

    const floatFields = ['gstRate'];

    const dateFields = ['saleStartsAt', 'saleEndsAt', 'releaseDate'];

    const stringFields = [
      'name',
      'shortName',
      'slug',
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
      'catalogueStockVisibility',
    ];

    const arrayFields = ['images', 'badges'];

    const boolFields = [
      'aiTryOnEligible',
      'aiRoomEligible',
      'arTryOnEligible',
      'codEligible',
      'returnEligible',
      'catalogueFeatured',
      'catalogueBestseller',
      'catalogueEditorial',
      'cataloguePinHero',
      'catalogueExclude',
      'catalogueImageApproved',
    ];

    const data: any = {};

    for (const k of stringFields) {
      if (body[k] !== undefined) data[k] = body[k] === '' ? null : body[k];
    }

    for (const k of intFields) {
      if (body[k] !== undefined) {
        data[k] = body[k] === null || body[k] === '' ? null : parseInt(body[k], 10);
      }
    }

    for (const k of floatFields) {
      if (body[k] !== undefined) {
        data[k] = parseFloat(body[k]) || 0;
      }
    }

    for (const k of dateFields) {
      if (body[k] !== undefined) {
        data[k] = body[k] ? new Date(body[k]) : null;
      }
    }

    for (const k of arrayFields) {
      if (Array.isArray(body[k])) data[k] = body[k];
    }

    for (const k of boolFields) {
      if (body[k] !== undefined) data[k] = !!body[k];
    }

    if (data.name === null || data.name === '') {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    }

    if (
      data.catalogueStockVisibility &&
      !['IN_STOCK_ONLY', 'SHOW_ALL', 'HIDE_STOCK'].includes(data.catalogueStockVisibility)
    ) {
      return NextResponse.json(
        { error: 'Invalid catalogueStockVisibility value' },
        { status: 400 }
      );
    }

    const updated = await prisma.product.update({
      where: { id: existing.id },
      data,
    });

    return NextResponse.json({ success: true, product: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const existing = await prisma.product.findFirst({
      where: { OR: [{ id: params.id }, { slug: params.id }, { sku: params.id }] },
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
