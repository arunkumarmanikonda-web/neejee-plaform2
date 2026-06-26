// LEGACY route — kept for backward compatibility with existing /login page.
// New code should use /api/auth/otp/request (v23.35) which supports purposes
// (customer/seller/vendor/admin-2FA/checkout-guest) and the DLT template registry.
//
// POST /api/auth/otp/send  { phone }
// Generates a 6-digit OTP, stores the bcrypt hash, sends via Fast2SMS.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/phone';
import {
  generateOtpCode, hashOtp, sendOtpSms, smsConfigured, OTP_CONFIG,
} from '@/lib/otp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 15;

export async function POST(request: Request) {
  // Server-side gate: OTP login is disabled until DLT registration is approved.
  // Flip OTP_LOGIN_ENABLED=true in Vercel once SMS console templates are pasted.
  if (process.env.OTP_LOGIN_ENABLED !== 'true') {
    return NextResponse.json(
      { error: 'Phone login is coming soon. Please sign in with email or Google for now.' },
      { status: 503 },
    );
  }

  let body: any = {};
  try { body = await request.json(); } catch {}
  const raw = (body.phone || '').toString().trim();
  const phone = normalizePhone(raw);
  if (!phone) {
    return NextResponse.json({ error: 'Please enter a valid mobile number.' }, { status: 400 });
  }

  // Rate-limit: max N OTPs per phone per hour (v23.35: read from compat OTP_CONFIG)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await prisma.otpToken.count({
    where: { phone, createdAt: { gte: oneHourAgo } },
  });
  if (recentCount >= OTP_CONFIG.MAX_OTPS_PER_HOUR) {
    return NextResponse.json(
      { error: 'Too many OTP requests. Please try again in an hour.' },
      { status: 429 },
    );
  }

  // Invalidate any unconsumed OTPs for this phone (idempotent flow)
  await prisma.otpToken.updateMany({
    where: { phone, consumedAt: null, expiresAt: { gte: new Date() } },
    data: { expiresAt: new Date() },
  });

  // Generate, hash, persist
  const code = generateOtpCode();
  const codeHash = await hashOtp(code);
  const expiresAt = new Date(Date.now() + OTP_CONFIG.OTP_TTL_MS);
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;

  await prisma.otpToken.create({
    data: { phone, codeHash, expiresAt, ipAddress: ip },
  });

  // Send via Fast2SMS DLT (v23.35: routes through SmsTemplate registry)
  const send = await sendOtpSms(phone, code);
  if (!send.ok) {
    console.error('[otp/send] SMS provider failed:', (send as any).error);
    return NextResponse.json(
      { error: 'We couldn\u2019t send the code right now. Please try again in a moment.' },
      { status: 502 },
    );
  }

  const configured = await smsConfigured();
  const mock = (send as any).mock === true;
  const mockCode = (send as any).mockCode;

  return NextResponse.json({
    ok: true,
    phone,
    expiresInSeconds: Math.floor(OTP_CONFIG.OTP_TTL_MS / 1000),
    ...(mock ? { mock: true, mockCode } : {}),
    delivered: configured && !mock,
  });
}
