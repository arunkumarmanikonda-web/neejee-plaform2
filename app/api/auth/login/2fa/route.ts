import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  clearAdminMfaChallenge,
  getAdminMfaChallenge,
  isPrivilegedRole,
  setSessionCookie,
  type SessionRole,
} from '@/lib/auth';
import { verifyOtp } from '@/lib/otp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  email: z.string().email(),
  // Retained as optional for backwards compatibility with the current client.
  // The password proof is the signed, short-lived HttpOnly challenge cookie.
  password: z.string().min(1).optional(),
  code: z.string().trim().regex(/^\d{4,8}$/),
});

function redirectFor(role: string) {
  if (isPrivilegedRole(role)) return '/admin';
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
        { error: 'Email and 2FA code are required' },
        { status: 400 },
      );
    }

    const email = parsed.data.email.trim().toLowerCase();
    const code = parsed.data.code.trim();
    const challenge = await getAdminMfaChallenge();

    if (!challenge || challenge.email !== email) {
      clearAdminMfaChallenge();
      return NextResponse.json(
        { error: 'Your admin sign-in challenge is missing or expired. Please sign in again.' },
        { status: 401 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: challenge.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
      },
    });

    if (
      !user ||
      !user.email ||
      user.email.toLowerCase() !== challenge.email ||
      user.role !== challenge.role ||
      !isPrivilegedRole(user.role)
    ) {
      clearAdminMfaChallenge();
      return NextResponse.json(
        { error: 'Admin access is not allowed for this account' },
        { status: 403 },
      );
    }

    if (!user.phone) {
      clearAdminMfaChallenge();
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
      if (
        verification.reason === 'no_active_otp' ||
        verification.reason === 'expired' ||
        verification.reason === 'max_attempts'
      ) {
        clearAdminMfaChallenge();
      }

      return NextResponse.json(
        { error: otpReasonToMessage(verification.reason) },
        { status: 401 },
      );
    }

    const mfaVerifiedAt = new Date().toISOString();

    await setSessionCookie({
      id: user.id,
      email: user.email,
      name: user.name || 'Admin',
      role: user.role as SessionRole,
      aal: 'aal2',
      amr: ['password', 'otp'],
      mfaVerifiedAt,
    });
    clearAdminMfaChallenge();

    return NextResponse.json({
      ok: true,
      success: true,
      role: user.role,
      aal: 'aal2',
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
