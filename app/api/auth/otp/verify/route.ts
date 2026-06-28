import { NextResponse } from 'next/server';
import { verifyOtp, normalizePhone } from '@/lib/auth/otp';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type NormalizedPurpose = 'login' | 'signup';

function normalizePurpose(value: unknown): NormalizedPurpose {
  const raw = String(value || 'login').trim().toLowerCase();

  if (raw === 'signup' || raw === 'signup_customer') return 'signup';
  return 'login';
}

function buildSessionEmail(user: any, normalizedPhone: string): string {
  if (user?.email && typeof user.email === 'string' && user.email.includes('@')) {
    return user.email;
  }
  const digits = normalizedPhone.replace(/\D/g, '');
  return `phone-${digits}@otp.neejee.local`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const phone = String(body?.phone || '');
    const code = String(body?.code || '');
    const purpose = normalizePurpose(body?.purpose);
    const name = body?.name ? String(body.name).trim() : null;
    const email = body?.email ? String(body.email).trim().toLowerCase() : null;

    if (!phone || !code) {
      return NextResponse.json({ ok: false, error: 'Phone and code required' }, { status: 400 });
    }

    const normalized = normalizePhone(phone);
    const result = await verifyOtp({ phone: normalized, code, purpose });

    if (!result.ok) {
      const messages: Record<string, string> = {
        invalid_format: 'OTP must be 6 digits.',
        no_active_otp: 'No OTP found. Please request a new one.',
        expired: 'This OTP has expired. Please request a new one.',
        wrong_code: 'Incorrect OTP. Please try again.',
        max_attempts: 'Too many attempts. Please request a new OTP.',
      };

      return NextResponse.json(
        {
          ok: false,
          error: messages[result.reason] || 'OTP verification failed',
          code: result.reason.toUpperCase(),
        },
        { status: 401 }
      );
    }

    let user: any;

    if (purpose === 'signup') {
      const dupe = await prisma.user.findFirst({
        where: { phone: normalized },
        select: { id: true },
      });

      if (dupe) {
        return NextResponse.json(
          {
            ok: false,
            error: 'An account already exists with this number. Please log in instead.',
            code: 'USER_EXISTS',
          },
          { status: 409 }
        );
      }

      user = await prisma.user.create({
        data: {
          phone: normalized,
          phoneVerified: true,
          phoneVerifiedAt: new Date(),
          primaryAuthMethod: 'phone',
          name: name || null,
          email: email || null,
          role: 'CUSTOMER',
        } as any,
      });
    } else {
      user = await prisma.user.findFirst({
        where: { phone: normalized },
      });

      if (!user) {
        return NextResponse.json(
          {
            ok: false,
            error: 'No account found with this number. Please sign up.',
            code: 'NO_USER',
          },
          { status: 404 }
        );
      }

      if (!(user as any).phoneVerified) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { phoneVerified: true, phoneVerifiedAt: new Date() } as any,
        });
      }
    }

    await setSessionCookie({
      id: user.id,
      email: buildSessionEmail(user, normalized),
      name: user.name || undefined,
      role: ((user as any).role || 'CUSTOMER') as any,
    });

    const redirect = purpose === 'signup' ? '/account/welcome' : '/account';

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: (user as any).phone,
        role: (user as any).role,
      },
      redirect,
      redirectTo: redirect,
    });
  } catch (e: any) {
    console.error('[otp.verify]', e);
    return NextResponse.json({ ok: false, error: e.message || 'Server error' }, { status: 500 });
  }
}
