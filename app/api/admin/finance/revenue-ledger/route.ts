// v23.40.5 — Revenue Ledger
// GET /api/admin/finance/revenue-ledger
//   ?from&to&type&channel&saleType&sellerId&customerUserId&status&q
//
// Returns filtered RevenueEntry rows with aggregations.

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
  const where: any = {};
  const fromStr = url.searchParams.get('from');
  const toStr   = url.searchParams.get('to');
  if (fromStr || toStr) {
    where.txnDate = {};
    if (fromStr) where.txnDate.gte = new Date(fromStr);
    if (toStr)   { const d = new Date(toStr); d.setHours(23,59,59,999); where.txnDate.lte = d; }
  }
  const typeCsv = url.searchParams.get('type');
  if (typeCsv) where.type = { in: typeCsv.split(',') };
  if (url.searchParams.get('channel'))        where.channel        = url.searchParams.get('channel');
  if (url.searchParams.get('saleType'))       where.saleType       = url.searchParams.get('saleType');
  if (url.searchParams.get('sellerId'))       where.sellerId       = url.searchParams.get('sellerId');
  if (url.searchParams.get('customerUserId')) where.customerUserId = url.searchParams.get('customerUserId');
  if (url.searchParams.get('status'))         where.status         = url.searchParams.get('status');

  const entries = await prisma.revenueEntry.findMany({
    where,
    orderBy: { txnDate: 'asc' },
    take: 2000,
  });

  // Aggregations
  const byType: Record<string, number>   = {};
  const byChannel: Record<string, number> = {};
  const bySaleType: Record<string, number> = {};
  const byMonth: Record<string, { credit: number; debit: number }> = {};
  let totalCredit = 0, totalDebit = 0;
  let gstCgst = 0, gstSgst = 0, gstIgst = 0;
  let realizedRevenue = 0, accruedRevenue = 0;

  for (const e of entries) {
    if (e.amountPaise > 0) totalCredit += e.amountPaise;
    if (e.amountPaise < 0) totalDebit  += -e.amountPaise;
    byType[e.type]         = (byType[e.type]         || 0) + e.amountPaise;
    byChannel[e.channel]   = (byChannel[e.channel]   || 0) + e.amountPaise;
    bySaleType[e.saleType] = (bySaleType[e.saleType] || 0) + e.amountPaise;
    if (!byMonth[e.monthBucket]) byMonth[e.monthBucket] = { credit: 0, debit: 0 };
    if (e.amountPaise > 0) byMonth[e.monthBucket].credit += e.amountPaise;
    if (e.amountPaise < 0) byMonth[e.monthBucket].debit  += -e.amountPaise;
    gstCgst += e.cgstPaise;
    gstSgst += e.sgstPaise;
    gstIgst += e.igstPaise;
    if (e.type === 'PRODUCT_REVENUE' || e.type === 'COMMISSION_INCOME' || e.type === 'SHIPPING_REVENUE') {
      if (e.status === 'REALIZED') realizedRevenue += e.amountPaise;
      else if (e.status === 'ACCRUED') accruedRevenue += e.amountPaise;
    }
  }

  return NextResponse.json({
    entries,
    summary: {
      count: entries.length,
      totalCreditPaise: totalCredit,
      totalDebitPaise:  totalDebit,
      netPaise:         totalCredit - totalDebit,
      gstCgstPaise:     gstCgst,
      gstSgstPaise:     gstSgst,
      gstIgstPaise:     gstIgst,
      gstTotalOutputPaise: gstCgst + gstSgst + gstIgst,
      realizedRevenuePaise: realizedRevenue,
      accruedRevenuePaise:  accruedRevenue,
      byType, byChannel, bySaleType, byMonth,
    },
  });
}
