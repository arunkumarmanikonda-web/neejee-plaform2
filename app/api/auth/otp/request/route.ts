import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requestOtp, normalizePhone, OtpError } from '@/lib/otp';
import type { OtpPurpose } from '@/lib/otp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  phone: z.string().min(1, 'Phone is required'),
  purpose: z.string().optional(),
});

type PublicOtpPurpose =
  | 'login_customer'
  | 'login_vendor'
  | 'login_seller'
  | 'signup'
  | 'signup_customer'
  | 'checkout_guest';

function normalizePurpose(value?: string | null): PublicOtpPurpose | 'admin_2fa' | 'change_phone' {
  const raw = String(value || '')
    .trim()
    .toLowerCase();

  switch (raw) {
    case 'signup':
      return 'signup';
    case 'signup_customer':
      return 'signup_customer';
    case 'login_vendor':
      return 'login_vendor';
    case 'login_seller':
      return 'login_seller';
    case 'admin_2fa':
      return 'admin_2fa';
    case 'checkout_guest':
      return 'checkout_guest';
    case 'change_phone':
      return 'change_phone';
    case 'login_customer':
    case 'login':
    default:
      return 'login_customer';
  }
}

function expectedRolesForPurpose(purpose: PublicOtpPurpose): string[] | null {
  switch (purpose) {
    case 'login_customer':
      return ['CUSTOMER'];
    case 'login_vendor':
      return ['VENDOR', 'VENDOR_STAFF'];
    case 'login_seller':
      return ['SELLER', 'SELLER_STAFF'];
    default:
      return null;
  }
}

function firstForwardedIp(value: string | null) {
  return value?.split(',')[0]?.trim() || undefined;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Phone is required' },
        { status: 400 },
      );
    }

    const purpose = normalizePurpose(parsed.data.purpose);

    // Privileged OTP purposes are deliberately not public entry points.
    // Admin 2FA is created only after a successful password check in
    // /api/auth/login. Phone changes must be initiated from an authenticated
    // account flow, not from this anonymous authentication endpoint.
    if (purpose === 'admin_2fa' || purpose === 'change_phone') {
      return NextResponse.json(
        { error: 'This verification flow must be started from the authenticated sign-in or account flow.' },
        { status: 403 },
      );
    }

    const normalizedPhone = normalizePhone(parsed.data.phone);

    if (!normalizedPhone) {
      return NextResponse.json(
        { error: 'Please enter a valid mobile number' },
        { status: 400 },
      );
    }

    const existingUser = await prisma.user.findFirst({
      where: { phone: normalizedPhone },
      select: {
        id: true,
        phone: true,
        role: true,
      },
    });

    const expectedRoles = expectedRolesForPurpose(purpose);
    if (expectedRoles) {
      if (!existingUser) {
        return NextResponse.json(
          { error: 'No account found for this mobile number' },
          { status: 404 },
        );
      }

      if (!expectedRoles.includes(String(existingUser.role))) {
        return NextResponse.json(
          { error: 'This account must use its dedicated portal sign-in method.' },
          { status: 403 },
        );
      }
    }

    if (purpose === 'signup' || purpose === 'signup_customer') {
      if (existingUser) {
        return NextResponse.json(
          { error: 'An account already exists for this mobile number' },
          { status: 409 },
        );
      }
    }

    const otpResult = await requestOtp({
      phone: normalizedPhone,
      purpose: purpose as OtpPurpose,
      ipAddress: firstForwardedIp(req.headers.get('x-forwarded-for')),
      userAgent: req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      ok: true,
      phone: otpResult.phone,
      purpose,
      expiresAt: otpResult.expiresAt,
      expiresInSec: otpResult.expiresInSec,
      cooldownSec: otpResult.cooldownSec,
    });
  } catch (error) {
    if (error instanceof OtpError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          details: error.details ?? null,
        },
        { status: error.status || 400 },
      );
    }

    console.error('[auth/otp/request] error', error);

    return NextResponse.json(
      { error: 'Unable to send OTP right now' },
      { status: 500 },
    );
  }
}
