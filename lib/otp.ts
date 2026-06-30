import { randomInt } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export const OTP_LENGTH = 6;
export const OTP_TTL_MIN = 10;
export const OTP_TTL_MS = OTP_TTL_MIN * 60 * 1000;
export const OTP_RESEND_COOLDOWN_SEC = 60;
export const OTP_RESEND_COOLDOWN_MS = OTP_RESEND_COOLDOWN_SEC * 1000;
export const OTP_MAX_ATTEMPTS = 3;
export const OTP_MAX_OTPS_PER_HOUR = 5;

export const OTP_CONFIG = {
  length: OTP_LENGTH,
  ttlMin: OTP_TTL_MIN,
  ttlMs: OTP_TTL_MS,
  resendCooldownSec: OTP_RESEND_COOLDOWN_SEC,
  resendCooldownMs: OTP_RESEND_COOLDOWN_MS,
  maxAttempts: OTP_MAX_ATTEMPTS,
  maxOtpsPerHour: OTP_MAX_OTPS_PER_HOUR,

  LENGTH: OTP_LENGTH,
  TTL_MIN: OTP_TTL_MIN,
  TTL_MS: OTP_TTL_MS,
  RESEND_COOLDOWN_SEC: OTP_RESEND_COOLDOWN_SEC,
  RESEND_COOLDOWN_MS: OTP_RESEND_COOLDOWN_MS,
  MAX_ATTEMPTS: OTP_MAX_ATTEMPTS,
  MAX_OTPS_PER_HOUR: OTP_MAX_OTPS_PER_HOUR,

  OTP_LENGTH: OTP_LENGTH,
  OTP_TTL_MIN: OTP_TTL_MIN,
  OTP_TTL_MS: OTP_TTL_MS,
  OTP_RESEND_COOLDOWN_SEC: OTP_RESEND_COOLDOWN_SEC,
  OTP_RESEND_COOLDOWN_MS: OTP_RESEND_COOLDOWN_MS,
  OTP_MAX_ATTEMPTS: OTP_MAX_ATTEMPTS,
  OTP_MAX_OTPS_PER_HOUR: OTP_MAX_OTPS_PER_HOUR,
} as const;

export type OtpPurpose =
  | 'login'
  | 'signup'
  | 'signup_customer'
  | 'checkout_guest'
  | 'change_phone'
  | 'admin_2fa';

type CreateOtpInput = {
  phone: string;
  purpose: OtpPurpose;
  ipAddress?: string | null;
  userAgent?: string | null;
};

type RequestOtpInput = CreateOtpInput;

type VerifyOtpInput = {
  phone: string;
  code: string;
  purpose: OtpPurpose;
};

type VerifyOtpResult =
  | {
      ok: true;
      phone: string;
      purpose: OtpPurpose;
    }
  | {
      ok: false;
      reason:
        | 'invalid_phone'
        | 'invalid_format'
        | 'no_active_otp'
        | 'expired'
        | 'wrong_code'
        | 'max_attempts';
    };

type SendOtpSmsParams = {
  phone: string;
  code: string;
  purpose?: OtpPurpose;
};

type SendOtpSmsResult = {
  ok: true;
  provider: string;
  response?: unknown;
};

export class OtpError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    status = 400,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'OtpError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function digitsOnly(value: string) {
  return String(value || '').replace(/\D/g, '');
}

function parseBooleanFlag(value: string | undefined): boolean | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return null;
}

export function normalizePhone(input: string): string | null {
  const raw = String(input || '').trim();
  if (!raw) return null;

  if (raw.startsWith('+')) {
    const normalized = `+${digitsOnly(raw)}`;
    const len = normalized.slice(1).length;
    if (len >= 10 && len <= 15) return normalized;
    return null;
  }

  const digits = digitsOnly(raw);

  if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) {
    return `+91${digits}`;
  }

  if (digits.length === 12 && digits.startsWith('91')) {
    const local = digits.slice(2);
    if (/^[6-9]\d{9}$/.test(local)) {
      return `+${digits}`;
    }
  }

  if (digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }

  return null;
}

export function generateOtpCode(): string {
  return randomInt(0, 10 ** OTP_LENGTH)
    .toString()
    .padStart(OTP_LENGTH, '0');
}

export async function hashOtp(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

function isOtpAuthEnabled() {
  const explicit = parseBooleanFlag(process.env.OTP_AUTH_ENABLED);
  if (explicit !== null) return explicit;

  return Boolean(
    process.env.FAST2SMS_API_KEY ||
      process.env.FAST2SMS_AUTH_KEY ||
      process.env.FAST2SMS_API_TOKEN,
  );
}

export function smsConfigured(): boolean {
  if (!isOtpAuthEnabled()) return false;

  return Boolean(
    process.env.FAST2SMS_API_KEY ||
      process.env.FAST2SMS_AUTH_KEY ||
      process.env.FAST2SMS_API_TOKEN ||
      process.env.NODE_ENV !== 'production',
  );
}

async function sendOtpSmsInternal({
  phone,
  code,
  purpose = 'login',
}: SendOtpSmsParams): Promise<SendOtpSmsResult> {
  if (!isOtpAuthEnabled()) {
    throw new OtpError(
      'OTP_DISABLED',
      'OTP authentication is disabled',
      503,
    );
  }

  const message = `Your Neejee verification code is ${code}. It expires in ${OTP_TTL_MIN} minutes.`;

  const apiKey =
    process.env.FAST2SMS_API_KEY ||
    process.env.FAST2SMS_AUTH_KEY ||
    process.env.FAST2SMS_API_TOKEN ||
    '';

  const digits = digitsOnly(phone);
  const indianMobile = digits.startsWith('91') ? digits.slice(2) : digits;

  if (!apiKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[OTP DEV MODE]', { phone, purpose, code });
      return { ok: true, provider: 'console' };
    }

    throw new OtpError(
      'SMS_NOT_CONFIGURED',
      'SMS provider is not configured',
      500,
    );
  }

  const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
    method: 'POST',
    headers: {
      authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      route: 'q',
      message,
      language: 'english',
      flash: 0,
      numbers: indianMobile,
    }),
    cache: 'no-store',
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new OtpError(
      'SMS_SEND_FAILED',
      'Failed to send OTP SMS',
      502,
      { response: data },
    );
  }

  return {
    ok: true,
    provider: 'fast2sms',
    response: data,
  };
}

