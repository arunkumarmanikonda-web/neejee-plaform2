// Returns the currently signed-in user (or 401)
// Response shape flattens user fields at top level for ease of consumption.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null }, { status: 401 });

  // Enrich with DB fields (phone, opt-ins) when DB is available
  let enriched: any = { ...session };
  if (process.env.DATABASE_URL) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.id },
        select: {
          id: true, email: true, name: true, phone: true, role: true,
          marketingConsent: true, smsOptIn: true, whatsappOptIn: true, emailOptIn: true,
        },
      });
      if (dbUser) enriched = { ...enriched, ...dbUser };
    } catch (e) {
      // session is still valid — return what we have
    }
  }

  // Flatten + duplicate as `user` for compatibility
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
    user: enriched,
  });
}

// Update profile fields the user owns
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }
  try {
    const body = await request.json();
    const allowed: any = {};
    if (typeof body.name === 'string') allowed.name = body.name.trim();
    if (typeof body.phone === 'string') {
      const phone = body.phone.trim();
      if (phone) {
        // Ensure unique
        const clash = await prisma.user.findFirst({
          where: { phone, NOT: { id: session.id } },
          select: { id: true },
        });
        if (clash) return NextResponse.json({ error: 'Phone already in use' }, { status: 409 });
        allowed.phone = phone;
      } else {
        allowed.phone = null;
      }
    }
    if (typeof body.marketingConsent === 'boolean') allowed.marketingConsent = body.marketingConsent;
    if (typeof body.smsOptIn === 'boolean') allowed.smsOptIn = body.smsOptIn;
    if (typeof body.whatsappOptIn === 'boolean') allowed.whatsappOptIn = body.whatsappOptIn;
    if (typeof body.emailOptIn === 'boolean') allowed.emailOptIn = body.emailOptIn;

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: session.id },
      data: allowed,
      select: {
        id: true, email: true, name: true, phone: true, role: true,
        marketingConsent: true, smsOptIn: true, whatsappOptIn: true, emailOptIn: true,
      },
    });
    return NextResponse.json({ success: true, user: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
