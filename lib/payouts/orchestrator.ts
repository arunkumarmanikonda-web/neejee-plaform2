// lib/payouts/orchestrator.ts
// Initiate a RazorpayX payout for a vendor or seller. Caches contact_id and
// fund_account_id on the entity so subsequent payouts skip those steps.
//
// Map of RazorpayX statuses → our enum:
//   "queued" | "pending"      → PROCESSING
//   "processing"              → PROCESSING
//   "processed"               → PAID
//   "cancelled"               → CANCELLED
//   "rejected"                → FAILED
//   "reversed"                → FAILED  (later: REVERSED if we add it)
//   "failed"                  → FAILED

import { prisma } from '@/lib/prisma';
import {
  createContact, createFundAccount, createPayout, razorpayxConfigured,
  type PayoutMode,
} from '@/lib/razorpayx';

export function mapRzpxStatusToVendor(s?: string): 'SCHEDULED' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CANCELLED' {
  switch ((s || '').toLowerCase()) {
    case 'queued':
    case 'pending':
    case 'processing':       return 'PROCESSING';
    case 'processed':        return 'PAID';
    case 'cancelled':        return 'CANCELLED';
    case 'rejected':
    case 'reversed':
    case 'failed':           return 'FAILED';
    default:                 return 'PROCESSING';
  }
}

export function mapRzpxStatusToSeller(s?: string): 'PENDING' | 'PROCESSING' | 'PAID' | 'ON_HOLD' {
  switch ((s || '').toLowerCase()) {
    case 'queued':
    case 'pending':          return 'PENDING';
    case 'processing':       return 'PROCESSING';
    case 'processed':        return 'PAID';
    case 'cancelled':
    case 'rejected':
    case 'reversed':
    case 'failed':           return 'ON_HOLD';
    default:                 return 'PROCESSING';
  }
}

// ─────────────────────────────────────────────────────────────────────────────

interface EntityBanking {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  rzpxContactId: string | null;
  rzpxFundAccountId: string | null;
}

