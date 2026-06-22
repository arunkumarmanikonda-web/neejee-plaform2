// lib/email/templates/recovery-t1h.ts
// T+1h — Gentle nudge, no discount, AI-personalized lede.

import { brandHeader, brandFooter, renderItems, RecoveryEmailVars } from './recovery-shared';

export function recoveryT1hEmail(vars: RecoveryEmailVars): { subject: string; html: string } {
  const name = vars.customerName?.split(' ')[0] || 'friend';
  const ai = vars.aiCopy;

  const subject = ai?.subject || `Your trunk waits in our atelier`;
  const lede = ai?.lede || `Dear ${name}, your selections are still resting on the table where you left them.`;
  const body = ai?.body || `No rush, no urgency — only the quiet hum of the loom in the next room. We thought you might like to come back when the moment feels right.\n\nYour trunk is kept safe, exactly as you arranged it.`;
  const signoff = ai?.signoff || `With warmth from the karigars,\nThe NEEJEE atelier`;
  const itemHook = ai?.itemHook || '';

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#F4EFE6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4EFE6;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#FFFEFB;">
        <tr><td>${brandHeader}</td></tr>
        <tr><td style="padding:40px 36px 24px 36px;font-family:Georgia,serif;color:#1A1613;">

          <div style="font-size:13px;letter-spacing:0.25em;color:#776657;text-transform:uppercase;margin-bottom:18px;">A note from the atelier</div>

          <h1 style="font-family:Georgia,'Playfair Display',serif;font-size:26px;color:#1A1613;font-weight:400;line-height:1.3;margin:0 0 22px 0;letter-spacing:0.01em;">
            ${escapeHtml(subject)}
          </h1>

          <p style="font-size:16px;line-height:1.7;color:#3A3128;margin:0 0 18px 0;">${escapeHtml(lede)}</p>

          ${itemHook ? `<p style="font-size:15px;line-height:1.7;color:#776657;font-style:italic;margin:0 0 22px 0;border-left:2px solid #B43F3F;padding-left:14px;">${escapeHtml(itemHook)}</p>` : ''}

          <p style="font-size:15px;line-height:1.75;color:#3A3128;margin:0 0 24px 0;white-space:pre-line;">${escapeHtml(body)}</p>

          <div style="margin:32px 0 16px 0;">
            <div style="font-size:11px;letter-spacing:0.2em;color:#776657;text-transform:uppercase;margin-bottom:14px;">In your trunk</div>
            <table width="100%" cellpadding="0" cellspacing="0" border="0">${renderItems(vars.items)}</table>
            <div style="text-align:right;padding-top:14px;font-size:14px;color:#1A1613;font-family:Georgia,serif;">
              <span style="color:#776657;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;">Total · </span>
              ₹${(vars.subtotalPaise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
          </div>

          <p style="font-size:15px;line-height:1.7;color:#3A3128;margin:28px 0 0 0;white-space:pre-line;font-style:italic;">${escapeHtml(signoff)}</p>

        </td></tr>
        <tr><td>${brandFooter(vars.recoverUrl, vars.optOutUrl)}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html };
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
