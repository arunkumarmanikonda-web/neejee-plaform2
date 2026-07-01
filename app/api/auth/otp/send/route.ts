import { NextResponse } from 'next/server';
import {
  normalizePhone,
  OtpError,
  sendOtpSms,
  type OtpPurpose,
} from '@/lib/otp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function normalizePurpose(value: unknown): OtpPurpose {
  const raw = String(value ?? '').trim().toLowerCase();

  switch (raw) {
    case 'signup':
      return 'signup';
    case 'signup_customer':
      return 'signup_customer';
    case 'checkout_guest':
      return 'checkout_guest';
    case 'change_phone':
      return 'change_phone';
    case 'admin_2fa':
      return 'admin_2fa';
    case 'login':
    default:
      return 'login';
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | Record<string, unknown>
      | null;

    const phoneInput = String(body?.phone ?? '').trim();
    const code = String(body?.code ?? '').trim();
    const purpose = normalizePurpose(body?.purpose);
    const recipientName =
      String(body?.recipientName ?? body?.name ?? '').trim() || undefined;

    const phone = normalizePhone(phoneInput);

    if (!phone) {
      return NextResponse.json(
        { error: 'Please enter a valid mobile number' },
        { status: 400 },
      );
    }

    if (!/^\d{4,8}$/.test(code)) {
      return NextResponse.json(
        { error: 'Please enter a valid OTP code' },
        { status: 400 },
      );
    }

    await sendOtpSms({
      phone,
      code,
      purpose,
      recipientName,
    });

    return NextResponse.json({
      ok: true,
      success: true,
      phone,
      purpose,
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

    console.error('[auth/otp/send] error', error);

    return NextResponse.json(
      { error: 'Unable to send OTP right now' },
      { status: 500 },
    );
  }
}
