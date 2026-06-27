import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { setSessionCookie, verifyPassword } from '@/lib/auth';
import { requestOtp } from '@/lib/otp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Helper: where should this role land after login?
function redirectFor(role: string): string {
  if (['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR', 'QC_TEAM'].includes(role)) {
    return '/admin';
  }
  if (role === 'SELLER') return '/seller';
  return '/account';
}

// v23.37: Admin 2FA gate.
// When ADMIN_2FA_ENABLED=true, ADMIN/SUPER_ADMIN users with a registered phone
// must complete an OTP step before the session cookie is set. Returns
// { requires2FA: true, phoneMask } and triggers an SMS; client posts to
// /api/auth/login/2fa with { email, password, code } to complete.
function adminNeeds2FA(role: string): boolean {
  if (process.env.ADMIN_2FA_ENABLED !== 'true') return false;
  if (!process.env.FAST2SMS_API_KEY) return false; // can't send OTP, fail-open
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return '*'.repeat(Math.max(0, digits.length - 4)) + digits.slice(-4);
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

  // Try DB authentication first
  if (process.env.DATABASE_URL) {
    try {
      const user = await prisma.user.findUnique({ where: { email } });

      if (user && user.passwordHash && await verifyPassword(password, user.passwordHash)) {
        // v23.37: Admin 2FA gate
        if (adminNeeds2FA(user.role)) {
          if (!user.phone) {
            return NextResponse.json({
              error: 'Admin 2FA is required but no phone number is registered on your account. Contact a SUPER_ADMIN to add one.',
            }, { status: 403 });
          }

          const otpResult = await requestOtp({
            phone: user.phone,
            purpose: 'admin_2fa',
          });

          if (!otpResult.ok) {
            return NextResponse.json({
              error: `Could not send 2FA code: ${otpResult.error}`,
            }, { status: 502 });
          }

          return NextResponse.json({
            requires2FA: true,
            phoneMask: maskPhone(user.phone),
            expiresInSec: otpResult.expiresInSec,
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
          redirect: redirectFor(user.role),
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
        });
      }
    } catch (error) {
      console.error('Login route DB auth error', error);
    }
  }

  if (email === 'admin@neejee.com' && password === 'admin123') {
    return NextResponse.json({ error: 'Restricted admin login path is disabled in Phase 1.' }, { status: 403 });
  }

  return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
}
