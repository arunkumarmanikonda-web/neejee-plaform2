// app/api/auth/otp/request/route.ts
// v26.3b — Request an OTP for login or signup via SMS.
//
// POST body: { phone: '+919876543210', purpose: 'login' | 'signup' }
// Response:  { ok: true, expiresAt, cooldownSec: 60 }
//            or { ok: false, error, code }

import { NextResponse } from 'next/server';
import { createOtp, normalizePhone, OTP_RESEND_COOLDOWN_SEC, OTP_TTL_MIN } from '@/lib/auth/otp';
import { dispatchSms } from '@/lib/notifications/dispatcher';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const phone = String(body?.phone || '');
    const purpose = (body?.purpose || 'login') as 'login' | 'signup';

    if (!phone || !/^[+\d\s\-()]{8,15}$/.test(phone)) {
      return NextResponse.json({ ok: false, error: 'Invalid phone number' }, { status: 400 });
    }

    const normalized = normalizePhone(phone);

    // Signup vs login sanity: signup should not exist; login should exist
    const existing = await prisma.user.findFirst({
      where: { phone: normalized },
      select: { id: true },
    });

    if (purpose === 'login' && !existing) {
      return NextResponse.json({
        ok: false,
        error: 'No account found with this number. Please sign up first.',
        code: 'NO_USER',
      }, { status: 404 });
    }
    if (purpose === 'signup' && existing) {
      return NextResponse.json({
        ok: false,
        error: 'An account already exists with this number. Please log in instead.',
        code: 'USER_EXISTS',
      }, { status: 409 });
    }

    // Generate OTP
    let otp;
    try {
      otp = await createOtp({ phone: normalized, purpose });
    } catch (e: any) {
      if (e.code === 'COOLDOWN') {
        return NextResponse.json({
          ok: false,
          error: `Please wait ${e.cooldownSec}s before requesting another OTP`,
          code: 'COOLDOWN',
          cooldownSec: e.cooldownSec,
        }, { status: 429 });
      }
      throw e;
    }

    // Send via SMS
    const event = purpose === 'signup' ? 'OTP_SIGNUP' : 'OTP_LOGIN';
    const sendResult = await dispatchSms({
      event,
      recipient: normalized,
      variables: { otpCode: otp.code },
    });

    if (!sendResult.ok) {
      // Don't reveal SMS provider details to the user; log and return generic error
      console.warn('[otp.request] SMS dispatch failed:', sendResult.error);
      return NextResponse.json({
        ok: false,
        error: 'Could not send OTP at the moment. Please try again in a few seconds.',
      }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      expiresAt: otp.expiresAt.toISOString(),
      cooldownSec: OTP_RESEND_COOLDOWN_SEC,
      ttlMin: OTP_TTL_MIN,
    });
  } catch (e: any) {
    console.error('[otp.request]', e);
    return NextResponse.json({ ok: false, error: e.message || 'Server error' }, { status: 500 });
  }
}
