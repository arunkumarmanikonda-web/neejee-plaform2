import { NextResponse } from 'next/server';
import { z } from 'zod';
import { normalizePhone, verifyOtp } from '@/lib/otp';
import {
  createSellerOnboardingToken,
  SELLER_ONBOARDING_COOKIE,
  sellerOnboardingCookieOptions,
} from '@/lib/seller-onboarding/application-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  phone: z.string().min(8),
  code: z.string().regex(/^\d{4,8}$/),
});

export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Valid mobile number and OTP are required' }, { status: 400 });
  }

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    return NextResponse.json({ error: 'Invalid mobile number' }, { status: 400 });
  }

  try {
    const result = await verifyOtp({
      phone,
      purpose: 'signup',
      code: parsed.data.code,
    });

    if (!result.ok) {
      const messages: Record<string, string> = {
        invalid_phone: 'Invalid mobile number',
        invalid_format: 'Invalid OTP format',
        no_active_otp: 'No active OTP found. Please request a new code.',
        expired: 'This OTP has expired. Please request a new code.',
        wrong_code: 'The OTP is incorrect.',
        max_attempts: 'Too many incorrect attempts. Please request a new OTP.',
      };
      return NextResponse.json(
        { error: messages[result.reason] || 'Mobile OTP verification failed', reason: result.reason },
        { status: 400 },
      );
    }

    const token = await createSellerOnboardingToken(phone);
    const response = NextResponse.json({ ok: true, phone });
    response.cookies.set(SELLER_ONBOARDING_COOKIE, token, sellerOnboardingCookieOptions());
    return response;
  } catch (error) {
    console.error('[seller.application.verify-phone-otp] failed', {
      message: error instanceof Error ? error.message : 'unknown_error',
    });
    return NextResponse.json({ error: 'Unable to verify this OTP right now' }, { status: 500 });
  }
}
