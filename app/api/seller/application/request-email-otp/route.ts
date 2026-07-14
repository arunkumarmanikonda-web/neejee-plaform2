import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requestSellerEmailOtp } from '@/lib/seller-onboarding/email-otp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  sellerId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'sellerId required' }, { status: 400 });
    }

    const seller = await prisma.seller.findUnique({
      where: { id: parsed.data.sellerId },
      select: { id: true, email: true, contactName: true },
    });

    if (!seller) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 });
    }

    const result = await requestSellerEmailOtp({
      sellerId: seller.id,
      email: seller.email,
      recipientName: seller.contactName || seller.email,
    });

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to send email OTP' }, { status: 400 });
  }
}