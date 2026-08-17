import { timingSafeEqual } from 'crypto';

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

export function webhookSecretConfigured(secret: string | undefined): boolean {
  return String(secret || '').length >= 32;
}

/**
 * Provider-neutral secret check for webhook products that do not provide a
 * cryptographic payload signature. Supports a dedicated header, Bearer auth,
 * or a `?token=` callback URL parameter so the provider dashboard can use the
 * mechanism it supports.
 */
export function verifySharedWebhookSecret(
  request: Request,
  secret: string | undefined,
  headerName = 'x-neejee-webhook-token',
): boolean {
  const expected = String(secret || '');
  if (!webhookSecretConfigured(expected)) return false;

  const url = new URL(request.url);
  const auth = request.headers.get('authorization') || '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const header = request.headers.get(headerName) || '';
  const token = url.searchParams.get('token') || '';

  return [header, bearer, token].some((candidate) => safeEqual(candidate, expected));
}

/** Shiprocket officially sends the configured webhook security token as x-api-key. */
export function verifyShiprocketWebhook(request: Request): boolean {
  const expected = String(process.env.SHIPROCKET_WEBHOOK_TOKEN || '');
  if (!webhookSecretConfigured(expected)) return false;
  return safeEqual(request.headers.get('x-api-key') || '', expected);
}
