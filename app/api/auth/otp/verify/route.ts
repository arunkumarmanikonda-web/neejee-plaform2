import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '@/lib/auth';
import { normalizePhone, verifyOtp } from '@/lib/otp';
import type { OtpPurpose } from '@/lib/otp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  phone: z.string().min(1, 'Phone is required'),
  code: z.string().trim().regex(/^\d{4,8}$/, 'Invalid OTP format'),
  purpose: z.string().optional(),
  name: z.string().optional(),
  email: z.string().optional(),
});

type PublicOtpPurpose =
  | 'login_customer'
  | 'login_vendor'
  | 'login_seller'
  | 'signup'
  | 'signup_customer'
  | 'checkout_guest';

function normalizePurpose(value?: string | null): PublicOtpPurpose | 'admin_2fa' | 'change_phone' {
  const raw = String(value || '').trim().toLowerCase();

  switch (raw) {
    case 'signup':
      return 'signup';
    case 'signup_customer':
      return 'signup_customer';
    case 'login_vendor':
      return 'login_vendor';
    case 'login_seller':
      return 'login_seller';
    case 'admin_2fa':
      return 'admin_2fa';
    case 'checkout_guest':
      return 'checkout_guest';
    case 'change_phone':
      return 'change_phone';
    case 'login_customer':
    case 'login':
    default:
      return 'login_customer';
  }
}

function expectedRolesForPurpose(purpose: PublicOtpPurpose): string[] | null {
  switch (purpose) {
    case 'login_customer':
      return ['CUSTOMER'];
    case 'login_vendor':
      return ['VENDOR', 'VENDOR_STAFF'];
    case 'login_seller':
      return ['SELLER', 'SELLER_STAFF'];
    default:
      return null;
  }
}

function fallbackEmailForPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return `${digits}@phone.neejee.com`;
}

function normalizeOptionalEmail(value?: string) {
  const email = String(value || '').trim().toLowerCase();
  return email || null;
}

function normalizeOptionalName(value?: string) {
  const name = String(value || '').trim();
  return name || null;
}

function isPlaceholderEmail(email?: string | null, phone?: string | null) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return true;

  if (/^user_\d+@neejee\.local$/.test(normalized)) return true;
  if (/^\d+@phone\.neejee\.com$/.test(normalized)) return true;

  const digits = String(phone || '').replace(/\D/g, '');
  if (digits) {
    if (normalized === `user_${digits}@neejee.local`) return true;
    if (normalized === `${digits}@phone.neejee.com`) return true;
  }

  return false;
}

function needsProfileCompletion(
  user: { email?: string | null; name?: string | null; phone?: string | null },
  purpose: PublicOtpPurpose,
) {
  if (purpose === 'signup' || purpose === 'signup_customer') return true;

  const name = String(user.name || '').trim().toLowerCase();
  if (!name) return true;
  if (name === 'customer' || name === 'user' || name === 'guest') return true;
  if (isPlaceholderEmail(user.email, user.phone)) return true;
  return false;
}

function redirectFor(
  role: string,
  purpose: PublicOtpPurpose,
  user: { email?: string | null; name?: string | null; phone?: string | null },
) {
  if (role === 'SELLER' || role === 'SELLER_STAFF') return '/seller/dashboard';
  if (role === 'VENDOR' || role === 'VENDOR_STAFF') return '/vendor/dashboard';
  if (needsProfileCompletion(user, purpose)) return '/complete-profile';
  return '/account';
}

