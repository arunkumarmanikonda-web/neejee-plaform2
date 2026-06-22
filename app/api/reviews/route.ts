// Public reviews — GET approved reviews for a product, POST a new review (must be logged in)
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const productSlug = url.searchParams.get('product');
  if (!productSlug) return NextResponse.json({ reviews: [], summary: {} });

  try {
    const product = await prisma.product.findFirst({ where: { OR: [{ slug: productSlug }, { id: productSlug }] }, select: { id: true } });
    if (!product) return NextResponse.json({ reviews: [], summary: {} });

    const reviews = await prisma.review.findMany({
      where: { productId: product.id, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: { select: { name: true } } },
    });
    const count = reviews.length;
    const avg = count > 0 ? reviews.reduce((s: number, r: any) => s + r.rating, 0) / count : 0;
    const dist = [1, 2, 3, 4, 5].reduce((acc: any, n) => {
      acc[n] = reviews.filter((r: any) => r.rating === n).length;
      return acc;
    }, {});

    return NextResponse.json({
      reviews: reviews.map((r: any) => ({
        id: r.id, rating: r.rating, title: r.title, body: r.body,
        images: r.images, createdAt: r.createdAt,
        author: r.user?.name || 'Verified buyer',
      })),
      summary: { count, avg: Math.round(avg * 10) / 10, dist },
    });
  } catch (e: any) {
    return NextResponse.json({ reviews: [], summary: {}, error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Sign in to leave a review' }, { status: 401 });

  try {
    const body = await request.json();
    const { productSlug, rating, title, reviewBody } = body;
    if (!productSlug || !rating || !reviewBody) {
      return NextResponse.json({ error: 'productSlug, rating, body required' }, { status: 400 });
    }
    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be 1-5' }, { status: 400 });
    }
    const product = await prisma.product.findFirst({ where: { OR: [{ slug: productSlug }, { id: productSlug }] }, select: { id: true } });
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    const review = await prisma.review.create({
      data: {
        userId: user.id,
        productId: product.id,
        rating: parseInt(rating),
        title: title?.trim() || null,
        body: reviewBody.trim(),
        status: 'PENDING', // admin must approve
      },
    });
    return NextResponse.json({ success: true, review, message: 'Review submitted for moderation' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
