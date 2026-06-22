// /api/admin/ai-photo-requests
// Admin queue of vendor-raised photo requests.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ADMIN_ROLES.includes(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const url = new URL(req.url);
  const status = url.searchParams.get('status') || undefined;

  const rows = await prisma.aiPhotoRequest.findMany({
    where: status ? { status: status as any } : {},
    orderBy: { createdAt: 'desc' },
    include: {
      vendor: { select: { id: true, legalName: true } },
      product: { select: { id: true, name: true, slug: true } },
    },
    take: 200,
  });

  const counts: Record<string, number> = {};
  rows.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });

  return NextResponse.json({ rows, counts });
}
