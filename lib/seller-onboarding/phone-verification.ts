import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { normalizePhone } from '@/lib/otp';

export const SELLER_PHONE_VERIFICATION_COOKIE = 'neejee_seller_phone_verified';
export const SELLER_PHONE_VERIFICATION_TTL_SEC = 2 * 60 * 60;

type SellerPhoneProofPayload = {
  phone: string;
  exp: number;
  nonce: string;
  purpose: 'seller-application';
};

function signingKey(): Buffer {
  const source =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.DATABASE_URL ||
    '';

  if (!source) {
    throw new Error('Seller phone verification signing key is not configured');
  }

  return createHash('sha256')
    .update(`neejee:seller-phone-verification:${source}`)
    .digest();
}

function sign(encodedPayload: string): string {
  return createHmac('sha256', signingKey())
    .update(encodedPayload)
    .digest('base64url');
}

export function issueSellerPhoneVerificationProof(phoneInput: string): {
  token: string;
  expiresAt: Date;
} {
  const phone = normalizePhone(phoneInput);
  if (!phone) throw new Error('Invalid mobile number');

  const expiresAt = new Date(Date.now() + SELLER_PHONE_VERIFICATION_TTL_SEC * 1000);
  const payload: SellerPhoneProofPayload = {
    phone,
    exp: Math.floor(expiresAt.getTime() / 1000),
    nonce: randomUUID(),
    purpose: 'seller-application',
  };

  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return {
    token: `${encoded}.${sign(encoded)}`,
    expiresAt,
  };
}

export function verifySellerPhoneVerificationProof(
  token: string | null | undefined,
  expectedPhoneInput: string,
): { ok: true; phone: string } | { ok: false; reason: string } {
  const expectedPhone = normalizePhone(expectedPhoneInput);
  if (!expectedPhone) return { ok: false, reason: 'invalid_phone' };
  if (!token) return { ok: false, reason: 'missing_verification' };

  const [encoded, providedSignature, ...rest] = String(token).split('.');
  if (!encoded || !providedSignature || rest.length) {
    return { ok: false, reason: 'invalid_verification' };
  }

  const expectedSignature = sign(encoded);
  const a = Buffer.from(providedSignature, 'utf8');
  const b = Buffer.from(expectedSignature, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'invalid_verification' };
  }

  let payload: SellerPhoneProofPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'invalid_verification' };
  }

  if (payload.purpose !== 'seller-application') {
    return { ok: false, reason: 'invalid_verification' };
  }
  if (payload.phone !== expectedPhone) {
    return { ok: false, reason: 'phone_changed' };
  }
  if (!Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: 'verification_expired' };
  }

  return { ok: true, phone: expectedPhone };
}

export function readCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const prefix = `${name}=`;
  for (const part of cookieHeader.split(';')) {
    const item = part.trim();
    if (item.startsWith(prefix)) {
      try {
        return decodeURIComponent(item.slice(prefix.length));
      } catch {
        return item.slice(prefix.length);
      }
    }
  }
  return null;
}
