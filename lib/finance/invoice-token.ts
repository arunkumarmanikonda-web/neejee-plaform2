// v23.40.18.1 — Deterministic per-order invoice token.
// Used in order-confirmation emails so guests can access their invoice via
// a secure, unguessable URL without needing to sign in.
//
// Safe to put in email links: derived from AUTH_SECRET, doesn't expire,
// can't be brute-forced without the server secret.

import { createHash } from 'crypto';

export function invoiceTokenFor(orderId: string): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'neejee-fallback';
  return createHash('sha256').update(`invoice:${orderId}:${secret}`).digest('hex').slice(0, 24);
}
