// Admin CMS list + create
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import { slugify } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const pages = await prisma.cmsPage.findMany({ orderBy: { updatedAt: 'desc' } });
    return NextResponse.json({ pages });
  } catch (e: any) {
    return NextResponse.json({ pages: [], error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { title, slug, template = 'default', sections, seoTitle, seoDesc } = body;
    if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 });

    let finalSlug = slug ? slugify(slug) : slugify(title);
    // Auto-uniqueify slug if it collides (avoids hard error on AI-generated pages)
    const exists = await prisma.cmsPage.findUnique({ where: { slug: finalSlug } });
    if (exists) {
      // append numeric suffix
      for (let i = 2; i <= 50; i++) {
        const candidate = `${finalSlug}-${i}`;
        const c = await prisma.cmsPage.findUnique({ where: { slug: candidate } });
        if (!c) { finalSlug = candidate; break; }
      }
    }

    const page = await prisma.cmsPage.create({
      data: {
        title,
        slug: finalSlug,
        template,
        sections: Array.isArray(sections) ? (sections as any) : ([] as any),
        seoTitle: seoTitle || null,
        seoDesc: seoDesc || null,
        status: 'DRAFT',
      },
    });
    return NextResponse.json({ page });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
