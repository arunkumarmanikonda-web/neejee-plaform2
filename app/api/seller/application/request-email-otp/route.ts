import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requestSellerEmailOtp } from '@/lib/seller-onboarding/email-otp';
import { readSellerOnboardingSession } from '@/lib/seller-onboarding/application-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({ sellerId: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'sellerId required' }, { status: 400 });
    }

    const seller = await prisma.seller.findUnique({
      where: { id: parsed.data.sellerId },
      select: { id: true, email: true, phone: true, contactName: true },
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

    const result = await requestSellerEmailOtp({
      sellerId: seller.id,
      email: seller.email,
      recipientName: seller.contactName || seller.email,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[seller.application.request-email-otp] failed', {
      message: error instanceof Error ? error.message : 'unknown_error',
    });
    return NextResponse.json({ error: 'Unable to send the email verification code right now' }, { status: 400 });
  }
}
