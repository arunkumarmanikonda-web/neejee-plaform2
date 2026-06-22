// app/api/admin/abandoned-carts/[id]/route.ts
// v26.3a — Get cart detail, force-resend email, opt-out from admin.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cart = await prisma.abandonedCart.findUnique({ where: { id: params.id } });
  if (!cart) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ cart });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const allowed: any = {};
  if (typeof body.optedOut === 'boolean') allowed.optedOut = body.optedOut;
  if (typeof body.telecallerStatus === 'string') allowed.telecallerStatus = body.telecallerStatus;
  if (typeof body.telecallerNotes === 'string') allowed.telecallerNotes = body.telecallerNotes;
  if (body.telecallerCalledAt) allowed.telecallerCalledAt = new Date(body.telecallerCalledAt);
  if (body.telecallerCallbackAt) allowed.telecallerCallbackAt = new Date(body.telecallerCallbackAt);
  if (typeof body.recoveryStage === 'number') allowed.recoveryStage = body.recoveryStage;
  if (body.nextActionAt === null) allowed.nextActionAt = null;
  if (body.nextActionAt) allowed.nextActionAt = new Date(body.nextActionAt);

  if (body.action === 'resend_now') {
    // Reset nextActionAt to now so the next cron tick will pick it up
    allowed.nextActionAt = new Date();
  }

  const cart = await prisma.abandonedCart.update({
    where: { id: params.id },
    data: allowed,
  });
  return NextResponse.json({ cart });
}
