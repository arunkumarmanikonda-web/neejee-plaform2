// Bills (accounts payable).
// GET  /api/admin/finance/bills?status=&vendorId=&overdue=true
// POST /api/admin/finance/bills      — create a new bill
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { prismaErrorToHttp } from '@/lib/prisma-errors';
import { randomBytes } from 'crypto';
import { recordAudit } from '@/lib/finance/audit-log';
import { findOrCreateVendor } from '@/lib/finance/auto-vendor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const vendorId = url.searchParams.get('vendorId');
    const overdueOnly = url.searchParams.get('overdue') === 'true';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);

    const where: any = {};
    if (status) where.status = status;
    if (vendorId) where.vendorId = vendorId;
    if (overdueOnly) where.status = 'OVERDUE';

    const rows = await prisma.bill.findMany({
      where,
      orderBy: [{ status: 'asc' }, { dueOn: 'asc' }],
      take: limit,
      include: {
        category: { select: { id: true, code: true, label: true, group: true } },
        payments: { select: { id: true, amountPaise: true, paidOn: true, method: true } },
      },
    });

    // Refresh OVERDUE statuses on read (cheap; idempotent)
    const now = Date.now();
    const dayMs = 86_400_000;
    for (const b of rows) {
      const shouldBeOverdue = b.status === 'OPEN' && new Date(b.dueOn).getTime() < now - dayMs;
      if (shouldBeOverdue) {
        await prisma.bill.update({ where: { id: b.id }, data: { status: 'OVERDUE' } }).catch(() => {});
        b.status = 'OVERDUE' as any;
      }
    }

    return NextResponse.json({ bills: rows });
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
      billNumber, description, categoryId, vendorId, vendorNameSnapshot,
      amountPaise, gstPaise = 0, issuedOn, dueOn, receiptUrl, attachments, notes, purchaseOrderId,
    } = body;
    const atts: string[] = Array.isArray(attachments) ? attachments.filter(Boolean) : [];

    if (!description || !categoryId || amountPaise == null || !issuedOn || !dueOn) {
      return NextResponse.json({
        error: 'description, categoryId, amountPaise, issuedOn, dueOn are required',
      }, { status: 400 });
    }
    const amt = parseInt(amountPaise);
    const gst = parseInt(gstPaise) || 0;

    // v23.40.8 — fetch the category so we can stamp the vendor's serviceCategoryGroup.
    const category = await prisma.expenseCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, group: true },
    });

    // v23.40.4 — Auto-link or auto-create a Vendor so every bill lands in a ledger.
    // v23.40.8 — stamp serviceCategoryGroup from the bill's expense category.
    const vendorResolution = await findOrCreateVendor(vendorId, vendorNameSnapshot, {
      createdByUserId: session!.id,
      serviceCategoryGroup:     category?.group || null,
      defaultExpenseCategoryId: category?.id    || null,
    });
    const finalVendorId = vendorResolution.vendorId;

    // v23.40.8 — If the vendor already existed but had no category, backfill it now.
    if (finalVendorId && vendorResolution.matchedExisting && category) {
      await prisma.vendor.updateMany({
        where: { id: finalVendorId, serviceCategoryGroup: null },
        data: { serviceCategoryGroup: category.group, defaultExpenseCategoryId: category.id },
      });
    }

    // v23.40.10 — Atomic Bill + mirror Expense creation.
    // Accrual accounting: every bill IS an expense from day one (P&L recognition
    // happens at bill date, not at payment date). The Expense row is the same
    // economic event viewed from the P&L side; the Bill is the same event from
    // the AP / vendor-ledger side. Both auto-update when payments are recorded.
    const billId    = 'bill_' + randomBytes(10).toString('hex');
    const expenseId = 'exp_'  + randomBytes(10).toString('hex');

    const { bill } = await prisma.$transaction(async (tx) => {
      // Pre-create the Expense (status APPROVED — bill implies vendor invoice received)
      await tx.expense.create({
        data: {
          id: expenseId,
          categoryId,
          description: String(description).trim(),
          amountPaise: amt,
          gstPaise: gst,
          totalPaise: amt + gst,
          incurredOn: new Date(issuedOn),
          paidOn: null,
          paidPaise: 0,
          paymentStatus: 'UNPAID',
          vendorId: finalVendorId,
          vendorNameSnapshot: vendorNameSnapshot || null,
          invoiceNumber: billNumber || null,
          receiptUrl: receiptUrl || atts[0] || null,
          attachments: atts,
          notes: notes ? `[Auto-linked to bill] ${notes}` : '[Auto-linked to bill]',
          status: 'APPROVED',
          source: 'BILL',
          sourceRef: billId,
          createdByUserId: session!.id,
          reviewedByUserId: session!.id,
          reviewedAt: new Date(),
        },
      });
      const bill = await tx.bill.create({
        data: {
          id: billId,
          billNumber: billNumber || null,
          description: String(description).trim(),
          categoryId,
          vendorId: finalVendorId,
          vendorNameSnapshot: vendorNameSnapshot || null,
          amountPaise: amt,
          gstPaise: gst,
          totalPaise: amt + gst,
          paidPaise: 0,
          issuedOn: new Date(issuedOn),
          dueOn: new Date(dueOn),
          status: 'OPEN',
          receiptUrl: receiptUrl || atts[0] || null,
          attachments: atts,
          notes: notes || null,
          purchaseOrderId: purchaseOrderId || null,
          expenseId,
          createdByUserId: session!.id,
        },
      });
      return { bill };
    });
    // v23.38: audit log
    await recordAudit({
      action: 'CREATE',
      entityType: 'Bill',
      entityId: bill.id,
      after: bill,
      session,
      req,
    });
    return NextResponse.json({ bill }, { status: 201 });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