function otpReasonToMessage(
  reason:
    | 'invalid_phone'
    | 'invalid_format'
    | 'no_active_otp'
    | 'expired'
    | 'wrong_code'
    | 'max_attempts',
) {
  switch (reason) {
    case 'invalid_phone': return 'Please enter a valid mobile number';
    case 'invalid_format': return 'Invalid OTP format';
    case 'no_active_otp': return 'No active OTP found. Please request a new code.';
    case 'expired': return 'OTP expired. Please request a new code.';
    case 'wrong_code': return 'Incorrect OTP';
    case 'max_attempts': return 'Too many invalid attempts. Please request a new code.';
    default: return 'OTP verification failed';
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Phone and OTP code are required' }, { status: 400 });
    }

    const purpose = normalizePurpose(parsed.data.purpose);
    const normalizedPhone = normalizePhone(parsed.data.phone);
    const code = parsed.data.code.trim();
    const inputEmail = normalizeOptionalEmail(parsed.data.email);
    const inputName = normalizeOptionalName(parsed.data.name);

    if (!normalizedPhone) {
      return NextResponse.json({ error: 'Please enter a valid mobile number' }, { status: 400 });
    }

    // Privileged flows never create sessions through the anonymous OTP verifier.
    // Admin 2FA must pass through /api/auth/login/2fa, which re-checks the
    // password before consuming the OTP. Phone changes require an authenticated
    // account-specific flow.
    if (purpose === 'admin_2fa' || purpose === 'change_phone') {
      return NextResponse.json(
        { error: 'This verification flow must be completed through its dedicated authenticated endpoint.' },
        { status: 403 },
      );
    }

    // Resolve and authorize portal role BEFORE consuming the OTP. This prevents
    // a generic customer OTP from becoming a passwordless admin/seller/vendor
    // session simply because the phone number belongs to a privileged account.
    const expectedRoles = expectedRolesForPurpose(purpose);
    let loginUser: {
      id: string;
      email: string | null;
      name: string | null;
      role: any;
      phone: string | null;
      phoneVerifiedAt: Date | null;
      primaryAuthMethod: string | null;
    } | null = null;

    if (expectedRoles) {
      loginUser = await prisma.user.findFirst({
        where: { phone: normalizedPhone },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          phone: true,
          phoneVerifiedAt: true,
          primaryAuthMethod: true,
        },
      });

      if (!loginUser) {
        return NextResponse.json({ error: 'No account found for this mobile number' }, { status: 404 });
      }

      if (!expectedRoles.includes(String(loginUser.role))) {
        return NextResponse.json(
          { error: 'This account must use its dedicated portal sign-in method.' },
          { status: 403 },
        );
      }

      if (purpose === 'login_vendor') {
        const vendor = await prisma.vendor.findUnique({
          where: { userId: loginUser.id },
          select: { status: true },
        });
        if (!vendor || vendor.status === 'ARCHIVED' || vendor.status === 'SUSPENDED') {
          return NextResponse.json({ error: 'Vendor account is not active' }, { status: 403 });
        }
      }

      if (purpose === 'login_seller') {
        const seller = await prisma.seller.findFirst({
          where: { userId: loginUser.id },
          select: { id: true },
        });
        if (!seller) {
          return NextResponse.json({ error: 'Seller account is not linked' }, { status: 403 });
        }
      }
    }

    const verification = await verifyOtp({
      phone: normalizedPhone,
      code,
      purpose: purpose as OtpPurpose,
    });

    if (!verification.ok) {
      return NextResponse.json({ error: otpReasonToMessage(verification.reason) }, { status: 401 });
    }

    // Guest checkout verifies phone possession without creating an account or
    // session. /api/checkout remains the authority for its consumed OTP gate.
    if (purpose === 'checkout_guest') {
      return NextResponse.json({
        ok: true,
        guest: true,
        phone: normalizedPhone,
        phoneVerified: true,
      });
    }

    if (purpose === 'signup' || purpose === 'signup_customer') {
      const existingUser = await prisma.user.findFirst({
        where: { phone: normalizedPhone },
        select: { id: true },
      });

      if (existingUser) {
        return NextResponse.json({ error: 'An account already exists for this mobile number' }, { status: 409 });
      }

      const user = await prisma.user.create({
        data: {
          email: inputEmail || fallbackEmailForPhone(normalizedPhone),
          name: inputName || 'Customer',
          phone: normalizedPhone,
          role: 'CUSTOMER',
          phoneVerified: true,
          phoneVerifiedAt: new Date(),
          primaryAuthMethod: 'PHONE_OTP',
        },
        select: { id: true, email: true, name: true, role: true, phone: true },
      });

      const completionNeeded = needsProfileCompletion(user, purpose);

      await setSessionCookie({
        id: user.id,
        email: user.email || fallbackEmailForPhone(normalizedPhone),
        name: user.name || 'Customer',
        role: user.role as any,
      });

      return NextResponse.json({
        ok: true,
        user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
        redirect: redirectFor(user.role, purpose, user),
        forceRedirect: completionNeeded,
        needsProfileCompletion: completionNeeded,
      });
    }

    if (!loginUser) {
      return NextResponse.json({ error: 'No account found for this mobile number' }, { status: 404 });
    }

    const user = await prisma.user.update({
      where: { id: loginUser.id },
      data: {
        phoneVerified: true,
        phoneVerifiedAt: loginUser.phoneVerifiedAt || new Date(),
        primaryAuthMethod: loginUser.primaryAuthMethod || 'PHONE_OTP',
      },
      select: { id: true, email: true, name: true, role: true, phone: true },
    });

    const completionNeeded = needsProfileCompletion(user, purpose);

    await setSessionCookie({
      id: user.id,
      email: user.email || fallbackEmailForPhone(normalizedPhone),
      name: user.name || 'User',
      role: user.role as any,
    });

    return NextResponse.json({
      ok: true,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
      redirect: redirectFor(user.role, purpose, user),
      forceRedirect: completionNeeded,
      needsProfileCompletion: completionNeeded,
    });
  } catch (error) {
    console.error('[auth/otp/verify] error', error);
    return NextResponse.json({ error: 'Unable to verify OTP right now' }, { status: 500 });
  }
}
