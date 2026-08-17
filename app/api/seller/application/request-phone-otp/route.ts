import { NextResponse } from 'next/server';
import { z } from 'zod';
import { OtpError, requestOtp, normalizePhone } from '@/lib/otp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  phone: z.string().min(8),
  recipientName: z.string().max(100).optional(),
});

function firstForwardedIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
}

function safeOtpMessage(error: OtpError) {
  if (error.code === 'INVALID_PHONE') return 'Please enter a valid mobile number.';
  if (error.code === 'COOLDOWN') return error.message;
  if (error.code === 'RATE_LIMIT_HOURLY') return 'Too many OTP requests. Please try again later.';
  if (error.code === 'OTP_DISABLED') return 'Mobile verification is temporarily unavailable.';
  return 'We could not send the mobile verification code right now. Please try again shortly.';
}

export async function POST(request: Request) {
  try {
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid mobile number' }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(parsed.data.phone);
    if (!normalizedPhone) {
      return NextResponse.json({ error: 'Invalid mobile number' }, { status: 400 });
    }

    const result = await requestOtp({
      phone: normalizedPhone,
      purpose: 'signup',
      recipientName: parsed.data.recipientName || 'Seller',
      ipAddress: firstForwardedIp(request),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OtpError) {
      if (error.status >= 500) {
        console.error('[seller.application.request-phone-otp] provider failure', {
          code: error.code,
          status: error.status,
        });
      }
      return NextResponse.json(
        { error: safeOtpMessage(error), code: error.code },
        { status: error.status },
      );
    }

    console.error('[seller.application.request-phone-otp] failed', {
      message: error instanceof Error ? error.message : 'unknown_error',
    });
    return NextResponse.json(
      { error: 'We could not send the mobile verification code right now.' },
      { status: 500 },
    );
  }
}
