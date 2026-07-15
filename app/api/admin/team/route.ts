// Admin team — list staff users (non-customer roles) + create new staff
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole, hashPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STAFF_ROLES = ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR', 'SELLER', 'QC_TEAM'] as const;

export async function GET() {
  const user = await getSession();
  if (!requireRole(user, ['SUPER_ADMIN', 'ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const team = await prisma.user.findMany({
      where: { role: { in: STAFF_ROLES as any } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, name: true, phone: true, role: true, createdAt: true, emailVerified: true },
    });
    return NextResponse.json({ team });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, team: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Only SUPER_ADMIN can create staff' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { email, name, phone, role, password } = body;
    if (!email || !name || !role) {
      return NextResponse.json({ error: 'email, name, role required' }, { status: 400 });
    }
    if (!STAFF_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }
    const passwordHash = await hashPassword(password);
    const created = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        name: name.trim(),
        phone: phone?.trim() || null,
        role,
        passwordHash,
      },
      select: { id: true, email: true, name: true, phone: true, role: true, createdAt: true },
    });
    return NextResponse.json({ success: true, user: created });
  } catch (e: any) {
    const msg = e.code === 'P2002' ? 'Email or phone already in use' : e.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
