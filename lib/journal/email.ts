// lib/journal/email.ts
// Sends the weekly "new journal draft awaits review" email to Nidhi and admins.

import { sendEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import type { CuratedDraft } from './auto-curate';

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'https://www.neejee.com'
  ).replace(/\/$/, '');
}

function renderReviewEmailHtml(draft: CuratedDraft): string {
  const base = baseUrl();
  const approveUrl = `${base}/api/journal/approve?token=${draft.approvalToken}`;
  const rejectUrl = `${base}/api/journal/reject?token=${draft.approvalToken}`;
  const adminUrl = `${base}/admin/journal/${draft.draftId}`;
  const bodyHtml = draft.body
    .split(/\n\n+/)
    .map(p => `<p style="margin:0 0 14px 0; line-height:1.65; color:#2c2622;">${escapeHtml(p)}</p>`)
    .join('\n');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; background:#F4EFE6; font-family:Georgia, 'Times New Roman', serif; color:#2c2622;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4EFE6; padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border:1px solid #d9cfc1; padding:32px;">
        <tr><td>
          <p style="font-family:Helvetica,Arial,sans-serif; font-size:11px; letter-spacing:3px; color:#8B2E2A; text-transform:uppercase; margin:0 0 8px 0;">NEEJEE · Weekly Journal · Awaiting your review</p>
          <h1 style="font-family:Georgia,serif; font-size:24px; color:#1a1714; margin:0 0 6px 0;">${escapeHtml(draft.title)}</h1>
          <p style="font-family:Helvetica,Arial,sans-serif; font-size:12px; color:#6b5d4f; margin:0 0 20px 0;">Theme: ${escapeHtml(draft.theme)}${draft.seedRef ? ` · ${escapeHtml(draft.seedRef)}` : ''}</p>

          ${draft.coverImage ? `<img src="${escapeAttr(draft.coverImage)}" alt="" width="536" style="display:block; width:100%; height:auto; margin-bottom:20px; border:1px solid #e8e0d3;">` : ''}

          ${draft.excerpt ? `<p style="font-style:italic; color:#6b5d4f; border-left:2px solid #8B2E2A; padding-left:12px; margin:0 0 20px 0; font-size:15px;">${escapeHtml(draft.excerpt)}</p>` : ''}

          ${bodyHtml}

          <hr style="border:none; border-top:1px solid #d9cfc1; margin:28px 0;">

          <p style="font-family:Helvetica,Arial,sans-serif; font-size:13px; color:#2c2622; margin:0 0 16px 0;">
            One click to publish, one click to reject, or open in the admin to edit first:
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;">
            <tr>
              <td style="padding-right:8px;"><a href="${approveUrl}" style="display:inline-block; background:#8B2E2A; color:#ffffff; padding:12px 22px; font-family:Helvetica,Arial,sans-serif; font-size:12px; letter-spacing:2px; text-decoration:none; text-transform:uppercase;">Approve &amp; Publish</a></td>
              <td style="padding-right:8px;"><a href="${rejectUrl}" style="display:inline-block; background:#1a1714; color:#ffffff; padding:12px 22px; font-family:Helvetica,Arial,sans-serif; font-size:12px; letter-spacing:2px; text-decoration:none; text-transform:uppercase;">Reject</a></td>
              <td><a href="${adminUrl}" style="display:inline-block; background:#ffffff; color:#1a1714; border:1px solid #1a1714; padding:11px 22px; font-family:Helvetica,Arial,sans-serif; font-size:12px; letter-spacing:2px; text-decoration:none; text-transform:uppercase;">Edit in Admin</a></td>
            </tr>
          </table>

          <p style="font-family:Helvetica,Arial,sans-serif; font-size:11px; color:#8b8278; margin:0;">
            This draft was generated automatically on ${new Date().toUTCString()} by the NEEJEE weekly journal cron.
            If you do not act, the draft will simply stay in PENDING_REVIEW. Nothing publishes without your approval.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;');
}

export async function sendJournalReviewEmail(draft: CuratedDraft): Promise<{ sent: number; recipients: string[] }> {
  // Recipients: Nidhi (env override) + all SUPER_ADMIN / ADMIN users.
  const nidhiEmail = process.env.NIDHI_EMAIL || process.env.FOUNDER_EMAIL || '';
  const admins = await prisma.user.findMany({
    where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
    select: { email: true },
  });

  const set = new Set<string>();
  if (nidhiEmail) set.add(nidhiEmail.toLowerCase());
  for (const a of admins) if (a.email) set.add(a.email.toLowerCase());

  const recipients = Array.from(set);
  if (recipients.length === 0) return { sent: 0, recipients: [] };

  const html = renderReviewEmailHtml(draft);
  const subject = `Journal awaiting review · ${draft.title}`;

  let sent = 0;
  for (const to of recipients) {
    try {
      const res = await sendEmail({ to, subject, html });
      if (res?.ok) sent++;
    } catch (e) {
      console.error('[journal.email] send failed for', to, e);
    }
  }
  return { sent, recipients };
}
