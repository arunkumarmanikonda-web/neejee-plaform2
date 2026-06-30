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

function normalizePurpose(value?: string | null): OtpPurpose {
  const raw = String(value || '')
    .trim()
    .toLowerCase();

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
      },
    });

    if (purpose === 'login' || purpose === 'admin_2fa') {
      if (!existingUser) {
        return NextResponse.json(
          { error: 'No account found for this mobile number' },
          { status: 404 },
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
      purpose,
      ipAddress: firstForwardedIp(req.headers.get('x-forwarded-for')),
      userAgent: req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      ok: true,
      phone: otpResult.phone,
      purpose: otpResult.purpose,
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
