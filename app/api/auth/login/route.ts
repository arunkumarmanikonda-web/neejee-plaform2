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
]);

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
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 },
      );
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);

    if (!passwordOk) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 },
      );
    }

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
