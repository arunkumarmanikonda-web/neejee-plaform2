import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCatalogueProject } from '@/lib/catalogue-builder/storage';
import { renderCatalogueProjectHtml } from '@/lib/catalogue-builder/render';
import { renderHtmlToPdfBuffer } from '@/lib/catalogue-builder/pdf';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isAllowed(user: Awaited<ReturnType<typeof getSession>>) {
  return requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR']);
}

export async function GET(
  request: Request,
  context: { params: { id: string } }
) {
  const user = await getSession();

  if (!isAllowed(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const idOrSlug = context?.params?.id;
  if (!idOrSlug) {
    return NextResponse.json({ error: 'Project id required' }, { status: 400 });
  }

  const format = (new URL(request.url).searchParams.get('format') || 'json').toLowerCase();

  const page = await prisma.cmsPage.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      pageType: 'catalogue',
      template: 'catalogue_builder',
    },
    select: {
      id: true,
      slug: true,
      title: true,
    },
  });

  if (!page?.slug) {
    return NextResponse.json({ error: 'Catalogue project not found' }, { status: 404 });
  }

  const project = await getCatalogueProject(page.slug);

  if (!project) {
    return NextResponse.json({ error: 'Catalogue project not found' }, { status: 404 });
  }

  const html = renderCatalogueProjectHtml(project);
  const safeSlug = (project.slug || page.slug || page.id || 'catalogue-project').replace(/[^a-z0-9-_]+/gi, '-');

  if (format === 'html') {
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${safeSlug}.html"`,
      },
    });
  }

  if (format === 'pdf') {
    const pdf = await renderHtmlToPdfBuffer(html);

    const pdfStream = new ReadableStream({
      start(controller) {
        controller.enqueue(Uint8Array.from(pdf));
        controller.close();
      },
    });

    return new NextResponse(pdfStream, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeSlug}.pdf"`,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    projectId: page.id,
    projectSlug: page.slug,
    project,
  });
}