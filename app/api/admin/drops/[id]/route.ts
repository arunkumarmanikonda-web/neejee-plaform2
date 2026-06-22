// Admin Drops: read / update / delete one drop.
import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const drop = await prisma.drop.findUnique({ where: { id: params.id } });
  if (!drop) return NextResponse.json({ error: 'Drop not found' }, { status: 404 });
  // also load the products in this drop for the editor sidebar
  const products = drop.productIds.length > 0
    ? await prisma.product.findMany({
        where: { id: { in: drop.productIds } },
        select: { id: true, slug: true, name: true, images: true, sellingPrice: true, status: true, fulfilmentMode: true },
      })
    : [];
  return NextResponse.json({ drop, products });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const data: any = {};
    if (typeof body.title === 'string') data.title = body.title.trim();
    if (typeof body.subtitle === 'string' || body.subtitle === null) data.subtitle = body.subtitle || null;
    if (typeof body.description === 'string' || body.description === null) data.description = body.description || null;
    if (typeof body.coverImage === 'string' || body.coverImage === null) data.coverImage = body.coverImage || null;
    if (body.startsAt) data.startsAt = new Date(body.startsAt);
    if (body.endsAt !== undefined) data.endsAt = body.endsAt ? new Date(body.endsAt) : null;
    if (Array.isArray(body.productIds)) data.productIds = body.productIds;
    if (typeof body.status === 'string') data.status = body.status;
    if (typeof body.founderNote === 'string' || body.founderNote === null) data.founderNote = body.founderNote || null;
    if (typeof body.seoTitle === 'string' || body.seoTitle === null) data.seoTitle = body.seoTitle || null;
    if (typeof body.seoDesc === 'string' || body.seoDesc === null) data.seoDesc = body.seoDesc || null;

    const drop = await prisma.drop.update({ where: { id: params.id }, data });
    return NextResponse.json({ ok: true, drop });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to update drop' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await prisma.drop.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to delete' }, { status: 500 });
  }
}
