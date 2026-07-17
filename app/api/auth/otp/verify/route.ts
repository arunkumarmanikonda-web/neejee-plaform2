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
  'LEGAL',
]);

function normalizePurpose(value?: string | null): OtpPurpose {
  const raw = String(value || '').trim().toLowerCase();

  switch (raw) {
    case 'signup':
      return 'signup';
    case 'signup_customer':
      return 'signup_customer';
    case 'login_customer':
      return 'login';
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
  return `${digits}@phone.neejee.com`;
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

function isPlaceholderEmail(email?: string | null, phone?: string | null) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return true;

  if (/^user_\d+@neejee\.local$/.test(normalized)) return true;
  if (/^\d+@phone\.neejee\.com$/.test(normalized)) return true;

  const digits = String(phone || '').replace(/\D/g, '');
  if (digits) {
    if (normalized === `user_${digits}@neejee.local`) return true;
    if (normalized === `${digits}@phone.neejee.com`) return true;
  }

  return false;
}

function needsProfileCompletion(
  user: { email?: string | null; name?: string | null; phone?: string | null },
  purpose: OtpPurpose,
) {
  if (purpose === 'signup' || purpose === 'signup_customer') {
    return true;
  }

  const name = String(user.name || '').trim().toLowerCase();

  if (!name) return true;
  if (name === 'customer' || name === 'user' || name === 'guest') return true;
  if (isPlaceholderEmail(user.email, user.phone)) return true;

  return false;
}

function redirectFor(
  role: string,
  purpose: OtpPurpose,
  user: { email?: string | null; name?: string | null; phone?: string | null },
) {
  if (isAdminSideRole(role)) return '/admin';
  if (role === 'SELLER') return '/seller';
  if (needsProfileCompletion(user, purpose)) return '/complete-profile';
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
        select: { id: true },
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
          phoneVerified: true,
          phoneVerifiedAt: new Date(),
          primaryAuthMethod: 'PHONE_OTP',
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          phone: true,
        },
      });

      const completionNeeded = needsProfileCompletion(user, purpose);

      await setSessionCookie({
        id: user.id,
        email: user.email || fallbackEmailForPhone(normalizedPhone),
        name: user.name || 'Customer',
        role: user.role as any,
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
        redirect: redirectFor(user.role, purpose, user),
        forceRedirect: completionNeeded,
        needsProfileCompletion: completionNeeded,
      });
    }

    const currentUser = await prisma.user.findFirst({
      where: { phone: normalizedPhone },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        phoneVerifiedAt: true,
        primaryAuthMethod: true,
      },
    });

    if (!currentUser) {
      return NextResponse.json(
        { error: 'No account found for this mobile number' },
        { status: 404 },
      );
    }

    const user = await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        phoneVerified: true,
        phoneVerifiedAt: currentUser.phoneVerifiedAt || new Date(),
        primaryAuthMethod: currentUser.primaryAuthMethod || 'PHONE_OTP',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
      },
    });

    const completionNeeded = needsProfileCompletion(user, purpose);

    await setSessionCookie({
      id: user.id,
      email: user.email || fallbackEmailForPhone(normalizedPhone),
      name: user.name || 'User',
      role: user.role as any,
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
      redirect: redirectFor(user.role, purpose, user),
      forceRedirect: completionNeeded,
      needsProfileCompletion: completionNeeded,
    });
  } catch (error) {
    console.error('[auth/otp/verify] error', error);

    return NextResponse.json(
      { error: 'Unable to verify OTP right now' },
      { status: 500 },
    );
  }
}
