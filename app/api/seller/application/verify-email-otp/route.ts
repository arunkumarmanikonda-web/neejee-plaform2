import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifySellerEmailOtp } from '@/lib/seller-onboarding/email-otp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  sellerId: z.string().min(1),
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Valid sellerId and 6-digit code required' }, { status: 400 });
    }

    const result = await verifySellerEmailOtp(parsed.data);

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to verify email OTP' }, { status: 400 });
  }
}