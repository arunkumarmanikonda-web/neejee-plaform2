// lib/sms.ts
// Fast2SMS DLT-compliant SMS client.
//
// Two distinct routes:
//   1. DLT route       — transactional messages, requires DLT-approved template
//                        (TRAI-mandated for promotional + transactional in India)
//   2. OTP route       — Fast2SMS-managed OTP flow with built-in template
//
// Env vars (set in Vercel):
//   FAST2SMS_API_KEY              — Fast2SMS dashboard → API key
//   FAST2SMS_SENDER_ID            — your DLT-approved 6-char sender (e.g. "NEEJEY")
//   FAST2SMS_DLT_ENTITY_ID        — your DLT principal entity ID (PEID) — required by some carriers
//   FAST2SMS_DLT_HEADER_ID        — your DLT header ID                — optional, only some carriers
//   FAST2SMS_OTP_TEMPLATE_ID      — DLT message_id (numeric) for the OTP template
//   FAST2SMS_MODE                 — "live" | "test" (informational)

const FAST2SMS_BASE = 'https://www.fast2sms.com/dev';

export interface SendDltSmsArgs {
  phone: string;                 // 10-digit Indian number or +91XXXXXXXXXX
  templateId: string;            // numeric DLT message_id from your Fast2SMS dashboard
  vars: string[];                // ordered list of variable values to fill {#var#} slots
  rawMessage?: string;           // optional canonical text (for logging only)
}

export interface SmsResult {
  ok: boolean;
  provider: 'fast2sms';
  requestId?: string;
  status?: string;
  error?: string;
  raw?: any;
}

export function fast2smsConfigured(): boolean {
  return !!process.env.FAST2SMS_API_KEY;
}

// ─── Normalise a phone number to 10-digit Indian (Fast2SMS expects no +91) ─
export function normalisePhone(p: string): string {
  return (p || '').replace(/^\+91/, '').replace(/^91(?=\d{10}$)/, '').replace(/\D/g, '').slice(-10);
}

// ─── DLT route ───────────────────────────────────────────────────────────
// Sends a templated transactional SMS. Variables fill the {#var#} placeholders
// in your DLT-approved template (in registration order).
export async function sendDltSms(args: SendDltSmsArgs): Promise<SmsResult> {
  const key = process.env.FAST2SMS_API_KEY;
  if (!key) return { ok: false, provider: 'fast2sms', error: 'FAST2SMS_API_KEY missing' };

  const phone = normalisePhone(args.phone);
  if (phone.length !== 10) return { ok: false, provider: 'fast2sms', error: `Invalid phone: ${args.phone}` };

  const senderId = process.env.FAST2SMS_SENDER_ID || 'NEEJEY';
  const variables = (args.vars || []).join('|'); // Fast2SMS expects pipe-separated values

  const body = new URLSearchParams({
    authorization: key,
    route: 'dlt',
    sender_id: senderId,
    message: args.templateId,        // DLT message_id (the numeric template id)
    variables_values: variables,
    numbers: phone,
    flash: '0',
  });
  // Optional DLT entity/header for telcos that require them on the wire
  if (process.env.FAST2SMS_DLT_ENTITY_ID) body.append('entity_id', process.env.FAST2SMS_DLT_ENTITY_ID);

  try {
    const res = await fetch(`${FAST2SMS_BASE}/bulkV2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data: any = await res.json().catch(() => ({}));
    // Fast2SMS returns { return: true, request_id, message: ["..."] } on success
    if (res.ok && data?.return !== false && !data?.message?.[0]?.includes?.('Invalid')) {
      return {
        ok: true,
        provider: 'fast2sms',
        requestId: data?.request_id ? String(data.request_id) : undefined,
        status: 'sent',
        raw: data,
      };
    }
    const err = data?.message
      ? (Array.isArray(data.message) ? data.message.join('; ') : String(data.message))
      : `HTTP ${res.status}`;
    return { ok: false, provider: 'fast2sms', error: err, raw: data };
  } catch (e: any) {
    return { ok: false, provider: 'fast2sms', error: e?.message || 'network error' };
  }
}

// ─── OTP route ───────────────────────────────────────────────────────────
// Fast2SMS has a dedicated /otp endpoint that:
//   - generates the 6-digit code OR accepts your own
//   - sends via a Fast2SMS-managed OTP template (no DLT setup needed on this route)
// We pass our own code so we can verify it server-side.
export async function sendOtpSms(phone: string, code: string): Promise<SmsResult> {
  const key = process.env.FAST2SMS_API_KEY;
  if (!key) return { ok: false, provider: 'fast2sms', error: 'FAST2SMS_API_KEY missing' };
  const p = normalisePhone(phone);
  if (p.length !== 10) return { ok: false, provider: 'fast2sms', error: `Invalid phone: ${phone}` };
  if (!/^\d{4,6}$/.test(code)) return { ok: false, provider: 'fast2sms', error: 'OTP must be 4-6 digits' };

  // If a dedicated DLT OTP template is configured, prefer the DLT route so the
  // SMS carries the NEEJEE sender ID. Otherwise use Fast2SMS-managed OTP route.
  const otpTplId = process.env.FAST2SMS_OTP_TEMPLATE_ID;
  if (otpTplId) {
    return sendDltSms({
      phone: p,
      templateId: otpTplId,
      vars: [code],
      rawMessage: `Your NEEJEE verification code is ${code}. Valid for 10 minutes. Do not share.`,
    });
  }

  // Fallback: Fast2SMS OTP route (uses their generic OTP sender)
  const body = new URLSearchParams({
    authorization: key,
    variables_values: code,
    route: 'otp',
    numbers: p,
  });
  try {
    const res = await fetch(`${FAST2SMS_BASE}/bulkV2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data: any = await res.json().catch(() => ({}));
    if (res.ok && data?.return !== false) {
      return { ok: true, provider: 'fast2sms', requestId: data?.request_id ? String(data.request_id) : undefined, status: 'sent', raw: data };
    }
    const err = data?.message
      ? (Array.isArray(data.message) ? data.message.join('; ') : String(data.message))
      : `HTTP ${res.status}`;
    return { ok: false, provider: 'fast2sms', error: err, raw: data };
  } catch (e: any) {
    return { ok: false, provider: 'fast2sms', error: e?.message || 'network error' };
  }
}

// ─── Wallet/balance helper for the admin Settings page ──────────────────
export async function fast2smsBalance(): Promise<{ ok: boolean; balance?: number; error?: string }> {
  const key = process.env.FAST2SMS_API_KEY;
  if (!key) return { ok: false, error: 'FAST2SMS_API_KEY missing' };
  try {
    const res = await fetch(`${FAST2SMS_BASE}/wallet?authorization=${encodeURIComponent(key)}`);
    const data: any = await res.json().catch(() => ({}));
    if (res.ok && data?.wallet) {
      return { ok: true, balance: Number(data.wallet) };
    }
    return { ok: false, error: data?.message || `HTTP ${res.status}` };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'network error' };
  }
}
