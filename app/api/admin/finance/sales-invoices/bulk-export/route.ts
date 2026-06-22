// v23.40.13 — Bulk CSV export for selected sales invoices.
// GET /api/admin/finance/sales-invoices/bulk-export?ids=id1,id2,...
// Returns: a CSV file (Content-Disposition: attachment)

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
  const ids = (url.searchParams.get('ids') || '').split(',').filter(Boolean);
  if (!ids.length) return NextResponse.json({ error: 'ids required' }, { status: 400 });

  const invoices = await prisma.salesInvoice.findMany({
    where: { id: { in: ids } },
    include: { lines: true },
    orderBy: { invoiceNumber: 'asc' },
  });

  const header = [
    'Invoice #', 'Date', 'Type', 'Channel', 'Sale type',
    'Customer', 'Customer email', 'Customer phone', 'Customer GSTIN',
    'Place of supply', 'HSN/SAC', 'Description', 'Qty', 'Rate (₹)',
    'Discount (₹)', 'Taxable (₹)', 'GST rate (%)', 'CGST (₹)', 'SGST (₹)', 'IGST (₹)',
    'Line total (₹)',
    'Inv subtotal (₹)', 'Inv discount (₹)', 'Inv taxable (₹)',
    'Inv CGST (₹)', 'Inv SGST (₹)', 'Inv IGST (₹)',
    'Inv shipping (₹)', 'Inv shipping GST (₹)', 'Inv total (₹)',
    'Inv paid (₹)', 'Inv outstanding (₹)', 'Payment status',
  ];

  const rows: any[][] = [];
  for (const inv of invoices) {
    if (!inv.lines.length) {
      // Invoice with no lines — still emit one row
      rows.push([
        inv.invoiceNumber,
        new Date(inv.issuedOn).toLocaleDateString('en-IN'),
        inv.invoiceType, inv.saleChannel, inv.saleType,
        inv.customerName, inv.customerEmail || '', inv.customerPhone || '', inv.customerGstin || '',
        inv.placeOfSupply || '', '', '', '', '', '', '', '', '', '', '', '',
        inv.subtotalPaise / 100, inv.discountPaise / 100, inv.taxableValuePaise / 100,
        inv.cgstPaise / 100, inv.sgstPaise / 100, inv.igstPaise / 100,
        inv.shippingPaise / 100, inv.shippingTaxPaise / 100, inv.totalPaise / 100,
        inv.paidPaise / 100, (inv.totalPaise - inv.paidPaise) / 100, inv.paymentStatus,
      ]);
      continue;
    }
    for (const l of inv.lines) {
      rows.push([
        inv.invoiceNumber,
        new Date(inv.issuedOn).toLocaleDateString('en-IN'),
        inv.invoiceType, inv.saleChannel, inv.saleType,
        inv.customerName, inv.customerEmail || '', inv.customerPhone || '', inv.customerGstin || '',
        inv.placeOfSupply || '',
        l.hsnSac || '', l.description, l.quantity, l.unitPricePaise / 100,
        l.discountPaise / 100, l.taxableValuePaise / 100, l.gstRatePercent || 0,
        l.cgstPaise / 100, l.sgstPaise / 100, l.igstPaise / 100,
        l.totalPaise / 100,
        inv.subtotalPaise / 100, inv.discountPaise / 100, inv.taxableValuePaise / 100,
        inv.cgstPaise / 100, inv.sgstPaise / 100, inv.igstPaise / 100,
        inv.shippingPaise / 100, inv.shippingTaxPaise / 100, inv.totalPaise / 100,
        inv.paidPaise / 100, (inv.totalPaise - inv.paidPaise) / 100, inv.paymentStatus,
      ]);
    }
  }

  const escape = (v: any) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header, ...rows].map(r => r.map(escape).join(',')).join('\n');
  const filename = `neejee-invoices-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
