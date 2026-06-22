// Public Drop detail endpoint — used by /drops/[slug] landing page.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  const drop = await prisma.drop.findUnique({ where: { slug: params.slug } });
  if (!drop) return NextResponse.json({ error: 'Drop not found' }, { status: 404 });
  if (drop.status === 'DRAFT') {
    return NextResponse.json({ error: 'Drop not found' }, { status: 404 });
  }

  // Fetch the products in this drop (only active ones)
  const products = drop.productIds.length > 0
    ? await prisma.product.findMany({
        where: { id: { in: drop.productIds }, status: 'ACTIVE' },
        select: {
          id: true,
          slug: true,
          name: true,
          poeticLine: true,
          images: true,
          mrp: true,
          sellingPrice: true,
          salePrice: true,
          saleStartsAt: true,
          saleEndsAt: true,
          fulfilmentMode: true,
          depositPercent: true,
          releaseDate: true,
          editionSize: true,
          editionSold: true,
          badges: true,
        },
      })
    : [];

  // Re-order to match drop.productIds order
  const byId = new Map(products.map(p => [p.id, p]));
  const orderedProducts = drop.productIds.map(id => byId.get(id)).filter(Boolean);

  return NextResponse.json({
    drop: {
      id: drop.id,
      slug: drop.slug,
      title: drop.title,
      subtitle: drop.subtitle,
      description: drop.description,
      coverImage: drop.coverImage,
      startsAt: drop.startsAt,
      endsAt: drop.endsAt,
      status: drop.status,
      founderNote: drop.founderNote,
      seoTitle: drop.seoTitle,
      seoDesc: drop.seoDesc,
    },
    products: orderedProducts,
  });
}
