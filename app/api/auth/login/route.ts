import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '@/lib/auth';
import { requestOtp, OtpError } from '@/lib/otp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const ADMIN_ROLES = new Set([
  'ADMIN',
  'SUPER_ADMIN',
  'CONTENT_EDITOR',
  'QC_TEAM',
  'FINANCE',
  'FINANCE_OPERATOR',
  'MARKETING_OPERATOR',
  'MARKETING_MANAGER',
  'TELECALLER',
]);

const LOGIN_FAILURE_LIMIT = 12;
const LOGIN_WINDOW_SECONDS = 15 * 60;
const LOGIN_LOCK_SECONDS = 15 * 60;

type LoginThrottleStatus = {
  allowed: boolean;
  retry_after: number;
};

function isAdminSideRole(role: unknown): role is string {
  return typeof role === 'string' && ADMIN_ROLES.has(role);
}

function redirectFor(role: string) {
  if (isAdminSideRole(role)) return '/admin';
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
  // Prisma serialises JavaScript integer parameters as bigint. The private
  // throttle functions intentionally accept PostgreSQL integer, so cast the
  // numeric bind explicitly at the SQL boundary.
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
  await prisma.$queryRaw`
    select private.clear_auth_login_failures(${keyHash})
  `;
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

    if (isAdminSideRole(role) && admin2FAEnabled()) {
      if (!user.phone) {
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

        return NextResponse.json({
          ok: true,
          requires2FA: true,
          role,
          email: user.email,
          maskedPhone,
          phoneMasked: maskedPhone,
          redirect: redirectFor(role),
        });
      } catch (error) {
        if (error instanceof OtpError) {
          if (
            error.status === 429 ||
            error.code === 'COOLDOWN' ||
            error.code === 'RATE_LIMIT_HOURLY'
          ) {
            return NextResponse.json({
              ok: true,
              requires2FA: true,
              role,
              email: user.email,
              maskedPhone,
              phoneMasked: maskedPhone,
              redirect: redirectFor(role),
              info: error.message,
            });
          }

          return NextResponse.json(
            { error: error.message || 'Unable to send the security code right now.' },
            { status: error.status || 500 },
          );
        }

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
      role,
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
