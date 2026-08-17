import { createHmac, timingSafeEqual } from 'crypto';

function normalizeEmail(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function unsubscribeSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || '';
  if (secret.length < 32) throw new Error('Marketing unsubscribe secret is not configured');
  return secret;
}

export function unsubscribeTokenFor(email: string): string {
  const normalized = normalizeEmail(email);
  if (!/^\S+@\S+\.\S+$/.test(normalized)) throw new Error('Valid email required');
  return createHmac('sha256', unsubscribeSecret())
    .update(`neejee-marketing-unsubscribe:v1:${normalized}`, 'utf8')
    .digest('base64url');
}

export function verifyUnsubscribeToken(email: string, suppliedToken: string): boolean {
  try {
    const expected = unsubscribeTokenFor(email);
    const supplied = String(suppliedToken || '').trim();
    if (supplied.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(supplied, 'utf8'), Buffer.from(expected, 'utf8'));
  } catch {
    return false;
  }
}

export function unsubscribeUrlFor(email: string): string {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://neejee.com').replace(/\/$/, '');
  const normalized = normalizeEmail(email);
  const url = new URL('/unsubscribe', base);
  url.searchParams.set('email', normalized);
  url.searchParams.set('token', unsubscribeTokenFor(normalized));
  return url.toString();
}
