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

  OTP_LENGTH,
  OTP_TTL_MIN,
  OTP_TTL_MS,
  OTP_RESEND_COOLDOWN_SEC,
  OTP_RESEND_COOLDOWN_MS,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_OTPS_PER_HOUR,
} as const;

export type OtpPurpose =
  | 'login'
  | 'signup'
  | 'signup_customer'
  | 'checkout_guest'
  | 'change_phone'
  | 'admin_2fa';

export type CreateOtpInput = {
  phone: string;
  purpose: OtpPurpose;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type RequestOtpInput = CreateOtpInput & {
  recipientName?: string | null;
};

export type VerifyOtpInput = {
  phone: string;
  purpose: OtpPurpose;
  code: string;
};

export type VerifyOtpResult =
  | { ok: true; phone: string; purpose: OtpPurpose }
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

export class OtpError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(
    message: string,
    code = 'OTP_ERROR',
    status = 400,
    details?: unknown,
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

function parseBooleanFlag(value?: string | null): boolean | null {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return null;
}

export function normalizePhone(phone: string | null | undefined): string | null {
  const raw = String(phone || '').trim();
  if (!raw) return null;

  if (raw.startsWith('+')) {
    const digits = `+${digitsOnly(raw)}`;
    if (/^\+\d{8,15}$/.test(digits)) return digits;
    return null;
  }

  const digits = digitsOnly(raw);

  if (!digits) return null;

  // India local number
  if (digits.length === 10) {
    return `+91${digits}`;
  }

  // India with leading 0
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+91${digits.slice(1)}`;
  }

  // India with country code
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }

  // Generic international fallback
  if (digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`;
  }

  return null;
}

function toFast2SmsNumber(phone: string): string {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    throw new OtpError('Invalid mobile number', 'INVALID_PHONE', 400);
  }

  const digits = digitsOnly(normalized);

  // Fast2SMS examples use 10-digit Indian mobile numbers.
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }

  if (digits.length === 10) {
    return digits;
  }

  // Fallback: send digits only
  return digits;
}

export function generateOtpCode(length = OTP_LENGTH) {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += String(randomInt(0, 10));
  }
  return code;
}

export async function hashOtp(code: string) {
  return bcrypt.hash(code, 10);
}

export function isOtpAuthEnabled() {
  const explicit = parseBooleanFlag(process.env.OTP_AUTH_ENABLED);
  if (explicit !== null) return explicit;
  return true;
}

export function smsConfigured() {
  return Boolean(
    process.env.FAST2SMS_API_KEY ||
      process.env.FAST2SMS_AUTH_KEY ||
      process.env.FAST2SMS_API_TOKEN,
  );
}

function getFast2SmsApiKey() {
  return (
    process.env.FAST2SMS_API_KEY ||
    process.env.FAST2SMS_AUTH_KEY ||
    process.env.FAST2SMS_API_TOKEN ||
    ''
  ).trim();
}

function getFast2SmsDltConfig(purpose: OtpPurpose) {
  const senderId = (
    process.env.FAST2SMS_DLT_SENDER_ID ||
    'NEEJEY'
  ).trim();

  const loginMessageId = (
    process.env.FAST2SMS_DLT_LOGIN_MESSAGE_ID ||
    '218985'
  ).trim();

  const adminMessageId = (
    process.env.FAST2SMS_DLT_ADMIN_MESSAGE_ID ||
    loginMessageId
  ).trim();

  const messageId = purpose === 'admin_2fa' ? adminMessageId : loginMessageId;

  return {
    senderId,
    messageId,
    route: 'dlt' as const,
  };
}

function displayNameForPurpose(
  purpose: OtpPurpose,
  recipientName?: string | null,
) {
  const trimmed = String(recipientName || '').trim();
  if (trimmed) return trimmed;

  if (purpose === 'admin_2fa') return 'Admin';
  return 'Customer';
}

