// GET /api/vendor/activity — vendor-scoped audit log
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolveVendorForSession } from '@/lib/vendor-auth-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const session = await getSession();
  const v = await resolveVendorForSession(session);
  if (!v) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200);

  const logs = await prisma.vendorAuditLog.findMany({
    where: { vendorId: v.vendorId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return NextResponse.json({ logs });
}
