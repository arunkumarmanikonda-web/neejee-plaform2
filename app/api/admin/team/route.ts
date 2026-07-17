// Admin team â€” list staff users (non-customer roles) + create new staff
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole, hashPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STAFF_ROLES = [
  'ADMIN',
  'SUPER_ADMIN',
  'CONTENT_EDITOR',
  'SELLER',
  'QC_TEAM',
  'FINANCE',
  'FINANCE_OPERATOR',
  'MARKETING_OPERATOR',
  'MARKETING_MANAGER',
  'TELECALLER',
  'LEGAL',
] as const;

type StaffRole = (typeof STAFF_ROLES)[number];

function getFriendlyTeamError(e: any) {
  const msg = String(e?.message || '');
  if (
    msg.includes('Expected Role') ||
    msg.includes('Invalid value for argument `in`') ||
    msg.includes('prisma.user.findMany')
  ) {
    return 'Team roles are out of sync with the database schema. Apply the Prisma schema update and retry.';
  }
  return 'Failed to load team. Please try again.';
}

export async function GET() {
  const user = await getSession();
  if (!requireRole(user, ['SUPER_ADMIN', 'ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const team = await prisma.user.findMany({
      where: { role: { in: STAFF_ROLES as any } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
        emailVerified: true,
      },
    });

    return NextResponse.json({ team });
  } catch (e: any) {
    return NextResponse.json(
      { error: getFriendlyTeamError(e), team: [] },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['SUPER_ADMIN'])) {
    return NextResponse.json(
      { error: 'Only SUPER_ADMIN can create staff' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json().catch(() => null);
    const email = String(body?.email || '').trim().toLowerCase();
    const name = String(body?.name || '').trim();
    const phone = String(body?.phone || '').trim();
    const password = String(body?.password || '');
    const role = String(body?.role || '').trim().toUpperCase() as StaffRole;

    if (!email || !name || !role) {
      return NextResponse.json(
        { error: 'email, name, role required' },
        { status: 400 },
      );
    }

    if (!STAFF_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 },
      );
    }

    const passwordHash = await hashPassword(password);

    const created = await prisma.user.create({
      data: {
        email,
        name,
        phone: phone || null,
        role: role as any,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, user: created });
  } catch (e: any) {
    const raw = String(e?.message || '');
    const msg =
      e?.code === 'P2002'
        ? 'Email or phone already in use'
        : raw.includes('Expected Role') || raw.includes('Invalid value for argument')
          ? 'Selected role is not available in the database schema yet. Run Prisma schema sync first.'
          : 'Unable to create user';

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}