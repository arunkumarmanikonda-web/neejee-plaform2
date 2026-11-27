import { NextResponse } from 'next/server';
import { editorialTemplates } from '@/lib/public-editorial';
import { getSession } from '@/lib/auth';
import { isSectionVisibleNow, type Section } from '@/lib/cms-sections';
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

    if (!page || page.status !== 'PUBLISHED' || !['page','journal','lookbook'].includes(page.pageType) || !editorialTemplates.includes(page.template)) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    const blocks = Array.isArray(page.sections) ? page.sections as unknown as Section[] : [];
    const contextual = blocks.some(s=>s?.visibility?.audience && s.visibility.audience!=='all');
    const signedIn = contextual && !!(await getSession());
    const sections=blocks.filter(s=>s && isSectionVisibleNow(s) && (s.visibility?.audience!=='signed-in' || signedIn) && (s.visibility?.audience!=='guest' || !signedIn));
    const response = NextResponse.json({ page:{...page,sections} });
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch (error: any) {
    console.error('[cms.public] failed', { message: error?.message });
    return NextResponse.json({ error: 'Page is temporarily unavailable' }, { status: 500 });
  }
}
