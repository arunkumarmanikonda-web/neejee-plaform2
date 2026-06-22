// app/api/admin/recovery-settings/route.ts
// v26.3a — Get/update recovery settings singleton.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const s = await prisma.recoverySettings.findUnique({ where: { id: 'default' } } as any);
  return NextResponse.json({ settings: s });
}

export async function PATCH(req: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json();
  const allowed: any = {};
  if (body.cadenceHours) allowed.cadenceHours = body.cadenceHours;
  if (body.discountPercents) allowed.discountPercents = body.discountPercents;
  if (typeof body.aiEnabled === 'boolean') allowed.aiEnabled = body.aiEnabled;
  if (typeof body.telecallerHandoffEnabled === 'boolean') allowed.telecallerHandoffEnabled = body.telecallerHandoffEnabled;
  if (typeof body.abandonGraceMinutes === 'number') allowed.abandonGraceMinutes = body.abandonGraceMinutes;

  const s = await prisma.recoverySettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', ...allowed },
    update: { ...allowed, updatedAt: new Date() },
  } as any);

  return NextResponse.json({ settings: s });
}
