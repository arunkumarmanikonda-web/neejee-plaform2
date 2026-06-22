// Wishlist API — toggle and list
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ wishlist: [], loggedIn: false });
  try {
    const items = await prisma.wishlist.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          select: {
            id: true, slug: true, name: true, poeticLine: true, craft: true, region: true,
            mrp: true, sellingPrice: true, salePrice: true, saleStartsAt: true, saleEndsAt: true,
            images: true, badges: true, aiTryOnEligible: true, status: true,
            variants: { select: { inventory: true } },
          },
        },
      },
    });
    return NextResponse.json({
      loggedIn: true,
      productIds: items.map(i => i.productId),
      wishlist: items.map((i: any) => ({
        wishlistId: i.id,
        ...i.product,
        inventory: i.product.variants.reduce((s: number, v: any) => s + (v.inventory || 0), 0),
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ wishlist: [], error: e.message }, { status: 500 });
  }
}

// Toggle add/remove
export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Sign in to use wishlist' }, { status: 401 });
  try {
    const { productId, productSlug } = await request.json();
    let pid = productId;
    if (!pid && productSlug) {
      const p = await prisma.product.findFirst({ where: { slug: productSlug }, select: { id: true } });
      if (!p) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      pid = p.id;
    }
    if (!pid) return NextResponse.json({ error: 'productId or productSlug required' }, { status: 400 });

    const existing = await prisma.wishlist.findUnique({
      where: { userId_productId: { userId: user.id, productId: pid } },
    });
    if (existing) {
      await prisma.wishlist.delete({ where: { id: existing.id } });
      return NextResponse.json({ inWishlist: false });
    } else {
      await prisma.wishlist.create({ data: { userId: user.id, productId: pid } });
      return NextResponse.json({ inWishlist: true });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
