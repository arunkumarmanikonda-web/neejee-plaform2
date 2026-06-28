import { NextResponse } from 'next/server';
import { createOtp, normalizePhone, OTP_RESEND_COOLDOWN_SEC, OTP_TTL_MIN } from '@/lib/auth/otp';
import { dispatchSms } from '@/lib/notifications/dispatcher';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type NormalizedPurpose = 'login' | 'signup';

function normalizePurpose(value: unknown): NormalizedPurpose {
  const raw = String(value || 'login').trim().toLowerCase();

  if (raw === 'signup' || raw === 'signup_customer') return 'signup';
  return 'login';
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const phone = String(body?.phone || '');
    const purpose = normalizePurpose(body?.purpose);
    const firstName = String(body?.firstName || body?.name || 'Customer').trim() || 'Customer';

    if (!phone || !/^[+\d\s\-()]{8,15}$/.test(phone)) {
      return NextResponse.json({ ok: false, error: 'Invalid phone number' }, { status: 400 });
    }

    const normalized = normalizePhone(phone);

    const existing = await prisma.user.findFirst({
      where: { phone: normalized },
      select: { id: true },
    });

    if (purpose === 'login' && !existing) {
      return NextResponse.json(
        {
          ok: false,
          error: 'No account found with this number. Please sign up first.',
          code: 'NO_USER',
        },
        { status: 404 }
      );
    }

    if (purpose === 'signup' && existing) {
      return NextResponse.json(
        {
          ok: false,
          error: 'An account already exists with this number. Please log in instead.',
          code: 'USER_EXISTS',
        },
        { status: 409 }
      );
    }

    let otp;
    try {
      otp = await createOtp({ phone: normalized, purpose });
    } catch (e: any) {
      if (e.code === 'COOLDOWN') {
        return NextResponse.json(
          {
            ok: false,
            error: `Please wait ${e.cooldownSec}s before requesting another OTP`,
            code: 'COOLDOWN',
            cooldownSec: e.cooldownSec,
          },
          { status: 429 }
        );
      }
      throw e;
    }

    const event = purpose === 'signup' ? 'OTP_SIGNUP' : 'OTP_LOGIN';

    const sendResult = await dispatchSms({
      event,
      recipient: normalized,
      variables: {
        firstName,
        otpCode: otp.code,
      },
    });

    if (!sendResult.ok) {
      console.warn('[otp.request] SMS dispatch failed:', sendResult.error);
      return NextResponse.json(
        {
          ok: false,
          error: 'Could not send OTP at the moment. Please try again in a few seconds.',
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      phone: normalized,
      expiresAt: otp.expiresAt.toISOString(),
      cooldownSec: OTP_RESEND_COOLDOWN_SEC,
      ttlMin: OTP_TTL_MIN,
    });
  } catch (e: any) {
    console.error('[otp.request]', e);
    return NextResponse.json({ ok: false, error: e.message || 'Server error' }, { status: 500 });
  }
}
