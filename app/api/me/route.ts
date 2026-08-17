import { NextResponse } from 'next/server';
import { getSession, setSessionCookie } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/phone';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function normalizeEmail(value: unknown): string | null {
  const email = String(value ?? '').trim().toLowerCase();
  return email || null;
}

function isValidEmail(email: string) {
  return email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

function needsProfileCompletion(user: {
  email?: string | null;
  name?: string | null;
  phone?: string | null;
}) {
  const name = String(user.name || '').trim().toLowerCase();
  if (!name || name === 'customer' || name === 'user' || name === 'guest') return true;
  return isPlaceholderEmail(user.email, user.phone);
}

const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  marketingConsent: true,
  smsOptIn: true,
  whatsappOptIn: true,
  emailOptIn: true,
  emailVerified: true,
  phoneVerified: true,
  phoneVerifiedAt: true,
  primaryAuthMethod: true,
} as const;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null }, { status: 401 });

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.id },
      select: PUBLIC_USER_SELECT,
    });
    if (!dbUser) return NextResponse.json({ user: null }, { status: 401 });

    return NextResponse.json({
      ...dbUser,
      needsProfileCompletion: needsProfileCompletion(dbUser),
      user: dbUser,
    });
  } catch (error: any) {
    console.error('[me.get] failed', { userId: session.id, message: error?.message });
    return NextResponse.json({ error: 'Unable to load profile right now' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const current = await prisma.user.findUnique({
      where: { id: session.id },
      select: PUBLIC_USER_SELECT,
    });
    if (!current) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    const allowed: Record<string, any> = {};

    if (typeof body.name === 'string') {
      const name = body.name.trim().replace(/\s+/g, ' ');
      if (name.length > 100) return NextResponse.json({ error: 'Name is too long' }, { status: 400 });
      allowed.name = name || null;
    }

    if (typeof body.email === 'string') {
      const email = normalizeEmail(body.email);
      if (!email || !isValidEmail(email)) {
        return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
      }

      if (email !== current.email.trim().toLowerCase()) {
        if (!isPlaceholderEmail(current.email, current.phone)) {
          return NextResponse.json({
            error: 'Changing your sign-in email requires verification. Please use account support until the verification flow is completed.',
            code: 'EMAIL_REVERIFY_REQUIRED',
          }, { status: 409 });
        }

        const clash = await prisma.user.findFirst({
          where: { email, NOT: { id: session.id } },
          select: { id: true },
        });
        if (clash) return NextResponse.json({ error: 'Email already in use' }, { status: 409 });

        // Phone-OTP onboarding may replace the generated placeholder once, but
        // that does not prove ownership of the typed email address.
        allowed.email = email;
        allowed.emailVerified = null;
      }
    }

    if (typeof body.phone === 'string') {
      const rawPhone = body.phone.trim();
      const phone = rawPhone ? normalizePhone(rawPhone) : null;
      if (rawPhone && !phone) {
        return NextResponse.json({ error: 'Please enter a valid phone number' }, { status: 400 });
      }

      const currentPhone = current.phone ? normalizePhone(current.phone) || current.phone : null;
      if (phone !== currentPhone) {
        if (currentPhone) {
          return NextResponse.json({
            error: 'Changing your phone number requires OTP verification.',
            code: 'PHONE_REVERIFY_REQUIRED',
          }, { status: 409 });
        }
        if (phone) {
          const clash = await prisma.user.findFirst({
            where: { phone, NOT: { id: session.id } },
            select: { id: true },
          });
          if (clash) return NextResponse.json({ error: 'Phone already in use' }, { status: 409 });
        }
        allowed.phone = phone;
        allowed.phoneVerified = false;
        allowed.phoneVerifiedAt = null;
      }
    }

    if (typeof body.marketingConsent === 'boolean') allowed.marketingConsent = body.marketingConsent;
    if (typeof body.smsOptIn === 'boolean') allowed.smsOptIn = body.smsOptIn;
    if (typeof body.whatsappOptIn === 'boolean') allowed.whatsappOptIn = body.whatsappOptIn;
    if (typeof body.emailOptIn === 'boolean') allowed.emailOptIn = body.emailOptIn;

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ success: true, needsProfileCompletion: needsProfileCompletion(current), user: current });
    }

    const updated = await prisma.$transaction(async (tx: any) => {
      const user = await tx.user.update({
        where: { id: session.id },
        data: allowed,
        select: PUBLIC_USER_SELECT,
      });

      if (typeof body.marketingConsent === 'boolean' && isValidEmail(user.email)) {
        if (body.marketingConsent) {
          await tx.$executeRaw`
            insert into public."NewsletterSubscriber"(email, source, status, "consentAt", "unsubscribedAt", "updatedAt")
            values (${user.email.toLowerCase()}, 'account', 'SUBSCRIBED', current_timestamp, null, current_timestamp)
            on conflict (email) do update set
              source='account', status='SUBSCRIBED', "consentAt"=current_timestamp,
              "unsubscribedAt"=null, "updatedAt"=current_timestamp
          `;
        } else {
          await tx.$executeRaw`
            insert into public."NewsletterSubscriber"(email, source, status, "consentAt", "unsubscribedAt", "updatedAt")
            values (${user.email.toLowerCase()}, 'account', 'UNSUBSCRIBED', current_timestamp, current_timestamp, current_timestamp)
            on conflict (email) do update set
              status='UNSUBSCRIBED', "unsubscribedAt"=current_timestamp, "updatedAt"=current_timestamp
          `;
        }
      }
      return user;
    });

    await setSessionCookie({
      id: updated.id,
      email: updated.email,
      name: updated.name || session.name || 'User',
      role: updated.role as any,
    });

    return NextResponse.json({
      success: true,
      needsProfileCompletion: needsProfileCompletion(updated),
      user: updated,
    });
  } catch (error: any) {
    console.error('[me.patch] failed', { userId: session.id, message: error?.message });
    return NextResponse.json({ error: 'Unable to update profile right now' }, { status: 500 });
  }
}
