// PO message helpers — shared between admin and vendor APIs.
// Centralises the "post message + notify the other party" logic.

import { prisma } from '@/lib/prisma';

type AuthorRole = 'ADMIN' | 'SUPER_ADMIN' | 'VENDOR' | 'VENDOR_STAFF';

export async function postPoMessage(args: {
  purchaseOrderId: string;
  authorUserId: string;
  authorRole: AuthorRole;
  authorName: string;
  body: string;
  attachments?: string[];
}) {
  const body = (args.body || '').trim().slice(0, 2000);
  if (!body) throw new Error('Message body is required');

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: args.purchaseOrderId },
    select: { id: true, poNumber: true, vendorId: true },
  });
  if (!po) throw new Error('Purchase order not found');

  const isAdmin = args.authorRole === 'ADMIN' || args.authorRole === 'SUPER_ADMIN';

  const msg = await prisma.poMessage.create({
    data: {
      purchaseOrderId: args.purchaseOrderId,
      authorUserId: args.authorUserId,
      authorRole: args.authorRole,
      authorName: args.authorName,
      body,
      attachments: args.attachments || [],
      // Author has implicitly read their own message
      readByAdminAt: isAdmin ? new Date() : null,
      readByVendorAt: !isAdmin ? new Date() : null,
    },
  });

  // Notify the OTHER side
  try {
    const { notify } = await import('@/lib/notifications');
    const vendor = await prisma.vendor.findUnique({
      where: { id: po.vendorId },
      select: { userId: true, contactEmail: true, legalName: true },
    });

    if (isAdmin) {
      // Notify vendor
      const recipients = vendor?.userId
        ? { userId: vendor.userId }
        : vendor?.contactEmail
          ? { recipients: [{ email: vendor.contactEmail }] }
          : null;
      if (recipients) {
        notify({
          event: 'PO_MESSAGE_RECEIVED',
          ...recipients,
          data: {
            poNumber: po.poNumber,
            authorName: args.authorName,
            authorSide: 'admin',
            preview: body.slice(0, 200),
            link: `/vendor/purchase-orders/${po.id}`,
          },
          context: { type: 'PO', id: po.id },
        } as any).catch(e => console.warn('[po msg notify]', e?.message));
      }
    } else {
      // Notify admins — broadcast to ADMIN/SUPER_ADMIN
      const admins = await prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
        select: { id: true, email: true },
      });
      for (const a of admins) {
        notify({
          event: 'PO_MESSAGE_RECEIVED',
          userId: a.id,
          data: {
            poNumber: po.poNumber,
            authorName: args.authorName,
            authorSide: 'vendor',
            vendorName: vendor?.legalName || '',
            preview: body.slice(0, 200),
            link: `/admin/purchase-orders/${po.id}`,
          },
          context: { type: 'PO', id: po.id },
        } as any).catch(e => console.warn('[po msg notify admin]', e?.message));
      }
    }
  } catch (e: any) {
    console.warn('[postPoMessage] notify failed:', e?.message);
  }

  return msg;
}

/** Mark all messages on a PO as read by the given party. */
export async function markPoMessagesRead(poId: string, party: 'admin' | 'vendor') {
  const field = party === 'admin' ? 'readByAdminAt' : 'readByVendorAt';
  await prisma.poMessage.updateMany({
    where: { purchaseOrderId: poId, [field]: null } as any,
    data: { [field]: new Date() } as any,
  });
}
