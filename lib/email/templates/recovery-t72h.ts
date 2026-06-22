// lib/email/templates/recovery-t72h.ts
// T+72h — Gentle finality, 15% farewell gift.

import { brandHeader, brandFooter, renderItems, discountPanel, RecoveryEmailVars } from './recovery-shared';

export interface T72hVars extends RecoveryEmailVars {
  discountCode: string;
  discountPercent: number;
  validHours: number;
}

export function recoveryT72hEmail(vars: T72hVars): { subject: string; html: string } {
  const name = vars.customerName?.split(' ')[0] || 'friend';
  const ai = vars.aiCopy;

  const subject = ai?.subject || `Before the loom rests`;
  const lede = ai?.lede || `Dear ${name}, a last gentle note about your trunk — a ${vars.discountPercent}% farewell gift, with code ${vars.discountCode}.`;
  const body = ai?.body || `We don't believe in pressing — only in remembering. Your trunk has stayed warm these last few days, but soon the karigars will return your pieces to the shelves.\n\nIf the moment is right, the door is open. If not, we'll be here when it is.`;
  const signoff = ai?.signoff || `With quiet gratitude,\nThe NEEJEE atelier`;
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

          <div style="font-size:13px;letter-spacing:0.25em;color:#776657;text-transform:uppercase;margin-bottom:18px;">A last note from the atelier</div>

          <h1 style="font-family:Georgia,'Playfair Display',serif;font-size:26px;color:#1A1613;font-weight:400;line-height:1.3;margin:0 0 22px 0;letter-spacing:0.01em;">
            ${escapeHtml(subject)}
          </h1>

          <p style="font-size:16px;line-height:1.7;color:#3A3128;margin:0 0 18px 0;">${escapeHtml(lede)}</p>

          ${itemHook ? `<p style="font-size:15px;line-height:1.7;color:#776657;font-style:italic;margin:0 0 22px 0;border-left:2px solid #B43F3F;padding-left:14px;">${escapeHtml(itemHook)}</p>` : ''}

          ${discountPanel(vars.discountCode, vars.discountPercent, vars.validHours)}

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
