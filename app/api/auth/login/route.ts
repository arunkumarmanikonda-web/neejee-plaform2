import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requestOtp } from '@/lib/otp';
import { setSessionCookie, verifyPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const ADMIN_ROLES = [
  'ADMIN',
  'SUPER_ADMIN',
  'CONTENT_EDITOR',
  'QC_TEAM',
  'FINANCE',
  'FINANCE_OPERATOR',
  'MARKETING_OPERATOR',
  'MARKETING_MANAGER',
] as const;

function isAdminSideRole(role: string): boolean {
  return ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number]);
}

function redirectFor(role: string): string {
  if (isAdminSideRole(role)) return '/admin';
  if (role === 'SELLER') return '/seller';
  return '/account';
}

function admin2FAEnabled(): boolean {
  const raw = (process.env.ADMIN_2FA_ENABLED || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function maskPhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  const last4 = digits.slice(-4);

  if (!last4) return phone;
  if (digits.startsWith('91') && digits.length >= 12) {
    return `+91 ******${last4}`;
  }
  if (digits.length >= 10) {
    return `******${last4}`;
  }
  return `***${last4}`;
}

function firstForwardedIp(headerValue: string | null): string | undefined {
  if (!headerValue) return undefined;
  return headerValue.split(',')[0]?.trim() || undefined;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const password = parsed.data.password;

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const passwordOk = await verifyPassword(password, user.passwordHash);
    if (!passwordOk) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const role = String(user.role);

    if (isAdminSideRole(role) && admin2FAEnabled()) {
      if (!user.phone) {
        return NextResponse.json(
          { error: 'Admin 2FA is enabled, but no phone number is configured for this account.' },
          { status: 403 }
        );
      }

      const otpResult = await requestOtp({
        phone: user.phone,
        purpose: 'admin_2fa',
        ipAddress: firstForwardedIp(request.headers.get('x-forwarded-for')),
        userAgent: request.headers.get('user-agent') || undefined,
      });

      if (!otpResult.ok) {
        const message = otpResult.error || 'Unable to send the security code right now.';

        if (/please wait/i.test(message)) {
          return NextResponse.json({
            ok: true,
            requires2FA: true,
            phoneMask: maskPhone(user.phone),
          });
        }

        return NextResponse.json({ error: message }, { status: 400 });
      }

      return NextResponse.json({
        ok: true,
        requires2FA: true,
        phoneMask: maskPhone(user.phone),
      });
    }

    await setSessionCookie({
      id: user.id,
      email: user.email,
      name: user.name || undefined,
      role: user.role as any,
    });

    return NextResponse.json({
      ok: true,
      redirect: redirectFor(role),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login route DB auth error', error);
    return NextResponse.json({ error: 'Unable to sign in right now' }, { status: 500 });
  }
}
