import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = ['ADMIN', 'SUPER_ADMIN', 'MARKETING_MANAGER', 'MARKETING_OPERATOR'];

function socialDbAvailable(db: any) {
  return typeof db?.socialPageConnection?.findMany === 'function';
}

export async function GET() {
  const session = await getSession();
  if (!session || !ALLOWED.includes(session.role as any)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = prisma as any;
  if (!socialDbAvailable(db)) {
    return NextResponse.json({
      pages: [],
      degraded: true,
      warning: 'Meta social connection tables are not available in this deployment yet.',
    });
  }

  const pages = await db.socialPageConnection.findMany({
    where: {
      socialConnection: { status: 'ACTIVE' },
    },
    orderBy: [{ isPrimary: 'desc' }, { pageName: 'asc' }],
    include: {
      socialConnection: {
        select: { id: true, provider: true, displayName: true, metaUserEmail: true },
      },
    },
  });

  return NextResponse.json({ pages, degraded: false });
}
