// Seller's own product detail — GET + PATCH (only fields they can edit)
// v23.40.21 — Admins can view/edit any seller product (admin-bypass hotfix).
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApprovedSeller } from '@/lib/seller-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const ctx = await requireApprovedSeller();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  // Admin bypass — admins (with or without a seller record) can read any product.
  // Sellers can only read their own products.
  const where: any = { id: params.id };
  if (!ctx.isAdmin) {
    if (!ctx.seller) return NextResponse.json({ error: 'No seller record' }, { status: 404 });
    where.sellerId = ctx.seller.id;
  }

  const product = await prisma.product.findFirst({
    where,
    include: { variants: true, category: { select: { slug: true, name: true } } },
  });
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ product });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ctx = await requireApprovedSeller();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  // v23.40.21 — Admins can edit any seller product. Sellers only their own.
  const where: any = { id: params.id };
  if (!ctx.isAdmin) {
    if (!ctx.seller) return NextResponse.json({ error: 'No seller record' }, { status: 404 });
    where.sellerId = ctx.seller.id;
  }

  try {
    const body = await request.json();
    const product = await prisma.product.findFirst({
      where,
      select: { id: true, status: true },
    });
    if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const data: any = {};
    // Sellers can edit content fields freely
    ['name', 'shortName', 'poeticLine', 'description', 'story', 'craftNote', 'careInstructions',
     'craft', 'region', 'material', 'technique', 'occasion', 'images', 'mrp', 'sellingPrice', 'salePrice',
     'saleStartsAt', 'saleEndsAt', 'seoTitle', 'seoDesc'].forEach(k => {
      if (body[k] !== undefined) data[k] = body[k];
    });

    // Any edit on a previously-rejected or active product pushes back into QC.
    // Admins are trusted — their edits do NOT bounce back into QC.
    if (!ctx.isAdmin && (product.status === 'REJECTED' || product.status === 'ACTIVE')) {
      data.status = 'PENDING_QC';
    }

    const updated = await prisma.product.update({ where: { id: product.id }, data });
    return NextResponse.json({ success: true, product: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
