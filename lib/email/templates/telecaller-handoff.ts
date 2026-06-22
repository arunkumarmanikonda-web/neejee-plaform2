// lib/email/templates/telecaller-handoff.ts
// T+7d — Internal notification to the telecaller team.
// NOT sent to the customer. Triggers a row in the telecaller dashboard.

export interface TelecallerHandoffVars {
  cartId: string;
  customerName: string | null | undefined;
  customerEmail: string;
  customerPhone: string | null | undefined;
  itemCount: number;
  subtotalPaise: number;
  craftRegions: string[]; // distinct craft+region tuples for talking points
  adminUrl: string;       // /admin/telecaller/<cartId>
}

export function telecallerHandoffEmail(vars: TelecallerHandoffVars): { subject: string; html: string } {
  const subject = `[Telecaller queue] ${vars.customerName || vars.customerEmail} · ₹${(vars.subtotalPaise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  const talking = vars.craftRegions.slice(0, 3).map(cr => `<li style="margin:4px 0;">${escapeHtml(cr)}</li>`).join('');

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F4EFE6;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" border="0" style="background:#FFFEFB;border:1px solid #E8E0D2;">
        <tr><td style="padding:28px 32px;">
          <div style="font-size:11px;letter-spacing:0.25em;color:#B43F3F;text-transform:uppercase;margin-bottom:12px;">Internal · Telecaller queue</div>
          <h2 style="font-family:Georgia,serif;font-size:20px;color:#1A1613;margin:0 0 18px 0;font-weight:400;">A customer is ready for a personal call</h2>

          <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:20px;">
            <tr><td style="padding:6px 0;color:#776657;font-size:13px;width:120px;">Name</td><td style="padding:6px 0;color:#1A1613;font-size:14px;">${escapeHtml(vars.customerName || '—')}</td></tr>
            <tr><td style="padding:6px 0;color:#776657;font-size:13px;">Email</td><td style="padding:6px 0;color:#1A1613;font-size:14px;">${escapeHtml(vars.customerEmail)}</td></tr>
            <tr><td style="padding:6px 0;color:#776657;font-size:13px;">Phone</td><td style="padding:6px 0;color:#1A1613;font-size:14px;">${escapeHtml(vars.customerPhone || '—')}</td></tr>
            <tr><td style="padding:6px 0;color:#776657;font-size:13px;">Trunk value</td><td style="padding:6px 0;color:#1A1613;font-size:14px;">₹${(vars.subtotalPaise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })} · ${vars.itemCount} item${vars.itemCount > 1 ? 's' : ''}</td></tr>
          </table>

          ${talking ? `
          <div style="background:#F9F4EA;padding:16px;margin:18px 0;">
            <div style="font-size:11px;letter-spacing:0.18em;color:#776657;text-transform:uppercase;margin-bottom:8px;">Talking points</div>
            <ul style="margin:0;padding-left:20px;color:#3A3128;font-size:14px;line-height:1.6;">${talking}</ul>
          </div>` : ''}

          <div style="margin-top:24px;text-align:center;">
            <a href="${vars.adminUrl}" style="background:#1A1613;color:#F4EFE6;text-decoration:none;padding:12px 28px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;display:inline-block;">Open in dashboard</a>
          </div>

          <p style="font-size:11px;color:#A89A86;margin-top:24px;text-align:center;">This customer was contacted by email at T+1h, T+24h, and T+72h with no conversion.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html };
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
