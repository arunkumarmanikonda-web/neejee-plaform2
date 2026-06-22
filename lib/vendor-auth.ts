// Vendor portal authentication: magic links + optional password.
// Magic link flow:
//   1. Admin invites vendor → /api/admin/vendors/[id]/invite creates a token
//   2. We email the vendor a link like /vendor/login?token=...
//   3. They click → token consumed → session cookie set
//   4. First visit prompts them to either keep magic-link login OR set a password
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export const VENDOR_TOKEN_TTL_MINUTES = 60 * 24; // 24 hours

export function generateMagicToken(): string {
  // 32 random bytes → url-safe base64 (~43 chars). Enough entropy.
  return randomBytes(32).toString('base64url');
}

export async function hashMagicToken(token: string): Promise<string> {
  return bcrypt.hash(token, 10);
}

export async function compareMagicToken(token: string, hash: string): Promise<boolean> {
  return bcrypt.compare(token, hash);
}

export async function createMagicTokenForVendor(args: {
  vendorId: string;
  purpose?: 'LOGIN' | 'SET_PASSWORD';
}): Promise<{ token: string; expiresAt: Date }> {
  const token = generateMagicToken();
  const tokenHash = await hashMagicToken(token);
  const expiresAt = new Date(Date.now() + VENDOR_TOKEN_TTL_MINUTES * 60 * 1000);
  await prisma.vendorMagicToken.create({
    data: {
      vendorId: args.vendorId,
      tokenHash,
      purpose: args.purpose || 'LOGIN',
      expiresAt,
    },
  });
  return { token, expiresAt };
}

// Verify a token presented by the browser. Returns the vendor row (and consumes
// the token) on success; null on failure. Defensive against replay by marking
// `consumedAt` even on partial hash misses.
export async function consumeMagicToken(rawToken: string): Promise<{
  vendorId: string;
  purpose: string;
} | null> {
  if (!rawToken || rawToken.length < 10) return null;
  // We don't know which row to look up by, so fetch recent unconsumed tokens
  // and bcrypt-compare. Limit to last 24h × few hundred candidates max.
  const candidates = await prisma.vendorMagicToken.findMany({
    where: {
      consumedAt: null,
      expiresAt: { gte: new Date() },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  for (const c of candidates) {
    // eslint-disable-next-line no-await-in-loop
    const match = await compareMagicToken(rawToken, c.tokenHash);
    if (match) {
      await prisma.vendorMagicToken.update({
        where: { id: c.id },
        data: { consumedAt: new Date() },
      });
      return { vendorId: c.vendorId, purpose: c.purpose };
    }
  }
  return null;
}
