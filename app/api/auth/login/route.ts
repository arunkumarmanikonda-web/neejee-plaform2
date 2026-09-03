import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import {
  clearAdminMfaChallenge,
  createAdminMfaChallenge,
  isPrivilegedRole,
  setSessionCookie,
  type SessionRole,
} from '@/lib/auth';
import { requestOtp, OtpError } from '@/lib/otp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const LOGIN_FAILURE_LIMIT = 12;
const LOGIN_WINDOW_SECONDS = 15 * 60;
const LOGIN_LOCK_SECONDS = 15 * 60;

type LoginThrottleStatus = {
  allowed: boolean;
  retry_after: number;
};

function redirectFor(role: string) {
  if (isPrivilegedRole(role)) return '/admin';
  if (role === 'SELLER') return '/seller';
  return '/account';
}

function parseBooleanFlag(value: string | undefined): boolean | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return null;
}

function admin2FAEnabled() {
  // Privileged production access is never allowed to bypass MFA via config.
  if (process.env.NODE_ENV === 'production') return true;

  const explicit = parseBooleanFlag(process.env.ADMIN_2FA_ENABLED);
  if (explicit !== null) return explicit;
  return true;
}

function firstForwardedIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
}

function maskPhone(phone: string | null | undefined) {
  const raw = String(phone || '').trim();
  if (!raw) return '';

  const plus = raw.startsWith('+') ? '+' : '';
  const digits = raw.replace(/\D/g, '');

  if (digits.length <= 4) return `${plus}${digits}`;
  if (digits.length <= 6) {
    return `${plus}${'*'.repeat(Math.max(digits.length - 2, 0))}${digits.slice(-2)}`;
  }

  const last4 = digits.slice(-4);
  const visiblePrefix = digits.length > 10 ? digits.slice(0, digits.length - 10) : '';
  const maskedLocal = '*'.repeat(Math.max(digits.length - visiblePrefix.length - 4, 0));

  return `${plus}${visiblePrefix}${maskedLocal}${last4}`;
}

function loginThrottleKey(email: string) {
  return createHash('sha256').update(`neejee-login:${email}`, 'utf8').digest('hex');
}

async function getLoginThrottleStatus(keyHash: string): Promise<LoginThrottleStatus> {
  const rows = await prisma.$queryRaw<LoginThrottleStatus[]>`
    select allowed, retry_after
    from private.auth_login_rate_status(${keyHash}, ${LOGIN_WINDOW_SECONDS}::integer)
  `;
  return rows[0] || { allowed: true, retry_after: 0 };
}

async function recordLoginFailure(keyHash: string) {
  await prisma.$queryRaw`
    select allowed, retry_after, attempts
    from private.record_auth_login_failure(
      ${keyHash},
      ${LOGIN_FAILURE_LIMIT}::integer,
      ${LOGIN_WINDOW_SECONDS}::integer,
      ${LOGIN_LOCK_SECONDS}::integer
    )
  `;
}

async function clearLoginFailures(keyHash: string) {
  // PostgreSQL function returns void. Cast it to text so Prisma can safely
  // deserialize the SELECT result instead of throwing P2010 on successful login.
  await prisma.$queryRaw`
    select private.clear_auth_login_failures(${keyHash})::text as cleared
  `;
}

async function issueAdminMfaChallenge(user: {
  id: string;
  email: string | null;
  role: string;
}) {
  if (!user.email || !isPrivilegedRole(user.role)) {
    throw new Error('Cannot issue an admin MFA challenge for this account.');
  }

  await createAdminMfaChallenge({
    userId: user.id,
    email: user.email.toLowerCase(),
    role: user.role as SessionRole,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 },
      );
    }

    const email = parsed.data.email.trim().toLowerCase();
    const password = parsed.data.password;
    const throttleKey = loginThrottleKey(email);
    const throttle = await getLoginThrottleStatus(throttleKey);

    if (!throttle.allowed) {
      const retryAfter = Math.max(1, Number(throttle.retry_after) || LOGIN_LOCK_SECONDS);
      return NextResponse.json(
        { error: 'Too many sign-in attempts. Please wait and try again.' },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) },
        },
      );
    }

    const user = await prisma.user.findFirst({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        passwordHash: true,
        phone: true,
      },
    });

    if (!user || !user.passwordHash) {
      await recordLoginFailure(throttleKey);
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 },
      );
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);

    if (!passwordOk) {
      await recordLoginFailure(throttleKey);
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 },
      );
    }

    await clearLoginFailures(throttleKey);

    const role = user.role;

    if (isPrivilegedRole(role) && admin2FAEnabled()) {
      if (!user.phone) {
        clearAdminMfaChallenge();
        return NextResponse.json(
          { error: 'Admin account does not have a phone number configured' },
          { status: 400 },
        );
      }

      const maskedPhone = maskPhone(user.phone);

      try {
        await requestOtp({
          phone: user.phone,
          purpose: 'admin_2fa',
          ipAddress: firstForwardedIp(request),
          userAgent: request.headers.get('user-agent'),
        });
        await issueAdminMfaChallenge(user);

        return NextResponse.json({
          ok: true,
          requires2FA: true,
          role,
          email: user.email,
          maskedPhone,
          phoneMasked: maskedPhone,
          phoneMask: maskedPhone,
          redirect: redirectFor(role),
        });
      } catch (error) {
        if (error instanceof OtpError) {
          if (
            error.status === 429 ||
            error.code === 'COOLDOWN' ||
            error.code === 'RATE_LIMIT_HOURLY'
          ) {
            // A usable OTP may already exist. Bind this newly verified password
            // ceremony to a fresh, short-lived signed MFA challenge.
            await issueAdminMfaChallenge(user);

            return NextResponse.json({
              ok: true,
              requires2FA: true,
              role,
              email: user.email,
              maskedPhone,
              phoneMasked: maskedPhone,
              phoneMask: maskedPhone,
              redirect: redirectFor(role),
              info: error.message,
            });
          }

          clearAdminMfaChallenge();
          return NextResponse.json(
            { error: error.message || 'Unable to send the security code right now.' },
            { status: error.status || 500 },
          );
        }

        clearAdminMfaChallenge();
        console.error('[auth/login] admin 2FA request failed', error);

        return NextResponse.json(
          { error: 'Unable to send the security code right now.' },
          { status: 500 },
        );
      }
    }

    await setSessionCookie({
      id: user.id,
      email: user.email || `${user.id}@neejee.local`,
      name: user.name || 'User',
      role: role as SessionRole,
      aal: 'aal1',
      amr: ['password'],
    });

    return NextResponse.json({
      ok: true,
      success: true,
      redirect: redirectFor(role),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role,
      },
    });
  } catch (error) {
    console.error('[auth/login] error', error);

    return NextResponse.json(
      { error: 'Unable to sign in right now' },
      { status: 500 },
    );
  }
}
