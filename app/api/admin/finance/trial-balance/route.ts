// v23.40.3 — Trial Balance
// GET /api/admin/finance/trial-balance?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// Groups all transactions by account (expense category) and counterparty,
// summing debits / credits. The grand total of debits must equal credits if
// the books are in balance — payments (credits) must equal billed/expensed (debits).

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
  const from = fromStr ? new Date(fromStr) : new Date(new Date().getFullYear(), 0, 1);
  const to   = toStr   ? new Date(toStr)   : new Date();
  to.setHours(23, 59, 59, 999);

  // Pull everything
  const [bills, billPayments, expenses, expensePayments, bankAccts, bankTxns] = await Promise.all([
    prisma.bill.findMany({
      where: { issuedOn: { gte: from, lte: to } },
      include: { category: { select: { id: true, code: true, label: true, group: true } } },
    }),
    prisma.billPayment.findMany({
      where: { paidOn: { gte: from, lte: to } },
      include: { bill: { include: { category: { select: { id: true, code: true, label: true, group: true } } } } },
    }),
    // v23.40.10 — mirror-of-bill expenses excluded; counted via Bills already.
    prisma.expense.findMany({
      where: { incurredOn: { gte: from, lte: to }, NOT: { source: 'BILL' } },
      include: { category: { select: { id: true, code: true, label: true, group: true } } },
    }),
    prisma.expensePayment.findMany({
      where: { paidOn: { gte: from, lte: to } },
      include: { expense: { include: { category: { select: { id: true, code: true, label: true, group: true } } } } },
    }),
    prisma.bankAccount.findMany({
      select: { id: true, nickname: true, bankName: true, accountNumber: true, openingBalancePaise: true },
    }).catch(() => []),
    prisma.bankTransaction.findMany({
      where: { txnDate: { gte: from, lte: to } },
      select: { bankAccountId: true, debitPaise: true, creditPaise: true },
    }).catch(() => []),
  ]);

  // ── Account ledger (by category) ────────────────────────────────────────
  const accountMap = new Map<string, {
    id: string; code: string; label: string; group: string;
    debit: number; credit: number; entryCount: number;
  }>();
  function bumpAccount(cat: any, debit: number, credit: number) {
    if (!cat) return;
    const key = cat.id;
    if (!accountMap.has(key)) {
      accountMap.set(key, { id: cat.id, code: cat.code, label: cat.label, group: cat.group, debit: 0, credit: 0, entryCount: 0 });
    }
    const a = accountMap.get(key)!;
    a.debit  += debit;
    a.credit += credit;
    a.entryCount++;
  }
  for (const b of bills)            bumpAccount(b.category,            b.totalPaise, 0);
  for (const p of billPayments)     bumpAccount(p.bill?.category,      0, p.amountPaise);
  for (const e of expenses)         bumpAccount(e.category,            e.totalPaise, 0);
  for (const p of expensePayments)  bumpAccount(p.expense?.category,   0, p.amountPaise);

  const accounts = Array.from(accountMap.values())
    .map(a => ({ ...a, balance: a.debit - a.credit }))
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));

  // ── Counterparty (vendor) summary ───────────────────────────────────────
  const partyMap = new Map<string, { name: string; debit: number; credit: number; entryCount: number }>();
  function bumpParty(name: string | null | undefined, debit: number, credit: number) {
    const key = (name || '— Unassigned').trim();
    if (!partyMap.has(key)) partyMap.set(key, { name: key, debit: 0, credit: 0, entryCount: 0 });
    const a = partyMap.get(key)!;
    a.debit  += debit;
    a.credit += credit;
    a.entryCount++;
  }
  for (const b of bills)            bumpParty(b.vendorNameSnapshot || b.vendorId,                         b.totalPaise, 0);
  for (const p of billPayments)     bumpParty(p.bill?.vendorNameSnapshot || p.bill?.vendorId,             0, p.amountPaise);
  for (const e of expenses)         bumpParty(e.vendorNameSnapshot || e.vendorId,                         e.totalPaise, 0);
  for (const p of expensePayments)  bumpParty(p.expense?.vendorNameSnapshot || p.expense?.vendorId,       0, p.amountPaise);
  const parties = Array.from(partyMap.values())
    .map(p => ({ ...p, balance: p.debit - p.credit }))
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));

  // ── Bank balances ───────────────────────────────────────────────────────
  const bankMap = new Map<string, any>();
  for (const a of bankAccts as any[]) {
    bankMap.set(a.id, {
      id: a.id,
      label: `${a.bankName} · ${a.nickname || a.accountNumber}`,
      openingBalancePaise: a.openingBalancePaise || 0,
      debits: 0, credits: 0,
    });
  }
  for (const t of bankTxns as any[]) {
    const b = bankMap.get(t.bankAccountId);
    if (!b) continue;
    b.debits  += t.debitPaise  || 0; // money out
    b.credits += t.creditPaise || 0; // money in
  }
  const banks = Array.from(bankMap.values()).map(b => ({
    ...b,
    closingBalancePaise: b.openingBalancePaise + b.credits - b.debits,
  }));

  // ── Grand totals ────────────────────────────────────────────────────────
  const totalDebits  = accounts.reduce((s, a) => s + a.debit, 0);
  const totalCredits = accounts.reduce((s, a) => s + a.credit, 0);

  return NextResponse.json({
    period: { from: from.toISOString(), to: to.toISOString() },
    accounts,
    parties,
    banks,
    totals: {
      totalDebitsPaise:  totalDebits,
      totalCreditsPaise: totalCredits,
      differencePaise:   totalDebits - totalCredits, // = AP outstanding when books are balanced
    },
  });
}
