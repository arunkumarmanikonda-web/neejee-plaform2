// Expense CRUD with maker-checker.
//
// Auto-approval logic at create time:
//   threshold = null  → APPROVED immediately (no threshold = no checker needed)
//   threshold = 0     → PENDING always (every entry needs approval)
//   amount <= threshold → APPROVED
//   amount > threshold  → PENDING

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm, canApproveFinance } from '@/lib/finance/roles';
import { prismaErrorToHttp } from '@/lib/prisma-errors';
import { findOrCreateVendor } from '@/lib/finance/auto-vendor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Decide initial status of a new expense based on category threshold & user role. */
function initialStatus(
  amountPaise: number,
  threshold: number | null,
  userCanApprove: boolean,
): 'APPROVED' | 'PENDING' {
  // If user is a checker (FINANCE/ADMIN/SUPER_ADMIN), respect threshold — they can post
  // their own entries below threshold as approved; above threshold still goes to PENDING
  // (per maker-checker hygiene — even managers self-approve sparingly).
  if (threshold === null) return 'APPROVED';
  if (threshold === 0) return 'PENDING';
  if (amountPaise <= threshold) return 'APPROVED';
  return 'PENDING';
}

export async function GET(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const categoryId = url.searchParams.get('categoryId');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);

    const where: any = {};
    if (status) where.status = status;
    if (categoryId) where.categoryId = categoryId;
    if (from || to) {
      where.incurredOn = {};
      if (from) where.incurredOn.gte = new Date(from);
      if (to) where.incurredOn.lte = new Date(to);
    }

    const rows = await prisma.expense.findMany({
      where,
      include: {
        category: { select: { id: true, code: true, label: true, group: true } },
        // v23.40.2 — include payments for inline display
        payments: { orderBy: { paidOn: 'desc' }, select: { id: true, amountPaise: true, paidOn: true, method: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return NextResponse.json({ expenses: rows });
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
      categoryId, description, amountPaise, gstPaise = 0,
      incurredOn, paidOn, vendorId, vendorNameSnapshot,
      invoiceNumber, receiptUrl, attachments, orderId, notes, status: requestedStatus,
    } = body;
    const atts: string[] = Array.isArray(attachments) ? attachments.filter(Boolean) : [];

    if (!categoryId || !description || amountPaise == null || !incurredOn) {
      return NextResponse.json({
        error: 'categoryId, description, amountPaise, and incurredOn are required',
      }, { status: 400 });
    }
    const amt = parseInt(amountPaise);
    const gst = parseInt(gstPaise) || 0;
    if (isNaN(amt) || amt < 0) {
      return NextResponse.json({ error: 'amountPaise must be a non-negative integer' }, { status: 400 });
    }

    const category = await prisma.expenseCategory.findUnique({ where: { id: categoryId } });
    if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    if (!category.isActive) return NextResponse.json({ error: 'Category is archived' }, { status: 400 });

    // v23.40.4 — Auto-link or auto-create a Vendor so every booking lands in a ledger.
    // v23.40.8 — also stamp the vendor's serviceCategoryGroup from the booking's ExpenseCategory.
    const vendorResolution = await findOrCreateVendor(vendorId, vendorNameSnapshot, {
      createdByUserId: session!.id,
      serviceCategoryGroup: category.group,
      defaultExpenseCategoryId: category.id,
    });
    const finalVendorId = vendorResolution.vendorId;

    // v23.40.8 — If the vendor already existed but had no category, backfill it now.
    if (finalVendorId && vendorResolution.matchedExisting) {
      await prisma.vendor.updateMany({
        where: { id: finalVendorId, serviceCategoryGroup: null },
        data: { serviceCategoryGroup: category.group, defaultExpenseCategoryId: category.id },
      });
    }

    // Save-as-draft override
    const wantDraft = requestedStatus === 'DRAFT';
    const autoStatus = initialStatus(amt, category.approvalThresholdPaise, canApproveFinance(session));
    const status = wantDraft ? 'DRAFT' : autoStatus;

    const created = await prisma.expense.create({
      data: {
        categoryId,
        description: String(description).trim(),
        amountPaise: amt,
        gstPaise: gst,
        totalPaise: amt + gst,
        incurredOn: new Date(incurredOn),
        paidOn: paidOn ? new Date(paidOn) : null,
        vendorId: finalVendorId,
        vendorNameSnapshot: vendorNameSnapshot || null,
        invoiceNumber: invoiceNumber || null,
        receiptUrl: receiptUrl || atts[0] || null,
        attachments: atts,                            // v23.39.4
        orderId: orderId || null,
        notes: notes || null,
        status,
        createdByUserId: session!.id,
        // If maker-checker auto-approved, stamp the reviewer too
        ...(status === 'APPROVED' && !wantDraft ? {
          reviewedByUserId: session!.id,
          reviewedAt: new Date(),
          reviewNote: 'Auto-approved (under category threshold)',
        } : {}),
        source: 'MANUAL',
      },
      include: { category: { select: { code: true, label: true, group: true } } },
    });

    // Notify approvers if pending (broadcasts to ADMIN + SUPER_ADMIN + FINANCE)
    if (status === 'PENDING') {
      try {
        const { notify } = await import('@/lib/notifications');
        // Also include FINANCE users explicitly (toAdmins is ADMIN/SUPER_ADMIN by default)
        const financeUsers = await prisma.user.findMany({
          where: { role: 'FINANCE' },
          select: { id: true },
        });
        notify({
          event: 'EXPENSE_PENDING_APPROVAL',
          toAdmins: true,
          userIds: financeUsers.map(u => u.id),
          data: {
            description: created.description,
            amount: (amt / 100).toLocaleString('en-IN'),
            category: created.category.label,
            createdByEmail: session!.email,
          },
          context: { type: 'EXPENSE', id: created.id },
        }).catch(() => {});
      } catch { /* notify is best-effort */ }
    }

    return NextResponse.json({ expense: created }, { status: 201 });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    console.error('[finance.expense.create]', err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
