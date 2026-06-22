// v23.40.7 — Backfill: link orphan Expenses + Bills to Vendors.
//
// Many records booked before v23.40.4 have `vendorNameSnapshot` set but no
// `vendorId`. This means they don't appear in any vendor ledger.
// This endpoint walks every such record, finds (or auto-creates) the matching
// Vendor by name, and writes back the `vendorId`.
//
// POST /api/admin/finance/backfill/vendor-links?dryRun=1   — preview only
// POST /api/admin/finance/backfill/vendor-links            — execute

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { findOrCreateVendor } from '@/lib/finance/auto-vendor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.write');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dryRun') === '1';

  const result = {
    expenses: { scanned: 0, linkedToExisting: 0, vendorCreated: 0, skipped: 0, details: [] as any[] },
    bills:    { scanned: 0, linkedToExisting: 0, vendorCreated: 0, skipped: 0, details: [] as any[] },
    dryRun,
  };

  // ── Expenses ──────────────────────────────────────────────────────────
  const orphanExpenses = await prisma.expense.findMany({
    where: { vendorId: null, vendorNameSnapshot: { not: null } },
    select: { id: true, description: true, vendorNameSnapshot: true, totalPaise: true,
             category: { select: { id: true, group: true } } },
  });
  result.expenses.scanned = orphanExpenses.length;

  for (const e of orphanExpenses) {
    const name = (e.vendorNameSnapshot || '').trim();
    if (!name) { result.expenses.skipped++; continue; }
    if (dryRun) {
      // Preview — only check if a vendor exists, don't create or write
      const candidate = await prisma.vendor.findFirst({
        where: { OR: [
          { legalName:   { equals: name, mode: 'insensitive' } },
          { displayName: { equals: name, mode: 'insensitive' } },
        ]},
        select: { id: true, displayName: true, legalName: true },
      });
      if (candidate) {
        result.expenses.linkedToExisting++;
        result.expenses.details.push({ id: e.id, name, action: 'would link', vendorId: candidate.id, vendorName: candidate.displayName || candidate.legalName });
      } else {
        result.expenses.vendorCreated++;
        result.expenses.details.push({ id: e.id, name, action: 'would create vendor' });
      }
      continue;
    }
    // Real run
    const res = await findOrCreateVendor(null, name, {
      createdByUserId: session!.id,
      serviceCategoryGroup:     e.category?.group || null,
      defaultExpenseCategoryId: e.category?.id    || null,
    });
    if (!res.vendorId) { result.expenses.skipped++; continue; }
    await prisma.expense.update({ where: { id: e.id }, data: { vendorId: res.vendorId } });
    if (res.matchedExisting && e.category) {
      await prisma.vendor.updateMany({
        where: { id: res.vendorId, serviceCategoryGroup: null },
        data: { serviceCategoryGroup: e.category.group, defaultExpenseCategoryId: e.category.id },
      });
    }
    if (res.created)         { result.expenses.vendorCreated++;     result.expenses.details.push({ id: e.id, name, action: 'created vendor + linked', vendorId: res.vendorId }); }
    else if (res.matchedExisting) { result.expenses.linkedToExisting++; result.expenses.details.push({ id: e.id, name, action: 'linked to existing',       vendorId: res.vendorId }); }
  }

  // ── Bills ─────────────────────────────────────────────────────────────
  const orphanBills = await prisma.bill.findMany({
    where: { vendorId: null, vendorNameSnapshot: { not: null } },
    select: { id: true, description: true, vendorNameSnapshot: true, totalPaise: true,
             category: { select: { id: true, group: true } } },
  });
  result.bills.scanned = orphanBills.length;

  for (const b of orphanBills) {
    const name = (b.vendorNameSnapshot || '').trim();
    if (!name) { result.bills.skipped++; continue; }
    if (dryRun) {
      const candidate = await prisma.vendor.findFirst({
        where: { OR: [
          { legalName:   { equals: name, mode: 'insensitive' } },
          { displayName: { equals: name, mode: 'insensitive' } },
        ]},
        select: { id: true, displayName: true, legalName: true },
      });
      if (candidate) {
        result.bills.linkedToExisting++;
        result.bills.details.push({ id: b.id, name, action: 'would link', vendorId: candidate.id, vendorName: candidate.displayName || candidate.legalName });
      } else {
        result.bills.vendorCreated++;
        result.bills.details.push({ id: b.id, name, action: 'would create vendor' });
      }
      continue;
    }
    const res = await findOrCreateVendor(null, name, {
      createdByUserId: session!.id,
      serviceCategoryGroup:     b.category?.group || null,
      defaultExpenseCategoryId: b.category?.id    || null,
    });
    if (!res.vendorId) { result.bills.skipped++; continue; }
    await prisma.bill.update({ where: { id: b.id }, data: { vendorId: res.vendorId } });
    if (res.matchedExisting && b.category) {
      await prisma.vendor.updateMany({
        where: { id: res.vendorId, serviceCategoryGroup: null },
        data: { serviceCategoryGroup: b.category.group, defaultExpenseCategoryId: b.category.id },
      });
    }
    if (res.created)         { result.bills.vendorCreated++;     result.bills.details.push({ id: b.id, name, action: 'created vendor + linked', vendorId: res.vendorId }); }
    else if (res.matchedExisting) { result.bills.linkedToExisting++; result.bills.details.push({ id: b.id, name, action: 'linked to existing',       vendorId: res.vendorId }); }
  }

  return NextResponse.json(result);
}
