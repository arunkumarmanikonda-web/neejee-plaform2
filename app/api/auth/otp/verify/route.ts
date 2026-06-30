import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '@/lib/auth';
import { normalizePhone, verifyOtp } from '@/lib/otp';
import type { OtpPurpose } from '@/lib/otp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  phone: z.string().min(1, 'Phone is required'),
  code: z.string().trim().regex(/^\d{4,8}$/, 'Invalid OTP format'),
  purpose: z.string().optional(),
  name: z.string().optional(),
  email: z.string().optional(),
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

function normalizePurpose(value?: string | null): OtpPurpose {
  const raw = String(value || '').trim().toLowerCase();

  switch (raw) {
    case 'signup':
      return 'signup';
    case 'signup_customer':
      return 'signup_customer';
    case 'admin_2fa':
      return 'admin_2fa';
    case 'checkout_guest':
      return 'checkout_guest';
    case 'change_phone':
      return 'change_phone';
    case 'login':
    default:
      return 'login';
  }
}

function fallbackEmailForPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return `user_${digits}@neejee.local`;
}

function normalizeOptionalEmail(value?: string) {
  const email = String(value || '').trim().toLowerCase();
  return email || null;
}

function normalizeOptionalName(value?: string) {
  const name = String(value || '').trim();
  return name || null;
}

function isAdminSideRole(role: unknown): role is string {
  return typeof role === 'string' && ADMIN_ROLES.has(role);
}

function redirectFor(role: string, purpose: OtpPurpose) {
  if (purpose === 'signup' || purpose === 'signup_customer') {
    return '/account/welcome';
  }
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
      return 'Please enter a valid mobile number';
    case 'invalid_format':
      return 'Invalid OTP format';
    case 'no_active_otp':
      return 'No active OTP found. Please request a new code.';
    case 'expired':
      return 'OTP expired. Please request a new code.';
    case 'wrong_code':
      return 'Incorrect OTP';
    case 'max_attempts':
      return 'Too many invalid attempts. Please request a new code.';
    default:
      return 'OTP verification failed';
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Phone and OTP code are required' },
        { status: 400 },
      );
    }

    const purpose = normalizePurpose(parsed.data.purpose);
    const normalizedPhone = normalizePhone(parsed.data.phone);
    const code = parsed.data.code.trim();
    const inputEmail = normalizeOptionalEmail(parsed.data.email);
    const inputName = normalizeOptionalName(parsed.data.name);

    if (!normalizedPhone) {
      return NextResponse.json(
        { error: 'Please enter a valid mobile number' },
        { status: 400 },
      );
    }

    const verification = await verifyOtp({
      phone: normalizedPhone,
      code,
      purpose,
    });

    if (!verification.ok) {
      return NextResponse.json(
        { error: otpReasonToMessage(verification.reason) },
        { status: 401 },
      );
    }

    if (purpose === 'signup' || purpose === 'signup_customer') {
      const existingUser = await prisma.user.findFirst({
        where: { phone: normalizedPhone },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          phone: true,
        },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: 'An account already exists for this mobile number' },
          { status: 409 },
        );
      }

      const user = await prisma.user.create({
        data: {
          email: inputEmail || fallbackEmailForPhone(normalizedPhone),
          name: inputName || 'Customer',
          phone: normalizedPhone,
          role: 'CUSTOMER',
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          phone: true,
        },
      });

      await setSessionCookie({
        id: user.id,
        email: user.email || fallbackEmailForPhone(normalizedPhone),
        name: user.name || 'Customer',
        role: user.role,
      });

      return NextResponse.json({
        ok: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
        redirect: redirectFor(user.role, purpose),
      });
    }

    const user = await prisma.user.findFirst({
      where: { phone: normalizedPhone },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'No account found for this mobile number' },
        { status: 404 },
      );
    }

    await setSessionCookie({
      id: user.id,
      email: user.email || fallbackEmailForPhone(normalizedPhone),
      name: user.name || 'User',
      role: user.role,
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      redirect: redirectFor(user.role, purpose),
    });
  } catch (error) {
    console.error('[auth/otp/verify] error', error);

    return NextResponse.json(
      { error: 'Unable to verify OTP right now' },
      { status: 500 },
    );
  }
}
