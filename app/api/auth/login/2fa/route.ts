import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { setSessionCookie, verifyPassword } from '@/lib/auth';
import { verifyOtp } from '@/lib/otp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  code: z.string().min(4).max(8),
});

const ADMIN_ROLES = [
  'ADMIN',
  'SUPER_ADMIN',
  'CONTENT_EDITOR',
  'QC_TEAM',
  'FINANCE',
  'FINANCE_OPERATOR',
  'MARKETING_OPERATOR',
  'MARKETING_MANAGER',
] as const;

function isAdminSideRole(role: string): boolean {
  return ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number]);
}

function redirectFor(role: string): string {
  if (isAdminSideRole(role)) return '/admin';
  if (role === 'SELLER') return '/seller';
  return '/account';
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const password = parsed.data.password;
  const code = parsed.data.code.trim();

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash || !user.phone) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const passOk = await verifyPassword(password, user.passwordHash);
    if (!passOk) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const role = String(user.role);

    if (!isAdminSideRole(role)) {
      return NextResponse.json({ error: 'Not eligible for 2FA' }, { status: 403 });
    }

    const v = await verifyOtp({
      phone: user.phone,
      purpose: 'admin_2fa',
      code,
    });

    if (!v.ok) {
      return NextResponse.json({ error: v.error || 'Invalid 2FA code' }, { status: 401 });
    }

    await setSessionCookie({
      id: user.id,
      email: user.email,
      name: user.name || undefined,
      role: user.role as any,
    });

    return NextResponse.json({
      ok: true,
      success: true,
      role: user.role,
      redirect: redirectFor(role),
    });
  } catch (error) {
    console.error('Login 2FA route error', error);
    return NextResponse.json({ error: 'Unable to complete sign in right now' }, { status: 500 });
  }
}
