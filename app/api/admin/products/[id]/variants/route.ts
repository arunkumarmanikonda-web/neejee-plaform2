// Admin variants for a product — POST creates a new variant
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const product = await prisma.product.findFirst({
      where: { OR: [{ id: params.id }, { slug: params.id }, { sku: params.id }] },
      select: { id: true },
    });
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    if (!body.sku) return NextResponse.json({ error: 'SKU is required' }, { status: 400 });

    const variant = await prisma.variant.create({
      data: {
        productId: product.id,
        sku: body.sku,
        size: body.size || null,
        color: body.color || null,
        colorHex: body.colorHex || null,
        material: body.material || null,
        inventory: parseInt(body.inventory ?? 0),
        lowStockThreshold: parseInt(body.lowStockThreshold ?? 3),
        mrp: body.mrp ? parseInt(body.mrp) : null,
        sellingPrice: body.sellingPrice ? parseInt(body.sellingPrice) : null,
        images: Array.isArray(body.images) ? body.images : [],
      },
    });
    return NextResponse.json({ success: true, variant });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
