// JWT-based auth — works without external auth providers
// In production, swap for NextAuth.js with Email + Google + Apple OAuth + Phone OTP
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

const rawSecret = process.env.AUTH_SECRET || '';
if (process.env.NODE_ENV === 'production' && rawSecret.length < 32) {
  // Fail loudly instead of silently using the dev fallback in prod.
  throw new Error('AUTH_SECRET is missing or too short in production (need >= 32 chars).');
}
const secret = new TextEncoder().encode(
  rawSecret || 'neejee-dev-secret-change-in-production-please'
);

export type SessionUser = {
  id: string;
  email: string;
  name?: string;
  role:
    | 'CUSTOMER'
    | 'ADMIN' | 'SUPER_ADMIN'
    | 'SELLER' | 'SELLER_STAFF'
    | 'QC_TEAM' | 'CONTENT_EDITOR'
    | 'VENDOR' | 'VENDOR_STAFF'
    | 'FINANCE' | 'FINANCE_OPERATOR'
    | 'MARKETING_OPERATOR' | 'MARKETING_MANAGER';
};

export async function signSession(user: SessionUser): Promise<string> {
  return await new SignJWT(user as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret);
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const token = cookies().get('neejee-session')?.value;
  if (!token) return null;
  // IMPORTANT: do NOT delete the cookie on verify failure here.
  // (We previously did, which caused users to be silently logged out mid-session
  // when a transient JWT verify hiccup occurred. The client/logout flow is the
  // only place that should ever clear the session cookie.)
  return await verifySession(token);
}

export async function setSessionCookie(user: SessionUser) {
  const token = await signSession(user);
  cookies().set('neejee-session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
}

export async function clearSession() {
  cookies().delete('neejee-session');
}

export const hashPassword = (pwd: string) => bcrypt.hash(pwd, 12);
export const verifyPassword = (pwd: string, hash: string) => bcrypt.compare(pwd, hash);

export function requireRole(user: SessionUser | null, roles: SessionUser['role'][]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}
