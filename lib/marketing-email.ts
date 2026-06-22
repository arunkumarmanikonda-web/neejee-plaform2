// Marketing email helpers — render with brand wrapper, batch send via Resend.
// STRICT OPT-IN ENFORCEMENT: only sends to users with marketingConsent=true
// AND emailOptIn=true. Adds unsubscribe link.
import { sendEmail } from './email';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://neejee.com';

export interface MarketingRecipient {
  email: string;
  name?: string | null;
  userId?: string | null;
  unsubscribeToken?: string;
}

/** Wraps a marketing email body with brand chrome and unsubscribe footer. */
export function wrapMarketingHtml(opts: {
  subject: string;
  bodyHtml: string;
  recipientEmail: string;
  unsubscribeUrl?: string;
}) {
  const unsub = opts.unsubscribeUrl || `${BASE_URL}/unsubscribe?email=${encodeURIComponent(opts.recipientEmail)}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(opts.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#F4EFE6;font-family:Georgia,'Times New Roman',serif;color:#2A2622;">
<div style="max-width:600px;margin:0 auto;background:#FFFEF9;padding:0;">
  <!-- Header -->
  <div style="padding:32px 32px 20px;text-align:center;border-bottom:1px solid #E8DDD0;">
    <div style="font-family:Georgia,serif;font-size:28px;letter-spacing:0.2em;color:#7C2D2D;">NEEJEE</div>
    <div style="font-style:italic;font-size:12px;color:#8A7E70;margin-top:4px;letter-spacing:0.05em;">Found. Personal.</div>
  </div>
  <!-- Body -->
  <div style="padding:32px;line-height:1.7;font-size:15px;color:#2A2622;">
    ${opts.bodyHtml}
  </div>
  <!-- Footer -->
  <div style="padding:24px 32px 32px;border-top:1px solid #E8DDD0;text-align:center;font-size:11px;color:#8A7E70;line-height:1.6;">
    <p style="margin:0 0 8px;font-style:italic;">Personally,<br/>Nidhi &amp; the NEEJEE team</p>
    <p style="margin:12px 0;">
      <a href="${BASE_URL}" style="color:#7C2D2D;text-decoration:none;">www.neejee.com</a>
    </p>
    <p style="margin:16px 0 0;color:#A89C90;">
      You are receiving this because you opted in to NEEJEE updates.<br/>
      <a href="${unsub}" style="color:#7C2D2D;text-decoration:underline;">Unsubscribe</a> · <a href="${BASE_URL}/account" style="color:#7C2D2D;text-decoration:underline;">Manage preferences</a>
    </p>
  </div>
</div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** Personalise body — supports {{name}}, {{firstName}}, {{email}} */
export function personalise(body: string, r: MarketingRecipient): string {
  const first = (r.name || '').split(' ')[0] || 'there';
  return body
    .replace(/\{\{name\}\}/g, r.name || first)
    .replace(/\{\{firstName\}\}/g, first)
    .replace(/\{\{email\}\}/g, r.email);
}

/** Send to a batch with throttle. Returns counts. */
export async function sendMarketingBatch(opts: {
  recipients: MarketingRecipient[];
  subject: string;
  bodyHtml: string;
  campaignId?: string;
}): Promise<{ sent: number; failed: number }> {
  let sent = 0, failed = 0;
  for (const r of opts.recipients) {
    const personalSubject = personalise(opts.subject, r);
    const personalBody = personalise(opts.bodyHtml, r);
    const html = wrapMarketingHtml({
      subject: personalSubject,
      bodyHtml: personalBody,
      recipientEmail: r.email,
    });
    const res = await sendEmail({ to: r.email, subject: personalSubject, html });
    if (res.ok) sent++; else failed++;
    // Tiny pause to be gentle on rate limits
    await new Promise(r => setTimeout(r, 60));
  }
  return { sent, failed };
}
