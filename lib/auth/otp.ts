// lib/auth/otp.ts
// v26.3b — OTP generation, storage, validation.
// Uses existing OtpCode table (already in schema from older sprints).

import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export const OTP_LENGTH = 6;
export const OTP_TTL_MIN = 10;
export const OTP_RESEND_COOLDOWN_SEC = 60;
export const OTP_MAX_ATTEMPTS = 3;

// Purpose codes — must match what the verify endpoint checks
export type OtpPurpose = 'login' | 'signup' | 'checkout_guest' | 'change_phone';

export function generateOtpCode(): string {
  // Cryptographically random 6-digit code (avoids leading-zero issues by
  // using 100000-999999 range)
  const buf = crypto.randomBytes(4);
  const n = (buf.readUInt32BE(0) % 900_000) + 100_000;
  return String(n);
}

export function normalizePhone(p: string): string {
  const digits = String(p).replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith('091')) return `+${digits.slice(1)}`;
  if (p.startsWith('+')) return p;
  return `+${digits}`;
}

/**
 * Create and persist a new OTP. Caller is responsible for sending it via
 * dispatchSms.
 *
 * Returns:
 *   { code: '123456', cooldownSec?: number }
 * Throws if user is in cooldown.
 */
export async function createOtp(opts: {
  phone: string;
  purpose: OtpPurpose;
}): Promise<{ code: string; expiresAt: Date }> {
  const phone = normalizePhone(opts.phone);

  // Cooldown check: reject if a non-expired non-consumed OTP was created
  // less than 60s ago
  const recent = await prisma.otpCode.findFirst({
    where: {
      phone,
      purpose: opts.purpose,
      consumedAt: null,
      createdAt: { gte: new Date(Date.now() - OTP_RESEND_COOLDOWN_SEC * 1000) },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (recent) {
    const ageSec = Math.floor((Date.now() - new Date(recent.createdAt).getTime()) / 1000);
    const remaining = OTP_RESEND_COOLDOWN_SEC - ageSec;
    throw Object.assign(new Error('OTP cooldown active'), {
      code: 'COOLDOWN',
      cooldownSec: Math.max(remaining, 1),
    });
  }

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60 * 1000);

  await prisma.otpCode.create({
    data: {
      phone,
      code,
      purpose: opts.purpose,
      expiresAt,
    } as any,
  });

  return { code, expiresAt };
}

/**
 * Verify an OTP. Marks it consumed on success.
 * Returns { ok, phone } or { ok: false, reason }.
 */
export async function verifyOtp(opts: {
  phone: string;
  code: string;
  purpose: OtpPurpose;
}): Promise<{ ok: true; phone: string } | { ok: false; reason: string }> {
  const phone = normalizePhone(opts.phone);
  const code = String(opts.code).trim();
  if (!/^\d{6}$/.test(code)) return { ok: false, reason: 'invalid_format' };

  const row = await prisma.otpCode.findFirst({
    where: {
      phone,
      purpose: opts.purpose,
      consumedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!row) return { ok: false, reason: 'no_active_otp' };

  if (new Date(row.expiresAt) < new Date()) {
    return { ok: false, reason: 'expired' };
  }
  if ((row as any).attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, reason: 'max_attempts' };
  }

  if ((row as any).code !== code) {
    await prisma.otpCode.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } } as any,
    }).catch(() => {});
    return { ok: false, reason: 'wrong_code' };
  }

  // Success — mark consumed
  await prisma.otpCode.update({
    where: { id: row.id },
    data: { consumedAt: new Date() } as any,
  });
  return { ok: true, phone };
}
