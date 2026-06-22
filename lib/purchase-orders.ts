// Helpers for purchase order numbering and totals.
import { prisma } from '@/lib/prisma';

// Generates the next PO number in the form PO-2026-0001.
// Uses the current calendar year and zero-pads a counter that resets each year.
export async function generatePoNumber(): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `PO-${year}-`;
  // Find the highest existing PO number for this year
  const latest = await prisma.purchaseOrder.findFirst({
    where: { poNumber: { startsWith: prefix } },
    orderBy: { poNumber: 'desc' },
    select: { poNumber: true },
  });
  let next = 1;
  if (latest?.poNumber) {
    const tail = latest.poNumber.slice(prefix.length);
    const n = parseInt(tail, 10);
    if (!isNaN(n)) next = n + 1;
  }
  return `${prefix}${String(next).padStart(4, '0')}`;
}

export type PoLineInput = {
  productId?: string | null;
  variantId?: string | null;
  description: string;
  sku?: string | null;
  orderedQty: number;
  unitCostPaise: number;
  gstRate?: number;
};

// Recomputes subtotal, GST, and total paise from a set of lines.
export function computePoTotals(lines: Array<{
  orderedQty: number;
  unitCostPaise: number;
  gstRate: number;
}>): { subtotalPaise: number; gstPaise: number; totalPaise: number } {
  let subtotal = 0;
  let gst = 0;
  for (const l of lines) {
    const lineSubtotal = Math.round(l.orderedQty * l.unitCostPaise);
    const lineGst = Math.round(lineSubtotal * (l.gstRate / 100));
    subtotal += lineSubtotal;
    gst += lineGst;
  }
  return { subtotalPaise: subtotal, gstPaise: gst, totalPaise: subtotal + gst };
}

// Status transition guard — returns true if `to` is a legal next status from `from`.
export function canTransitionPoStatus(from: string, to: string): boolean {
  const allowed: Record<string, string[]> = {
    DRAFT:      ['SENT', 'CANCELLED'],
    SENT:       ['CONFIRMED', 'CANCELLED'],
    CONFIRMED:  ['DISPATCHED', 'CANCELLED'],
    DISPATCHED: ['RECEIVED', 'CANCELLED'],
    RECEIVED:   ['CLOSED'],
    CLOSED:     [],
    CANCELLED:  [],
  };
  return allowed[from]?.includes(to) ?? false;
}
