import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '@/lib/auth';
import { verifyOtp } from '@/lib/otp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  code: z.string().trim().regex(/^\d{4,8}$/),
});

const ADMIN_ROLES = new Set([
  'ADMIN',
  'SUPER_ADMIN',
  'CONTENT_EDITOR',
  'QC_TEAM',
  'FINANCE',
  'FINANCE_OPERATOR',
  'MARKETING_OPERATOR',
  'MARKETING_MANAGER',
]);

function isAdminSideRole(role: unknown): role is string {
  return typeof role === 'string' && ADMIN_ROLES.has(role);
}

function redirectFor(role: string) {
  if (isAdminSideRole(role)) return '/admin';
  if (role === 'SELLER') return '/seller';
  return '/account';
}

function otpReasonToMessage(
  reason:
    | 'invalid_phone'
    | 'invalid_format'
    | 'no_active_otp'
    | 'expired'
    | 'wrong_code'
    | 'max_attempts',
) {
  switch (reason) {
    case 'invalid_phone':
      return 'Admin phone number is invalid';
    case 'invalid_format':
      return 'Invalid 2FA code format';
    case 'no_active_otp':
      return 'No active 2FA code found. Please sign in again.';
    case 'expired':
      return '2FA code expired. Please sign in again.';
    case 'wrong_code':
      return 'Invalid 2FA code';
    case 'max_attempts':
      return 'Too many invalid attempts. Please sign in again.';
    default:
      return 'Invalid 2FA code';
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Email, password and 2FA code are required' },
        { status: 400 },
      );
    }

    const email = parsed.data.email.trim().toLowerCase();
    const password = parsed.data.password;
    const code = parsed.data.code.trim();

    const user = await prisma.user.findFirst({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        passwordHash: true,
        phone: true,
      },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 },
      );
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);

    if (!passwordOk) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 },
      );
    }

    if (!isAdminSideRole(user.role)) {
      return NextResponse.json(
        { error: 'Admin access is not allowed for this account' },
        { status: 403 },
      );
    }

    if (!user.phone) {
      return NextResponse.json(
        { error: 'Admin account does not have a phone number configured' },
        { status: 400 },
      );
    }

    const verification = await verifyOtp({
      phone: user.phone,
      purpose: 'admin_2fa',
      code,
    });

    if (!verification.ok) {
      return NextResponse.json(
        { error: otpReasonToMessage(verification.reason) },
        { status: 401 },
      );
    }

    await setSessionCookie({
      id: user.id,
      email: user.email || `${user.id}@neejee.local`,
      name: user.name || 'Admin',
      role: user.role,
    });

    return NextResponse.json({
      ok: true,
      success: true,
      role: user.role,
      redirect: redirectFor(user.role),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('[auth/login/2fa] error', error);

    return NextResponse.json(
      { error: 'Unable to verify 2FA right now' },
      { status: 500 },
    );
  }
}
