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
  const logs = await prisma.notificationLog.findMany({
    where: { channel: 'SMS' },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return NextResponse.json({ logs });
}