async function parseProviderResponse(response: Response) {
  const raw = await response.text();

  try {
    return {
      raw,
      json: JSON.parse(raw) as Record<string, unknown>,
    };
  } catch {
    return {
      raw,
      json: null as Record<string, unknown> | null,
    };
  }
}

async function sendOtpSmsInternal(args: {
  phone: string;
  code: string;
  purpose: OtpPurpose;
  recipientName?: string | null;
}) {
  const { phone, code, purpose, recipientName } = args;

  if (!isOtpAuthEnabled()) {
    throw new OtpError(
      'OTP authentication is disabled',
      'OTP_DISABLED',
      503,
    );
  }

  const apiKey = getFast2SmsApiKey();

  if (!apiKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[otp:dev] ${purpose} OTP for ${phone}: ${code}`,
      );
      return;
    }

    throw new OtpError(
      'SMS provider is not configured',
      'SMS_NOT_CONFIGURED',
      500,
    );
  }

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    throw new OtpError('Invalid mobile number', 'INVALID_PHONE', 400);
  }

  const fast2SmsNumber = toFast2SmsNumber(normalizedPhone);
  const dlt = getFast2SmsDltConfig(purpose);
  const name = displayNameForPurpose(purpose, recipientName);
  const variablesValues = `${name}|${code}`;

  const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
    method: 'POST',
    headers: {
      authorization: apiKey,
      accept: '*/*',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      route: dlt.route,
      sender_id: dlt.senderId,
      message: dlt.messageId,
      variables_values: variablesValues,
      numbers: fast2SmsNumber,
    }),
    cache: 'no-store',
  });

  const parsed = await parseProviderResponse(response);
  const providerStatusCode =
    parsed.json && typeof parsed.json.status_code !== 'undefined'
      ? String(parsed.json.status_code)
      : '';

  const providerMessage =
    parsed.json && typeof parsed.json.message === 'string'
      ? parsed.json.message
      : '';

  if (!response.ok) {
    const message =
      providerMessage ||
      `Fast2SMS request failed with status ${response.status}`;

    throw new OtpError(
      message,
      `FAST2SMS_${providerStatusCode || response.status}`,
      response.status,
      parsed.json ?? parsed.raw,
    );
  }

  if (
    providerStatusCode &&
    providerStatusCode !== '200' &&
    providerStatusCode !== '201'
  ) {
    throw new OtpError(
      providerMessage || 'Fast2SMS rejected the request',
      `FAST2SMS_${providerStatusCode}`,
      400,
      parsed.json ?? parsed.raw,
    );
  }
}

export async function sendOtpSms(phone: string, code: string): Promise<void>;
export async function sendOtpSms(args: {
  phone: string;
  code: string;
  purpose?: OtpPurpose;
  recipientName?: string | null;
}): Promise<void>;
export async function sendOtpSms(
  phoneOrArgs:
    | string
    | {
        phone: string;
        code: string;
        purpose?: OtpPurpose;
        recipientName?: string | null;
      },
  maybeCode?: string,
): Promise<void> {
  if (typeof phoneOrArgs === 'string') {
    await sendOtpSmsInternal({
      phone: phoneOrArgs,
      code: String(maybeCode || ''),
      purpose: 'login',
    });
    return;
  }

  await sendOtpSmsInternal({
    phone: phoneOrArgs.phone,
    code: phoneOrArgs.code,
    purpose: phoneOrArgs.purpose || 'login',
    recipientName: phoneOrArgs.recipientName,
  });
}

export async function createOtp(input: CreateOtpInput) {
  const normalizedPhone = normalizePhone(input.phone);

  if (!normalizedPhone) {
    throw new OtpError(
      'Please enter a valid mobile number',
      'INVALID_PHONE',
      400,
    );
  }

  if (!isOtpAuthEnabled()) {
    throw new OtpError(
      'OTP authentication is disabled',
      'OTP_DISABLED',
      503,
    );
  }

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const hourlyCount = await prisma.otpCode.count({
    where: {
      phone: normalizedPhone,
      purpose: input.purpose,
      createdAt: { gte: oneHourAgo },
    },
  });

  if (hourlyCount >= OTP_MAX_OTPS_PER_HOUR) {
    throw new OtpError(
      'Too many OTP requests. Please try again later.',
      'RATE_LIMIT_HOURLY',
      429,
    );
  }

  const latestActive = await prisma.otpCode.findFirst({
    where: {
      phone: normalizedPhone,
      purpose: input.purpose,
      consumedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (latestActive) {
    const elapsedMs = now.getTime() - latestActive.createdAt.getTime();
    const cooldownRemainingMs = OTP_RESEND_COOLDOWN_MS - elapsedMs;

    if (cooldownRemainingMs > 0) {
      throw new OtpError(
        `Please wait ${Math.ceil(
          cooldownRemainingMs / 1000,
        )} seconds before requesting another OTP.`,
        'COOLDOWN',
        429,
        { cooldownSec: Math.ceil(cooldownRemainingMs / 1000) },
      );
    }
  }

  const code = generateOtpCode();
  const codeHash = await hashOtp(code);
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

  await prisma.otpCode.updateMany({
    where: {
      phone: normalizedPhone,
      purpose: input.purpose,
      consumedAt: null,
    },
    data: {
      consumedAt: now,
    },
  });

  await prisma.otpCode.create({
    data: {
      phone: normalizedPhone,
      purpose: input.purpose,
      codeHash,
      expiresAt,
      attempts: 0,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });

  return {
    code,
    phone: normalizedPhone,
    purpose: input.purpose,
    expiresAt,
    expiresInSec: Math.floor((expiresAt.getTime() - now.getTime()) / 1000),
    cooldownSec: OTP_RESEND_COOLDOWN_SEC,
  };
}

export async function requestOtp(input: RequestOtpInput) {
  const created = await createOtp(input);

  await sendOtpSms({
    phone: created.phone,
    code: created.code,
    purpose: created.purpose,
    recipientName: input.recipientName,
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
  const normalizedPhone = normalizePhone(input.phone);

  if (!input.phone) {
    return { ok: false, reason: 'invalid_phone' };
  }

  if (!normalizedPhone) {
    return { ok: false, reason: 'invalid_format' };
  }

  const code = String(input.code || '').trim();

  if (!/^\d{4,8}$/.test(code)) {
    return { ok: false, reason: 'invalid_format' };
  }

  const now = new Date();

  const otp = await prisma.otpCode.findFirst({
    where: {
      phone: normalizedPhone,
      purpose: input.purpose,
      consumedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp) {
    return { ok: false, reason: 'no_active_otp' };
  }

  if (otp.expiresAt.getTime() <= now.getTime()) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumedAt: now },
    });
    return { ok: false, reason: 'expired' };
  }

  if ((otp.attempts ?? 0) >= OTP_MAX_ATTEMPTS) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumedAt: now },
    });
    return { ok: false, reason: 'max_attempts' };
  }

  const matches = await bcrypt.compare(code, otp.codeHash);

  if (!matches) {
    const nextAttempts = (otp.attempts ?? 0) + 1;

    await prisma.otpCode.update({
      where: { id: otp.id },
      data: {
        attempts: nextAttempts,
        consumedAt: nextAttempts >= OTP_MAX_ATTEMPTS ? now : null,
      },
    });

    return {
      ok: false,
      reason:
        nextAttempts >= OTP_MAX_ATTEMPTS ? 'max_attempts' : 'wrong_code',
    };
  }

  await prisma.otpCode.update({
    where: { id: otp.id },
    data: {
      consumedAt: now,
    },
  });

  return {
    ok: true,
    phone: normalizedPhone,
    purpose: input.purpose,
  };
}
