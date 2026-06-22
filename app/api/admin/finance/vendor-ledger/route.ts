// v23.40.3 — Vendor ledger index
// GET /api/admin/finance/vendor-ledger
// Returns every vendor that has at least one Bill, Expense, BillPayment, or ExpensePayment
// along with totals (billed, expensed, paid) and outstanding amount.
//
// Note: Bill.vendorId and Expense.vendorId are plain FK strings without Prisma relations,
// so we query each model separately and aggregate in code.

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
  const q = url.searchParams.get('q')?.trim().toLowerCase() || '';
  const onlyOutstanding = url.searchParams.get('outstanding') === '1';
  const categoryGroup   = url.searchParams.get('categoryGroup') || '';

  // 1. Pull all vendors
  const where: any = {};
  if (q) {
    where.OR = [
      { displayName: { contains: q, mode: 'insensitive' } },
      { legalName:   { contains: q, mode: 'insensitive' } },
      { contactEmail:{ contains: q, mode: 'insensitive' } },
      { gstin:       { contains: q, mode: 'insensitive' } },
    ];
  }
  if (categoryGroup) where.serviceCategoryGroup = categoryGroup;

  const vendors = await prisma.vendor.findMany({
    where: Object.keys(where).length ? where : undefined,
    select: {
      id: true, displayName: true, legalName: true, contactEmail: true,
      contactPhone: true, gstin: true, status: true,
      serviceCategoryGroup: true,
    },
    orderBy: { displayName: 'asc' },
  });

  const vendorIds = vendors.map(v => v.id);

  // 2. Pull all bills + expenses for these vendors in one go
  const [bills, expenses] = await Promise.all([
    prisma.bill.findMany({
      where: { vendorId: { in: vendorIds } },
      select: { vendorId: true, totalPaise: true, paidPaise: true, status: true, dueOn: true },
    }),
    // v23.40.10 — exclude the mirror Expenses that auto-link to a Bill; we'd be
    // counting their amount twice in vendor totals.
    prisma.expense.findMany({
      where: { vendorId: { in: vendorIds }, NOT: { source: 'BILL' } },
      select: { vendorId: true, totalPaise: true, paidPaise: true, status: true },
    }),
  ]);

  // 3. Aggregate per vendor
  const aggMap = new Map<string, {
    totalBilled: number; totalBillPaid: number;
    totalExpensed: number; totalExpPaid: number;
    billCount: number; expenseCount: number; overdueBills: number;
  }>();
  const now = new Date();
  for (const v of vendors) {
    aggMap.set(v.id, {
      totalBilled: 0, totalBillPaid: 0, totalExpensed: 0, totalExpPaid: 0,
      billCount: 0, expenseCount: 0, overdueBills: 0,
    });
  }
  for (const b of bills) {
    const a = aggMap.get(b.vendorId!);
    if (!a) continue;
    a.totalBilled   += b.totalPaise;
    a.totalBillPaid += b.paidPaise;
    a.billCount++;
    if (b.status !== 'PAID' && b.status !== 'CANCELLED' && new Date(b.dueOn) < now) a.overdueBills++;
  }
  for (const e of expenses) {
    const a = aggMap.get(e.vendorId!);
    if (!a) continue;
    a.totalExpensed += e.totalPaise;
    a.totalExpPaid  += (e.paidPaise || 0);
    a.expenseCount++;
  }

  const rows = vendors.map(v => {
    const a = aggMap.get(v.id)!;
    const outstanding = (a.totalBilled + a.totalExpensed) - (a.totalBillPaid + a.totalExpPaid);
    return {
      id: v.id,
      displayName: v.displayName || v.legalName,
      legalName: v.legalName,
      contactEmail: v.contactEmail,
      contactPhone: v.contactPhone,
      gstin: v.gstin,
      status: v.status,
      serviceCategoryGroup: v.serviceCategoryGroup,
      billCount: a.billCount,
      expenseCount: a.expenseCount,
      totalBilledPaise: a.totalBilled,
      totalExpensedPaise: a.totalExpensed,
      totalPaidPaise: a.totalBillPaid + a.totalExpPaid,
      outstandingPaise: outstanding,
      overdueBills: a.overdueBills,
    };
  });

  const filtered = onlyOutstanding ? rows.filter(r => r.outstandingPaise > 0) : rows;
  filtered.sort((a, b) => b.outstandingPaise - a.outstandingPaise || a.displayName.localeCompare(b.displayName));

  // v23.40.8 — By-category summary
  const byCategory: Record<string, { count: number; outstandingPaise: number; spentPaise: number }> = {};
  for (const v of rows) {
    const key = v.serviceCategoryGroup || 'UNCATEGORISED';
    if (!byCategory[key]) byCategory[key] = { count: 0, outstandingPaise: 0, spentPaise: 0 };
    byCategory[key].count++;
    byCategory[key].outstandingPaise += v.outstandingPaise;
    byCategory[key].spentPaise       += (v.totalBilledPaise + v.totalExpensedPaise);
  }

  return NextResponse.json({
    vendors: filtered,
    totals: {
      vendorCount:        filtered.length,
      totalBilledPaise:   filtered.reduce((s, r) => s + r.totalBilledPaise,   0),
      totalExpensedPaise: filtered.reduce((s, r) => s + r.totalExpensedPaise, 0),
      totalPaidPaise:     filtered.reduce((s, r) => s + r.totalPaidPaise,     0),
      outstandingPaise:   filtered.reduce((s, r) => s + r.outstandingPaise,   0),
    },
    byCategory,
  });
}
