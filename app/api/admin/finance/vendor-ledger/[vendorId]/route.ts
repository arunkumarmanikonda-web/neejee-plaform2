// v23.40.2 — Vendor ledger
// GET /api/admin/finance/vendor-ledger/{vendorId}
// Returns all bills + bill-payments + direct expenses + expense-payments
// for a vendor as a single chronological ledger with running balance.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { vendorId: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const vendor = await prisma.vendor.findUnique({
    where: { id: params.vendorId },
    select: {
      id: true, displayName: true, legalName: true, contactEmail: true,
      contactPhone: true, gstin: true, status: true,
      bankAccountName: true, bankAccountNumber: true, bankIfsc: true,
      // v23.40.8
      serviceCategoryGroup: true, defaultExpenseCategoryId: true,
    },
  });
  if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });

  // Bills for this vendor (AP)
  const bills = await prisma.bill.findMany({
    where: { vendorId: params.vendorId },
    orderBy: { issuedOn: 'desc' },
    include: {
      category: { select: { code: true, label: true } },
      payments: { orderBy: { paidOn: 'desc' } },
    },
  });

  // v23.40.10 — only direct expenses (not the mirror of a Bill). Bills already
  // appear as their own ledger entries; counting the mirror Expense would
  // double-debit the vendor.
  const expenses = await prisma.expense.findMany({
    where: {
      vendorId: params.vendorId,
      NOT: { source: 'BILL' },
    },
    orderBy: { incurredOn: 'desc' },
    include: {
      category: { select: { code: true, label: true } },
      payments: { orderBy: { paidOn: 'desc' } },
    },
  });

  type Entry = {
    date: Date;
    type: 'BILL' | 'BILL_PAYMENT' | 'EXPENSE' | 'EXPENSE_PAYMENT';
    refId: string;
    description: string;
    debitPaise: number;   // we owe vendor
    creditPaise: number;  // we paid vendor
    receiptUrl?: string | null;
    attachments?: string[];
    method?: string | null;
    reference?: string | null;
    billNumber?: string | null;
    invoiceNumber?: string | null;
    category?: string | null;
  };

  const entries: Entry[] = [];

  for (const b of bills) {
    entries.push({
      date: b.issuedOn,
      type: 'BILL',
      refId: b.id,
      description: b.description,
      debitPaise: b.totalPaise,
      creditPaise: 0,
      receiptUrl: b.receiptUrl,
      attachments: (b as any).attachments || [],
      billNumber: b.billNumber,
      category: b.category?.label,
    });
    for (const p of b.payments) {
      entries.push({
        date: p.paidOn,
        type: 'BILL_PAYMENT',
        refId: p.id,
        description: `Payment for ${b.description}`,
        debitPaise: 0,
        creditPaise: p.amountPaise,
        receiptUrl: p.receiptUrl,
        attachments: (p as any).attachments || [],
        method: p.method,
        reference: p.reference,
        billNumber: b.billNumber,
      });
    }
  }

  for (const e of expenses) {
    entries.push({
      date: e.incurredOn,
      type: 'EXPENSE',
      refId: e.id,
      description: e.description,
      debitPaise: e.totalPaise,
      creditPaise: 0,
      receiptUrl: e.receiptUrl,
      attachments: (e as any).attachments || [],
      invoiceNumber: e.invoiceNumber,
      category: e.category?.label,
    });
    for (const p of e.payments) {
      entries.push({
        date: p.paidOn,
        type: 'EXPENSE_PAYMENT',
        refId: p.id,
        description: `Payment for ${e.description}`,
        debitPaise: 0,
        creditPaise: p.amountPaise,
        receiptUrl: p.receiptUrl,
        attachments: p.attachments || [],
        method: p.method,
        reference: p.reference,
        invoiceNumber: e.invoiceNumber,
      });
    }
  }

  entries.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Running balance (positive = we owe vendor)
  let running = 0;
  const ledger = entries.map(e => {
    running += e.debitPaise - e.creditPaise;
    return { ...e, runningBalancePaise: running };
  });

  // Summary
  const totalBilledPaise = bills.reduce((s, b) => s + b.totalPaise, 0);
  const totalBillPaidPaise = bills.reduce((s, b) => s + b.paidPaise, 0);
  const totalExpensedPaise = expenses.reduce((s, e) => s + e.totalPaise, 0);
  const totalExpensePaidPaise = expenses.reduce((s, e) => s + ((e as any).paidPaise || 0), 0);
  const outstandingPaise = (totalBilledPaise + totalExpensedPaise) - (totalBillPaidPaise + totalExpensePaidPaise);

  return NextResponse.json({
    vendor,
    summary: {
      totalBilledPaise,
      totalBillPaidPaise,
      totalExpensedPaise,
      totalExpensePaidPaise,
      // legacy field names for back-compat in the existing UI
      totalPaidPaise: totalBillPaidPaise + totalExpensePaidPaise,
      outstandingPaise,
      billCount: bills.length,
      expenseCount: expenses.length,
    },
    ledger,
  });
}

// v23.40.8 — Update vendor service category from the ledger page.
export async function PATCH(req: Request, { params }: { params: { vendorId: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.write');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json();
  const data: any = {};
  if (body.serviceCategoryGroup !== undefined)     data.serviceCategoryGroup = body.serviceCategoryGroup || null;
  if (body.defaultExpenseCategoryId !== undefined) data.defaultExpenseCategoryId = body.defaultExpenseCategoryId || null;
  if (body.displayName !== undefined)              data.displayName = body.displayName || null;
  if (body.contactPhone !== undefined)             data.contactPhone = body.contactPhone || null;
  if (body.gstin !== undefined)                    data.gstin = body.gstin?.toUpperCase() || null;
  if (body.notes !== undefined)                    data.notes = body.notes || null;

  if (!Object.keys(data).length) return NextResponse.json({ error: 'No editable fields supplied' }, { status: 400 });

  const vendor = await prisma.vendor.update({ where: { id: params.vendorId }, data });
  return NextResponse.json({ vendor });
}
