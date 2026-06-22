// /api/admin/crafts
// GET  - list crafts with product counts (matched via Product.craft string)
// POST - create a new craft

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

export async function GET() {
  const session = await getSession();
  if (!requireRole(session, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR', 'MARKETING_OPERATOR', 'MARKETING_MANAGER'])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const crafts = await prisma.craft.findMany({
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
    // Best-effort product count per craft (matched by name, case-insensitive)
    const names = crafts.map(c => c.name);
    const counts: Record<string, number> = {};
    if (names.length > 0) {
      const rows = await prisma.product.groupBy({
        by: ['craft'],
        where: { craft: { in: names, mode: 'insensitive' } },
        _count: { _all: true },
      });
      for (const r of rows) if (r.craft) counts[r.craft.toLowerCase()] = r._count._all;
    }
    const enriched = crafts.map(c => ({
      ...c,
      productCount: counts[c.name.toLowerCase()] || 0,
    }));
    return NextResponse.json({ crafts: enriched });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
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
    if (!slug) slug = `craft-${Date.now()}`;
    let base = slug, suffix = 2;
    while (await prisma.craft.findUnique({ where: { slug } })) {
      slug = `${base}-${suffix++}`;
      if (suffix > 50) { slug = `${base}-${Date.now()}`; break; }
    }
    const craft = await prisma.craft.create({
      data: {
        name,
        slug,
        region:      body.region || null,
        state:       body.state  || null,
        description: body.description || null,
        longStory:   body.longStory || null,
        image:       body.image || null,
        thumbnail:   body.thumbnail || null,
        seoTitle:    body.seoTitle || null,
        seoDesc:     body.seoDesc || null,
        featured:    !!body.featured,
        active:      body.active !== false,
        order:       parseInt(body.order) || 0,
      },
    });
    return NextResponse.json({ ok: true, craft });
  } catch (e: any) {
    const msg = e?.code === 'P2002' ? 'A craft with that slug already exists' : (e?.message || 'Create failed');
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
