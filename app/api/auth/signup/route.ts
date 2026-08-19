import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { setSessionCookie, hashPassword } from '@/lib/auth';
import {
  assertNewPasswordIsSafe,
  PasswordSecurityError,
} from '@/lib/password-security';
import { sendEmail, welcomeEmail } from '@/lib/email';
import { generateWelcomeCoupon } from '@/lib/welcome-coupon';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Phone validation: E.164-ish — starts with +, followed by 7-15 digits
const SignupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().regex(/^\+\d{7,15}$/, 'Invalid phone format'),
  password: z.string().min(8).max(128),
  marketingConsent: z.boolean().optional().default(false),
  smsOptIn: z.boolean().optional().default(false),
  whatsappOptIn: z.boolean().optional().default(false),
  referralCode: z.string().optional(),
});

// Development-only fallback for local work without a database.
const memoryUsers: Record<string, any> = {};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const {
    name,
    phone,
    password,
    marketingConsent,
    smsOptIn,
    whatsappOptIn,
    referralCode,
  } = parsed.data;
  const email = parsed.data.email.trim().toLowerCase();

  try {
    await assertNewPasswordIsSafe(password);
  } catch (error) {
    if (error instanceof PasswordSecurityError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === 'PASSWORD_CHECK_UNAVAILABLE' ? 503 : 400 },
      );
    }

    console.error('[signup] password security check failed', error);
    return NextResponse.json(
      { error: 'We could not safely validate this password right now. Please try again.' },
      { status: 503 },
    );
  }

  if (process.env.DATABASE_URL) {
    try {
      const existing = await prisma.user.findFirst({
        where: { OR: [{ email }, { phone }] },
      });
      if (existing) {
        return NextResponse.json({
          error: existing.email === email ? 'Email already registered' : 'Phone already registered',
        }, { status: 409 });
      }
      const passwordHash = await hashPassword(password);

      // Resolve referrer (if a valid code was given)
      let referrerId: string | null = null;
      let referralRow: any = null;
      if (referralCode) {
        const cleanCode = String(referralCode).toUpperCase().trim();
        const referrer = await prisma.user.findFirst({
          where: { referralCode: cleanCode, role: 'CUSTOMER' },
          select: { id: true },
        });
        if (referrer) referrerId = referrer.id;
      }

      // Create the user first — we need the id to bind the coupon
      const user = await prisma.user.create({
        data: {
          name,
          email,
          phone,
          passwordHash,
          role: 'CUSTOMER',
          marketingConsent,
          smsOptIn,
          whatsappOptIn,
          emailOptIn: true,
          referredById: referrerId,
        },
      });

      // Create Referral record (PENDING until first qualified order)
      if (referrerId && referralCode) {
        referralRow = await prisma.referral.create({
          data: {
            referrerId,
            refereeId: user.id,
            refereeEmail: email,
            code: String(referralCode).toUpperCase().trim(),
            status: 'PENDING',
          },
        }).catch(() => null);
      }
      void referralRow;

      // Auto-generate this user's own referral code
      try {
        const { ensureReferralCode } = await import('@/lib/loyalty');
        await ensureReferralCode(user.id);
      } catch {}

      // Generate per-user welcome coupon bound to this user's id
      let welcomeCode: string | undefined;
      const coupon = await generateWelcomeCoupon(name, user.id).catch(() => null);
      if (coupon) {
        welcomeCode = coupon.code;
        await prisma.user.update({
          where: { id: user.id },
          data: { welcomeCouponId: coupon.id },
        }).catch(() => {});
      }

      await setSessionCookie({
        id: user.id,
        email: user.email,
        name: user.name || undefined,
        role: user.role as any,
        aal: 'aal1',
        amr: ['password'],
      });

      sendEmail({
        to: user.email,
        subject: `Welcome to NEEJEE${welcomeCode ? ` — your code: ${welcomeCode}` : ''}`,
        html: welcomeEmail(user.name || '', welcomeCode),
      }).catch(e => console.warn('[signup] welcome email failed:', e.message));

      return NextResponse.json({
        success: true,
        user: { id: user.id, name: user.name, email: user.email },
        welcomeCode,
      });
    } catch (e: any) {
      console.error('[signup] database operation failed:', e?.message || e);

      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: 'Account creation is temporarily unavailable. Please try again.' },
          { status: 503 },
        );
      }
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.error('[signup] DATABASE_URL is missing in production');
    return NextResponse.json(
      { error: 'Account creation is temporarily unavailable. Please try again.' },
      { status: 503 },
    );
  }

  // Development-only memory fallback.
  if (memoryUsers[email]) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
  }
  const id = 'u_' + Math.random().toString(36).slice(2, 10);
  const passwordHash = await hashPassword(password);
  memoryUsers[email] = { id, name, email, phone, passwordHash };
  await setSessionCookie({
    id,
    email,
    name,
    role: 'CUSTOMER',
    aal: 'aal1',
    amr: ['password'],
  });
  return NextResponse.json({ success: true, user: { id, name, email }, source: 'memory' });
}
