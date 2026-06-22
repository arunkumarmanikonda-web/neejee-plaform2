// Returns ledger.
// GET/POST /api/admin/finance/returns
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');

    const where: any = {};
    if (from || to) {
      where.returnedOn = {};
      if (from) where.returnedOn.gte = new Date(from);
      if (to) where.returnedOn.lte = new Date(to);
    }

    const rows = await prisma.returnEntry.findMany({
      where,
      orderBy: { returnedOn: 'desc' },
      take: limit,
    });
    return NextResponse.json({ returns: rows });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.write');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const body = await req.json();
    const {
      orderId, orderNumber, returnedOn, refundedOn,
      refundedAmountPaise, reverseShippingPaise = 0,
      damagedValuePaise = 0, restockedValuePaise = 0,
      lineBreakdown, reason, notes,
    } = body;

    if (!orderId || !orderNumber || !returnedOn || refundedAmountPaise == null) {
      return NextResponse.json({
        error: 'orderId, orderNumber, returnedOn, and refundedAmountPaise are required',
      }, { status: 400 });
    }

    const refundAmt = parseInt(refundedAmountPaise);
    const restockedAmt = parseInt(restockedValuePaise) || 0;
    const damagedAmt  = parseInt(damagedValuePaise) || 0;

    const created = await prisma.returnEntry.create({
      data: {
        orderId,
        orderNumber,
        returnedOn: new Date(returnedOn),
        refundedOn: refundedOn ? new Date(refundedOn) : null,
        refundedAmountPaise: refundAmt,
        reverseShippingPaise: parseInt(reverseShippingPaise) || 0,
        damagedValuePaise: damagedAmt,
        restockedValuePaise: restockedAmt,
        lineBreakdown: lineBreakdown || [],
        reason: reason || null,
        notes: notes || null,
        createdByUserId: session!.id,
      },
    });

    // v23.40.12 — Auto-post the reversal to the revenue ledger + customer ledger.
    // Compute the proportion of the original invoice being reversed so we can
    // post proportional negative RevenueEntries on partial returns.
    let reversal: any = null;
    try {
      const { reverseOrderRevenue } = await import('@/lib/finance/reverse-order');
      // Look up invoice total to compute the proportion
      const inv = await prisma.salesInvoice.findUnique({
        where: { orderId },
        select: { totalPaise: true },
      });
      const proportionReversed = inv && inv.totalPaise > 0 ? Math.min(1, refundAmt / inv.totalPaise) : 1;
      reversal = await reverseOrderRevenue({
        orderId,
        refundAmountPaise: refundAmt,
        restockedValuePaise: restockedAmt,
        damagedValuePaise: damagedAmt,
        proportionReversed,
        refundedOn: refundedOn ? new Date(refundedOn) : new Date(),
        reason: reason || 'RETURN',
        notes: notes || null,
        postedByUserId: session!.id,
        returnEntryId: created.id,
      });
    } catch (e: any) {
      console.warn('[returns POST] revenue reversal failed:', e?.message);
      // Don't roll back the return record — finance team can re-run the
      // backfill if needed. Just surface the warning.
      reversal = { reversed: false, error: e?.message };
    }

    return NextResponse.json({ return: created, reversal }, { status: 201 });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