export function sendOtpSms(
  phone: string,
  code: string,
  purpose?: OtpPurpose,
): Promise<SendOtpSmsResult>;
export function sendOtpSms(
  params: SendOtpSmsParams,
): Promise<SendOtpSmsResult>;
export async function sendOtpSms(
  arg1: string | SendOtpSmsParams,
  arg2?: string,
  arg3?: OtpPurpose,
): Promise<SendOtpSmsResult> {
  if (typeof arg1 === 'string') {
    return sendOtpSmsInternal({
      phone: arg1,
      code: arg2 || '',
      purpose: arg3 ?? 'login',
    });
  }

  return sendOtpSmsInternal(arg1);
}

export async function createOtp(input: CreateOtpInput) {
  const phone = normalizePhone(input.phone);
  if (!phone) {
    throw new OtpError(
      'INVALID_PHONE',
      'Please enter a valid mobile number',
      400,
    );
  }

  const purpose = input.purpose;
  const now = new Date();

  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const recentCount = await prisma.otpCode.count({
    where: {
      phone,
      createdAt: { gte: oneHourAgo },
    },
  });

  if (recentCount >= OTP_MAX_OTPS_PER_HOUR) {
    throw new OtpError(
      'RATE_LIMIT_HOURLY',
      'Too many OTP requests. Please try again in an hour.',
      429,
      { maxOtpsPerHour: OTP_MAX_OTPS_PER_HOUR },
    );
  }

  const latest = await prisma.otpCode.findFirst({
    where: {
      phone,
      purpose,
      consumedAt: null,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (latest) {
    const nextAllowedAt = latest.createdAt.getTime() + OTP_RESEND_COOLDOWN_MS;
    const cooldownSec = Math.ceil((nextAllowedAt - now.getTime()) / 1000);

    if (cooldownSec > 0) {
      throw new OtpError(
        'COOLDOWN',
        `Please wait ${cooldownSec} seconds before requesting another OTP`,
        429,
        { cooldownSec },
      );
    }
  }

  const code = generateOtpCode();
  const codeHash = await hashOtp(code);
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

  await prisma.otpCode.updateMany({
    where: {
      phone,
      purpose,
      consumedAt: null,
    },
    data: {
      consumedAt: now,
    },
  });

  const otp = await prisma.otpCode.create({
    data: {
      phone,
      purpose,
      codeHash,
      attempts: 0,
      maxAttempts: OTP_MAX_ATTEMPTS,
      expiresAt,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });

  return {
    ok: true as const,
    id: otp.id,
    phone,
    purpose,
    code,
    expiresAt,
    expiresInSec: Math.floor(OTP_TTL_MS / 1000),
    cooldownSec: OTP_RESEND_COOLDOWN_SEC,
  };
}

export async function requestOtp(input: RequestOtpInput) {
  const created = await createOtp(input);

  await sendOtpSms({
    phone: created.phone,
    code: created.code,
    purpose: created.purpose,
  });

  return {
    ok: true as const,
    phone: created.phone,
    purpose: created.purpose,
    expiresAt: created.expiresAt,
    expiresInSec: created.expiresInSec,
    cooldownSec: created.cooldownSec,
  };
}

export async function verifyOtp(
  input: VerifyOtpInput,
): Promise<VerifyOtpResult> {
  const phone = normalizePhone(input.phone);
  if (!phone) {
    return { ok: false, reason: 'invalid_phone' };
  }

  const code = String(input.code || '').trim();
  if (!/^\d{4,8}$/.test(code)) {
    return { ok: false, reason: 'invalid_format' };
  }

  const purpose = input.purpose;
  const now = new Date();

  const otp = await prisma.otpCode.findFirst({
    where: {
      phone,
      purpose,
      consumedAt: null,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (!otp) {
    return { ok: false, reason: 'no_active_otp' };
  }

  if (otp.expiresAt.getTime() < now.getTime()) {
    return { ok: false, reason: 'expired' };
  }

  if (otp.attempts >= otp.maxAttempts) {
    return { ok: false, reason: 'max_attempts' };
  }

  const matched = await bcrypt.compare(code, otp.codeHash);

  if (!matched) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });

    const nextAttempts = otp.attempts + 1;
    if (nextAttempts >= otp.maxAttempts) {
      return { ok: false, reason: 'max_attempts' };
    }

    return { ok: false, reason: 'wrong_code' };
  }

  await prisma.otpCode.update({
    where: { id: otp.id },
    data: {
      consumedAt: now,
    },
  });

  return {
    ok: true,
    phone,
    purpose,
  };
}
