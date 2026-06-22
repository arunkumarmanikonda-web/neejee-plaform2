// GET / PATCH single PO. PATCH handles status transitions, edits to DRAFT lines,
// and GRN (receiving) with optional override of received qty + unit cost per line.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { computePoTotals, canTransitionPoStatus } from '@/lib/purchase-orders';
import { notify } from '@/lib/notifications';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function gate(write = false) {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized', status: 401 };
  const reads = ['ADMIN', 'SUPER_ADMIN', 'FINANCE'];
  const writes = ['ADMIN', 'SUPER_ADMIN'];
  if (!(write ? writes : reads).includes(session.role)) {
    return { error: 'Forbidden', status: 403 };
  }
  return { session };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await gate();
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: params.id },
    include: {
      vendor: true,
      lines: { orderBy: { createdAt: 'asc' } },
      purchaseCosts: true,
    },
  });
  if (!po) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ purchaseOrder: po });
}

// PATCH body modes:
//   { transition: 'SENT' }                         → admin marks sent
//   { transition: 'DISPATCHED', trackingNumber? } → admin records dispatch (rare; usually vendor)
//   { transition: 'RECEIVED', lineUpdates: [{lineId, receivedQty, receivedUnitCostPaise?}] }
//   { transition: 'CLOSED' }                       → after payment
//   { transition: 'CANCELLED' }
//   { notes, expectedDate, trackingNumber, trackingUrl, vendorInvoiceNumber, vendorInvoiceUrl }
//   { lines: [...] } → replace DRAFT lines (only allowed when status=DRAFT)
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const g = await gate(true);
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: params.id },
    include: { lines: true },
  });
  if (!po) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: any = {};
  try { body = await request.json(); } catch {}

  // Field-only updates (no transition)
  if (!body.transition && !body.lines) {
    const data: Record<string, any> = {};
    for (const k of ['notes','trackingNumber','trackingUrl','vendorInvoiceNumber','vendorInvoiceUrl']) {
      if (k in body) data[k] = body[k] === '' ? null : body[k];
    }
    if ('expectedDate' in body) data.expectedDate = body.expectedDate ? new Date(body.expectedDate) : null;
    const updated = await prisma.purchaseOrder.update({ where: { id: po.id }, data });
    return NextResponse.json({ purchaseOrder: updated });
  }

  // Replace lines while DRAFT
  if (Array.isArray(body.lines)) {
    if (po.status !== 'DRAFT') {
      return NextResponse.json({ error: 'Lines can only be edited while PO is DRAFT' }, { status: 400 });
    }
    const cleanLines = body.lines.map((l: any, idx: number) => {
      const orderedQty = Number(l.orderedQty);
      const unitCostPaise = Number(l.unitCostPaise);
      const gstRate = Number(l.gstRate ?? 5);
      if (!l.description) throw new Error(`Line ${idx + 1}: description required`);
      if (!(orderedQty > 0)) throw new Error(`Line ${idx + 1}: quantity must be > 0`);
      return {
        productId: l.productId || null,
        variantId: l.variantId || null,
        description: String(l.description),
        sku: l.sku || null,
        orderedQty,
        unitCostPaise: Math.round(unitCostPaise),
        gstRate,
      };
    });
    const totals = computePoTotals(cleanLines);
    try {
      const updated = await prisma.$transaction(async (tx) => {
        await tx.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: po.id } });
        return tx.purchaseOrder.update({
          where: { id: po.id },
          data: { ...totals, lines: { create: cleanLines } },
          include: { lines: true },
        });
      });
      return NextResponse.json({ purchaseOrder: updated });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Update failed' }, { status: 400 });
    }
  }

  // Status transition
  const target = body.transition as string;
  if (!canTransitionPoStatus(po.status, target)) {
    return NextResponse.json({ error: `Cannot transition from ${po.status} to ${target}` }, { status: 400 });
  }

  if (target === 'SENT') {
    const updated = await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: { status: 'SENT', sentAt: new Date() },
    });
    // Notify vendor (owner) that a new PO is waiting
    const vendor = await prisma.vendor.findUnique({ where: { id: po.vendorId }, select: { userId: true, legalName: true, displayName: true } });
    if (vendor?.userId) {
      notify({
        event: 'PO_SENT',
        userId: vendor.userId,
        data: { poId: po.id, poNumber: po.poNumber, totalPaise: po.totalPaise, lineCount: po.lines.length },
        context: { type: 'PURCHASE_ORDER', id: po.id },
      }).catch(e => console.warn('[notify PO_SENT]', e));
    }
    return NextResponse.json({ purchaseOrder: updated });
  }

  if (target === 'DISPATCHED') {
    const updated = await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: {
        status: 'DISPATCHED',
        dispatchedAt: new Date(),
        trackingNumber: body.trackingNumber || po.trackingNumber,
        trackingUrl: body.trackingUrl || po.trackingUrl,
      },
    });
    return NextResponse.json({ purchaseOrder: updated });
  }

  if (target === 'RECEIVED') {
    // Build a map of line overrides (admin can adjust qty + cost at GRN time)
    const overrides: Record<string, { receivedQty?: number; receivedUnitCostPaise?: number }> = {};
    if (Array.isArray(body.lineUpdates)) {
      for (const u of body.lineUpdates) {
        if (u?.lineId) overrides[u.lineId] = {
          receivedQty: u.receivedQty !== undefined ? Number(u.receivedQty) : undefined,
          receivedUnitCostPaise: u.receivedUnitCostPaise !== undefined ? Number(u.receivedUnitCostPaise) : undefined,
        };
      }
    }
    try {
      const updated = await prisma.$transaction(async (tx) => {
        // For each line: write receivedQty + receivedUnitCostPaise (default to PO values),
        // create PurchaseCost row, and increment Product/Variant inventory.
        for (const line of po.lines) {
          const ov = overrides[line.id] || {};
          const receivedQty = ov.receivedQty ?? line.orderedQty;
          const receivedUnitCost = ov.receivedUnitCostPaise ?? line.unitCostPaise;
          if (receivedQty < 0) throw new Error(`Line ${line.description}: received qty cannot be negative`);

          await tx.purchaseOrderLine.update({
            where: { id: line.id },
            data: {
              receivedQty,
              receivedUnitCostPaise: receivedUnitCost,
            },
          });

          if (receivedQty > 0 && line.productId) {
            // 1. Append cost ledger
            await tx.purchaseCost.create({
              data: {
                productId: line.productId,
                variantId: line.variantId,
                vendorId: po.vendorId,
                purchaseOrderId: po.id,
                quantity: receivedQty,
                unitCostPaise: receivedUnitCost,
                gstRate: line.gstRate,
                receivedAt: new Date(),
                notes: `PO ${po.poNumber}`,
              },
            });
            // 2. Increment inventory (variant if specified, else product)
            // Inventory bump: variants carry inventory in our schema. If the line
            // references a productId without variantId, we still write the cost
            // ledger row but do not touch inventory (admin can fix the variant
            // count manually if the product is a one-variant SKU).
            if (line.variantId) {
              await tx.variant.update({
                where: { id: line.variantId },
                data: { inventory: { increment: receivedQty } },
              });
            }
          }
        }
        return tx.purchaseOrder.update({
          where: { id: po.id },
          data: { status: 'RECEIVED', receivedAt: new Date() },
          include: { lines: true },
        });
      });
      // Notify vendor that GRN is complete — payment processing follows
      const vendor = await prisma.vendor.findUnique({ where: { id: po.vendorId }, select: { userId: true } });
      if (vendor?.userId) {
        notify({
          event: 'PO_RECEIVED',
          userId: vendor.userId,
          data: { poId: po.id, poNumber: po.poNumber },
          context: { type: 'PURCHASE_ORDER', id: po.id },
        }).catch(e => console.warn('[notify PO_RECEIVED]', e));
      }
      // Auto-create a Bill (accounts-payable entry) from the PO
      try {
        const { autoCreateBillFromPO } = await import('@/lib/finance/po-bill');
        const actorId = ('session' in g && g.session) ? g.session.id : 'system';
        const billResult = await autoCreateBillFromPO(po.id, actorId);
        if (billResult.created) {
          console.log('[po-receive] auto-created Bill', billResult.billId);
        }
      } catch (e: any) {
        console.warn('[po-receive] bill auto-create failed:', e?.message);
      }
      return NextResponse.json({ purchaseOrder: updated });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Receive failed' }, { status: 400 });
    }
  }

  if (target === 'CLOSED') {
    const updated = await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
    const vendor = await prisma.vendor.findUnique({ where: { id: po.vendorId }, select: { userId: true } });
    if (vendor?.userId) {
      notify({
        event: 'PO_CLOSED',
        userId: vendor.userId,
        data: { poId: po.id, poNumber: po.poNumber, totalPaise: po.totalPaise },
        context: { type: 'PURCHASE_ORDER', id: po.id },
      }).catch(e => console.warn('[notify PO_CLOSED]', e));
    }
    return NextResponse.json({ purchaseOrder: updated });
  }

  if (target === 'CANCELLED') {
    const updated = await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    const vendor = await prisma.vendor.findUnique({ where: { id: po.vendorId }, select: { userId: true } });
    if (vendor?.userId) {
      notify({
        event: 'PO_CANCELLED',
        userId: vendor.userId,
        data: { poId: po.id, poNumber: po.poNumber, reason: body.reason },
        context: { type: 'PURCHASE_ORDER', id: po.id },
      }).catch(e => console.warn('[notify PO_CANCELLED]', e));
    }
    return NextResponse.json({ purchaseOrder: updated });
  }

  return NextResponse.json({ error: 'Unknown transition' }, { status: 400 });
}
