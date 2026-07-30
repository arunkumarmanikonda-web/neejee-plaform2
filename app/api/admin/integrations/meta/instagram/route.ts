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

  const accounts = await prisma.instagramBusinessConnection.findMany({
    where: {
      socialConnection: { status: 'ACTIVE' },
    },
    orderBy: { username: 'asc' },
    include: {
      socialConnection: {
        select: { id: true, provider: true, displayName: true, metaUserEmail: true },
      },
    },
  });

  return NextResponse.json({ accounts, degraded: false });
}