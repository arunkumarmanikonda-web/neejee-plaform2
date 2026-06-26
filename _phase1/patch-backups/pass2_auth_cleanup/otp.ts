// v23.35 — OTP service (6-digit, 5 min expiry, 3 attempts, 60s resend cooldown)
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { sendDltSms } from '@/lib/sms';
import { getTemplate, markUsed } from '@/lib/sms-registry';

export type OtpPurpose =
  | 'login_customer'
  | 'login_seller'
  | 'login_vendor'
  | 'admin_2fa'
  | 'checkout_guest';

const OTP_LENGTH = 6;
const OTP_TTL_MS = 5 * 60 * 1000;     // 5 minutes
const MAX_ATTEMPTS = 3;
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds

function generateOtp(): string {
  // cryptographically random 6-digit code
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  const n = (buf[0] << 24 | buf[1] << 16 | buf[2] << 8 | buf[3]) >>> 0;
  return String(n % 1_000_000).padStart(OTP_LENGTH, '0');
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) return '+' + digits;
  if (digits.length === 10) return '+91' + digits;
  if (raw.startsWith('+')) return raw;
  return '+' + digits;
}

export async function requestOtp(opts: {
  phone: string;
  purpose: OtpPurpose;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ ok: boolean; error?: string; expiresInSec?: number; devCode?: string }> {
  const phone = normalizePhone(opts.phone);
  if (!/^\+91[6-9]\d{9}$/.test(phone)) {
    return { ok: false, error: 'Invalid Indian mobile number' };
  }

  // Cooldown check — block if last OTP was issued within 60s and not yet expired/consumed
  const recent = await prisma.otpCode.findFirst({
    where: { phone, purpose: opts.purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (recent && Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - recent.createdAt.getTime())) / 1000);
    return { ok: false, error: `Please wait ${wait}s before requesting a new OTP` };
  }

  // Invalidate previous unused OTPs for same phone+purpose
  await prisma.otpCode.updateMany({
    where: { phone, purpose: opts.purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const code = generateOtp();
  const codeHash = await bcrypt.hash(code, 10);

  await prisma.otpCode.create({
    data: {
      phone,
      codeHash,
      purpose: opts.purpose,
      maxAttempts: MAX_ATTEMPTS,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      ipAddress: opts.ipAddress,
      userAgent: opts.userAgent,
    },
  });

  // Look up DLT template
  const tpl = await getTemplate('otp_login');
  if (!tpl || !tpl.ready) {
    // Dev fallback: return code in response if SMS not ready (NEVER in production)
    if (process.env.NODE_ENV !== 'production') {
      return { ok: true, expiresInSec: OTP_TTL_MS / 1000, devCode: code };
    }
    return { ok: false, error: 'SMS service not configured. Add DLT template ID in admin settings.' };
  }

  const result = await sendDltSms({
    phone,
    templateId: tpl.templateId,
    vars: [code],
    rawMessage: tpl.body.replace('{#var#}', code),
  });

  if (!result.ok) {
    return { ok: false, error: result.error || 'Failed to send OTP' };
  }

  await markUsed('otp_login');
  return {
    ok: true,
    expiresInSec: OTP_TTL_MS / 1000,
    ...(process.env.NODE_ENV !== 'production' ? { devCode: code } : {}),
  };
}

export async function verifyOtp(opts: {
  phone: string;
  purpose: OtpPurpose;
  code: string;
}): Promise<{ ok: boolean; error?: string; remaining?: number }> {
  const phone = normalizePhone(opts.phone);
  const row = await prisma.otpCode.findFirst({
    where: { phone, purpose: opts.purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!row) return { ok: false, error: 'No OTP requested. Please request a new one.' };
  if (row.expiresAt < new Date()) {
    await prisma.otpCode.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
    return { ok: false, error: 'OTP expired. Please request a new one.' };
  }
  if (row.attempts >= row.maxAttempts) {
    await prisma.otpCode.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
    return { ok: false, error: 'Too many failed attempts. Please request a new OTP.' };
  }

  const matches = await bcrypt.compare(opts.code.trim(), row.codeHash);
  if (!matches) {
    const attempts = row.attempts + 1;
    await prisma.otpCode.update({ where: { id: row.id }, data: { attempts } });
    const remaining = row.maxAttempts - attempts;
    return { ok: false, error: `Incorrect OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`, remaining };
  }

  await prisma.otpCode.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
  return { ok: true };
}

// ─── v23.34 backward-compat exports ──────────────────────────────────────────
// Older /api/auth/otp/send route uses these named exports. Kept thin.
export const OTP_CONFIG = {
  // v23.35 keys
  length: OTP_LENGTH,
  ttlMs: OTP_TTL_MS,
  maxAttempts: MAX_ATTEMPTS,
  resendCooldownMs: RESEND_COOLDOWN_MS,
  // v23.34 legacy keys (used by /api/auth/otp/send)
  OTP_LENGTH,
  OTP_TTL_MS,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_MS,
  MAX_OTPS_PER_HOUR: 5,
} as const;

export function generateOtpCode(): string {
  return generateOtp();
}

export async function hashOtp(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

export async function smsConfigured(): Promise<boolean> {
  return !!process.env.FAST2SMS_API_KEY;
}

export async function sendOtpSms(phone: string, code: string) {
  // Delegate to the central sender via the OTP template
  const tpl = await getTemplate('otp_login');
  if (!tpl || !tpl.ready) {
    return { ok: false, error: 'OTP template not configured' };
  }
  return sendDltSms({
    phone,
    templateId: tpl.templateId,
    vars: [code],
    rawMessage: tpl.body.replace('{#var#}', code),
  });
}
