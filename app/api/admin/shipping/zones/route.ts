// /api/admin/shipping/zones
// GET  - list all zones (active + inactive), priority desc
// POST - create a new zone

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'FINANCE'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const zones = await prisma.shippingZone.findMany({
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  });
  return NextResponse.json({ zones });
}

export async function POST(req: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const data: any = {
      name: String(body.name || '').trim() || 'Untitled zone',
      pincodePrefixes: Array.isArray(body.pincodePrefixes) ? body.pincodePrefixes.map((s: any) => String(s).trim()).filter(Boolean) : [],
      pincodeExact:    Array.isArray(body.pincodeExact)    ? body.pincodeExact.map((s: any) => String(s).trim()).filter(Boolean)    : [],
      states:          Array.isArray(body.states)          ? body.states.map((s: any) => String(s).trim()).filter(Boolean)          : [],
      isDefault:       !!body.isDefault,
      standardPaise:   Math.max(0, parseInt(body.standardPaise) || 0),
      expressPaise:    Math.max(0, parseInt(body.expressPaise)  || 0),
      freeAboveSubtotalPaise: Math.max(0, parseInt(body.freeAboveSubtotalPaise) || 0),
      inclusive:       !!body.inclusive,
      priority:        parseInt(body.priority) || 100,
      active:          body.active !== false,
    };
    // Only one default allowed — clear other defaults if this one is default
    if (data.isDefault) {
      await prisma.shippingZone.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }
    const zone = await prisma.shippingZone.create({ data });
    return NextResponse.json({ ok: true, zone });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
