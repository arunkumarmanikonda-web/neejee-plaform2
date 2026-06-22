// Admin Badge CRUD endpoints.
// GET  → list all badges (active + inactive)
// POST → create a new badge { key, label, description, group?, sortOrder? }
import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { loadAllBadges } from '@/lib/badges-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function slugify(s: string): string {
  return s
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60);
}

export async function GET() {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const badges = await loadAllBadges();
  return NextResponse.json({ badges });
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const label = (body.label || '').toString().trim();
    if (!label) return NextResponse.json({ error: 'Label is required' }, { status: 400 });
    const key = body.key ? slugify(body.key) : slugify(label);
    if (!key) return NextResponse.json({ error: 'Invalid key' }, { status: 400 });

    const existing = await prisma.badge.findUnique({ where: { key } });
    if (existing) {
      return NextResponse.json({ error: `Badge with key "${key}" already exists` }, { status: 409 });
    }

    const created = await prisma.badge.create({
      data: {
        key,
        label,
        description: (body.description || '').toString().trim(),
        group: (body.group || 'editorial').toString(),
        sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : 999,
        active: body.active !== false,
      },
    });
    return NextResponse.json({ ok: true, badge: created });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to create badge' }, { status: 500 });
  }
}
