// Email Campaign / Marketing Broadcast API
// - GET: list campaigns
// - POST: create draft
// - PATCH: update / send
// STRICT OPT-IN: only sends to marketingConsent=true OR emailOptIn=true
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { sendMarketingBatch } from '@/lib/marketing-email';
import { canReadMarketing, canDraftMarketing, canSendMarketing, canBypassMarketing, canApproveMarketing } from '@/lib/marketing/roles';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Legacy admin-only check kept for DELETE; new endpoints use marketing perms.
const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];

/** Resolve a segment to a list of opted-in recipients. */
async function resolveAudience(segment: string): Promise<{ email: string; name: string | null; userId: string }[]> {
  // STRICT: every recipient must have emailOptIn AND (marketingConsent OR was unset)
  // Implemented as: emailOptIn = true (default true) AND marketingConsent = true for marketing broadcasts.
  // Exception: transactional segments are not exposed here.
  const NOW = Date.now();
  const DAYS = (n: number) => n * 24 * 60 * 60 * 1000;

  const baseWhere: any = {
    role: 'CUSTOMER',
    emailOptIn: true,
    marketingConsent: true,
  };

  switch (segment) {
    case 'ALL':
    case 'OPTED_IN_ONLY':
      return prisma.user.findMany({
        where: baseWhere,
        select: { email: true, name: true, id: true },
        take: 10000,
      }).then(rows => rows.map(r => ({ email: r.email, name: r.name, userId: r.id })));

    case 'CUSTOMERS': {
      // Users with at least one paid order
      const rows = await prisma.user.findMany({
        where: { ...baseWhere, orders: { some: { paymentStatus: 'PAID' } } },
        select: { email: true, name: true, id: true },
        take: 10000,
      });
      return rows.map(r => ({ email: r.email, name: r.name, userId: r.id }));
    }

    case 'VIP': {
      // Users with 3+ paid orders OR > 50k lifetime
      const candidates = await prisma.user.findMany({
        where: baseWhere,
        select: {
          id: true, email: true, name: true,
          orders: { where: { paymentStatus: 'PAID' }, select: { total: true } },
        },
        take: 10000,
      });
      return candidates.filter(u => {
        const cnt = u.orders.length;
        const ltv = u.orders.reduce((s, o) => s + o.total, 0);
        return cnt >= 3 || ltv > 5000000;
      }).map(u => ({ email: u.email, name: u.name, userId: u.id }));
    }

    case 'LAPSED': {
      // Users who bought once but no order in 120+ days
      const candidates = await prisma.user.findMany({
        where: { ...baseWhere, orders: { some: { paymentStatus: 'PAID' } } },
        select: {
          id: true, email: true, name: true,
          orders: { where: { paymentStatus: 'PAID' }, select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        },
        take: 10000,
      });
      const cutoff = NOW - DAYS(120);
      return candidates.filter(u => {
        const last = u.orders[0]?.createdAt;
        return last && new Date(last).getTime() < cutoff;
      }).map(u => ({ email: u.email, name: u.name, userId: u.id }));
    }

    case 'WISHLIST': {
      const rows = await prisma.user.findMany({
        where: { ...baseWhere, wishlist: { some: {} } },
        select: { email: true, name: true, id: true },
        take: 10000,
      });
      return rows.map(r => ({ email: r.email, name: r.name, userId: r.id }));
    }

    default:
      return [];
  }
}

export async function GET() {
  const session = await getSession();
  if (!canReadMarketing(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const campaigns = await prisma.emailCampaign.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json({ campaigns });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!canDraftMarketing(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { name, subject, bodyHtml, segment = 'OPTED_IN_ONLY', notes } = body;
    if (!name || !subject || !bodyHtml) {
      return NextResponse.json({ error: 'name, subject, bodyHtml required' }, { status: 400 });
    }
    // Audience preview count
    const audience = await resolveAudience(segment);
    const created = await prisma.emailCampaign.create({
      data: {
        name, subject, bodyHtml, segment, notes: notes || null,
        status: 'DRAFT',
        recipientCount: audience.length,
        createdBy: session!.id,
      },
    });
    return NextResponse.json({ campaign: created, audienceCount: audience.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!canDraftMarketing(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id, action, approvalRequestId, ...updates } = await request.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // SUBMIT FOR APPROVAL: any drafter can submit; goes into the queue, no send yet.
    if (action === 'SUBMIT_FOR_APPROVAL') {
      const campaign = await prisma.emailCampaign.findUnique({ where: { id } });
      if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      if (campaign.status === 'SENT') {
        return NextResponse.json({ error: 'Already sent' }, { status: 400 });
      }
      // Look for existing pending
      const existing = await prisma.marketingApprovalRequest.findFirst({
        where: { resourceType: 'EMAIL_BROADCAST', resourceId: id, status: 'PENDING' },
      });
      if (existing) {
        return NextResponse.json({
          error: 'A pending approval already exists for this broadcast',
          existingId: existing.id,
        }, { status: 409 });
      }
      const req = await prisma.marketingApprovalRequest.create({
        data: {
          resourceType: 'EMAIL_BROADCAST',
          resourceId: id,
          proposedPayload: {
            name: campaign.name,
            subject: campaign.subject,
            bodyHtml: campaign.bodyHtml,
            segment: campaign.segment,
            recipientCount: campaign.recipientCount,
          } as any,
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
            resourceType: 'EMAIL BROADCAST',
            summary: campaign.name + ' — \"' + campaign.subject + '\"',
            createdByEmail: session!.email,
          },
          context: { type: 'MARKETING_APPROVAL', id: req.id },
        }).catch(() => {});
      } catch { /* */ }
      return NextResponse.json({ approvalRequest: req, message: 'Submitted for approval' });
    }

    if (action === 'SEND') {
      // Gate the send: must be able to send. If not bypass-capable, must reference an APPROVED request.
      if (!canSendMarketing(session)) {
        return NextResponse.json({
          error: 'You do not have permission to send. Use "Submit for approval" instead.',
        }, { status: 403 });
      }
      if (!canBypassMarketing(session)) {
        // MARKETING_MANAGER must have an APPROVED request to send. They cannot self-approve and send in one shot.
        if (!approvalRequestId) {
          return NextResponse.json({
            error: 'approvalRequestId required — approve a submitted request first, then send.',
          }, { status: 400 });
        }
        const apReq = await prisma.marketingApprovalRequest.findUnique({ where: { id: approvalRequestId } });
        if (!apReq || apReq.resourceType !== 'EMAIL_BROADCAST' || apReq.resourceId !== id) {
          return NextResponse.json({ error: 'approvalRequestId does not match this campaign' }, { status: 400 });
        }
        if (apReq.status !== 'APPROVED') {
          return NextResponse.json({ error: `Approval is in ${apReq.status} state, must be APPROVED` }, { status: 400 });
        }
        if (apReq.reviewedByUserId === session!.id) {
          return NextResponse.json({
            error: 'You approved this request — a different reviewer must press SEND (maker-checker hygiene).',
          }, { status: 403 });
        }
      }

      const campaign = await prisma.emailCampaign.findUnique({ where: { id } });
      if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      if (campaign.status === 'SENT') {
        return NextResponse.json({ error: 'Already sent' }, { status: 400 });
      }
      const audience = await resolveAudience(campaign.segment);
      if (audience.length === 0) {
        return NextResponse.json({ error: 'No opted-in recipients in this segment' }, { status: 400 });
      }
      // Mark as sending
      await prisma.emailCampaign.update({
        where: { id },
        data: { status: 'SENDING', recipientCount: audience.length },
      });
      // Fire-and-forget send (background) — but await for now since serverless
      const { sent, failed } = await sendMarketingBatch({
        recipients: audience.map(a => ({ email: a.email, name: a.name, userId: a.userId })),
        subject: campaign.subject,
        bodyHtml: campaign.bodyHtml,
        campaignId: campaign.id,
      });
      const finalCampaign = await prisma.emailCampaign.update({
        where: { id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          sentCount: sent,
          bounceCount: failed,
        },
      });
      return NextResponse.json({ campaign: finalCampaign, sent, failed });
    }

    // Regular updates (draft edits)
    const allowed = ['name', 'subject', 'bodyHtml', 'segment', 'notes', 'scheduledFor'];
    const data: any = {};
    for (const k of allowed) if (k in updates) data[k] = updates[k];
    // Recompute recipient count if segment changed
    if (data.segment) {
      const audience = await resolveAudience(data.segment);
      data.recipientCount = audience.length;
    }
    const updated = await prisma.emailCampaign.update({ where: { id }, data });
    return NextResponse.json({ campaign: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session || !ADMIN_ROLES.includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await request.json();
  await prisma.emailCampaign.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
