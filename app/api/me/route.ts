import { NextResponse } from 'next/server';
import { getSession, setSessionCookie } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function normalizeEmail(value: unknown): string | null {
  const email = String(value ?? '').trim().toLowerCase();
  return email || null;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

  if (!name) return true;
  if (name === 'customer' || name === 'user' || name === 'guest') return true;
  if (isPlaceholderEmail(user.email, user.phone)) return true;

  return false;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  let enriched: any = { ...session };

  if (process.env.DATABASE_URL) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.id },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          marketingConsent: true,
          smsOptIn: true,
          whatsappOptIn: true,
          emailOptIn: true,
          phoneVerified: true,
          phoneVerifiedAt: true,
          primaryAuthMethod: true,
        },
      });

      if (dbUser) {
        enriched = { ...enriched, ...dbUser };
      }
    } catch {
      // keep session-only data
    }
  }

  return NextResponse.json({
    id: enriched.id,
    email: enriched.email,
    name: enriched.name,
    phone: enriched.phone,
    role: enriched.role,
    marketingConsent: enriched.marketingConsent,
    smsOptIn: enriched.smsOptIn,
    whatsappOptIn: enriched.whatsappOptIn,
    emailOptIn: enriched.emailOptIn,
    phoneVerified: enriched.phoneVerified,
    phoneVerifiedAt: enriched.phoneVerifiedAt,
    primaryAuthMethod: enriched.primaryAuthMethod,
    needsProfileCompletion: needsProfileCompletion(enriched),
    user: enriched,
  });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const allowed: Record<string, any> = {};

    if (typeof body.name === 'string') {
      const name = body.name.trim();
      allowed.name = name || null;
    }

    if (typeof body.phone === 'string') {
      const phone = body.phone.trim();

      if (phone) {
        const clash = await prisma.user.findFirst({
          where: {
            phone,
            NOT: { id: session.id },
          },
          select: { id: true },
        });

        if (clash) {
          return NextResponse.json(
            { error: 'Phone already in use' },
            { status: 409 },
          );
        }

        allowed.phone = phone;
      } else {
        allowed.phone = null;
      }
    }

    if (typeof body.email === 'string') {
      const email = normalizeEmail(body.email);

      if (!email) {
        return NextResponse.json(
          { error: 'Email is required' },
          { status: 400 },
        );
      }

      if (!isValidEmail(email)) {
        return NextResponse.json(
          { error: 'Please enter a valid email address' },
          { status: 400 },
        );
      }

      const clash = await prisma.user.findFirst({
        where: {
          email,
          NOT: { id: session.id },
        },
        select: { id: true },
      });

      if (clash) {
        return NextResponse.json(
          { error: 'Email already in use' },
          { status: 409 },
        );
      }

      allowed.email = email;
    }

    if (typeof body.marketingConsent === 'boolean') {
      allowed.marketingConsent = body.marketingConsent;
    }

    if (typeof body.smsOptIn === 'boolean') {
      allowed.smsOptIn = body.smsOptIn;
    }

    if (typeof body.whatsappOptIn === 'boolean') {
      allowed.whatsappOptIn = body.whatsappOptIn;
    }

    if (typeof body.emailOptIn === 'boolean') {
      allowed.emailOptIn = body.emailOptIn;
    }

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: session.id },
      data: allowed,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        marketingConsent: true,
        smsOptIn: true,
        whatsappOptIn: true,
        emailOptIn: true,
        phoneVerified: true,
        phoneVerifiedAt: true,
        primaryAuthMethod: true,
      },
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
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Unable to update profile right now' },
      { status: 500 },
    );
  }
}
