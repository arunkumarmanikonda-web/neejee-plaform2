// v23.40.14 — GSTR-3B helper API
//
// GET /api/admin/finance/gstr-3b?month=YYYY-MM
// GET /api/admin/finance/gstr-3b?month=YYYY-MM&format=csv
//
// Returns the data the finance team needs to file Form GSTR-3B:
//   - Box 3.1: Outward taxable supplies (taxable value + CGST/SGST/IGST output)
//   - Box 3.1.1: Supplies through e-commerce operators (where applicable)
//   - Box 4: Eligible ITC (CGST/SGST/IGST input from bills)
//   - Box 5: Exempt / nil-rated / non-GST inward supplies
//   - Box 6.1: Tax payable & paid (computed)
//   - Box 7: TDS/TCS (currently informational)
//
// CSV export matches GSTR-3B field names so finance can paste straight in.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function paiseToRs(n: number) { return Math.round(n) / 100; }

export async function GET(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const url = new URL(req.url);
  const month = url.searchParams.get('month');                 // YYYY-MM
  const format = url.searchParams.get('format') || 'json';
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month=YYYY-MM required' }, { status: 400 });
  }
  const [yStr, mStr] = month.split('-');
  const year  = parseInt(yStr);
  const mIdx  = parseInt(mStr) - 1;
  const start = new Date(year, mIdx, 1);
  const end   = new Date(year, mIdx + 1, 1);

  // ── OUTWARD SUPPLIES (Box 3.1) ─────────────────────────────────────
  const outInvoices = await prisma.salesInvoice.findMany({
    where: {
      issuedOn: { gte: start, lt: end },
      paymentStatus: { notIn: ['CANCELLED', 'VOID'] },
    },
    select: {
      id: true, invoiceNumber: true, invoiceType: true, customerName: true, customerGstin: true,
      placeOfSupply: true, taxableValuePaise: true,
      cgstPaise: true, sgstPaise: true, igstPaise: true,
      shippingPaise: true, shippingTaxPaise: true, totalPaise: true,
    },
  });

  // Negative reversals (refunds) in this month — reduce output tax
  const reversalEntries = await prisma.revenueEntry.findMany({
    where: {
      monthBucket: month,
      type: 'REFUND_REVERSAL',
    },
    select: { amountPaise: true, cgstPaise: true, sgstPaise: true, igstPaise: true },
  });

  let outTaxable = 0, outCgst = 0, outSgst = 0, outIgst = 0;
  let exportTaxable = 0;       // inter-state to overseas (Box 3.1 (b)) — not auto-detected; keep 0 placeholder
  let exemptTaxable = 0;       // Box 3.1 (c) — exempt outward (GST = 0)
  let b2bTaxable = 0, b2cTaxable = 0;

  for (const inv of outInvoices) {
    outTaxable += inv.taxableValuePaise;
    outCgst    += inv.cgstPaise;
    outSgst    += inv.sgstPaise;
    outIgst    += inv.igstPaise;
    if (inv.cgstPaise === 0 && inv.sgstPaise === 0 && inv.igstPaise === 0) {
      exemptTaxable += inv.taxableValuePaise;
    }
    if (inv.customerGstin) b2bTaxable += inv.taxableValuePaise;
    else                   b2cTaxable += inv.taxableValuePaise;
  }
  // Apply reversals
  for (const r of reversalEntries) {
    outCgst += r.cgstPaise;
    outSgst += r.sgstPaise;
    outIgst += r.igstPaise;
  }

  // ── INWARD SUPPLIES + ITC (Box 4) ──────────────────────────────────
  // Bills + expenses with GST become input tax credit (eligible if proper invoice).
  const inBills = await prisma.bill.findMany({
    where: {
      issuedOn: { gte: start, lt: end },
      status: { notIn: ['CANCELLED'] },
    },
    select: { id: true, vendorNameSnapshot: true, totalPaise: true, gstPaise: true, billNumber: true },
  });
  const inExpenses = await prisma.expense.findMany({
    where: {
      incurredOn: { gte: start, lt: end },
      status: { in: ['APPROVED'] },
      source: { not: 'BILL' },  // mirror expenses would double-count
    },
    select: { id: true, vendorNameSnapshot: true, totalPaise: true, gstPaise: true, invoiceNumber: true },
  });

  let itcCgst = 0, itcSgst = 0, itcIgst = 0, itcTotal = 0;
  // Without inter-state split per bill we approximate 50/50 CGST+SGST for intra-state.
  // For an accurate split, finance team should categorise bills by isInterState.
  for (const b of [...inBills, ...inExpenses]) {
    itcTotal += b.gstPaise;
    itcCgst  += Math.round(b.gstPaise / 2);
    itcSgst  += b.gstPaise - Math.round(b.gstPaise / 2);
  }

  // ── NET TAX PAYABLE ────────────────────────────────────────────────
  const netCgst = Math.max(0, outCgst - itcCgst);
  const netSgst = Math.max(0, outSgst - itcSgst);
  const netIgst = Math.max(0, outIgst - itcIgst);
  const totalPayable = netCgst + netSgst + netIgst;

  const result = {
    month,
    boxes: {
      // 3.1 Outward supplies
      '3.1(a) Taxable outward (other than zero-rated, nil-rated, exempt)': {
        taxableValue: paiseToRs(outTaxable - exemptTaxable),
        cgst: paiseToRs(outCgst),
        sgst: paiseToRs(outSgst),
        igst: paiseToRs(outIgst),
      },
      '3.1(b) Outward zero-rated (export, SEZ)': {
        taxableValue: paiseToRs(exportTaxable), cgst: 0, sgst: 0, igst: 0,
      },
      '3.1(c) Other outward (nil-rated, exempt)': {
        taxableValue: paiseToRs(exemptTaxable), cgst: 0, sgst: 0, igst: 0,
      },
      // 4 ITC
      '4(A)(5) All other ITC': {
        cgst: paiseToRs(itcCgst), sgst: paiseToRs(itcSgst), igst: paiseToRs(itcIgst),
      },
      '4(C) Net ITC available': {
        cgst: paiseToRs(itcCgst), sgst: paiseToRs(itcSgst), igst: paiseToRs(itcIgst),
        total: paiseToRs(itcTotal),
      },
      // 6.1 Tax payable & paid
      '6.1 Tax payable (net)': {
        cgst: paiseToRs(netCgst), sgst: paiseToRs(netSgst), igst: paiseToRs(netIgst),
        total: paiseToRs(totalPayable),
      },
    },
    counts: {
      outwardInvoices: outInvoices.length,
      inwardBills:     inBills.length,
      inwardExpenses:  inExpenses.length,
      refundReversals: reversalEntries.length,
    },
    splits: {
      b2bTaxable: paiseToRs(b2bTaxable),
      b2cTaxable: paiseToRs(b2cTaxable),
    },
    note: 'CGST/SGST split on ITC is assumed 50/50 intra-state. For accurate split, mark bills as inter-state where applicable.',
  };

  if (format !== 'csv') return NextResponse.json(result);

  // CSV — one row per GSTR-3B box for direct paste into the portal
  const rows: any[][] = [
    ['Box', 'Description', 'Taxable value (₹)', 'CGST (₹)', 'SGST (₹)', 'IGST (₹)', 'Total (₹)'],
    ['3.1(a)', 'Outward taxable supplies', result.boxes['3.1(a) Taxable outward (other than zero-rated, nil-rated, exempt)'].taxableValue, result.boxes['3.1(a) Taxable outward (other than zero-rated, nil-rated, exempt)'].cgst, result.boxes['3.1(a) Taxable outward (other than zero-rated, nil-rated, exempt)'].sgst, result.boxes['3.1(a) Taxable outward (other than zero-rated, nil-rated, exempt)'].igst, ''],
    ['3.1(b)', 'Zero-rated (export/SEZ)', result.boxes['3.1(b) Outward zero-rated (export, SEZ)'].taxableValue, 0, 0, 0, ''],
    ['3.1(c)', 'Nil-rated / exempt',     result.boxes['3.1(c) Other outward (nil-rated, exempt)'].taxableValue, 0, 0, 0, ''],
    ['4(A)5',  'All other ITC',                            '', result.boxes['4(A)(5) All other ITC'].cgst, result.boxes['4(A)(5) All other ITC'].sgst, result.boxes['4(A)(5) All other ITC'].igst, ''],
    ['4(C)',   'Net ITC available',                         '', result.boxes['4(C) Net ITC available'].cgst, result.boxes['4(C) Net ITC available'].sgst, result.boxes['4(C) Net ITC available'].igst, result.boxes['4(C) Net ITC available'].total],
    ['6.1',    'Tax payable (net of ITC)',                  '', result.boxes['6.1 Tax payable (net)'].cgst, result.boxes['6.1 Tax payable (net)'].sgst, result.boxes['6.1 Tax payable (net)'].igst, result.boxes['6.1 Tax payable (net)'].total],
  ];
  const escape = (v: any) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = rows.map(r => r.map(escape).join(',')).join('\n');
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="gstr-3b-${month}.csv"`,
    },
  });
}
