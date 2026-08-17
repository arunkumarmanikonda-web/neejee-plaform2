import crypto from 'crypto';

const DEFAULT_TTL_SECONDS = 10 * 24 * 60 * 60;

function secret(): string {
  const value = process.env.CART_RECOVERY_SECRET || process.env.AUTH_SECRET || '';
  if (value.length < 32) {
    throw new Error('Cart recovery signing secret is not configured');
  }
  return value;
}

function signature(cartId: string, expiresAt: number): string {
  return crypto
    .createHmac('sha256', secret())
    .update(`neejee-cart-recovery:v1:${cartId}:${expiresAt}`)
    .digest('base64url');
}

export function createRecoveryRef(
  cartId: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): string {
  const id = String(cartId || '').trim();
  if (!id || id.includes('.')) throw new Error('Invalid recovery cart id');
  const expiresAt = Math.floor(Date.now() / 1000) + Math.max(300, ttlSeconds);
  return `${id}.${expiresAt}.${signature(id, expiresAt)}`;
}

export function verifyRecoveryRef(value: string): {
  ok: boolean;
  cartId?: string;
  expiresAt?: number;
  reason?: 'invalid' | 'expired' | 'signature';
} {
  const raw = String(value || '').trim();
  const parts = raw.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'invalid' };

  const [cartId, expRaw, suppliedSignature] = parts;
  const expiresAt = Number(expRaw);
  if (!cartId || !Number.isSafeInteger(expiresAt) || expiresAt <= 0 || !suppliedSignature) {
    return { ok: false, reason: 'invalid' };
  }
  if (expiresAt < Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: 'expired' };
  }

  const expected = signature(cartId, expiresAt);
  const supplied = String(suppliedSignature);
  if (expected.length !== supplied.length) return { ok: false, reason: 'signature' };

  const valid = crypto.timingSafeEqual(
    Buffer.from(expected, 'utf8'),
    Buffer.from(supplied, 'utf8'),
  );
  if (!valid) return { ok: false, reason: 'signature' };

  return { ok: true, cartId, expiresAt };
}
