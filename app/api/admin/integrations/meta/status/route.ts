import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = ['ADMIN', 'SUPER_ADMIN', 'MARKETING_MANAGER', 'MARKETING_OPERATOR'];
const DEGRADED_WARNING = 'Meta social connection tables are not available in this deployment yet. Returning an empty connection list.';

export async function GET() {
  const session = await getSession();
  if (!session || !ALLOWED.includes(session.role as any)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = prisma as any;
  if (typeof db?.socialConnection?.findMany !== 'function') {
    return NextResponse.json({
      connections: [],
      degraded: true,
      warning: DEGRADED_WARNING,
    });
  }

  const connections = await db.socialConnection.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      createdByUser: {
        select: { id: true, email: true, name: true, role: true },
      },
      pages: {
        orderBy: [{ isPrimary: 'desc' }, { pageName: 'asc' }],
      },
      instagramAccounts: {
        orderBy: { username: 'asc' },
      },
    },
  });

  return NextResponse.json({ connections, degraded: false });
}
