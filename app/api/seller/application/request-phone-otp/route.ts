import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requestOtp, normalizePhone } from '@/lib/otp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  phone: z.string().min(8),
  recipientName: z.string().optional(),
});

function firstForwardedIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);

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
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to send OTP' }, { status: 400 });
  }
}