// POST /api/vendor/auth/forgot-password { email }
// Generates a vendor magic link and emails it. Always returns 200 to avoid
// leaking which emails exist in our system.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createMagicTokenForVendor } from '@/lib/vendor-auth';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function productionBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  return 'https://www.neejee.com';
}

export async function POST(request: Request) {
  let body: any = {};
  try { body = await request.json(); } catch {}
  const email = String(body?.email || '').trim().toLowerCase();
  if (!email) return NextResponse.json({ ok: true });   // silent success

  // Look up vendor by contact email OR by team-member email.
  let vendorId: string | null = null;
  const vendor = await prisma.vendor.findUnique({ where: { contactEmail: email }, select: { id: true } });
  if (vendor) {
    vendorId = vendor.id;
  } else {
    const tm = await prisma.vendorTeamMember.findFirst({
      where: { email, status: 'ACTIVE' },
      select: { vendorId: true },
    });
    if (tm) vendorId = tm.vendorId;
  }
  if (!vendorId) return NextResponse.json({ ok: true });  // silent — email doesn't exist

  try {
    const { token, expiresAt } = await createMagicTokenForVendor({
      vendorId,
      purpose: 'LOGIN',
    });
    const loginUrl = `${productionBaseUrl()}/vendor/login?token=${encodeURIComponent(token)}`;

    await sendEmail({
      to: email,
      subject: 'Reset your NEEJEE vendor portal access',
      html: `<!DOCTYPE html>
<html><body style="font-family:Georgia,serif;background:#F2EAD9;padding:40px 20px;">
  <div style="max-width:560px;margin:0 auto;background:#FBF5E8;padding:40px;border:1px solid #D4C8A8;">
    <h1 style="font-family:'Cormorant Garamond',Georgia,serif;color:#2B2118;margin:0 0 8px;">NEE<span style="color:#9F2B3C;">·</span>JEE</h1>
    <p style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#7A6952;margin:0 0 24px;">Vendor Portal</p>
    <p style="color:#2B2118;line-height:1.7;">Click the link below to sign in to your vendor portal. From there you can set or change your password.</p>
    <p style="margin:24px 0;text-align:center;">
      <a href="${loginUrl}" style="display:inline-block;padding:14px 32px;background:#9F2B3C;color:#FBF5E8;text-decoration:none;letter-spacing:2px;text-transform:uppercase;font-size:13px;">Sign in</a>
    </p>
    <p style="font-size:11px;color:#7A6952;">This link expires on ${expiresAt.toLocaleString('en-IN')}. If you didn't ask for this, please ignore.</p>
  </div>
</body></html>`,
    });
  } catch (e) {
    console.error('[vendor forgot-password]', e);
    // still return ok to client
  }
  return NextResponse.json({ ok: true });
}
