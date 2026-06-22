// v23.40.10 — Backfill: create a Bill for every legacy orphan Expense that has
// an invoice number (i.e. a real vendor invoice was recorded as an Expense only).
//
// Pre-v23.40.10 the team booked vendor invoices either as a Bill OR as an
// Expense, never both. From v23.40.10 a Bill always auto-creates a mirror
// Expense, so AP and P&L stay in sync. This endpoint scans existing standalone
// Expenses (source MANUAL, has invoiceNumber, has vendor) and creates the
// matching Bill row + 1:1 link.
//
// POST /api/admin/finance/backfill/bill-from-expense?dryRun=1   — preview
// POST /api/admin/finance/backfill/bill-from-expense            — execute

import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.write');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dryRun') === '1';

  // Find Expenses that look like they should have been Bills:
  //  - has vendorId
  //  - has invoiceNumber (real vendor invoice)
  //  - source is MANUAL (not already a mirror)
  //  - no Bill currently points to this expense
  const candidates = await prisma.expense.findMany({
    where: {
      vendorId: { not: null },
      invoiceNumber: { not: null },
      source: 'MANUAL',
    },
    select: {
      id: true, vendorId: true, vendorNameSnapshot: true,
      categoryId: true, description: true,
      amountPaise: true, gstPaise: true, totalPaise: true, paidPaise: true,
      incurredOn: true, paidOn: true,
      invoiceNumber: true, receiptUrl: true, attachments: true, notes: true,
    },
  });

  // Filter out ones already linked from a Bill
  const linkedExpenseIds = new Set(
    (await prisma.bill.findMany({
      where: { expenseId: { in: candidates.map(c => c.id) } },
      select: { expenseId: true },
    })).map(b => b.expenseId).filter(Boolean) as string[]
  );

  const toConvert = candidates.filter(c => !linkedExpenseIds.has(c.id));

  const result = {
    scanned: candidates.length,
    alreadyLinked: candidates.length - toConvert.length,
    toConvert: toConvert.length,
    converted: 0,
    samples: toConvert.slice(0, 10).map(e => ({
      expenseId: e.id,
      invoiceNumber: e.invoiceNumber,
      vendor: e.vendorNameSnapshot,
      totalPaise: e.totalPaise,
    })),
    errors: [] as { expenseId: string; error: string }[],
  };

  if (dryRun) {
    return NextResponse.json({ dryRun: true, result });
  }

  // Execute — wrap each conversion in its own transaction so a single failure
  // doesn't kill the whole batch.
  for (const e of toConvert) {
    try {
      const billId = 'bill_' + randomBytes(10).toString('hex');
      const dueOn  = e.paidOn || new Date(e.incurredOn.getTime() + 30 * 86_400_000);

      // Status mirrors the existing payment state
      const status =
        (e.paidPaise || 0) >= e.totalPaise ? 'PAID' :
        (e.paidPaise || 0) > 0             ? 'PARTIALLY_PAID' :
                                             'OPEN';

      await prisma.$transaction(async (tx) => {
        await tx.bill.create({
          data: {
            id: billId,
            billNumber: e.invoiceNumber,
            description: e.description,
            categoryId: e.categoryId,
            vendorId: e.vendorId!,
            vendorNameSnapshot: e.vendorNameSnapshot,
            amountPaise: e.amountPaise,
            gstPaise: e.gstPaise,
            totalPaise: e.totalPaise,
            paidPaise: e.paidPaise || 0,
            issuedOn: e.incurredOn,
            dueOn,
            status: status as any,
            receiptUrl: e.receiptUrl,
            attachments: e.attachments || [],
            notes: e.notes ? `[Backfilled from expense ${e.id}] ${e.notes}` : `[Backfilled from expense ${e.id}]`,
            createdByUserId: session!.id,
            expenseId: e.id,
          },
        });
        // Mark the original expense as source=BILL so the vendor ledger dedupe
        // logic kicks in (otherwise it'd double-count).
        await tx.expense.update({
          where: { id: e.id },
          data: {
            source: 'BILL',
            sourceRef: billId,
            notes: e.notes ? `[Linked to bill via backfill] ${e.notes}` : '[Linked to bill via backfill]',
          },
        });
      });

      result.converted++;
    } catch (err: any) {
      result.errors.push({ expenseId: e.id, error: err.message || String(err) });
    }
  }

  return NextResponse.json({ dryRun: false, result });
}
