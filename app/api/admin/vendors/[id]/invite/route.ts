// POST /api/admin/vendors/[id]/invite
// Generates a one-time magic link for the vendor and emails it to them via Resend.
// The link is also returned so the admin can copy/share manually if email fails.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createMagicTokenForVendor } from '@/lib/vendor-auth';
import { sendEmail } from '@/lib/email';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Production domain is ALWAYS the canonical one. Vercel preview URLs
// (project-codebase-v2-fixed-xyz.vercel.app) are password-protected by Vercel
// itself and would force the vendor through Vercel's login — never embed them
// into a magic link.
function productionBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  return 'https://www.neejee.com';
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const vendor = await prisma.vendor.findUnique({ where: { id: params.id } });
    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    if (vendor.status === 'ARCHIVED') {
      return NextResponse.json({ error: 'Cannot invite an archived vendor' }, { status: 400 });
    }

    const { token, expiresAt } = await createMagicTokenForVendor({
      vendorId: vendor.id,
      purpose: 'LOGIN',
    });

    const baseUrl = productionBaseUrl();
    const loginUrl = `${baseUrl}/vendor/login?token=${encodeURIComponent(token)}`;
    const portalUrl = `${baseUrl}/vendor`;

    // Email the vendor automatically. Falls back gracefully if RESEND_API_KEY
    // isn't set (dev mode logs to console; admin can still copy the URL).
    const subject = `Your NEEJEE vendor portal access`;
    const html = renderInviteEmail({
      vendorName: vendor.displayName || vendor.legalName,
      contactPerson: vendor.contactPerson || vendor.legalName,
      loginUrl,
      portalUrl,
      expiresAt,
    });
    const emailResult = await sendEmail({
      to: vendor.contactEmail,
      subject,
      html,
    });

    return NextResponse.json({
      ok: true,
      loginUrl,
      portalUrl,
      expiresAt,
      vendorEmail: vendor.contactEmail,
      emailSent: !!emailResult?.ok,
      emailDevMode: !!emailResult?.dev,
    });
  } catch (e: any) {
    console.error('[vendor invite]', e);
    const { status, message, code } = prismaErrorToHttp(e);
    return NextResponse.json({ error: message, code }, { status });
  }
}

function renderInviteEmail({
  vendorName, contactPerson, loginUrl, portalUrl, expiresAt,
}: {
  vendorName: string; contactPerson: string; loginUrl: string; portalUrl: string; expiresAt: Date;
}): string {
  const expiry = expiresAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F2EAD9;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F2EAD9;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#FBF5E8;border:1px solid #D4C8A8;">
        <tr><td style="padding:40px 40px 24px;">
          <h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:32px;color:#2B2118;margin:0 0 8px;letter-spacing:0.5px;">NEE<span style="color:#9F2B3C;">•</span>JEE</h1>
          <p style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#7A6952;margin:0;">Found. Personal.</p>
        </td></tr>
        <tr><td style="padding:0 40px 32px;">
          <p style="font-size:16px;color:#2B2118;line-height:1.6;margin:0 0 16px;">Dear ${escapeHtml(contactPerson)},</p>
          <p style="font-size:14px;color:#3D3225;line-height:1.7;margin:0 0 20px;">
            You've been invited to the <strong>NEEJEE Vendor Portal</strong> as <strong>${escapeHtml(vendorName)}</strong>.
            Click the secure link below to sign in. You can choose to keep magic-link-only sign-in or set a password on first visit.
          </p>
          <p style="margin:32px 0;text-align:center;">
            <a href="${loginUrl}" style="display:inline-block;padding:14px 32px;background:#9F2B3C;color:#FBF5E8;text-decoration:none;font-family:Georgia,serif;font-size:14px;letter-spacing:2px;text-transform:uppercase;">Sign in to portal</a>
          </p>
          <p style="font-size:12px;color:#7A6952;line-height:1.6;margin:0 0 8px;">
            This link expires on <strong>${expiry}</strong>. If it expires, ask your NEEJEE contact for a fresh one.
          </p>
          <p style="font-size:12px;color:#7A6952;line-height:1.6;margin:0;word-break:break-all;">
            Portal home (after sign-in): <a href="${portalUrl}" style="color:#9F2B3C;">${portalUrl}</a>
          </p>
        </td></tr>
        <tr><td style="padding:24px 40px;border-top:1px solid #E4D9BE;background:#F8F1E0;">
          <p style="font-size:11px;color:#7A6952;line-height:1.5;margin:0;">
            You received this email because the NEEJEE team added you as a supplier. If this wasn't you, please ignore — the link will expire on its own.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
