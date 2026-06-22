// GET / PUT /api/vendor/account/notifications
// Vendor users (owner OR team) manage their own channel preferences.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function gate() {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized', status: 401 };
  if (!['VENDOR', 'VENDOR_STAFF'].includes(session.role)) {
    return { error: 'Vendor accounts only', status: 403 };
  }
  return { session };
}

export async function GET() {
  const g = await gate();
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const pref = await prisma.vendorNotificationPref.findUnique({
    where: { userId: g.session.id },
  });
  // Defaults if no row exists yet
  return NextResponse.json({
    pref: pref || { emailOptIn: true, whatsappOptIn: true, smsOptIn: false },
  });
}

export async function PUT(request: Request) {
  const g = await gate();
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status });
  let body: any = {};
  try { body = await request.json(); } catch {}
  const data = {
    emailOptIn:    !!body?.emailOptIn,
    whatsappOptIn: !!body?.whatsappOptIn,
    smsOptIn:      !!body?.smsOptIn,
  };
  const pref = await prisma.vendorNotificationPref.upsert({
    where: { userId: g.session.id },
    update: data,
    create: { userId: g.session.id, ...data },
  });
  return NextResponse.json({ pref });
}
