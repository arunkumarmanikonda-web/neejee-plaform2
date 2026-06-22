// Admin CMS - get / update / delete single page
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const page = await prisma.cmsPage.findFirst({
      where: { OR: [{ id: params.id }, { slug: params.id }] },
    });
    if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ page });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const existing = await prisma.cmsPage.findFirst({
      where: { OR: [{ id: params.id }, { slug: params.id }] },
      select: { id: true, status: true },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const data: any = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.slug !== undefined) data.slug = String(body.slug).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (body.sections !== undefined) data.sections = body.sections;
    if (body.template !== undefined) data.template = body.template;
    if (body.seoTitle !== undefined) data.seoTitle = body.seoTitle;
    if (body.seoDesc !== undefined) data.seoDesc = body.seoDesc;
    if (body.ogImage !== undefined) data.ogImage = body.ogImage;
    // Editorial fields
    if (body.pageType !== undefined) data.pageType = body.pageType;
    if (body.tags !== undefined) data.tags = Array.isArray(body.tags) ? body.tags : [];
    if (body.featured !== undefined) data.featured = !!body.featured;
    if (body.excerpt !== undefined) data.excerpt = body.excerpt;
    if (body.coverImage !== undefined) data.coverImage = body.coverImage;
    if (body.author !== undefined) data.author = body.author;
    if (body.status !== undefined) {
      data.status = body.status;
      if (body.status === 'PUBLISHED' && existing.status !== 'PUBLISHED') {
        data.publishedAt = new Date();
      }
    }

    const page = await prisma.cmsPage.update({ where: { id: existing.id }, data });
    return NextResponse.json({ page });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const existing = await prisma.cmsPage.findFirst({
      where: { OR: [{ id: params.id }, { slug: params.id }] },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await prisma.cmsPage.delete({ where: { id: existing.id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
