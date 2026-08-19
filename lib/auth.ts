// JWT-based application auth. Privileged sessions carry explicit MFA assurance.
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

const rawSecret = process.env.AUTH_SECRET || '';
if (process.env.NODE_ENV === 'production' && rawSecret.length < 32) {
  throw new Error('AUTH_SECRET is missing or too short in production (need >= 32 chars).');
}

const secret = new TextEncoder().encode(
  rawSecret || 'neejee-dev-secret-change-in-production-please'
);

const SESSION_COOKIE = 'neejee-session';
const ADMIN_MFA_COOKIE = 'neejee-admin-mfa';
const CUSTOMER_SESSION_SECONDS = 60 * 60 * 24 * 30;
const PRIVILEGED_SESSION_SECONDS = 60 * 60 * 12;
const ADMIN_MFA_CHALLENGE_SECONDS = 60 * 10;

export type SessionRole =
  | 'CUSTOMER'
  | 'ADMIN' | 'SUPER_ADMIN'
  | 'SELLER' | 'SELLER_STAFF'
  | 'QC_TEAM' | 'CONTENT_EDITOR'
  | 'VENDOR' | 'VENDOR_STAFF'
  | 'FINANCE' | 'FINANCE_OPERATOR'
  | 'MARKETING_OPERATOR' | 'MARKETING_MANAGER'
  | 'TELECALLER';

export type AuthenticationMethod = 'password' | 'otp';
export type AuthenticatorAssuranceLevel = 'aal1' | 'aal2';

export type SessionUser = {
  id: string;
  email: string;
  name?: string;
  role: SessionRole;
  aal?: AuthenticatorAssuranceLevel;
  amr?: AuthenticationMethod[];
  mfaVerifiedAt?: string;
};

export type AdminMfaChallenge = {
  purpose: 'admin_2fa';
  userId: string;
  email: string;
  role: SessionRole;
  passwordVerifiedAt: string;
};

export const PRIVILEGED_ROLES: readonly SessionRole[] = [
  'ADMIN',
  'SUPER_ADMIN',
  'CONTENT_EDITOR',
  'QC_TEAM',
  'FINANCE',
  'FINANCE_OPERATOR',
  'MARKETING_OPERATOR',
  'MARKETING_MANAGER',
  'TELECALLER',
] as const;

const SESSION_ROLES = new Set<SessionRole>([
  'CUSTOMER',
  'ADMIN',
  'SUPER_ADMIN',
  'SELLER',
  'SELLER_STAFF',
  'QC_TEAM',
  'CONTENT_EDITOR',
  'VENDOR',
  'VENDOR_STAFF',
  'FINANCE',
  'FINANCE_OPERATOR',
  'MARKETING_OPERATOR',
  'MARKETING_MANAGER',
  'TELECALLER',
]);

const PRIVILEGED_ROLE_SET = new Set<SessionRole>(PRIVILEGED_ROLES);

export function isPrivilegedRole(role: unknown): role is SessionRole {
  return typeof role === 'string' && PRIVILEGED_ROLE_SET.has(role as SessionRole);
}

export function hasValidPrivilegedAssurance(user: SessionUser): boolean {
  if (user.aal !== 'aal2') return false;
  if (!Array.isArray(user.amr)) return false;
  if (!user.amr.includes('password') || !user.amr.includes('otp')) return false;
  if (!user.mfaVerifiedAt) return false;

  const verifiedAt = Date.parse(user.mfaVerifiedAt);
  if (!Number.isFinite(verifiedAt)) return false;

  return Date.now() - verifiedAt <= PRIVILEGED_SESSION_SECONDS * 1000;
}

function normaliseSession(user: SessionUser): SessionUser {
  const amr = Array.from(new Set(user.amr?.length ? user.amr : ['password'])) as AuthenticationMethod[];
  const aal = user.aal || (amr.includes('otp') ? 'aal2' : 'aal1');

  return {
    ...user,
    aal,
    amr,
  };
}

export async function signSession(user: SessionUser): Promise<string> {
  const normalised = normaliseSession(user);
  const privileged = isPrivilegedRole(normalised.role);

  return await new SignJWT(normalised as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('neejee')
    .setIssuedAt()
    .setExpirationTime(privileged ? '12h' : '30d')
    .sign(secret);
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { issuer: 'neejee' });

    if (
      typeof payload.id !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.role !== 'string' ||
      !SESSION_ROLES.has(payload.role as SessionRole)
    ) {
      return null;
    }

    const user = normaliseSession(payload as unknown as SessionUser);

    if (
      process.env.NODE_ENV === 'production' &&
      isPrivilegedRole(user.role) &&
      !hasValidPrivilegedAssurance(user)
    ) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return await verifySession(token);
}

export async function setSessionCookie(user: SessionUser) {
  const normalised = normaliseSession(user);
  const privileged = isPrivilegedRole(normalised.role);

  if (
    process.env.NODE_ENV === 'production' &&
    privileged &&
    !hasValidPrivilegedAssurance(normalised)
  ) {
    throw new Error('Refusing to issue a privileged production session without AAL2 assurance.');
  }

  const token = await signSession(normalised);
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: privileged ? PRIVILEGED_SESSION_SECONDS : CUSTOMER_SESSION_SECONDS,
    path: '/',
  });
}

export async function createAdminMfaChallenge(challenge: Omit<AdminMfaChallenge, 'purpose' | 'passwordVerifiedAt'>) {
  const payload: AdminMfaChallenge = {
    ...challenge,
    purpose: 'admin_2fa',
    passwordVerifiedAt: new Date().toISOString(),
  };

  const token = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('neejee')
    .setAudience('neejee-admin-mfa')
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(secret);

  cookies().set(ADMIN_MFA_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ADMIN_MFA_CHALLENGE_SECONDS,
    path: '/',
  });
}

export async function getAdminMfaChallenge(): Promise<AdminMfaChallenge | null> {
  const token = cookies().get(ADMIN_MFA_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: 'neejee',
      audience: 'neejee-admin-mfa',
    });

    if (
      payload.purpose !== 'admin_2fa' ||
      typeof payload.userId !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.role !== 'string' ||
      !isPrivilegedRole(payload.role) ||
      typeof payload.passwordVerifiedAt !== 'string'
    ) {
      return null;
    }

    return payload as unknown as AdminMfaChallenge;
  } catch {
    return null;
  }
}

export function clearAdminMfaChallenge() {
  cookies().delete(ADMIN_MFA_COOKIE);
}

export async function clearSession() {
  cookies().delete(SESSION_COOKIE);
  cookies().delete(ADMIN_MFA_COOKIE);
}

export const hashPassword = (pwd: string) => bcrypt.hash(pwd, 12);
export const verifyPassword = (pwd: string, hash: string) => bcrypt.compare(pwd, hash);

export function requireRole(user: SessionUser | null, roles: SessionRole[]): boolean {
  if (!user) return false;
  if (!roles.includes(user.role)) return false;

  if (
    process.env.NODE_ENV === 'production' &&
    isPrivilegedRole(user.role) &&
    !hasValidPrivilegedAssurance(user)
  ) {
    return false;
  }

  return true;
}
