// v23.40.11 — Customer ledger INDEX: every customer with totals + AR aging.
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
  const q    = (url.searchParams.get('q') || '').trim();
  const type = url.searchParams.get('type');

  const where: any = { status: { not: 'BLOCKED' } };
  if (type) where.customerType = type;
  if (q) {
    where.OR = [
      { displayName:  { contains: q, mode: 'insensitive' } },
      { legalName:    { contains: q, mode: 'insensitive' } },
      { primaryEmail: { contains: q, mode: 'insensitive' } },
      { primaryPhone: { contains: q } },
      { gstin:        { contains: q, mode: 'insensitive' } },
    ];
  }

  const customers = await prisma.customer.findMany({
    where,
    orderBy: { displayName: 'asc' },
    select: {
      id: true, displayName: true, legalName: true,
      primaryEmail: true, primaryPhone: true, gstin: true,
      customerType: true, channel: true, status: true,
      creditLimitPaise: true, creditDays: true,
    },
  });

  const customerIds = customers.map(c => c.id);

  // Pull invoices for these customers (use the customerId link, with snapshot-name fallback)
  const invoices = await prisma.salesInvoice.findMany({
    where: { customerId: { in: customerIds } },
    select: {
      customerId: true, totalPaise: true, paidPaise: true,
      paymentStatus: true, dueOn: true, issuedOn: true,
    },
  });

  // Aggregate
  const now = new Date();
  const aggMap = new Map<string, {
    totalBilled: number;   // sum of totalPaise
    totalReceived: number; // sum of paidPaise
    outstanding: number;
    invoiceCount: number;
    overdueCount: number;
    overduePaise: number;
    bucketCurrent: number;
    bucket1_30: number;
    bucket31_60: number;
    bucket61_90: number;
    bucket90Plus: number;
  }>();
  for (const c of customers) {
    aggMap.set(c.id, {
      totalBilled: 0, totalReceived: 0, outstanding: 0,
      invoiceCount: 0, overdueCount: 0, overduePaise: 0,
      bucketCurrent: 0, bucket1_30: 0, bucket31_60: 0, bucket61_90: 0, bucket90Plus: 0,
    });
  }
  for (const i of invoices) {
    if (!i.customerId) continue;
    const a = aggMap.get(i.customerId);
    if (!a) continue;
    a.totalBilled   += i.totalPaise;
    a.totalReceived += i.paidPaise;
    a.invoiceCount++;
    const outstanding = i.totalPaise - i.paidPaise;
    if (outstanding > 0 && i.paymentStatus !== 'CANCELLED' && i.paymentStatus !== 'VOID') {
      a.outstanding += outstanding;
      if (i.dueOn) {
        const daysOverdue = Math.floor((now.getTime() - new Date(i.dueOn).getTime()) / 86_400_000);
        if (daysOverdue > 0) { a.overdueCount++; a.overduePaise += outstanding; }
        if (daysOverdue <= 0)       a.bucketCurrent  += outstanding;
        else if (daysOverdue <= 30) a.bucket1_30     += outstanding;
        else if (daysOverdue <= 60) a.bucket31_60    += outstanding;
        else if (daysOverdue <= 90) a.bucket61_90    += outstanding;
        else                        a.bucket90Plus   += outstanding;
      } else {
        a.bucketCurrent += outstanding;
      }
    }
  }

  const result = customers.map(c => ({ ...c, ...(aggMap.get(c.id) || {}) }));

  const summary = {
    customerCount: customers.length,
    totalBilled:   result.reduce((s, r: any) => s + r.totalBilled, 0),
    totalReceived: result.reduce((s, r: any) => s + r.totalReceived, 0),
    totalOutstanding: result.reduce((s, r: any) => s + r.outstanding, 0),
    totalOverdue:  result.reduce((s, r: any) => s + r.overduePaise, 0),
    bucketCurrent: result.reduce((s, r: any) => s + r.bucketCurrent, 0),
    bucket1_30:    result.reduce((s, r: any) => s + r.bucket1_30, 0),
    bucket31_60:   result.reduce((s, r: any) => s + r.bucket31_60, 0),
    bucket61_90:   result.reduce((s, r: any) => s + r.bucket61_90, 0),
    bucket90Plus:  result.reduce((s, r: any) => s + r.bucket90Plus, 0),
  };

  return NextResponse.json({ customers: result, summary });
}
