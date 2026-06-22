// Dispute helpers — create, comment, change status with notifications.

import { prisma } from '@/lib/prisma';

export type DisputeSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type DisputeCategory =
  | 'WRONG_ITEM' | 'DAMAGED' | 'NOT_RECEIVED' | 'QUALITY_ISSUE'
  | 'SHORT_SHIPMENT' | 'LATE_DELIVERY' | 'PAYMENT_ISSUE' | 'OTHER';
export type DisputeStatus =
  | 'OPEN' | 'AWAITING_CUSTOMER' | 'AWAITING_VENDOR' | 'UNDER_REVIEW'
  | 'RESOLVED' | 'REJECTED' | 'WITHDRAWN';

// SLA in hours by severity
const SLA_HOURS: Record<DisputeSeverity, number> = {
  LOW: 7 * 24,
  MEDIUM: 3 * 24,
  HIGH: 1 * 24,
  CRITICAL: 4,
};

function computeDueBy(severity: DisputeSeverity): Date {
  const d = new Date();
  d.setUTCHours(d.getUTCHours() + SLA_HOURS[severity]);
  return d;
}

/** Open a new dispute. resourceType determines which target field to use. */
export async function openDispute(args: {
  resourceType: 'ORDER' | 'PURCHASE_ORDER';
  orderId?: string;
  purchaseOrderId?: string;
  raisedByUserId: string;
  raisedByRole: 'CUSTOMER' | 'ADMIN' | 'VENDOR' | 'SELLER';
  category: DisputeCategory;
  severity?: DisputeSeverity;
  title: string;
  description: string;
  evidenceUrls?: string[];
}) {
  const severity = args.severity || 'MEDIUM';

  // Resolve counterparty IDs for indexing
  let vendorId: string | null = null;
  let sellerId: string | null = null;
  let customerUserId: string | null = null;

  if (args.resourceType === 'ORDER' && args.orderId) {
    const order = await prisma.order.findUnique({
      where: { id: args.orderId },
      select: { userId: true, items: { select: { product: { select: { sellerId: true } } }, take: 1 } },
    });
    customerUserId = order?.userId || null;
    sellerId = order?.items[0]?.product?.sellerId || null;
  } else if (args.resourceType === 'PURCHASE_ORDER' && args.purchaseOrderId) {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: args.purchaseOrderId },
      select: { vendorId: true },
    });
    vendorId = po?.vendorId || null;
  }

  const dispute = await prisma.dispute.create({
    data: {
      resourceType: args.resourceType as any,
      orderId: args.resourceType === 'ORDER' ? args.orderId : null,
      purchaseOrderId: args.resourceType === 'PURCHASE_ORDER' ? args.purchaseOrderId : null,
      vendorId,
      sellerId,
      customerUserId,
      raisedByUserId: args.raisedByUserId,
      raisedByRole: args.raisedByRole,
      category: args.category as any,
      severity: severity as any,
      status: 'OPEN',
      title: args.title.trim().slice(0, 200),
      description: args.description.trim(),
      evidenceUrls: args.evidenceUrls || [],
      dueBy: computeDueBy(severity),
    },
  });

  await prisma.disputeEvent.create({
    data: {
      disputeId: dispute.id,
      actorUserId: args.raisedByUserId,
      actorRole: args.raisedByRole,
      type: 'CREATED',
      body: `${args.category}: ${args.title}`,
      toStatus: 'OPEN',
    },
  });

  // Notify counterparties
  try {
    const { notify } = await import('@/lib/notifications');
    const eventData = {
      disputeId: dispute.id,
      title: dispute.title,
      category: dispute.category,
      severity: dispute.severity,
      resourceType: dispute.resourceType,
      link: `/admin/disputes/${dispute.id}`,
    };

    // Always notify admins
    const admins = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
      select: { id: true },
    });
    for (const a of admins) {
      notify({
        event: 'DISPUTE_OPENED',
        userId: a.id,
        data: eventData,
        context: { type: 'DISPUTE', id: dispute.id },
      } as any).catch(() => {});
    }

    // Notify the counterparty
    if (vendorId && args.raisedByRole !== 'VENDOR') {
      const v = await prisma.vendor.findUnique({
        where: { id: vendorId },
        select: { userId: true, contactEmail: true },
      });
      const recipients = v?.userId ? { userId: v.userId } : v?.contactEmail ? { recipients: [{ email: v.contactEmail }] } : null;
      if (recipients) {
        notify({
          event: 'DISPUTE_OPENED',
          ...recipients,
          data: { ...eventData, link: `/vendor/purchase-orders/${args.purchaseOrderId}` },
          context: { type: 'DISPUTE', id: dispute.id },
        } as any).catch(() => {});
      }
    }
    if (customerUserId && args.raisedByRole !== 'CUSTOMER') {
      notify({
        event: 'DISPUTE_OPENED',
        userId: customerUserId,
        data: { ...eventData, link: `/account/disputes/${dispute.id}` },
        context: { type: 'DISPUTE', id: dispute.id },
      } as any).catch(() => {});
    }
  } catch (e: any) {
    console.warn('[openDispute] notify:', e?.message);
  }

  return dispute;
}

