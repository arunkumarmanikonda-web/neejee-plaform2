// app/api/admin/notification-dispatches/route.ts
// v26.3b — Audit log of all SMS/WA dispatches.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(req.url);
  const channel = url.searchParams.get('channel');
  const status  = url.searchParams.get('status');
  const event   = url.searchParams.get('event');
  const limit   = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);

  const where: any = {};
  if (channel) where.channel = channel;
  if (status)  where.status  = status;
  if (event)   where.event   = event;

  const [dispatches, summary] = await Promise.all([
    prisma.notificationDispatch.findMany({
      where, orderBy: { createdAt: 'desc' }, take: limit,
    }),
    prisma.notificationDispatch.groupBy({
      by: ['channel', 'status'],
      _count: { _all: true },
    } as any),
  ]);

  return NextResponse.json({ dispatches, summary });
}
