// /api/admin/categories/[id]
// PATCH - edit category
// DELETE - remove (only when no products linked)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const update: any = {};
    if (typeof body.name === 'string')        update.name = body.name.trim();
    if (typeof body.slug === 'string')        update.slug = slugify(body.slug) || undefined;
    if (typeof body.description === 'string') update.description = body.description;
    if (typeof body.image === 'string')       update.image = body.image || null;
    if (typeof body.seoTitle === 'string')    update.seoTitle = body.seoTitle || null;
    if (typeof body.seoDesc === 'string')     update.seoDesc = body.seoDesc || null;
    if (typeof body.order === 'number')       update.order = body.order;
    if (typeof body.active === 'boolean')     update.active = body.active;
    if (typeof body.featured === 'boolean')   update.featured = body.featured;
    if ('parentId' in body)                   update.parentId = body.parentId || null;

    const category = await prisma.category.update({ where: { id: params.id }, data: update });
    return NextResponse.json({ ok: true, category });
  } catch (e: any) {
    const msg = e?.code === 'P2002' ? 'A category with that slug already exists' : (e?.message || 'Update failed');
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const productCount = await prisma.product.count({ where: { categoryId: params.id } });
    if (productCount > 0) {
      return NextResponse.json({
        error: `Cannot delete: ${productCount} product(s) are still in this category. Move them first.`,
      }, { status: 400 });
    }
    const childCount = await prisma.category.count({ where: { parentId: params.id } });
    if (childCount > 0) {
      return NextResponse.json({
        error: `Cannot delete: ${childCount} sub-category(ies) still nested under this one.`,
      }, { status: 400 });
    }
    await prisma.category.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Delete failed' }, { status: 500 });
  }
}
