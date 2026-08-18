// Admin seller management: GET detail, PATCH approve/reject/edit
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import { getSellerActivationSnapshot } from '@/lib/seller-onboarding/status';
import { sendSellerTransactionalEmail } from '@/lib/seller-onboarding/transactional-email';
import { issueSellerPortalActivation } from '@/lib/seller-onboarding/portal-activation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
        autoKycSummary: true,
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

    const activationSnapshot = await getSellerActivationSnapshot(params.id);

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
        address:
          ((summary: any) => {
            const onboarding =
              summary?.onboarding && typeof summary.onboarding === 'object'
                ? summary.onboarding
                : {};
            const direct = String(onboarding.address || '').trim();
            const parts = [
              onboarding.addressLine1,
              onboarding.addressLine2,
              onboarding.city,
              onboarding.state,
              onboarding.pincode,
            ]
              .map((value: any) => String(value || '').trim())
              .filter(Boolean);
            return direct || parts.join(', ');
          })(seller.autoKycSummary),
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
        autoKycSummary: seller.autoKycSummary ?? null,
        activationSnapshot,
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

    // Re-send the application acknowledgement on demand.
    if (body.resendApplicationEmail) {
      const delivery = await sendSellerTransactionalEmail({
        to: existing.email,
        subject: 'Your NEEJEE seller application — received',
        html: sellerApplicationReceivedEmail(existing.contactName, existing.businessName),
      });
      return NextResponse.json({
        success: true,
        emailSent: true,
        deliveryId: delivery.id,
      });
    }

    // Re-issue the secure portal activation email without creating or emailing passwords.
    if (body.resendActivationEmail) {
      if (String(existing.kycStatus) !== 'APPROVED') {
        return NextResponse.json({ error: 'Seller must be approved before activation can be reissued.' }, { status: 400 });
      }
      const activation = await issueSellerPortalActivation({ sellerId: existing.id, reapproved: true });
      return NextResponse.json({ success: true, activationEmailSent: true, deliveryId: activation.deliveryId });
    }

    // Clarification is a first-class state. It is not a rejection and the seller
    // should never be forced to restart their application for a missing answer.
    if (body.requestInfo) {
      const query = String(body.query || '').trim();
      const subject = String(body.subject || 'A clarification is needed for your NEEJEE seller application').trim();
      if (query.length < 3) {
        return NextResponse.json({ error: 'Please enter the clarification required from the seller.' }, { status: 400 });
      }

      if (String(existing.kycStatus) !== 'APPROVED' && String(existing.kycStatus) !== 'SUSPENDED') {
        await prisma.seller.update({
          where: { id: existing.id },
          data: { kycStatus: 'UNDER_REVIEW' },
        });
      }

      const delivery = await sendSellerTransactionalEmail({
        to: existing.email,
        subject,
        html: sellerClarificationEmail(existing.contactName, existing.businessName, query),
      });

      await prisma.sellerAuditLog.create({
        data: {
          sellerId: existing.id,
          actorUserId: user?.id || null,
          actorRole: String(user?.role || 'ADMIN'),
          action: 'SELLER_INFO_REQUEST_SENT',
          details: {
            recipient: existing.email,
            subject,
            query,
            deliveryId: delivery.id,
          },
        },
      }).catch(() => null);

      return NextResponse.json({
        success: true,
        querySent: true,
        recipient: existing.email,
        deliveryId: delivery.id,
      });
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
    let lifecycleWarning: string | null = null;

    // Approval is the single point at which Seller Studio access is issued.
    // The seller receives a short-lived activation link and creates their own
    // password; a permanent password is never generated or emailed.
    if (statusChange === 'APPROVED' || statusChange === 'REAPPROVED') {
      try {
        await issueSellerPortalActivation({
          sellerId: seller.id,
          reapproved: statusChange === 'REAPPROVED',
        });
      } catch (error: any) {
        lifecycleWarning = `Seller approved, but portal activation email could not be sent: ${String(error?.message || 'unknown error')}`;
        console.warn('[seller-admin] approval activation email failed', {
          sellerId: seller.id,
          message: String(error?.message || 'unknown error').slice(0, 240),
        });
      }
    }

    if (statusChange === 'REJECTED') {
      try {
        await sendSellerTransactionalEmail({
          to: seller.email,
          subject: 'Your NEEJEE seller application — a note from us',
          html: rejectionEmail(seller.contactName, seller.businessName, body.rejectionNote || ''),
        });
      } catch (error: any) {
        lifecycleWarning = `Seller status was updated, but the rejection email could not be sent: ${String(error?.message || 'unknown error')}`;
      }
    }

    return NextResponse.json({ success: true, seller, warning: lifecycleWarning });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function shell(inner: string) {
  return `
  <div style="max-width:580px;margin:0 auto;background:#fff;font-family:Georgia,serif;">
    <div style="background:#1A1613;padding:36px;text-align:center;">
      <div style="font-family:Georgia,serif;color:#F4EFE6;font-size:32px;letter-spacing:0.18em;">NEE<span style="display:inline-block;width:6px;height:6px;background:#8B2E2A;border-radius:50%;margin:0 8px;vertical-align:middle"></span>JEE</div>
      <p style="color:#A47E3B;font-size:10px;letter-spacing:0.35em;margin-top:14px;">FOUND. PERSONAL.</p>
    </div>
    <div style="padding:48px 36px;">${inner}</div>
    <div style="background:#F4EFE6;padding:24px;text-align:center;color:#6B6862;font-size:11px;">
      <a href="https://www.neejee.com" style="color:#8B2E2A;text-decoration:none;">neejee.com</a>
    </div>
  </div>`;
}

function sellerApplicationReceivedEmail(name: string, businessName: string) {
  const first = escapeHtml((name || 'friend').split(' ')[0]);
  const business = escapeHtml(businessName);
  return shell(`
    <p style="font-size:10px;letter-spacing:0.35em;color:#8B2E2A;margin:0 0 12px;">APPLICATION RECEIVED</p>
    <h1 style="font-size:30px;color:#1A1613;margin:0 0 18px;font-weight:400;">Namaste, ${first}.</h1>
    <p style="color:#1A1613;line-height:1.8;font-size:15px;margin:0 0 18px;">
      Thank you for sharing <strong>${business}</strong> with us.
    </p>
    <p style="color:#6B6862;line-height:1.8;font-size:14px;margin:0 0 18px;">
      Your application is in the NEEJEE review queue. We will review the KYC information and supporting documents and write to your communication email if anything further is required.
    </p>
    <p style="color:#6B6862;line-height:1.8;font-size:14px;margin:0;">
      You will not be asked to restart the application if we need a clarification.
    </p>
  `);
}

function sellerClarificationEmail(name: string, businessName: string, query: string) {
  const first = escapeHtml((name || 'friend').split(' ')[0]);
  const business = escapeHtml(businessName);
  const safeQuery = escapeHtml(query).replace(/\n/g, '<br/>');
  return shell(`
    <p style="font-size:10px;letter-spacing:0.35em;color:#8B2E2A;margin:0 0 12px;">CLARIFICATION REQUIRED</p>
    <h1 style="font-size:30px;color:#1A1613;margin:0 0 18px;font-weight:400;">Dear ${first},</h1>
    <p style="color:#1A1613;line-height:1.8;font-size:15px;margin:0 0 18px;">
      We are reviewing the seller application for <strong>${business}</strong> and need one clarification before we can complete the review.
    </p>
    <div style="color:#1A1613;line-height:1.8;font-size:14px;margin:0 0 18px;padding:16px 18px;background:#F4EFE6;border-left:3px solid #8B2E2A;">${safeQuery}</div>
    <p style="color:#6B6862;line-height:1.8;font-size:14px;margin:0 0 18px;">
      Please reply to this email with the requested information. Your existing application and uploaded documents remain safely on file; there is no need to apply again.
    </p>
    <p style="color:#1A1613;line-height:1.8;font-size:14px;margin:0;font-style:italic;">
      With respect for your work,<br/>NEEJEE Seller Review
    </p>
  `);
}

function rejectionEmail(name: string, businessName: string, note: string) {
  const first = escapeHtml((name || 'friend').split(' ')[0]);
  const business = escapeHtml(businessName);
  const safeNote = escapeHtml(note);
  return shell(`
    <p style="font-size:10px;letter-spacing:0.35em;color:#8B2E2A;margin:0 0 12px;">A NOTE FROM US</p>
    <h1 style="font-size:30px;color:#1A1613;margin:0 0 18px;font-weight:400;">Dear ${first},</h1>
    <p style="color:#1A1613;line-height:1.8;font-size:15px;margin:0 0 18px;">
      Thank you for sharing <strong>${business}</strong> with us.
    </p>
    <p style="color:#6B6862;line-height:1.8;font-size:14px;margin:0 0 18px;">
      After reviewing the application carefully, we are unable to approve it at this stage. This decision relates to the current application and does not diminish the work behind your business.
    </p>
    ${safeNote ? `<p style="color:#6B6862;line-height:1.8;font-size:14px;margin:0 0 18px;padding:14px 18px;background:#F4EFE6;border-left:2px solid #8B2E2A;font-style:italic;">${safeNote}</p>` : ''}
    <p style="color:#6B6862;line-height:1.8;font-size:14px;margin:0;">
      If circumstances change, you are welcome to contact NEEJEE again.<br/>The NEEJEE team
    </p>
  `);
}

async function getSellerDependencyCounts(sellerId: string) {
  const [
    products,
    payouts,
    documents,
    changeRequests,
    auditLogs,
    magicTokens,
    teamMembers,
    inventorySubmissions,
    categoryCommissions,
    productCommissions,
    orderReleases
  ] = await Promise.all([
    prisma.product.count({ where: { sellerId } }),
    prisma.payout.count({ where: { sellerId } }),
    prisma.sellerDocument.count({ where: { sellerId } }),
    prisma.sellerChangeRequest.count({ where: { sellerId } }),
    prisma.sellerAuditLog.count({ where: { sellerId } }),
    prisma.sellerMagicToken.count({ where: { sellerId } }),
    prisma.sellerTeamMember.count({ where: { sellerId } }),
    prisma.sellerInventorySubmission.count({ where: { sellerId } }),
    prisma.sellerCategoryCommission.count({ where: { sellerId } }),
    prisma.sellerProductCommission.count({ where: { sellerId } }),
    prisma.sellerOrderRelease.count({ where: { sellerId } }),
  ]);

  return {
    products,
    payouts,
    documents,
    changeRequests,
    auditLogs,
    magicTokens,
    teamMembers,
    inventorySubmissions,
    categoryCommissions,
    productCommissions,
    orderReleases,
  };
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const force = url.searchParams.get('force') === '1';

    const seller = await prisma.seller.findUnique({
      where: { id: params.id },
      select: { id: true, businessName: true },
    });

    if (!seller) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const deps = await getSellerDependencyCounts(params.id);
    const hardBlock = deps.products > 0 || deps.payouts > 0;

    if (hardBlock && !force) {
      return NextResponse.json(
        {
          error: 'Seller has dependent records. Remove products/payouts first or retry with force=1 only after manual review.',
          code: 'seller_delete_blocked',
          dependencies: deps,
        },
        { status: 409 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.sellerDocument.deleteMany({ where: { sellerId: params.id } });
      await tx.sellerChangeRequest.deleteMany({ where: { sellerId: params.id } });
      await tx.sellerAuditLog.deleteMany({ where: { sellerId: params.id } });
      await tx.sellerMagicToken.deleteMany({ where: { sellerId: params.id } });
      await tx.sellerTeamMember.deleteMany({ where: { sellerId: params.id } });
      await tx.sellerInventorySubmission.deleteMany({ where: { sellerId: params.id } });
      await tx.sellerCategoryCommission.deleteMany({ where: { sellerId: params.id } });
      await tx.sellerProductCommission.deleteMany({ where: { sellerId: params.id } });
      await tx.sellerOrderRelease.deleteMany({ where: { sellerId: params.id } });

      if (force) {
        await tx.product.deleteMany({ where: { sellerId: params.id } });
        await tx.payout.deleteMany({ where: { sellerId: params.id } });
      }

      await tx.seller.delete({ where: { id: params.id } });
    });

    return NextResponse.json({
      ok: true,
      deletedSellerId: params.id,
      deletedSellerName: seller.businessName || '',
      force,
      dependencies: deps,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to delete seller' },
      { status: 500 }
    );
  }
}
