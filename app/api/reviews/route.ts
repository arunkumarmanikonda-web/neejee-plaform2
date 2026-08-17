// Public reviews: approved reviews are readable; new reviews require a signed-in
// customer who has actually paid for the product. One active review per buyer
// and product is enforced both here and by a partial database unique index.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function publicAuthor(name: string | null | undefined): string {
  const first = String(name || '').trim().split(/\s+/)[0];
  return first ? first.slice(0, 50) : 'NEEJEE customer';
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const productSlug = String(url.searchParams.get('product') || '').trim();
  if (!productSlug || productSlug.length > 220) {
    return NextResponse.json({ reviews: [], summary: { count: 0, avg: 0, dist: {} } });
  }

  try {
    const product = await prisma.product.findFirst({
      where: { OR: [{ slug: productSlug }, { id: productSlug }] },
      select: { id: true },
    });
    if (!product) return NextResponse.json({ reviews: [], summary: { count: 0, avg: 0, dist: {} } });

    const where = { productId: product.id, status: 'APPROVED' as const };
    const [reviews, aggregate, grouped] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { user: { select: { name: true } } },
      }),
      prisma.review.aggregate({ where, _count: { _all: true }, _avg: { rating: true } }),
      prisma.review.groupBy({ where, by: ['rating'], _count: { _all: true } }),
    ]);

    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of grouped) dist[row.rating] = row._count._all;

    const response = NextResponse.json({
      reviews: reviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        title: review.title,
        body: review.body,
        images: review.images,
        createdAt: review.createdAt,
        author: publicAuthor(review.user?.name),
      })),
      summary: {
        count: aggregate._count._all,
        avg: Math.round(Number(aggregate._avg.rating || 0) * 10) / 10,
        dist,
      },
    });
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return response;
  } catch (error: any) {
    console.error('[reviews.get] failed', { message: error?.message });
    return NextResponse.json({ error: 'Reviews are temporarily unavailable.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Sign in to leave a review' }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const productSlug = String(body?.productSlug || '').trim();
    const rating = Number(body?.rating);
    const title = String(body?.title || '').trim();
    const reviewBody = String(body?.reviewBody || '').trim();

    if (!productSlug || productSlug.length > 220) {
      return NextResponse.json({ error: 'Product is required' }, { status: 400 });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be a whole number from 1 to 5' }, { status: 400 });
    }
    if (title.length > 120) {
      return NextResponse.json({ error: 'Review title is too long' }, { status: 400 });
    }
    if (reviewBody.length < 5 || reviewBody.length > 3000) {
      return NextResponse.json({ error: 'Review must be between 5 and 3,000 characters' }, { status: 400 });
    }

    const product = await prisma.product.findFirst({
      where: {
        OR: [{ slug: productSlug }, { id: productSlug }],
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    const purchased = await prisma.$queryRaw<Array<{ id: string }>>`
      select oi.id
      from public."OrderItem" oi
      join public."Order" o on o.id = oi."orderId"
      where oi."productId" = ${product.id}
        and o."userId" = ${user.id}
        and o."paymentStatus"::text = 'PAID'
      limit 1
    `;
    if (!purchased.length) {
      return NextResponse.json({ error: 'Reviews are available after purchase.' }, { status: 403 });
    }

    const existing = await prisma.review.findFirst({
      where: {
        userId: user.id,
        productId: product.id,
        status: { not: 'REJECTED' },
      },
      select: { id: true, status: true },
    });
    if (existing) {
      return NextResponse.json({ error: 'You have already submitted a review for this product.' }, { status: 409 });
    }

    const review = await prisma.review.create({
      data: {
        userId: user.id,
        productId: product.id,
        rating,
        title: title || null,
        body: reviewBody,
        status: 'PENDING',
      },
      select: { id: true, status: true },
    });

    return NextResponse.json({
      success: true,
      review,
      message: 'Review submitted for moderation',
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'You have already submitted a review for this product.' }, { status: 409 });
    }
    console.error('[reviews.post] failed', { userId: user.id, message: error?.message });
    return NextResponse.json({ error: 'Unable to submit your review right now.' }, { status: 500 });
  }
}
