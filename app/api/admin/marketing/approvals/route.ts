// Marketing approval queue.
// GET  /api/admin/marketing/approvals?status=PENDING  — list requests
// POST /api/admin/marketing/approvals                 — submit a new request
//   body: { resourceType: 'CAMPAIGN'|'EMAIL_BROADCAST'|'COUPON'|'BANNER', resourceId, proposedPayload }
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireMarketingPerm } from '@/lib/marketing/roles';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_TYPES = ['CAMPAIGN', 'EMAIL_BROADCAST', 'COUPON', 'BANNER'];

export async function GET(req: Request) {
  const session = await getSession();
  const gate = requireMarketingPerm(session, 'marketing.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status') || '';
    const resourceType = url.searchParams.get('resourceType') || '';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 200);

    const where: any = {};
    if (status) where.status = status;
    if (resourceType) where.resourceType = resourceType;

    const rows = await prisma.marketingApprovalRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Hydrate creator email
    const creatorIds = Array.from(new Set(rows.map(r => r.createdByUserId)));
    const reviewerIds = Array.from(new Set(rows.map(r => r.reviewedByUserId).filter(Boolean) as string[]));
    const users = creatorIds.length || reviewerIds.length
      ? await prisma.user.findMany({
          where: { id: { in: [...creatorIds, ...reviewerIds] } },
          select: { id: true, email: true, name: true },
        })
      : [];
    const uMap = new Map(users.map(u => [u.id, u]));

    const counts = await prisma.marketingApprovalRequest.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    return NextResponse.json({
      requests: rows.map(r => ({
        ...r,
        createdBy: uMap.get(r.createdByUserId) || null,
        reviewedBy: r.reviewedByUserId ? uMap.get(r.reviewedByUserId) || null : null,
      })),
      counts,
    });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  const gate = requireMarketingPerm(session, 'marketing.submit');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const body = await req.json();
    const { resourceType, resourceId, proposedPayload } = body;
    if (!resourceType || !VALID_TYPES.includes(resourceType)) {
      return NextResponse.json({ error: `resourceType must be one of ${VALID_TYPES.join(', ')}` }, { status: 400 });
    }
    if (!resourceId || !proposedPayload) {
      return NextResponse.json({ error: 'resourceId and proposedPayload required' }, { status: 400 });
    }

    // De-dup: don't allow two PENDING requests for the same resource
    const existing = await prisma.marketingApprovalRequest.findFirst({
      where: { resourceType, resourceId, status: 'PENDING' },
    });
    if (existing) {
      return NextResponse.json({
        error: 'A pending approval already exists for this resource',
        existingId: existing.id,
      }, { status: 409 });
    }

    const created = await prisma.marketingApprovalRequest.create({
      data: {
        resourceType: resourceType as any,
        resourceId,
        proposedPayload,
        status: 'PENDING',
        createdByUserId: session!.id,
      },
    });

    // Notify approvers
    try {
      const { notify } = await import('@/lib/notifications');
      const approvers = await prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'SUPER_ADMIN', 'MARKETING_MANAGER'] } },
        select: { id: true },
      });
      notify({
        event: 'MARKETING_APPROVAL_REQUESTED',
        userIds: approvers.map(u => u.id),
        data: {
          resourceType: resourceType.replace('_', ' '),
          summary: proposedPayload?.name || proposedPayload?.title || proposedPayload?.subject || 'Untitled',
          createdByEmail: session!.email,
        },
        context: { type: 'MARKETING_APPROVAL', id: created.id },
      }).catch(() => {});
    } catch { /* */ }

    return NextResponse.json({ request: created }, { status: 201 });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
