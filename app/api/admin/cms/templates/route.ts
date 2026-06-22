// CMS Template library + create-from-template
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import { slugify } from '@/lib/utils';
import { CMS_TEMPLATES, getTemplate } from '@/lib/cms-templates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Return template metadata (without function refs)
  return NextResponse.json({
    templates: CMS_TEMPLATES.map(t => ({
      key: t.key,
      name: t.name,
      description: t.description,
      preview: t.preview,
      sectionCount: t.sections().length,
    })),
  });
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { templateKey, title, slug } = await request.json();
    if (!templateKey) return NextResponse.json({ error: 'Template key required' }, { status: 400 });

    const template = getTemplate(templateKey);
    if (!template) return NextResponse.json({ error: 'Unknown template' }, { status: 400 });

    const finalTitle = title?.trim() || template.name;
    let finalSlug = slug ? slugify(slug) : slugify(finalTitle);

    // Auto-uniqueify
    const existing = await prisma.cmsPage.findUnique({ where: { slug: finalSlug } });
    if (existing) {
      for (let i = 2; i <= 50; i++) {
        const candidate = `${finalSlug}-${i}`;
        const c = await prisma.cmsPage.findUnique({ where: { slug: candidate } });
        if (!c) { finalSlug = candidate; break; }
      }
    }

    const page = await prisma.cmsPage.create({
      data: {
        title: finalTitle,
        slug: finalSlug,
        template: templateKey,
        sections: template.sections() as any,
        seoTitle: template.seoTitle || null,
        seoDesc: template.seoDesc || null,
        status: 'DRAFT',
      },
    });

    return NextResponse.json({ page });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
