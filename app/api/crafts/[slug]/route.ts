// Public single-craft endpoint — used by /crafts/[slug] landing page
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  try {
    const craft = await prisma.craft.findFirst({
      where: { OR: [{ slug: params.slug }, { id: params.slug }], active: true },
    });
    if (!craft) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    // Best-effort: fetch active products that match this craft by name (case-insensitive)
    const products = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        craft: { equals: craft.name, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
      take: 24,
      select: {
        id: true, slug: true, name: true, shortName: true, images: true,
        mrp: true, sellingPrice: true, salePrice: true, badges: true,
        category: { select: { slug: true, name: true } },
      },
    });
    return NextResponse.json({ craft, products });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
