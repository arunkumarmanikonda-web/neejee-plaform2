// PO → Bill auto-create on GRN (status=RECEIVED).
// Each PO becomes ONE Bill, categorized under a generic "COGS — Inventory" category.
// (We use COGS_INBOUND_SHIPPING by default as it's seeded; admin can re-categorize.)
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

/** Create a Bill from a received PO. Idempotent — won't create twice. */
export async function autoCreateBillFromPO(
  poId: string,
  createdByUserId: string,
): Promise<{ created: boolean; billId?: string; reason?: string }> {
  // 1) Already a bill for this PO?
  const existing = await prisma.bill.findFirst({
    where: { purchaseOrderId: poId },
    select: { id: true },
  });
  if (existing) return { created: false, billId: existing.id, reason: 'duplicate' };

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: { vendor: { select: { id: true, legalName: true, displayName: true, paymentTermsDays: true } } },
  });
  if (!po) return { created: false, reason: 'po-not-found' };
  if (po.status !== 'RECEIVED' && po.status !== 'CLOSED') {
    return { created: false, reason: 'po-not-received' };
  }

  // Find a sensible default category — fall back gracefully if none
  let categoryId: string | null = null;
  const cat = await prisma.expenseCategory.findFirst({
    where: { code: 'COGS_INBOUND_SHIPPING' },
    select: { id: true },
  });
  if (cat) {
    categoryId = cat.id;
  } else {
    // Fall back to any COGS_DIRECT category
    const fallback = await prisma.expenseCategory.findFirst({
      where: { group: 'COGS_DIRECT', isActive: true },
      select: { id: true },
    });
    if (fallback) categoryId = fallback.id;
  }
  if (!categoryId) {
    return { created: false, reason: 'no-category — seed chart of accounts first' };
  }

  // Compute due date from vendor's paymentTermsDays (defaults to 30 if missing)
  const termsDays = po.vendor?.paymentTermsDays || 30;
  const issuedOn = po.receivedAt || new Date();
  const dueOn = new Date(issuedOn.getTime() + termsDays * 86_400_000);

  const bill = await prisma.bill.create({
    data: {
      id: 'bill_' + randomBytes(10).toString('hex'),
      billNumber: po.vendorInvoiceNumber || null,
      description: `PO ${po.poNumber} — ${po.vendor?.displayName || po.vendor?.legalName || po.vendorNameSnapshot}`,
      vendorId: po.vendorId,
      vendorNameSnapshot: po.vendor?.displayName || po.vendor?.legalName || po.vendorNameSnapshot,
      categoryId,
      purchaseOrderId: po.id,
      amountPaise: po.subtotalPaise,
      gstPaise: po.gstPaise,
      totalPaise: po.totalPaise,
      paidPaise: 0,
      issuedOn,
      dueOn,
      status: 'OPEN',
      receiptUrl: po.vendorInvoiceUrl || null,
      notes: 'Auto-created from PO ' + po.poNumber + ' on goods receipt.',
      createdByUserId,
    },
  });

  return { created: true, billId: bill.id };
}
