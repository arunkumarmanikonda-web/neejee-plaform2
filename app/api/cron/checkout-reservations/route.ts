import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.warn('[checkout-reservations] CRON_SECRET not set — refusing');
    return false;
  }
  return (req.headers.get('authorization') || '') === `Bearer ${expected}`;
}

async function runCleanup() {
  try {
    const rows = await prisma.$queryRaw<Array<{ result: Record<string, unknown> }>>`
      select private.expire_checkout_reservations() as result
    `;
    return NextResponse.json(rows?.[0]?.result || { ok: true, totalExpired: 0 });
  } catch (error: any) {
    console.error('[checkout-reservations] cleanup failed', { message: error?.message });
    return NextResponse.json({ error: 'cleanup failed' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return runCleanup();
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return runCleanup();
}
