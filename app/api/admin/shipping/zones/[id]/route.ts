// /api/admin/shipping/zones/[id]
// PATCH - edit a zone
// DELETE - remove a zone

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const update: any = {};
    if (typeof body.name === 'string')                     update.name = body.name.trim();
    if (Array.isArray(body.pincodePrefixes))               update.pincodePrefixes = body.pincodePrefixes.map((s: any) => String(s).trim()).filter(Boolean);
    if (Array.isArray(body.pincodeExact))                  update.pincodeExact    = body.pincodeExact.map((s: any) => String(s).trim()).filter(Boolean);
    if (Array.isArray(body.states))                        update.states          = body.states.map((s: any) => String(s).trim()).filter(Boolean);
    if (typeof body.isDefault === 'boolean')               update.isDefault = body.isDefault;
    if (typeof body.standardPaise === 'number')            update.standardPaise = Math.max(0, parseInt(body.standardPaise as any) || 0);
    if (typeof body.expressPaise === 'number')             update.expressPaise  = Math.max(0, parseInt(body.expressPaise as any)  || 0);
    if (typeof body.freeAboveSubtotalPaise === 'number')   update.freeAboveSubtotalPaise = Math.max(0, parseInt(body.freeAboveSubtotalPaise as any) || 0);
    if (typeof body.inclusive === 'boolean')               update.inclusive = body.inclusive;
    if (typeof body.priority === 'number')                 update.priority  = parseInt(body.priority as any) || 100;
    if (typeof body.active === 'boolean')                  update.active = body.active;

    // Single default enforcement
    if (update.isDefault === true) {
      await prisma.shippingZone.updateMany({
        where: { isDefault: true, id: { not: params.id } },
        data: { isDefault: false },
      });
    }
    const zone = await prisma.shippingZone.update({ where: { id: params.id }, data: update });
    return NextResponse.json({ ok: true, zone });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const zone = await prisma.shippingZone.findUnique({ where: { id: params.id } });
    if (!zone) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (zone.isDefault) {
      return NextResponse.json({ error: 'Cannot delete the default zone. Mark another zone as default first.' }, { status: 400 });
    }
    await prisma.shippingZone.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
