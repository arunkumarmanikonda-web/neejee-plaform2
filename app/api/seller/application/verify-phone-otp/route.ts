import { NextResponse } from 'next/server';
import { z } from 'zod';
import { normalizePhone, verifyOtp } from '@/lib/otp';
import {
  issueSellerPhoneVerificationProof,
  SELLER_PHONE_VERIFICATION_COOKIE,
  SELLER_PHONE_VERIFICATION_TTL_SEC,
} from '@/lib/seller-onboarding/phone-verification';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  phone: z.string().min(8),
  code: z.string().regex(/^\d{6}$/),
});

function messageForReason(reason: string): string {
  switch (reason) {
    case 'expired':
      return 'This mobile OTP has expired. Please request a new OTP.';
    case 'wrong_code':
      return 'The mobile OTP entered is incorrect.';
    case 'max_attempts':
      return 'Too many incorrect OTP attempts. Please request a new OTP.';
    case 'no_active_otp':
      return 'No active mobile OTP was found. Please request a new OTP.';
    case 'invalid_format':
      return 'Please enter the 6-digit mobile OTP.';
    case 'invalid_phone':
      return 'Please enter a valid mobile number.';
    default:
      return 'Mobile OTP verification failed. Please try again.';
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Please enter the 6-digit mobile OTP.' },
        { status: 400 },
      );
    }

    const phone = normalizePhone(parsed.data.phone);
    if (!phone) {
      return NextResponse.json({ error: 'Invalid mobile number' }, { status: 400 });
    }

    const otpResult = await verifyOtp({
      phone,
      purpose: 'signup',
      code: parsed.data.code,
    });

    if (!otpResult.ok) {
      return NextResponse.json(
        {
          error: messageForReason(otpResult.reason),
          reason: otpResult.reason,
        },
        { status: 400 },
      );
    }

    const proof = issueSellerPhoneVerificationProof(phone);
    const response = NextResponse.json({
      ok: true,
      phone,
      verified: true,
      expiresAt: proof.expiresAt,
    });

    response.cookies.set(SELLER_PHONE_VERIFICATION_COOKIE, proof.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SELLER_PHONE_VERIFICATION_TTL_SEC,
    });

    return response;
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Mobile OTP verification failed' },
      { status: 500 },
    );
  }
}
