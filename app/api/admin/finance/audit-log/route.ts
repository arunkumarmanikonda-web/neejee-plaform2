// v23.38 — Finance audit log
// GET /api/admin/finance/audit-log?entityType=&entityId=&userId=&limit=
// Returns the immutable change log for finance entities.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const url = new URL(req.url);
  const entityType = url.searchParams.get('entityType') || undefined;
  const entityId = url.searchParams.get('entityId') || undefined;
  const userId = url.searchParams.get('userId') || undefined;
  const action = url.searchParams.get('action') || undefined;
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);

  const where: any = {};
  if (entityType) where.entityType = entityType;
  if (entityId)   where.entityId = entityId;
  if (userId)     where.userId = userId;
  if (action)     where.action = action;

  const logs = await prisma.financeAuditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return NextResponse.json({ logs });
}
