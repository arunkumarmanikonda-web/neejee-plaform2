import crypto from 'crypto';

const MAX_MEDIA_URL_LIFETIME_SECONDS = 2 * 60 * 60;

function signingSecret(): string {
  const secret = process.env.AI_MEDIA_SIGNING_SECRET || process.env.AUTH_SECRET || '';
  if (secret.length < 32) throw new Error('AI media signing secret is not configured');
  return secret;
}

function cleanPath(value: string): string {
  const path = String(value || '').trim().replace(/^\/+/, '');
  if (!path || path.includes('..') || path.includes('\\') || path.includes('\0')) {
    throw new Error('Invalid AI media path');
  }
  return path;
}

function signatureFor(path: string, expires: number): string {
  return crypto
    .createHmac('sha256', signingSecret())
    .update(`${path}\n${expires}`, 'utf8')
    .digest('base64url');
}

export function createPrivateAiMediaUrl(
  origin: string,
  filePath: string,
  lifetimeSeconds = MAX_MEDIA_URL_LIFETIME_SECONDS,
): string {
  const path = cleanPath(filePath);
  const ttl = Math.max(60, Math.min(MAX_MEDIA_URL_LIFETIME_SECONDS, Math.floor(lifetimeSeconds)));
  const expires = Math.floor(Date.now() / 1000) + ttl;
  const sig = signatureFor(path, expires);
  const url = new URL('/api/ai/media', origin);
  url.searchParams.set('path', path);
  url.searchParams.set('expires', String(expires));
  url.searchParams.set('sig', sig);
  return url.toString();
}

export function verifyPrivateAiMediaRequest(url: URL): { ok: true; path: string } | { ok: false; reason: string } {
  try {
    const path = cleanPath(url.searchParams.get('path') || '');
    const expires = Number(url.searchParams.get('expires'));
    const supplied = String(url.searchParams.get('sig') || '');
    const now = Math.floor(Date.now() / 1000);

    if (!Number.isInteger(expires) || expires <= now) return { ok: false, reason: 'expired' };
    if (expires - now > MAX_MEDIA_URL_LIFETIME_SECONDS + 60) return { ok: false, reason: 'invalid_expiry' };

    const expected = signatureFor(path, expires);
    if (supplied.length !== expected.length) return { ok: false, reason: 'invalid_signature' };
    if (!crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
      return { ok: false, reason: 'invalid_signature' };
    }
    return { ok: true, path };
  } catch {
    return { ok: false, reason: 'invalid_request' };
  }
}
