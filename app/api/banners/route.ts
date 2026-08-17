// Public banners endpoint — returns active, scheduled banners by position.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const position = String(url.searchParams.get('position') || '').trim().slice(0, 64);
  if (!position) {
    const response = NextResponse.json({ banners: [] });
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return response;
  }

  try {
    const now = new Date();
    const banners = await prisma.banner.findMany({
      where: {
        position,
        active: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        position: true,
        title: true,
        subtitle: true,
        image: true,
        video: true,
        ctaText: true,
        ctaUrl: true,
        textColor: true,
        bgColor: true,
        linkType: true,
        linkProductId: true,
        linkCategoryId: true,
        linkCollectionTag: true,
        linkDropSlug: true,
        linkPageSlug: true,
        startsAt: true,
        endsAt: true,
        order: true,
        updatedAt: true,
      },
    });
    const response = NextResponse.json({ banners });
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return response;
  } catch (error: any) {
    console.error('[banners.public] failed', { message: error?.message });
    return NextResponse.json({ error: 'Banners are temporarily unavailable', banners: [] }, { status: 500 });
  }
}
