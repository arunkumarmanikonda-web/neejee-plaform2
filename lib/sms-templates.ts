// lib/sms-templates.ts
// Registry of DLT-approved templates for NEEJEE. Each entry maps a notification
// event to the Fast2SMS DLT message_id + the canonical text + the variable
// extraction order.
//
// HOW TO ADD A NEW TEMPLATE
//   1. Register the template on your DLT portal (Jio/Airtel/VI/BSNL via your
//      Sender ID provider). Copy the approved text EXACTLY.
//   2. In the Fast2SMS dashboard, paste the same text under DLT Templates and
//      pick the same Sender ID → save → copy the numeric message_id.
//   3. Add a row below with that message_id and the variable order.
//   4. Each {#var#} in the template corresponds to a position in `vars[]`.
//
// IMPORTANT: variable values are pipe-separated in transit. Pipes inside any
// variable value will break the template — sanitise on the way in.

export interface SmsTemplate {
  // Stable internal key used by callers
  key: string;
  // Numeric DLT message_id from Fast2SMS dashboard (env var name to read it from)
  envVar: string;
  // The canonical template body (with {1}, {2}, ... placeholders for variables)
  preview: string;
  // What each variable holds, in order. Used by UI + validation.
  variables: string[];
  // Optional category for the admin Settings page grouping.
  group: 'auth' | 'order' | 'shipping' | 'marketing' | 'admin';
}

export const SMS_TEMPLATES: SmsTemplate[] = [
  // ── Authentication ────────────────────────────────────────────────
  {
    key: 'otp_login',
    envVar: 'FAST2SMS_OTP_TEMPLATE_ID',
    preview: 'Your NEEJEE verification code is {1}. Valid for 10 minutes. Do not share with anyone. -NEEJEE',
    variables: ['code'],
    group: 'auth',
  },

  // ── Order lifecycle ──────────────────────────────────────────────
  {
    key: 'order_placed',
    envVar: 'FAST2SMS_TPL_ORDER_PLACED',
    preview: 'Hello {1}, your NEEJEE order {2} for Rs. {3} has been placed. Track at neejee.com/orders/{2}. -NEEJEE',
    variables: ['firstName', 'orderNumber', 'amount'],
    group: 'order',
  },
  {
    key: 'order_confirmed',
    envVar: 'FAST2SMS_TPL_ORDER_CONFIRMED',
    preview: 'Hello {1}, payment received for order {2}. We are now packing your piece with care. -NEEJEE',
    variables: ['firstName', 'orderNumber'],
    group: 'order',
  },
  {
    key: 'order_shipped',
    envVar: 'FAST2SMS_TPL_ORDER_SHIPPED',
    preview: 'Hello {1}, your NEEJEE order {2} has shipped via {3}. AWB {4}. Track at neejee.com/orders/{2}. -NEEJEE',
    variables: ['firstName', 'orderNumber', 'courier', 'awb'],
    group: 'shipping',
  },
  {
    key: 'order_out_for_delivery',
    envVar: 'FAST2SMS_TPL_ORDER_OFD',
    preview: 'Hello {1}, your NEEJEE order {2} is out for delivery today. Please keep your phone reachable. -NEEJEE',
    variables: ['firstName', 'orderNumber'],
    group: 'shipping',
  },
  {
    key: 'order_delivered',
    envVar: 'FAST2SMS_TPL_ORDER_DELIVERED',
    preview: 'Hello {1}, order {2} has been delivered. We hope you cherish it. Reply to share a moment. -NEEJEE',
    variables: ['firstName', 'orderNumber'],
    group: 'order',
  },
  {
    key: 'order_cancelled',
    envVar: 'FAST2SMS_TPL_ORDER_CANCELLED',
    preview: 'Hello {1}, your NEEJEE order {2} has been cancelled. Any refund will reflect in 5-7 working days. -NEEJEE',
    variables: ['firstName', 'orderNumber'],
    group: 'order',
  },
  {
    key: 'order_refund',
    envVar: 'FAST2SMS_TPL_ORDER_REFUND',
    preview: 'Hello {1}, a refund of Rs. {2} for order {3} has been initiated. It will reflect in 5-7 working days. -NEEJEE',
    variables: ['firstName', 'amount', 'orderNumber'],
    group: 'order',
  },

  // ── Marketing (only with explicit opt-in) ────────────────────────
  {
    key: 'marketing_drop_live',
    envVar: 'FAST2SMS_TPL_MKT_DROP',
    preview: 'Hello {1}, a new NEEJEE piece is live: {2}. View at neejee.com/{3}. Reply STOP to unsubscribe. -NEEJEE',
    variables: ['firstName', 'productName', 'slug'],
    group: 'marketing',
  },
];

// Lookup by event key
export function getTemplate(key: string): SmsTemplate | undefined {
  return SMS_TEMPLATES.find(t => t.key === key);
}

// Read the configured DLT message_id from env for a template (returns null
// when the env var isn't set — caller should skip the send and fall back to
// EMAIL/WhatsApp).
export function getTemplateId(key: string): string | null {
  const tpl = getTemplate(key);
  if (!tpl) return null;
  const id = process.env[tpl.envVar];
  return id && id.trim() ? id.trim() : null;
}

// Build the canonical preview text by substituting {n} → vars[n-1].
// Useful for logging and the admin "Test SMS" tool.
export function fillTemplate(key: string, vars: string[]): string {
  const tpl = getTemplate(key);
  if (!tpl) return '';
  return tpl.preview.replace(/\{(\d+)\}/g, (_m, n) => vars[Number(n) - 1] ?? '');
}