async function ensureContactAndFundAccount(
  entity: EntityBanking,
  entityType: 'vendor' | 'seller',
  persistUpdate: (data: { rzpxContactId?: string; rzpxFundAccountId?: string }) => Promise<void>,
): Promise<{ ok: boolean; contactId?: string; fundAccountId?: string; error?: string }> {
  if (!entity.bankAccountNumber || !entity.bankIfsc) {
    return { ok: false, error: 'Beneficiary bank account / IFSC missing on entity' };
  }
  if (!entity.bankAccountName && !entity.name) {
    return { ok: false, error: 'Beneficiary name missing' };
  }

  // 1. Contact
  let contactId = entity.rzpxContactId || null;
  if (!contactId) {
    const c = await createContact({
      name: entity.name.slice(0, 50),
      email: entity.email || undefined,
      contact: entity.phone || undefined,
      type: 'vendor',
      reference_id: `${entityType}_${entity.id}`,
    });
    if (!c.ok || !c.id) return { ok: false, error: `Contact create failed: ${c.error}` };
    contactId = c.id;
    await persistUpdate({ rzpxContactId: contactId });
  }

  // 2. Fund account
  let fundAccountId = entity.rzpxFundAccountId || null;
  if (!fundAccountId) {
    const fa = await createFundAccount({
      contact_id: contactId,
      account_type: 'bank_account',
      bank_account: {
        name: (entity.bankAccountName || entity.name).slice(0, 120),
        ifsc: entity.bankIfsc.toUpperCase(),
        account_number: entity.bankAccountNumber,
      },
    });
    if (!fa.ok || !fa.id) return { ok: false, error: `Fund account create failed: ${fa.error}` };
    fundAccountId = fa.id;
    await persistUpdate({ rzpxFundAccountId: fundAccountId });
  }

  return { ok: true, contactId, fundAccountId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Vendor payouts

export async function initiateVendorPayout(payoutId: string, actorUserId: string | null, opts?: { mode?: PayoutMode }) {
  if (!razorpayxConfigured()) {
    throw new Error('RazorpayX not configured (set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAYX_ACCOUNT_NUMBER)');
  }

  const payout = await prisma.vendorPayout.findUnique({
    where: { id: payoutId },
    include: { vendor: true },
  });
  if (!payout) throw new Error('Payout not found');
  if (payout.status === 'PAID') throw new Error('Already paid');
  if (payout.status === 'PROCESSING') throw new Error('Already in-flight (PROCESSING)');

  const v = payout.vendor as any;
  const ensured = await ensureContactAndFundAccount(
    {
      id: v.id,
      name: v.displayName || v.legalName || 'Vendor',
      email: v.contactEmail || null,
      phone: v.contactPhone || null,
      bankAccountName: v.bankAccountName || null,
      bankAccountNumber: v.bankAccountNumber || null,
      bankIfsc: v.bankIfsc || null,
      rzpxContactId: v.rzpxContactId || null,
      rzpxFundAccountId: v.rzpxFundAccountId || null,
    },
    'vendor',
    async (data) => {
      await prisma.vendor.update({ where: { id: v.id }, data });
    },
  );
  if (!ensured.ok) {
    await prisma.vendorPayout.update({
      where: { id: payout.id },
      data: { status: 'FAILED', rzpxFailReason: ensured.error || 'banking setup failed' },
    });
    throw new Error(ensured.error || 'Failed to set up RazorpayX contact / fund account');
  }

  // Default to IMPS (instant, up to ₹5L); fall back to NEFT for larger amounts
  const mode: PayoutMode = opts?.mode || (payout.netPaise > 500000 * 100 ? 'NEFT' : 'IMPS');

  const r = await createPayout({
    fund_account_id: ensured.fundAccountId!,
    amount: payout.netPaise,
    mode,
    purpose: 'vendor_bill',
    queue_if_low_balance: true,
    reference_id: payout.id,
    narration: `NEEJEE payout ${payout.id.slice(0, 8)}`,
    notes: {
      vendorId: v.id,
      vendorName: (v.displayName || v.legalName || '').slice(0, 80),
      poCount: String((payout.poIds || []).length),
    },
  });

  if (!r.ok || !r.id) {
    await prisma.vendorPayout.update({
      where: { id: payout.id },
      data: { status: 'FAILED', rzpxFailReason: r.error || 'createPayout failed' },
    });
    throw new Error(r.error || 'RazorpayX payout failed');
  }

  const mappedStatus = mapRzpxStatusToVendor(r.status);
  await prisma.vendorPayout.update({
    where: { id: payout.id },
    data: {
      status: mappedStatus,
      rzpxPayoutId: r.id,
      rzpxStatus: r.status || null,
      paymentMethod: 'RAZORPAY_PAYOUT',
      transactionRef: r.id,
      initiatedAt: new Date(),
      initiatedByUserId: actorUserId,
      paidAt: mappedStatus === 'PAID' ? new Date() : null,
    },
  });

  return { ok: true, rzpxPayoutId: r.id, status: mappedStatus, rawStatus: r.status };
}

// ─────────────────────────────────────────────────────────────────────────────
// Seller payouts (mirror of vendor flow)

export async function initiateSellerPayout(payoutId: string, actorUserId: string | null, opts?: { mode?: PayoutMode }) {
  if (!razorpayxConfigured()) {
    throw new Error('RazorpayX not configured (set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAYX_ACCOUNT_NUMBER)');
  }

  const payout = await prisma.payout.findUnique({
    where: { id: payoutId },
    include: { seller: true },
  });
  if (!payout) throw new Error('Payout not found');
  if (payout.status === 'PAID') throw new Error('Already paid');
  if (payout.status === 'PROCESSING') throw new Error('Already in-flight (PROCESSING)');

  const s = payout.seller as any;
  const ensured = await ensureContactAndFundAccount(
    {
      id: s.id,
      name: s.businessName || s.contactName || 'Seller',
      email: s.email || null,
      phone: s.phone || null,
      bankAccountName: s.businessName || s.contactName || null,
      bankAccountNumber: s.bankAccount || null,
      bankIfsc: s.ifsc || null,
      rzpxContactId: s.rzpxContactId || null,
      rzpxFundAccountId: s.rzpxFundAccountId || null,
    },
    'seller',
    async (data) => {
      await prisma.seller.update({ where: { id: s.id }, data });
    },
  );
  if (!ensured.ok) {
    await prisma.payout.update({
      where: { id: payout.id },
      data: { status: 'ON_HOLD', rzpxFailReason: ensured.error || 'banking setup failed' },
    });
    throw new Error(ensured.error || 'Failed to set up RazorpayX contact / fund account');
  }

  const mode: PayoutMode = opts?.mode || (payout.netPayoutPaise > 500000 * 100 ? 'NEFT' : 'IMPS');

  const r = await createPayout({
    fund_account_id: ensured.fundAccountId!,
    amount: payout.netPayoutPaise,
    mode,
    purpose: 'payout',
    queue_if_low_balance: true,
    reference_id: payout.id,
    narration: `NEEJEE seller payout ${payout.id.slice(0, 8)}`,
    notes: {
      sellerId: s.id,
      sellerName: (s.businessName || s.contactName || '').slice(0, 80),
      orderCount: String(payout.orderCount || 0),
    },
  });

  if (!r.ok || !r.id) {
    await prisma.payout.update({
      where: { id: payout.id },
      data: { status: 'ON_HOLD', rzpxFailReason: r.error || 'createPayout failed' },
    });
    throw new Error(r.error || 'RazorpayX payout failed');
  }

  const mappedStatus = mapRzpxStatusToSeller(r.status);
  await prisma.payout.update({
    where: { id: payout.id },
    data: {
      status: mappedStatus,
      rzpxPayoutId: r.id,
      rzpxStatus: r.status || null,
      utr: r.id,
      initiatedAt: new Date(),
      initiatedByUserId: actorUserId,
      paidAt: mappedStatus === 'PAID' ? new Date() : null,
    },
  });

  return { ok: true, rzpxPayoutId: r.id, status: mappedStatus, rawStatus: r.status };
}
