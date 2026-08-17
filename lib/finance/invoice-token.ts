// Deterministic per-order invoice token for secure guest invoice links.
// Keep the existing token format for backward compatibility, but never fall
// back to a known secret and always verify using a timing-safe comparison.
import { createHash, timingSafeEqual } from 'crypto';

function invoiceSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || '';
  if (secret.length < 32) {
    throw new Error('Invoice token secret is not configured');
  }
  return secret;
}

export function invoiceTokenFor(orderId: string): string {
  const id = String(orderId || '').trim();
  if (!id) throw new Error('Order id is required for invoice token');
  return createHash('sha256')
    .update(`invoice:${id}:${invoiceSecret()}`)
    .digest('hex')
    .slice(0, 24);
}

export function verifyInvoiceToken(orderId: string, suppliedToken: string): boolean {
  try {
    const supplied = String(suppliedToken || '').trim();
    const expected = invoiceTokenFor(orderId);
    if (supplied.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(supplied, 'utf8'), Buffer.from(expected, 'utf8'));
  } catch {
    return false;
  }
}
