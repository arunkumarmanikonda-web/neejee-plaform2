// /api/admin/disputes
// GET  - list all disputes with filters
// POST - admin raises a dispute (e.g. PURCHASE_ORDER short shipment)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { openDispute } from '@/lib/disputes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ROLES = ['ADMIN', 'SUPER_ADMIN', 'FINANCE'];

async function gate() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!ROLES.includes(session.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { session };
}

export async function GET(req: NextRequest) {
  const g = await gate();
  if (g.error) return g.error;
  const url = new URL(req.url);
  const status = url.searchParams.get('status') || undefined;
  const resourceType = url.searchParams.get('resourceType') || undefined;
  const severity = url.searchParams.get('severity') || undefined;

  const where: any = {};
  if (status) where.status = status;
  if (resourceType) where.resourceType = resourceType;
  if (severity) where.severity = severity;

  const rows = await prisma.dispute.findMany({
    where,
    orderBy: [
      // Show open + overdue first
      { status: 'asc' },
      { dueBy: 'asc' },
      { createdAt: 'desc' },
    ],
    take: 500,
  });

  // Status counts for filter chips
  const counts: Record<string, number> = {};
  rows.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });

  return NextResponse.json({ rows, counts });
}

export async function POST(req: NextRequest) {
  const g = await gate();
  if (g.error) return g.error;
  try {
    const body = await req.json();
    const dispute = await openDispute({
      resourceType: body.resourceType,
      orderId: body.orderId,
      purchaseOrderId: body.purchaseOrderId,
      raisedByUserId: g.session!.id,
      raisedByRole: 'ADMIN',
      category: body.category,
      severity: body.severity || 'MEDIUM',
      title: body.title || '',
      description: body.description || '',
      evidenceUrls: Array.isArray(body.evidenceUrls) ? body.evidenceUrls : [],
    });
    return NextResponse.json({ ok: true, dispute });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
