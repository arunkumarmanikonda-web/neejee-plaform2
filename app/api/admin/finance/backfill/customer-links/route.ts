// v23.40.11 — Backfill: link existing SalesInvoices to Customer profiles.
//
// Pre-v23.40.11 invoices have customerName/Email/Phone/Gstin as free-text snapshots
// but no customerId. This endpoint walks each invoice, finds/creates a matching
// Customer (by phone → email → name), and writes back customerId.
//
// POST /api/admin/finance/backfill/customer-links?dryRun=1  — preview
// POST /api/admin/finance/backfill/customer-links            — execute

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { findOrCreateCustomer } from '@/lib/finance/auto-customer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.write');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dryRun') === '1';

  const orphans = await prisma.salesInvoice.findMany({
    where: { customerId: null },
    select: {
      id: true, invoiceNumber: true,
      customerName: true, customerEmail: true, customerPhone: true,
      customerGstin: true, customerUserId: true, totalPaise: true,
      invoiceType: true, saleChannel: true,
    },
  });

  const result = {
    scanned: orphans.length,
    linkedExisting: 0,
    createdNew: 0,
    failed: 0,
    samples: [] as { invoiceNumber: string; customer: string; matchedBy: string; totalPaise: number }[],
    errors: [] as { invoiceId: string; error: string }[],
  };

  if (dryRun) {
    // Simulate: just predict counts via cheap lookups for first 20
    for (const inv of orphans.slice(0, 20)) {
      result.samples.push({
        invoiceNumber: inv.invoiceNumber,
        customer: inv.customerName,
        matchedBy: 'preview-only',
        totalPaise: inv.totalPaise,
      });
    }
    return NextResponse.json({ dryRun: true, result });
  }

  for (const inv of orphans) {
    try {
      const resolution = await findOrCreateCustomer({
        name: inv.customerName,
        email: inv.customerEmail,
        phone: inv.customerPhone,
        gstin: inv.customerGstin,
        userId: inv.customerUserId,
        channel: inv.saleChannel === 'POS' ? 'POS' : (inv.saleChannel === 'BULK' ? 'BULK' : 'WEBSITE'),
        customerType: inv.customerGstin ? 'B2B' : (inv.invoiceType === 'BULK' ? 'WHOLESALE' : 'INDIVIDUAL'),
        source: 'IMPORT',
        createdByUserId: session!.id,
      });
      if (!resolution) { result.failed++; continue; }

      await prisma.salesInvoice.update({
        where: { id: inv.id },
        data: { customerId: resolution.customerId },
      });

      if (resolution.matchedExisting) result.linkedExisting++;
      else                            result.createdNew++;

      if (result.samples.length < 15) {
        result.samples.push({
          invoiceNumber: inv.invoiceNumber,
          customer: inv.customerName,
          matchedBy: resolution.matchedBy,
          totalPaise: inv.totalPaise,
        });
      }
    } catch (err: any) {
      result.failed++;
      result.errors.push({ invoiceId: inv.id, error: err.message || String(err) });
    }
  }

  return NextResponse.json({ dryRun: false, result });
}
