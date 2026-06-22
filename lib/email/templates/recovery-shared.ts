// lib/email/templates/recovery-shared.ts
// v26.3a — Shared chrome for recovery emails.
// Matches the existing brand header in lib/email.ts (kohl/ivory palette).

export const brandHeader = `
  <div style="background:#1A1613;padding:36px 24px;text-align:center;">
    <table align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
      <tr>
        <td style="font-family:Georgia,'Playfair Display',serif;color:#F4EFE6;font-size:34px;letter-spacing:0.18em;font-weight:400;padding-right:6px;line-height:1;">NEE</td>
        <td style="padding:0 4px;vertical-align:middle;">
          <div style="width:6px;height:6px;background:#B43F3F;border-radius:50%;display:inline-block;"></div>
        </td>
        <td style="font-family:Georgia,'Playfair Display',serif;color:#F4EFE6;font-size:34px;letter-spacing:0.18em;font-weight:400;padding-left:6px;line-height:1;">JEE</td>
      </tr>
    </table>
    <div style="font-family:Georgia,serif;color:#A89A86;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;margin-top:14px;">Heritage Crafts · India</div>
  </div>
`;

export const brandFooter = (recoverUrl: string, optOutUrl: string) => `
  <div style="background:#F4EFE6;padding:32px 24px;text-align:center;font-family:Georgia,serif;">
    <div style="margin-bottom:18px;">
      <a href="${recoverUrl}" style="background:#1A1613;color:#F4EFE6;text-decoration:none;padding:14px 32px;font-family:Georgia,serif;letter-spacing:0.12em;font-size:13px;text-transform:uppercase;display:inline-block;">Return to your trunk</a>
    </div>
    <div style="font-size:12px;color:#776657;letter-spacing:0.06em;margin-top:24px;">
      <a href="https://neejee.com" style="color:#776657;text-decoration:none;">neejee.com</a>
      &nbsp;·&nbsp;
      <a href="mailto:hello@neejee.com" style="color:#776657;text-decoration:none;">hello@neejee.com</a>
    </div>
    <div style="font-size:11px;color:#A89A86;margin-top:16px;font-style:italic;">
      <a href="${optOutUrl}" style="color:#A89A86;text-decoration:underline;">No more notes, please</a>
    </div>
  </div>
`;

export interface RenderItem {
  name: string;
  craft?: string | null;
  region?: string | null;
  quantity: number;
  price: number; // paise
}

export function renderItems(items: RenderItem[]): string {
  return items.slice(0, 4).map(i => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #E8E0D2;font-family:Georgia,serif;">
        <div style="color:#1A1613;font-size:15px;letter-spacing:0.02em;">${escapeHtml(i.name)}</div>
        <div style="color:#776657;font-size:12px;margin-top:4px;font-style:italic;">
          ${i.craft ? escapeHtml(i.craft) : ''}${i.region ? ` · ${escapeHtml(i.region)}` : ''}
        </div>
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #E8E0D2;text-align:right;font-family:Georgia,serif;color:#1A1613;font-size:14px;">
        ${i.quantity} × ₹${(i.price / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
      </td>
    </tr>
  `).join('');
}

export function discountPanel(code: string, percent: number, expiresInHours: number): string {
  return `
    <div style="background:#F9F4EA;border:1px dashed #B43F3F;padding:20px;text-align:center;margin:24px 0;font-family:Georgia,serif;">
      <div style="font-size:11px;color:#776657;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">A small gesture</div>
      <div style="font-size:22px;color:#1A1613;letter-spacing:0.08em;margin-bottom:6px;">${percent}% from the karigars</div>
      <div style="font-family:'Courier New',monospace;font-size:18px;color:#B43F3F;letter-spacing:0.2em;margin:10px 0;">${escapeHtml(code)}</div>
      <div style="font-size:11px;color:#776657;font-style:italic;">rests until ${expiresInHours} hours from now</div>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export interface RecoveryEmailVars {
  customerName: string | null | undefined;
  items: RenderItem[];
  subtotalPaise: number;
  recoverUrl: string;
  optOutUrl: string;
  aiCopy?: {
    subject: string;
    lede: string;
    body: string;
    signoff: string;
    itemHook: string;
  };
}
