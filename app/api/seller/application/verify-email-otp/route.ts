import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifySellerEmailOtp } from '@/lib/seller-onboarding/email-otp';
import { readSellerOnboardingSession } from '@/lib/seller-onboarding/application-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  sellerId: z.string().min(1),
  code: z.string().regex(/^\d{6}$/),
});

const REASON_MESSAGES: Record<string, string> = {
  no_active_otp: 'No active email verification code was found. Please request a new code.',
  expired: 'This email verification code has expired. Please request a new code.',
  wrong_code: 'The email verification code is incorrect.',
  max_attempts: 'Too many incorrect attempts. Please request a new email verification code.',
  seller_not_found: 'Seller application not found.',
  phone_session_mismatch: 'The verified mobile session does not match this application.',
  account_identity_conflict: 'This email or mobile number is already associated with another account. Please contact NEEJEE support.',
  protected_account_conflict: 'This email belongs to an internal NEEJEE account and cannot be converted into a seller account automatically.',
  pending_documents_missing: 'The application documents are no longer available. Please restart the document step.',
};

function reasonStatus(reason: string) {
  if (reason === 'max_attempts') return 429;
  if (reason === 'phone_session_mismatch') return 401;
  if (['account_identity_conflict', 'protected_account_conflict', 'pending_documents_missing'].includes(reason)) return 409;
  if (reason === 'seller_not_found') return 404;
  return 400;
}

export async function POST(request: Request) {
  try {
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Valid sellerId and 6-digit code required' }, { status: 400 });
    }

    const seller = await prisma.seller.findUnique({
      where: { id: parsed.data.sellerId },
      select: { id: true, phone: true },
    });
    if (!seller) {
      return NextResponse.json({ error: 'Seller application not found' }, { status: 404 });
    }

    const onboarding = await readSellerOnboardingSession(seller.phone);
    if (!onboarding) {
      return NextResponse.json(
        { error: 'Your verified mobile session has expired. Please verify the mobile OTP again.' },
        { status: 401 },
      );
    }

    const result = await verifySellerEmailOtp({
      sellerId: seller.id,
      code: parsed.data.code,
      verifiedPhone: onboarding.phone,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ...result, error: REASON_MESSAGES[result.reason] || 'Failed to verify email OTP' },
        { status: reasonStatus(result.reason) },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[seller.application.verify-email-otp] failed', {
      message: error instanceof Error ? error.message : 'unknown_error',
    });
    return NextResponse.json({ error: 'Unable to verify the email code right now' }, { status: 500 });
  }
}
