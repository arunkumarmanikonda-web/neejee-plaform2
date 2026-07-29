import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = ['ADMIN', 'SUPER_ADMIN', 'MARKETING_MANAGER', 'MARKETING_OPERATOR'];

export async function GET() {
  const session = await getSession();
  if (!session || !ALLOWED.includes(session.role as any)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pages = await prisma.socialPageConnection.findMany({
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

  return NextResponse.json({ pages });
}