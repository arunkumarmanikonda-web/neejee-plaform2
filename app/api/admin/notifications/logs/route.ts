// GET /api/admin/notifications/logs
// Filterable feed of notification attempts. Useful for debugging delivery.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN', 'FINANCE'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || undefined;
  const channel = url.searchParams.get('channel') || undefined;
  const event = url.searchParams.get('event') || undefined;
  const q = url.searchParams.get('q')?.trim() || '';
  const limit = Math.min(Number(url.searchParams.get('limit') || 100), 500);

  const where: any = {};
  if (status) where.status = status;
  if (channel) where.channel = channel;
  if (event) where.event = event;
  if (q) where.recipient = { contains: q, mode: 'insensitive' };

  const [logs, summary] = await Promise.all([
    prisma.notificationLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, event: true, channel: true, recipient: true, subject: true,
        status: true, errorMessage: true, providerId: true,
        contextType: true, contextId: true, createdAt: true, deliveredAt: true,
      },
    }),
    // Last-24h summary across statuses
    prisma.notificationLog.groupBy({
      by: ['status'],
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      _count: { _all: true },
    }),
  ]);

  const summaryMap: Record<string, number> = {};
  for (const row of summary) summaryMap[row.status] = row._count._all;

  return NextResponse.json({ logs, summary: summaryMap });
}
