// Admin Drops: list all drops + create new.
import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'drop';
}

export async function GET() {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const drops = await prisma.drop.findMany({ orderBy: { startsAt: 'desc' } });
  return NextResponse.json({ drops });
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const title = (body.title || '').toString().trim();
    if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 });

    let slug = body.slug ? slugify(body.slug) : slugify(title);
    // Uniqueness
    const existing = await prisma.drop.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

    if (!body.startsAt) return NextResponse.json({ error: 'Start date is required' }, { status: 400 });

    const drop = await prisma.drop.create({
      data: {
        slug,
        title,
        subtitle: body.subtitle || null,
        description: body.description || null,
        coverImage: body.coverImage || null,
        startsAt: new Date(body.startsAt),
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        productIds: Array.isArray(body.productIds) ? body.productIds : [],
        status: body.status || 'DRAFT',
        founderNote: body.founderNote || null,
        seoTitle: body.seoTitle || null,
        seoDesc: body.seoDesc || null,
      },
    });
    return NextResponse.json({ ok: true, drop });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to create drop' }, { status: 500 });
  }
}
