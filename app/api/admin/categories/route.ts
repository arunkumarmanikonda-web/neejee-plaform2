// /api/admin/categories
// GET  - rich list with product counts (used by /admin/categories)
// POST - create a new category

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!requireRole(session, ['ADMIN', 'SUPER_ADMIN', 'FINANCE', 'CONTENT_EDITOR', 'QC_TEAM', 'MARKETING_OPERATOR', 'MARKETING_MANAGER'])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const url = new URL(req.url);
    const rich = url.searchParams.get('rich') === '1';
    if (rich) {
      const categories: any = await prisma.category.findMany({
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        include: {
          parent: { select: { id: true, name: true, slug: true } },
          _count: { select: { products: true, children: true } },
        },
      });
      return NextResponse.json({ categories });
    }
    // Lightweight (used by selectors)
    const categories = await prisma.category.findMany({
      select: { id: true, name: true, slug: true, parentId: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ categories });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    let slug = body.slug ? slugify(body.slug) : slugify(name);
    if (!slug) slug = `cat-${Date.now()}`;
    // Collision-safe slug
    let base = slug, suffix = 2;
    while (await prisma.category.findUnique({ where: { slug } })) {
      slug = `${base}-${suffix++}`;
      if (suffix > 50) { slug = `${base}-${Date.now()}`; break; }
    }
    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description: body.description || null,
        image: body.image || null,
        seoTitle: body.seoTitle || null,
        seoDesc: body.seoDesc || null,
        order: parseInt(body.order) || 0,
        active: body.active !== false,
        featured: !!body.featured,
        parentId: body.parentId || null,
      },
    });
    return NextResponse.json({ ok: true, category });
  } catch (e: any) {
    const msg = e?.code === 'P2002' ? 'A category with that slug already exists' : (e?.message || 'Create failed');
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
