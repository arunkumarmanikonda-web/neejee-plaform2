// Admin team — update role / name, or remove
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole, hashPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STAFF_ROLES = ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR', 'SELLER', 'QC_TEAM'];

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Only SUPER_ADMIN can update staff' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const data: any = {};
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.phone !== undefined) data.phone = body.phone?.trim() || null;
    if (body.role !== undefined) {
      if (!STAFF_ROLES.includes(body.role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      data.role = body.role;
    }
    if (body.password) {
      if (body.password.length < 8) return NextResponse.json({ error: 'Password too short' }, { status: 400 });
      data.passwordHash = await hashPassword(body.password);
    }
    const updated = await prisma.user.update({
      where: { id: params.id },
      data,
      select: { id: true, email: true, name: true, role: true },
    });
    return NextResponse.json({ success: true, user: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!requireRole(session, ['SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Only SUPER_ADMIN can remove staff' }, { status: 401 });
  }
  try {
    if (session!.id === params.id) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
    }
    // Downgrade to CUSTOMER instead of hard-delete to preserve history (orders, etc.)
    await prisma.user.update({ where: { id: params.id }, data: { role: 'CUSTOMER' } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
