// v23.40.26.0 — Taxonomy admin API
// GET  /api/admin/taxonomy           → full tree
// POST /api/admin/taxonomy           → create new category { name, parentId?, gender? }
// PATCH /api/admin/taxonomy?id=xxx   → update { name?, hidden?, active?, order?, gender?, parentId? }
// DELETE /api/admin/taxonomy?id=xxx  → soft-delete (sets active=false)
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function slugify(s: string): string {
  return s.toLowerCase().trim()
    .replace(/[^\w\s\-&]/g, '')
    .replace(/&/g, 'and')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function computePath(parentId: string | null, slug: string): Promise<string> {
  if (!parentId) return slug;
  const parent = await prisma.category.findUnique({ where: { id: parentId }, select: { path: true, slug: true } });
  const base = parent?.path || parent?.slug || '';
  return base ? `${base}/${slug}` : slug;
}

async function computeLevel(parentId: string | null): Promise<number> {
  if (!parentId) return 1;
  const parent = await prisma.category.findUnique({ where: { id: parentId }, select: { level: true } });
  return (parent?.level || 1) + 1;
}

export async function GET() {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Flat list, sorted; tree builds client-side
  const cats = await prisma.category.findMany({
    orderBy: [{ level: 'asc' }, { order: 'asc' }, { name: 'asc' }],
    select: {
      id: true, slug: true, name: true, parentId: true, level: true, path: true,
      active: true, hidden: true, featured: true, gender: true, aiGenerated: true,
      order: true,
      _count: { select: { products: true, children: true } },
    },
  });
  return NextResponse.json({ ok: true, categories: cats });
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const name = String(body?.name || '').trim();
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  const parentId = body?.parentId || null;
  const gender = body?.gender || null;

  const baseSlug = slugify(name);
  // If parented, prefix parent slug for uniqueness
  let slug = baseSlug;
  if (parentId) {
    const parent = await prisma.category.findUnique({ where: { id: parentId }, select: { slug: true } });
    if (parent?.slug) slug = `${parent.slug}-${baseSlug}`;
  }
  // Conflict check
  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) return NextResponse.json({ error: `Slug ${slug} already exists` }, { status: 409 });

  const level = await computeLevel(parentId);
  if (level > 3) return NextResponse.json({ error: 'Max depth is 3 levels' }, { status: 400 });
  const path = await computePath(parentId, baseSlug);

  const cat = await prisma.category.create({
    data: {
      slug, name, parentId, level, path,
      gender: gender || undefined,
      active: true, hidden: false, aiGenerated: false,
      order: 999, // append to end; admin can reorder
    },
  });
  return NextResponse.json({ ok: true, category: cat });
}

export async function PATCH(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing ?id=' }, { status: 400 });
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const data: any = {};
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
  if (typeof body.hidden === 'boolean') data.hidden = body.hidden;
  if (typeof body.active === 'boolean') data.active = body.active;
  if (typeof body.featured === 'boolean') data.featured = body.featured;
  if (typeof body.order === 'number') data.order = body.order;
  if (typeof body.gender === 'string' || body.gender === null) data.gender = body.gender;
  if (typeof body.parentId === 'string' || body.parentId === null) {
    data.parentId = body.parentId;
    data.level = await computeLevel(body.parentId);
    if (data.level > 3) return NextResponse.json({ error: 'Max depth is 3 levels' }, { status: 400 });
    const current = await prisma.category.findUnique({ where: { id }, select: { slug: true } });
    if (current) data.path = await computePath(body.parentId, current.slug.split('-').pop() || current.slug);
  }

  const cat = await prisma.category.update({ where: { id }, data });
  return NextResponse.json({ ok: true, category: cat });
}

export async function DELETE(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Only SUPER_ADMIN can delete' }, { status: 401 });
  }
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing ?id=' }, { status: 400 });
  // Soft-delete by deactivating (hard-delete only if zero products and zero children)
  const cat = await prisma.category.findUnique({
    where: { id }, include: { _count: { select: { products: true, children: true } } },
  });
  if (!cat) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (cat._count.products === 0 && cat._count.children === 0) {
    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ ok: true, deleted: 'hard' });
  }
  await prisma.category.update({ where: { id }, data: { active: false, hidden: true } });
  return NextResponse.json({ ok: true, deleted: 'soft', reason: 'Has products or children — soft-deleted (set active=false, hidden=true)' });
}
