// /api/admin/finance/vendor-payouts/[id]
// GET  - single payout
// POST - actions: { action: 'initiate' | 'sync' | 'cancel' }
// PATCH - edit notes / status (manual override)
// DELETE - remove SCHEDULED payouts (not PROCESSING/PAID)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import { initiateVendorPayout, mapRzpxStatusToVendor } from '@/lib/payouts/orchestrator';
import { fetchPayoutStatus } from '@/lib/razorpayx';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'FINANCE', 'FINANCE_OPERATOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const payout = await prisma.vendorPayout.findUnique({
    where: { id: params.id },
    include: { vendor: true },
  });
  if (!payout) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ payout });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'FINANCE'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '').toLowerCase();

    if (action === 'initiate') {
      const r = await initiateVendorPayout(params.id, user?.id || null, { mode: body.mode });
      return NextResponse.json(r);
    }

    if (action === 'sync') {
      const payout = await prisma.vendorPayout.findUnique({ where: { id: params.id } });
      if (!payout) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      if (!payout.rzpxPayoutId) return NextResponse.json({ error: 'No RazorpayX id on this payout' }, { status: 400 });
      const r = await fetchPayoutStatus(payout.rzpxPayoutId);
      if (!r.ok) return NextResponse.json({ error: r.error || 'Sync failed' }, { status: 500 });
      const mapped = mapRzpxStatusToVendor(r.status);
      const updated = await prisma.vendorPayout.update({
        where: { id: params.id },
        data: {
          status: mapped,
          rzpxStatus: r.status || null,
          paidAt: mapped === 'PAID' ? (payout.paidAt || new Date()) : payout.paidAt,
          rzpxFailReason: mapped === 'FAILED' ? (r.data?.failure_reason || payout.rzpxFailReason || null) : payout.rzpxFailReason,
        },
      });
      return NextResponse.json({ ok: true, payout: updated, rawStatus: r.status });
    }

    if (action === 'cancel') {
      const payout = await prisma.vendorPayout.findUnique({ where: { id: params.id } });
      if (!payout) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      if (payout.status !== 'SCHEDULED') {
        return NextResponse.json({ error: `Cannot cancel from ${payout.status} state` }, { status: 400 });
      }
      const updated = await prisma.vendorPayout.update({
        where: { id: params.id },
        data: { status: 'CANCELLED', notes: body.reason || payout.notes },
      });
      return NextResponse.json({ ok: true, payout: updated });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Action failed' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'FINANCE'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const update: any = {};
    if (typeof body.notes === 'string')          update.notes = body.notes;
    if (typeof body.scheduledFor === 'string')   update.scheduledFor = new Date(body.scheduledFor);
    if (typeof body.transactionRef === 'string') update.transactionRef = body.transactionRef;
    // Manual status override (admin only)
    if (typeof body.status === 'string' && ['SCHEDULED','PROCESSING','PAID','FAILED','CANCELLED'].includes(body.status)) {
      update.status = body.status;
      if (body.status === 'PAID') update.paidAt = new Date();
    }
    const payout = await prisma.vendorPayout.update({ where: { id: params.id }, data: update });
    return NextResponse.json({ ok: true, payout });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const payout = await prisma.vendorPayout.findUnique({ where: { id: params.id } });
    if (!payout) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (payout.status !== 'SCHEDULED' && payout.status !== 'CANCELLED' && payout.status !== 'FAILED') {
      return NextResponse.json({ error: `Cannot delete a ${payout.status} payout` }, { status: 400 });
    }
    await prisma.vendorPayout.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Delete failed' }, { status: 500 });
  }
}
