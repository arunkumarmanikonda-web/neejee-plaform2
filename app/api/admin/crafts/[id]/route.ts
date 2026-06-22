// /api/admin/crafts/[id]
// PATCH - edit
// DELETE - remove (allowed even with products; Product.craft is a string)

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
    if (typeof body.name === 'string')         update.name = body.name.trim();
    if (typeof body.slug === 'string')         update.slug = slugify(body.slug) || undefined;
    if (typeof body.region === 'string')       update.region = body.region || null;
    if (typeof body.state === 'string')        update.state = body.state || null;
    if (typeof body.description === 'string')  update.description = body.description;
    if (typeof body.longStory === 'string')    update.longStory = body.longStory;
    if (typeof body.image === 'string')        update.image = body.image || null;
    if (typeof body.thumbnail === 'string')    update.thumbnail = body.thumbnail || null;
    if (typeof body.seoTitle === 'string')     update.seoTitle = body.seoTitle || null;
    if (typeof body.seoDesc === 'string')      update.seoDesc = body.seoDesc || null;
    if (typeof body.featured === 'boolean')    update.featured = body.featured;
    if (typeof body.active === 'boolean')      update.active = body.active;
    if (typeof body.order === 'number')        update.order = body.order;
    const craft = await prisma.craft.update({ where: { id: params.id }, data: update });
    return NextResponse.json({ ok: true, craft });
  } catch (e: any) {
    const msg = e?.code === 'P2002' ? 'A craft with that slug already exists' : (e?.message || 'Update failed');
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await prisma.craft.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Delete failed' }, { status: 500 });
  }
}
