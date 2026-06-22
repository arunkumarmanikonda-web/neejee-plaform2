// v23.40.3 — General Ledger
// GET /api/admin/finance/ledger
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD
//   &accountType=BILL|BILL_PAYMENT|EXPENSE|EXPENSE_PAYMENT|BANK_TXN
//   &categoryId=<id>
//   &vendorId=<id>
//   &q=<search description>
//   &limit=<n>
//
// Returns a unified journal of all finance transactions with running totals.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const url = new URL(req.url);
  const fromStr = url.searchParams.get('from');
  const toStr   = url.searchParams.get('to');
  const types   = (url.searchParams.get('accountType') || '').split(',').filter(Boolean);
  const categoryId = url.searchParams.get('categoryId') || '';
  const vendorId   = url.searchParams.get('vendorId') || '';
  const q          = url.searchParams.get('q')?.trim() || '';
  const limit      = Math.min(parseInt(url.searchParams.get('limit') || '500'), 5000);

  const from = fromStr ? new Date(fromStr) : new Date(new Date().getFullYear(), 0, 1);
  const to   = toStr   ? new Date(toStr)   : new Date();
  // Make `to` inclusive end-of-day
  to.setHours(23, 59, 59, 999);

  const want = (t: string) => types.length === 0 || types.includes(t);

  // ──────── Pull data ────────
  const [bills, billPayments, expenses, expensePayments, bankTxns] = await Promise.all([
    want('BILL') ? prisma.bill.findMany({
      where: {
        issuedOn: { gte: from, lte: to },
        ...(categoryId ? { categoryId } : {}),
        ...(vendorId   ? { vendorId   } : {}),
        ...(q ? { description: { contains: q, mode: 'insensitive' as const } } : {}),
      },
      include: { category: { select: { code: true, label: true } } },
    }) : Promise.resolve([] as any[]),

    want('BILL_PAYMENT') ? prisma.billPayment.findMany({
      where: { paidOn: { gte: from, lte: to } },
      include: { bill: { select: { id: true, description: true, vendorId: true, vendorNameSnapshot: true, categoryId: true, category: { select: { code: true, label: true } } } } },
    }) : Promise.resolve([] as any[]),

    // v23.40.10 — exclude mirror Expenses (source=BILL) since the Bill itself is also in the ledger.
    want('EXPENSE') ? prisma.expense.findMany({
      where: {
        incurredOn: { gte: from, lte: to },
        NOT: { source: 'BILL' },
        ...(categoryId ? { categoryId } : {}),
        ...(vendorId   ? { vendorId   } : {}),
        ...(q ? { description: { contains: q, mode: 'insensitive' as const } } : {}),
      },
      include: { category: { select: { code: true, label: true } } },
    }) : Promise.resolve([] as any[]),

    want('EXPENSE_PAYMENT') ? prisma.expensePayment.findMany({
      where: { paidOn: { gte: from, lte: to } },
      include: { expense: { select: { id: true, description: true, vendorId: true, vendorNameSnapshot: true, categoryId: true, category: { select: { code: true, label: true } } } } },
    }) : Promise.resolve([] as any[]),

    want('BANK_TXN') ? prisma.bankTransaction.findMany({
      where: { txnDate: { gte: from, lte: to } },
      include: { bankAccount: { select: { id: true, nickname: true, bankName: true, accountNumber: true } } },
    }).catch(() => []) : Promise.resolve([] as any[]),
  ]);

  type Entry = {
    date: Date;
    type: 'BILL' | 'BILL_PAYMENT' | 'EXPENSE' | 'EXPENSE_PAYMENT' | 'BANK_TXN';
    refId: string;
    description: string;
    debitPaise: number;   // money out / liability up
    creditPaise: number;  // money in / liability down
    account?: string | null;
    counterparty?: string | null;
    method?: string | null;
    reference?: string | null;
    receiptUrl?: string | null;
  };

  const entries: Entry[] = [];

  for (const b of bills as any[]) {
    if (categoryId && b.categoryId !== categoryId) continue;
    entries.push({
      date: b.issuedOn,
      type: 'BILL',
      refId: b.id,
      description: `Bill: ${b.description}`,
      debitPaise: b.totalPaise,
      creditPaise: 0,
      account: b.category?.label,
      counterparty: b.vendorNameSnapshot || b.vendorId || '—',
      reference: b.billNumber,
      receiptUrl: b.receiptUrl,
    });
  }

  for (const p of billPayments as any[]) {
    if (categoryId && p.bill?.categoryId !== categoryId) continue;
    if (vendorId   && p.bill?.vendorId   !== vendorId)   continue;
    if (q && !p.bill?.description?.toLowerCase().includes(q.toLowerCase())) continue;
    entries.push({
      date: p.paidOn,
      type: 'BILL_PAYMENT',
      refId: p.id,
      description: `Bill payment: ${p.bill?.description || p.billId}`,
      debitPaise: 0,
      creditPaise: p.amountPaise,
      account: p.bill?.category?.label,
      counterparty: p.bill?.vendorNameSnapshot || p.bill?.vendorId || '—',
      method: p.method,
      reference: p.reference,
      receiptUrl: p.receiptUrl,
    });
  }

  for (const e of expenses as any[]) {
    if (categoryId && e.categoryId !== categoryId) continue;
    entries.push({
      date: e.incurredOn,
      type: 'EXPENSE',
      refId: e.id,
      description: `Expense: ${e.description}`,
      debitPaise: e.totalPaise,
      creditPaise: 0,
      account: e.category?.label,
      counterparty: e.vendorNameSnapshot || e.vendorId || '—',
      reference: e.invoiceNumber,
      receiptUrl: e.receiptUrl,
    });
  }

  for (const p of expensePayments as any[]) {
    if (categoryId && p.expense?.categoryId !== categoryId) continue;
    if (vendorId   && p.expense?.vendorId   !== vendorId)   continue;
    if (q && !p.expense?.description?.toLowerCase().includes(q.toLowerCase())) continue;
    entries.push({
      date: p.paidOn,
      type: 'EXPENSE_PAYMENT',
      refId: p.id,
      description: `Expense payment: ${p.expense?.description || p.expenseId}`,
      debitPaise: 0,
      creditPaise: p.amountPaise,
      account: p.expense?.category?.label,
      counterparty: p.expense?.vendorNameSnapshot || p.expense?.vendorId || '—',
      method: p.method,
      reference: p.reference,
      receiptUrl: p.receiptUrl,
    });
  }

  for (const t of bankTxns as any[]) {
    if (vendorId) continue; // bank txns aren't directly tied to vendor
    if (q && !t.description?.toLowerCase().includes(q.toLowerCase())) continue;
    const accountLabel = t.bankAccount
      ? `${t.bankAccount.bankName} · ${t.bankAccount.nickname || t.bankAccount.accountNumber}`
      : 'Bank';
    entries.push({
      date: t.txnDate,
      type: 'BANK_TXN',
      refId: t.id,
      description: `Bank: ${t.description || 'Transaction'}`,
      debitPaise: t.debitPaise || 0,
      creditPaise: t.creditPaise || 0,
      account: accountLabel,
      counterparty: null,
      reference: t.reference,
    });
  }

  entries.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Running balance: positive = net debit (cumulative spend / liability)
  let running = 0;
  const ledger = entries.slice(0, limit).map(e => {
    running += e.debitPaise - e.creditPaise;
    return { ...e, runningBalancePaise: running };
  });

  const summary = {
    entryCount:        entries.length,
    totalDebitsPaise:  entries.reduce((s, e) => s + e.debitPaise,  0),
    totalCreditsPaise: entries.reduce((s, e) => s + e.creditPaise, 0),
    netPaise:          entries.reduce((s, e) => s + e.debitPaise - e.creditPaise, 0),
    from: from.toISOString(),
    to:   to.toISOString(),
  };

  return NextResponse.json({ ledger, summary });
}
