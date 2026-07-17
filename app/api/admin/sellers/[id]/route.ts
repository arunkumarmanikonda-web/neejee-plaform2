// Admin seller management: GET detail, PATCH approve/reject/edit
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { generateWelcomeCoupon } from '@/lib/welcome-coupon';
import { getSellerActivationSnapshot } from '@/lib/seller-onboarding/status';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const seller = await prisma.seller.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        businessName: true,
        contactName: true,
        email: true,
        phone: true,
        craft: true,
        region: true,
        kycStatus: true,
        rejectionNote: true,
        story: true,
        portfolio: true,
        pan: true,
        gstin: true,
        bankAccount: true,
        ifsc: true,
        bankName: true,
        products: {
          select: { id: true, name: true, status: true },
        },
        payouts: {
          take: 12,
          orderBy: { createdAt: 'desc' },
          select: { id: true, netPayoutPaise: true, status: true },
        },
        user: {
          select: { id: true, email: true, role: true },
        },
      },
    });

    if (!seller) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const documents = await prisma.sellerDocument.findMany({
      where: { sellerId: params.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      seller: {
        id: seller.id,
        businessName: seller.businessName,
        contactName: seller.contactName,
        email: seller.email,
        phone: seller.phone,
        craft: seller.craft,
        region: seller.region,
        kycStatus: seller.kycStatus,
        rejectionNote: seller.rejectionNote ?? '',
        story: seller.story ?? '',
        portfolio: Array.isArray(seller.portfolio) ? seller.portfolio : [],
        commissionPct: 20,
        qualityScore: 0,
        payoutCycle: '',
        isNeejeeSelect: false,
        yearsOfPractice: null,
        cluster: null,
        pan: seller.pan ?? '',
        gstin: seller.gstin ?? '',
        bankAccount: seller.bankAccount ?? '',
        ifsc: seller.ifsc ?? '',
        bankName: seller.bankName ?? '',
        user: seller.user,
        products: Array.isArray(seller.products) ? seller.products : [],
        payouts: Array.isArray(seller.payouts) ? seller.payouts : [],
        documents: Array.isArray(documents)
          ? documents.map((d: any) => ({
              id: d.id,
              docType: d.docType ?? d.type ?? 'OTHER',
              title: d.title ?? d.name ?? d.fileName ?? null,
              fileName: d.fileName ?? d.name ?? null,
              fileUrl: d.fileUrl ?? d.url ?? null,
              fileSize: d.fileSize ?? null,
              mimeType: d.mimeType ?? null,
              status: d.status ?? 'SUBMITTED',
              createdAt: d.createdAt ?? null,
            }))
          : [],
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to load seller' },
      { status: 500 }
    );
  }
}
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const existing = await prisma.seller.findUnique({
      where: { id: params.id },
      include: { user: true },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Quick action: re-send the original application-received confirmation email
    if (body.resendApplicationEmail) {
      const r = await sendEmail({
        to: existing.email,
        subject: 'Your NEEJEE seller application Ã¢â‚¬â€ received',
        html: sellerApplicationReceivedEmail(existing.contactName, existing.businessName),
      });
      return NextResponse.json({ success: true, emailSent: r.ok, error: r.ok ? undefined : 'Could not send email' });
    }

    const data: any = {};
    [
      'businessName','contactName','phone','craft','region','cluster','story',
      'yearsOfPractice','logoImage','coverImage','pan','gstin','bankAccount','ifsc','bankName',
      'commissionPct','qualityScore','isNeejeeSelect','payoutCycle','rejectionNote',
    ].forEach(k => { if (body[k] !== undefined) data[k] = body[k]; });

    let statusChange: 'APPROVED' | 'REJECTED' | 'REAPPROVED' | null = null;
    if (body.kycStatus && body.kycStatus !== existing.kycStatus) {
      if (body.kycStatus === 'APPROVED') {
        const activation = await getSellerActivationSnapshot(existing.id);
        if (!activation) {
          return NextResponse.json({ error: 'Seller activation snapshot unavailable' }, { status: 404 });
        }
        if (!activation.canApprove) {
          return NextResponse.json(
            {
              error: 'Seller is not approval-ready',
              code: 'seller_activation_blocked',
              blockers: activation.blockers,
              warnings: activation.warnings,
              activation,
            },
            { status: 400 }
          );
        }
      }

      data.kycStatus = body.kycStatus;
      if (body.kycStatus === 'APPROVED') {
        statusChange = existing.kycStatus === 'REJECTED' ? 'REAPPROVED' : 'APPROVED';
      }
      if (body.kycStatus === 'REJECTED') statusChange = 'REJECTED';
    }

    const seller = await prisma.seller.update({ where: { id: existing.id }, data });

    // If approved, promote the linked user to SELLER role
    if (statusChange === 'APPROVED' && existing.userId) {
      await prisma.user.update({
        where: { id: existing.userId },
        data: { role: 'SELLER' },
      }).catch(() => {});
    }

    // Status-change emails
    if (statusChange === 'APPROVED' || statusChange === 'REAPPROVED') {
      const subj = statusChange === 'REAPPROVED'
        ? `Good news from NEEJEE Ã¢â‚¬â€ we have re-opened your portal`
        : `Welcome to NEEJEE Ã¢â‚¬â€ your portal is open`;
      sendEmail({
        to: seller.email,
        subject: subj,
        html: approvalEmail(seller.contactName, seller.businessName, statusChange === 'REAPPROVED'),
      }).catch(() => {});
    }
    if (statusChange === 'REJECTED') {
      sendEmail({
        to: seller.email,
        subject: `Your NEEJEE application Ã¢â‚¬â€ a note from us`,
        html: rejectionEmail(seller.contactName, seller.businessName, body.rejectionNote || ''),
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, seller });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function shell(inner: string) {
  return `
  <div style="max-width:580px;margin:0 auto;background:#fff;font-family:Georgia,serif;">
    <div style="background:#1A1613;padding:36px;text-align:center;">
      <div style="font-family:Georgia,serif;color:#F4EFE6;font-size:32px;letter-spacing:0.18em;">NEE<span style="display:inline-block;width:6px;height:6px;background:#8B2E2A;border-radius:50%;margin:0 8px;vertical-align:middle"></span>JEE</div>
      <p style="color:#A47E3B;font-size:10px;letter-spacing:0.35em;margin-top:14px;font-style:italic;">FOUND Ã‚Â· PERSONAL</p>
    </div>
    <div style="padding:48px 36px;">${inner}</div>
    <div style="background:#F4EFE6;padding:24px;text-align:center;color:#6B6862;font-size:11px;">
      <a href="https://www.neejee.com" style="color:#8B2E2A;text-decoration:none;">www.neejee.com</a>
    </div>
  </div>`;
}

function approvalEmail(name: string, businessName: string, reapproved = false) {
  const first = (name || 'friend').split(' ')[0];
  const eyebrow = reapproved ? 'WELCOME BACK' : 'APPROVED';
  const heading = reapproved
    ? `Good news, ${first}.`
    : `Welcome to NEEJEE, ${first}.`;
  const intro = reapproved
    ? `We had another look at <strong>${businessName}</strong> and decided to open your portal. We are glad you stayed.`
    : `We are honoured to have <strong>${businessName}</strong> in our circle.`;
  return shell(`
    <p style="font-size:10px;letter-spacing:0.35em;color:#8B2E2A;margin:0 0 12px;">${eyebrow}</p>
    <h1 style="font-size:32px;color:#1A1613;margin:0 0 18px;font-weight:400;">${heading}</h1>
    <p style="color:#1A1613;line-height:1.8;font-size:15px;margin:0 0 18px;">
      ${intro}
    </p>
    <p style="color:#6B6862;line-height:1.8;font-size:14px;margin:0 0 18px;">
      Your seller portal is now open. Sign in with the same email and you'll find your dashboard at /seller Ã¢â‚¬â€ that is where you'll add your pieces, manage stock, view orders, and see your payouts.
    </p>
    <p style="color:#6B6862;line-height:1.8;font-size:14px;margin:0 0 18px;">
      Every piece you submit goes through a short personal review before it goes live. This is not bureaucracy Ã¢â‚¬â€ it is the trust our customers place in NEEJEE.
    </p>
    <a href="https://www.neejee.com/seller" style="display:inline-block;margin-top:18px;background:#1A1613;color:#F4EFE6;padding:14px 28px;text-decoration:none;letter-spacing:0.25em;font-size:12px;">OPEN MY PORTAL</a>
  `);
}

function sellerApplicationReceivedEmail(name: string, businessName: string) {
  const first = (name || 'friend').split(' ')[0];
  return shell(`
    <p style="font-size:10px;letter-spacing:0.35em;color:#8B2E2A;margin:0 0 12px;">APPLICATION RECEIVED</p>
    <h1 style="font-size:30px;color:#1A1613;margin:0 0 18px;font-weight:400;">Namaste, ${first}.</h1>
    <p style="color:#1A1613;line-height:1.8;font-size:15px;margin:0 0 18px;">
      Thank you for sharing <strong>${businessName}</strong> with us.
    </p>
    <p style="color:#6B6862;line-height:1.8;font-size:14px;margin:0 0 18px;">
      We read every application personally. It usually takes 3Ã¢â‚¬â€œ5 working days while we look at your portfolio, listen to your craft, and decide together whether NEEJEE is the right home for your work.
    </p>
    <p style="color:#6B6862;line-height:1.8;font-size:14px;margin:0 0 18px;">
      We will write back from this same address. If you have anything more to share Ã¢â‚¬â€ a story, a photograph, a person who introduced you Ã¢â‚¬â€ simply reply to this note.
    </p>
    <p style="color:#1A1613;line-height:1.8;font-size:14px;margin:0 0 0;font-style:italic;">
      With respect for your work,<br/>
      Ã¢â‚¬â€ Nidhi, Founder
    </p>
  `);
}

function rejectionEmail(name: string, businessName: string, note: string) {
  const first = (name || 'friend').split(' ')[0];
  return shell(`
    <p style="font-size:10px;letter-spacing:0.35em;color:#8B2E2A;margin:0 0 12px;">A NOTE FROM US</p>
    <h1 style="font-size:30px;color:#1A1613;margin:0 0 18px;font-weight:400;">Dear ${first},</h1>
    <p style="color:#1A1613;line-height:1.8;font-size:15px;margin:0 0 18px;">
      Thank you for sharing <strong>${businessName}</strong> with us.
    </p>
    <p style="color:#6B6862;line-height:1.8;font-size:14px;margin:0 0 18px;">
      After looking at your application carefully, we don't think NEEJEE is the right home for your work just yet. This is not a judgment of your craft Ã¢â‚¬â€ only that our trunk is small and we open it slowly.
    </p>
    ${note ? `<p style="color:#6B6862;line-height:1.8;font-size:14px;margin:0 0 18px;padding:14px 18px;background:#F4EFE6;border-left:2px solid #8B2E2A;font-style:italic;">${note}</p>` : ''}
    <p style="color:#6B6862;line-height:1.8;font-size:14px;margin:0 0 0;">
      You are welcome to reapply any time. With respect for your work,<br/>
      Ã¢â‚¬â€ The NEEJEE team
    </p>
  `);
}
