import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApprovedSeller } from '@/lib/seller-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SELLER_EDITABLE_FIELDS = [
  'name',
  'shortName',
  'poeticLine',
  'description',
  'story',
  'craftNote',
  'careInstructions',
  'craft',
  'region',
  'material',
  'technique',
  'occasion',
  'images',
  'mrp',
  'sellingPrice',
  'salePrice',
  'saleStartsAt',
  'saleEndsAt',
  'seoTitle',
  'seoDesc',
] as const;

function adminRouteOnlyResponse() {
  return NextResponse.json(
    {
      error: 'Admin access for seller products must use the dedicated admin product APIs',
    },
    { status: 403 },
  );
}

function noSellerRecordResponse() {
  return NextResponse.json({ error: 'No seller record' }, { status: 404 });
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const ctx = await requireApprovedSeller();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  if (ctx.isAdmin) {
    return adminRouteOnlyResponse();
  }

  if (!ctx.seller) {
    return noSellerRecordResponse();
  }

  const product = await prisma.product.findFirst({
    where: {
      id: params.id,
      sellerId: ctx.seller.id,
    },
    include: {
      variants: true,
      category: {
        select: {
          slug: true,
          name: true,
        },
      },
    },
  });

  if (!product) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ product });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ctx = await requireApprovedSeller();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  if (ctx.isAdmin) {
    return adminRouteOnlyResponse();
  }

  if (!ctx.seller) {
    return noSellerRecordResponse();
  }

  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const product = await prisma.product.findFirst({
      where: {
        id: params.id,
        sellerId: ctx.seller.id,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!product) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    for (const field of SELLER_EDITABLE_FIELDS) {
      if (body[field] !== undefined) {
        data[field] = body[field];
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    if (product.status === 'REJECTED' || product.status === 'ACTIVE') {
      data.status = 'PENDING_QC';
    }

    const updated = await prisma.product.update({
      where: { id: product.id },
      data,
    });

    return NextResponse.json({ success: true, product: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Unable to update product right now' },
      { status: 500 },
    );
  }
}
