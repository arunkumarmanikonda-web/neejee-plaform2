// Public CMS endpoint - fetch published pages by slug
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');
  try {
    if (slug) {
      const page = await prisma.cmsPage.findUnique({ where: { slug } });
      if (!page || page.status !== 'PUBLISHED') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      return NextResponse.json({ page });
    }
    const pages = await prisma.cmsPage.findMany({
      where: { status: 'PUBLISHED' },
      select: { slug: true, title: true, seoTitle: true, seoDesc: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json({ pages });
  } catch (e: any) {
    return NextResponse.json({ pages: [], error: e.message }, { status: 500 });
  }
}
