// lib/razorpayx.ts
// Thin client for RazorpayX (the payout side of Razorpay's API).
// Payouts use the RazorpayX account credentials. Older installations opted
// into a shared merchant key pair by supplying RAZORPAYX_ACCOUNT_NUMBER.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { readCredential } from './payments/razorpay-credentials';

const RZP_BASE = 'https://api.razorpay.com/v1';

function payoutCredentials() {
  const id = readCredential(process.env.RAZORPAYX_KEY_ID);
  const secret = readCredential(process.env.RAZORPAYX_KEY_SECRET);
  const source = readCredential(process.env.RAZORPAYX_SOURCE_ACCOUNT_NUMBER);
  const legacyAccount = readCredential(process.env.RAZORPAYX_ACCOUNT_NUMBER);
  if (id || secret || source || !legacyAccount) return { id, secret, account: source || legacyAccount };
  return {
    id: readCredential(process.env.RAZORPAY_KEY_ID),
    secret: readCredential(process.env.RAZORPAY_KEY_SECRET),
    account: legacyAccount,
  };
}

function authHeader(): string {
  const { id, secret } = payoutCredentials();
  if (!id || !secret) throw new Error('RazorpayX credentials are incomplete');
  return 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64');
}

export function razorpayxConfigured(): boolean {
  const { id, secret, account } = payoutCredentials();
  const allowedMode = process.env.VERCEL_ENV === 'production' ? id.startsWith('rzp_live_')
    : process.env.VERCEL_ENV === 'preview' ? id.startsWith('rzp_test_') : true;
  return Boolean(allowedMode && id && secret && account && process.env.RAZORPAYX_WEBHOOK_SECRET?.trim());
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
  reference_id: string;         // persisted VendorPayout.id / Payout.id
  narration?: string;
  notes?: Record<string, string>;
}

export async function createPayout(input: CreatePayoutInput): Promise<{ ok: boolean; id?: string; status?: string; data?: any; error?: string }> {
  try {
    if (!razorpayxConfigured()) return { ok: false, error: 'Payout credentials or webhook are incomplete' };
    if (!input.reference_id?.trim()) return { ok: false, error: 'A persisted payout reference is required' };
    const accountNumber = payoutCredentials().account;

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
        'X-Payout-Idempotency': input.reference_id,
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

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAYX_WEBHOOK_SECRET;
  if (!secret || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
