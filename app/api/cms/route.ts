import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = String(url.searchParams.get('slug') || '').trim().slice(0, 220);
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });

  try {
    const page = await prisma.cmsPage.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        template: true,
        sections: true,
        status: true,
        publishedAt: true,
        seoTitle: true,
        seoDesc: true,
        ogImage: true,
        pageType: true,
        tags: true,
        featured: true,
        excerpt: true,
        coverImage: true,
        author: true,
        updatedAt: true,
      },
    });

    if (!page || page.status !== 'PUBLISHED') {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    const response = NextResponse.json({ page });
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return response;
  } catch (error: any) {
    console.error('[cms.public] failed', { message: error?.message });
    return NextResponse.json({ error: 'Page is temporarily unavailable' }, { status: 500 });
  }
}