/** Add a comment to a dispute (any party). */
export async function commentOnDispute(args: {
  disputeId: string;
  actorUserId: string;
  actorRole: string;
  body: string;
  attachments?: string[];
}) {
  const dispute = await prisma.dispute.findUnique({ where: { id: args.disputeId } });
  if (!dispute) throw new Error('Dispute not found');

  const ev = await prisma.disputeEvent.create({
    data: {
      disputeId: args.disputeId,
      actorUserId: args.actorUserId,
      actorRole: args.actorRole,
      type: 'COMMENT',
      body: args.body.trim().slice(0, 4000),
      attachments: args.attachments || [],
    },
  });
  // Mark first-response time if this is the first non-CREATED event
  if (!dispute.firstResponseAt) {
    await prisma.dispute.update({
      where: { id: dispute.id },
      data: { firstResponseAt: new Date() },
    });
  }
  return ev;
}

/** Change dispute status (admin or party). Optionally records resolution. */
export async function changeDisputeStatus(args: {
  disputeId: string;
  actorUserId: string;
  actorRole: string;
  toStatus: DisputeStatus;
  note?: string;
  resolutionAmountPaise?: number;
}) {
  const dispute = await prisma.dispute.findUnique({ where: { id: args.disputeId } });
  if (!dispute) throw new Error('Dispute not found');
  const from = dispute.status;
  const isResolution = args.toStatus === 'RESOLVED';

  const updated = await prisma.dispute.update({
    where: { id: dispute.id },
    data: {
      status: args.toStatus as any,
      resolutionNote: isResolution ? args.note : dispute.resolutionNote,
      resolutionAmountPaise: isResolution ? (args.resolutionAmountPaise || null) : dispute.resolutionAmountPaise,
      resolvedAt: isResolution ? new Date() : dispute.resolvedAt,
      resolvedByUserId: isResolution ? args.actorUserId : dispute.resolvedByUserId,
    },
  });

  await prisma.disputeEvent.create({
    data: {
      disputeId: dispute.id,
      actorUserId: args.actorUserId,
      actorRole: args.actorRole,
      type: isResolution ? 'RESOLVED' : 'STATUS_CHANGED',
      body: args.note || null,
      fromStatus: from,
      toStatus: args.toStatus as any,
    },
  });

  // Fire notification
  try {
    const { notify } = await import('@/lib/notifications');
    const ev = isResolution ? 'DISPUTE_RESOLVED' : 'DISPUTE_STATUS_CHANGED';
    if (dispute.customerUserId && args.actorUserId !== dispute.customerUserId) {
      notify({
        event: ev,
        userId: dispute.customerUserId,
        data: { disputeId: dispute.id, title: dispute.title, fromStatus: from, toStatus: args.toStatus, link: `/account/disputes/${dispute.id}` },
        context: { type: 'DISPUTE', id: dispute.id },
      } as any).catch(() => {});
    }
    if (dispute.vendorId) {
      const v = await prisma.vendor.findUnique({
        where: { id: dispute.vendorId },
        select: { userId: true, contactEmail: true },
      });
      const recipients = v?.userId ? { userId: v.userId } : v?.contactEmail ? { recipients: [{ email: v.contactEmail }] } : null;
      if (recipients) {
        notify({
          event: ev,
          ...recipients,
          data: { disputeId: dispute.id, title: dispute.title, fromStatus: from, toStatus: args.toStatus, link: `/vendor/purchase-orders/${dispute.purchaseOrderId}` },
          context: { type: 'DISPUTE', id: dispute.id },
        } as any).catch(() => {});
      }
    }
  } catch (e: any) {
    console.warn('[changeDisputeStatus] notify:', e?.message);
  }

  return updated;
}
