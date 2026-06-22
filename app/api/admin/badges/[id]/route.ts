// Single-badge endpoints: update, delete.
import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const data: any = {};
    if (typeof body.label === 'string') data.label = body.label.trim();
    if (typeof body.description === 'string') data.description = body.description.trim();
    if (typeof body.group === 'string') data.group = body.group;
    if (typeof body.imageUrl === 'string' || body.imageUrl === null) data.imageUrl = body.imageUrl;
    if (typeof body.active === 'boolean') data.active = body.active;
    if (typeof body.sortOrder === 'number') data.sortOrder = body.sortOrder;

    const updated = await prisma.badge.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json({ ok: true, badge: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to update badge' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    // Best-effort: also remove the badge key from any Product.badges arrays.
    const badge = await prisma.badge.findUnique({ where: { id: params.id } });
    if (!badge) return NextResponse.json({ error: 'Badge not found' }, { status: 404 });

    await prisma.badge.delete({ where: { id: params.id } });

    // Pull the key from all products that reference it (Postgres array_remove)
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "Product" SET "badges" = array_remove("badges", $1) WHERE $1 = ANY("badges")`,
        badge.key
      );
    } catch {
      // non-fatal; badge is deleted, dangling key in arrays is harmless
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to delete badge' }, { status: 500 });
  }
}
