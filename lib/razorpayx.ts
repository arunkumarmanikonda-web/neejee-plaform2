// lib/razorpayx.ts
// Thin client for RazorpayX (the payout side of Razorpay's API).
// Auth uses HTTP Basic with RAZORPAY_KEY_ID:RAZORPAY_KEY_SECRET (the same
// keys used for the payments API — both share the same root credentials).
//
// Docs: https://razorpay.com/docs/api/x/
//
// We use three resources here:
//   1. Contacts        — POST /v1/contacts          (the vendor/seller entity)
//   2. Fund Accounts   — POST /v1/fund_accounts     (their bank account)
//   3. Payouts         — POST /v1/payouts           (the money movement)
//
// Optional env vars (set in Vercel):
//   RAZORPAYX_ACCOUNT_NUMBER     — your RazorpayX VA account number (mandatory for payouts)
//   RAZORPAYX_MODE               — "test" | "live"  (informational only)

const RZP_BASE = 'https://api.razorpay.com/v1';

function authHeader(): string {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) throw new Error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not configured');
  return 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64');
}

export function razorpayxConfigured(): boolean {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAYX_ACCOUNT_NUMBER);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) Contacts

export interface CreateContactInput {
  name: string;
  email?: string;
  contact?: string;             // phone
  type?: 'vendor' | 'employee' | 'customer' | 'self' | string;
  reference_id?: string;        // your own id (vendor.id / seller.id)
  notes?: Record<string, string>;
}

export async function createContact(input: CreateContactInput): Promise<{ ok: boolean; id?: string; data?: any; error?: string }> {
  try {
    const res = await fetch(`${RZP_BASE}/contacts`, {
      method: 'POST',
      headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data?.error?.description || `HTTP ${res.status}`, data };
    return { ok: true, id: data.id, data };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'createContact failed' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) Fund accounts

export interface CreateFundAccountBank {
  contact_id: string;
  account_type: 'bank_account';
  bank_account: {
    name: string;             // beneficiary name (must match bank record)
    ifsc: string;
    account_number: string;
  };
}

export interface CreateFundAccountVpa {
  contact_id: string;
  account_type: 'vpa';
  vpa: { address: string };   // e.g. "ramesh@okhdfc"
}

export async function createFundAccount(
  input: CreateFundAccountBank | CreateFundAccountVpa
): Promise<{ ok: boolean; id?: string; data?: any; error?: string }> {
  try {
    const res = await fetch(`${RZP_BASE}/fund_accounts`, {
      method: 'POST',
      headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data?.error?.description || `HTTP ${res.status}`, data };
    return { ok: true, id: data.id, data };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'createFundAccount failed' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) Payouts

export type PayoutMode = 'IMPS' | 'NEFT' | 'RTGS' | 'UPI';

export interface CreatePayoutInput {
  fund_account_id: string;
  amount: number;               // paise
  currency?: string;            // default INR
  mode: PayoutMode;
  purpose: 'payout' | 'salary' | 'vendor_bill' | 'refund' | 'cashback' | 'utility_bill';
  queue_if_low_balance?: boolean;
  reference_id?: string;        // your VendorPayout.id / Payout.id
  narration?: string;
  notes?: Record<string, string>;
}

export async function createPayout(input: CreatePayoutInput): Promise<{ ok: boolean; id?: string; status?: string; data?: any; error?: string }> {
  try {
    const accountNumber = process.env.RAZORPAYX_ACCOUNT_NUMBER;
    if (!accountNumber) return { ok: false, error: 'RAZORPAYX_ACCOUNT_NUMBER not configured' };

    const body: any = {
      account_number: accountNumber,
      currency: 'INR',
      ...input,
    };
    const res = await fetch(`${RZP_BASE}/payouts`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/json',
        // RazorpayX accepts an idempotency key on payouts. We use the payout
        // reference_id when present to make the call safe to retry.
        ...(input.reference_id ? { 'X-Payout-Idempotency': input.reference_id } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data?.error?.description || `HTTP ${res.status}`, data };
    return { ok: true, id: data.id, status: data.status, data };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'createPayout failed' };
  }
}

export async function fetchPayoutStatus(payoutId: string): Promise<{ ok: boolean; status?: string; data?: any; error?: string }> {
  try {
    const res = await fetch(`${RZP_BASE}/payouts/${payoutId}`, {
      headers: { Authorization: authHeader() },
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data?.error?.description || `HTTP ${res.status}`, data };
    return { ok: true, status: data.status, data };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'fetchPayoutStatus failed' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Webhook signature verification (X-Razorpay-Signature)

import { createHmac } from 'crypto';

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAYX_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  // constant-time compare
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}
