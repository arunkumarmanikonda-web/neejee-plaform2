// Admin seller management: GET detail, PATCH approve/reject/edit, DELETE controlled cleanup.
import { KycStatus, Role } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { getSellerActivationSnapshot } from '@/lib/seller-onboarding/status';
import { deleteFile, privateSellerStorageRef } from '@/lib/storage';
import { sellerDocumentStoragePathFromAdminUrl } from '@/lib/seller-onboarding/document-storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const APPROVABLE_USER_ROLES = new Set<Role>([Role.CUSTOMER, Role.SELLER]);

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sellerAddress(summary: any) {
  const onboarding = summary?.onboarding && typeof summary.onboarding === 'object'
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
}

function pendingStorageKeys(summary: any): string[] {
  const docs = Array.isArray(summary?.pendingDocuments) ? summary.pendingDocuments : [];
  return docs
    .map((doc: any) => String(doc?.storageKey || '').trim())
    .filter((value: string) => value && !value.includes('..') && !value.includes('\\') && !value.includes('\0'));
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
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
        products: { select: { id: true, name: true, status: true } },
        payouts: {
          take: 12,
          orderBy: { createdAt: 'desc' },
          select: { id: true, netPayoutPaise: true, status: true },
        },
        user: { select: { id: true, email: true, role: true } },
      },
    });

    if (!seller) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const [activationSnapshot, documents] = await Promise.all([
      getSellerActivationSnapshot(params.id),
      prisma.sellerDocument.findMany({
        where: { sellerId: params.id },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return NextResponse.json({
      seller: {
        id: seller.id,
        businessName: seller.businessName,
        contactName: seller.contactName,
        email: seller.email,
        phone: seller.phone,
        address: sellerAddress(seller.autoKycSummary),
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
        documents: documents.map((document: any) => ({
          id: document.id,
          docType: document.docType ?? document.type ?? 'OTHER',
          title: document.title ?? document.name ?? document.fileName ?? null,
          fileName: document.fileName ?? document.name ?? null,
          fileUrl: document.fileUrl ?? document.url ?? null,
          fileSize: document.fileSize ?? null,
          mimeType: document.mimeType ?? null,
          status: document.status ?? 'SUBMITTED',
          createdAt: document.createdAt ?? null,
        })),
      },
    });
  } catch (error) {
    console.error('[admin.sellers.detail] failed', {
      sellerId: params.id,
      message: error instanceof Error ? error.message : 'unknown_error',
    });
    return NextResponse.json({ error: 'Failed to load seller' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const admin = await getSession();
  if (!requireRole(admin, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const existing = await prisma.seller.findUnique({
      where: { id: params.id },
      include: { user: true },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (body.resendApplicationEmail) {
      const sent = await sendEmail({
        to: existing.email,
        subject: 'Your NEEJEE seller application has been received',
        html: sellerApplicationReceivedEmail(existing.contactName, existing.businessName),
      });
      return NextResponse.json({
        success: sent.ok,
        emailSent: sent.ok,
        ...(sent.ok ? {} : { error: 'Could not send the application email right now' }),
      }, { status: sent.ok ? 200 : 502 });
    }

    const data: Record<string, any> = {};
    [
      'businessName', 'contactName', 'phone', 'craft', 'region', 'cluster', 'story',
      'yearsOfPractice', 'logoImage', 'coverImage', 'pan', 'gstin', 'bankAccount', 'ifsc', 'bankName',
      'commissionPct', 'qualityScore', 'isNeejeeSelect', 'payoutCycle', 'rejectionNote',
    ].forEach((key) => {
      if (body[key] !== undefined) data[key] = body[key];
    });

    let statusChange: 'APPROVED' | 'REJECTED' | 'REAPPROVED' | null = null;
    if (body.kycStatus !== undefined) {
      if (!Object.values(KycStatus).includes(body.kycStatus as KycStatus)) {
        return NextResponse.json({ error: 'Invalid KYC status' }, { status: 400 });
      }

      if (body.kycStatus !== existing.kycStatus) {
        if (body.kycStatus === KycStatus.APPROVED) {
          const activation = await getSellerActivationSnapshot(existing.id);
          if (!activation) {
            return NextResponse.json({ error: 'Seller activation snapshot unavailable' }, { status: 404 });
          }
          if (!activation.canApprove) {
            return NextResponse.json({
              error: 'Seller is not approval-ready',
              code: 'seller_activation_blocked',
              blockers: activation.blockers,
              warnings: activation.warnings,
              activation,
            }, { status: 400 });
          }
          if (!existing.userId || !existing.user) {
            return NextResponse.json({
              error: 'Seller cannot be approved until the verified applicant account is linked',
              code: 'seller_user_missing',
            }, { status: 400 });
          }
          if (!APPROVABLE_USER_ROLES.has(existing.user.role)) {
            return NextResponse.json({
              error: 'The linked account has a protected internal role and cannot be promoted automatically',
              code: 'seller_protected_account_role',
            }, { status: 409 });
          }
        }

        data.kycStatus = body.kycStatus;
        if (body.kycStatus === KycStatus.APPROVED) {
          statusChange = existing.kycStatus === KycStatus.REJECTED ? 'REAPPROVED' : 'APPROVED';
        } else if (body.kycStatus === KycStatus.REJECTED) {
          statusChange = 'REJECTED';
        }
      }
    }

    const seller = await prisma.$transaction(async (tx) => {
      const updated = await tx.seller.update({ where: { id: existing.id }, data });
      if ((statusChange === 'APPROVED' || statusChange === 'REAPPROVED') && existing.userId) {
        await tx.user.update({
          where: { id: existing.userId },
          data: { role: Role.SELLER },
        });
      }
      return updated;
    });

    let emailSent: boolean | null = null;
    if (statusChange === 'APPROVED' || statusChange === 'REAPPROVED') {
      const subject = statusChange === 'REAPPROVED'
        ? 'Good news from NEEJEE · your seller portal has been reopened'
        : 'Welcome to NEEJEE · your seller portal is open';
      const sent = await sendEmail({
        to: seller.email,
        subject,
        html: approvalEmail(seller.contactName, seller.businessName, statusChange === 'REAPPROVED'),
      });
      emailSent = sent.ok;
    } else if (statusChange === 'REJECTED') {
      const sent = await sendEmail({
        to: seller.email,
        subject: 'Your NEEJEE seller application · a note from us',
        html: rejectionEmail(seller.contactName, seller.businessName, body.rejectionNote || ''),
      });
      emailSent = sent.ok;
    }

    return NextResponse.json({
      success: true,
      seller,
      statusChange,
      emailSent,
      ...(emailSent === false ? { emailWarning: 'Status changed successfully, but the notification email could not be delivered.' } : {}),
    });
  } catch (error) {
    console.error('[admin.sellers.patch] failed', {
      sellerId: params.id,
      message: error instanceof Error ? error.message : 'unknown_error',
    });
    return NextResponse.json({ error: 'Failed to update seller' }, { status: 500 });
  }
}

function shell(inner: string) {
  return `
  <div style="max-width:580px;margin:0 auto;background:#fff;font-family:Georgia,serif;">
    <div style="background:#1A1613;padding:32px;text-align:center;">
      <div style="font-family:Georgia,serif;color:#F4EFE6;font-size:30px;letter-spacing:0.16em;">NEEJEE</div>
      <p style="color:#A47E3B;font-size:10px;letter-spacing:0.28em;margin:12px 0 0;">FOUND. PERSONAL.</p>
    </div>
    <div style="padding:48px 36px;">${inner}</div>
    <div style="background:#F4EFE6;padding:24px;text-align:center;color:#6B6862;font-size:11px;">
      <a href="https://www.neejee.com" style="color:#8B2E2A;text-decoration:none;">www.neejee.com</a>
    </div>
  </div>`;
}

function approvalEmail(name: string, businessName: string, reapproved = false) {
  const first = escapeHtml((name || 'friend').trim().split(/\s+/)[0]);
  const business = escapeHtml(businessName);
  const eyebrow = reapproved ? 'WELCOME BACK' : 'APPROVED';
  const heading = reapproved ? `Good news, ${first}.` : `Welcome to NEEJEE, ${first}.`;
  const intro = reapproved
    ? `We reviewed <strong>${business}</strong> again and have reopened your seller portal.`
    : `We are honoured to welcome <strong>${business}</strong> to NEEJEE.`;

  return shell(`
    <p style="font-size:10px;letter-spacing:0.35em;color:#8B2E2A;margin:0 0 12px;">${eyebrow}</p>
    <h1 style="font-size:32px;color:#1A1613;margin:0 0 18px;font-weight:400;">${heading}</h1>
    <p style="color:#1A1613;line-height:1.8;font-size:15px;margin:0 0 18px;">${intro}</p>
    <p style="color:#6B6862;line-height:1.8;font-size:14px;margin:0 0 18px;">
      Sign in with the verified email used for your application. Your seller dashboard is available at NEEJEE Seller Studio, where you can add pieces, manage stock, review orders and follow payouts.
    </p>
    <p style="color:#6B6862;line-height:1.8;font-size:14px;margin:0 0 18px;">
      Every piece submitted to NEEJEE goes through a personal review before it is published. This protects the trust customers place in the marketplace and in its makers.
    </p>
    <a href="https://www.neejee.com/seller" style="display:inline-block;margin-top:18px;background:#1A1613;color:#F4EFE6;padding:14px 28px;text-decoration:none;letter-spacing:0.25em;font-size:12px;">OPEN MY PORTAL</a>
  `);
}

function sellerApplicationReceivedEmail(name: string, businessName: string) {
  const first = escapeHtml((name || 'friend').trim().split(/\s+/)[0]);
  const business = escapeHtml(businessName);
  return shell(`
    <p style="font-size:10px;letter-spacing:0.35em;color:#8B2E2A;margin:0 0 12px;">APPLICATION RECEIVED</p>
    <h1 style="font-size:30px;color:#1A1613;margin:0 0 18px;font-weight:400;">Namaste, ${first}.</h1>
    <p style="color:#1A1613;line-height:1.8;font-size:15px;margin:0 0 18px;">
      Thank you for sharing <strong>${business}</strong> with us.
    </p>
    <p style="color:#6B6862;line-height:1.8;font-size:14px;margin:0 0 18px;">
      We review every seller application carefully. The application will now move through NEEJEE's KYC and marketplace review process, and we will write to you when there is a decision or if anything further is required.
    </p>
    <p style="color:#6B6862;line-height:1.8;font-size:14px;margin:0 0 18px;">
      If you have additional context about your craft, provenance or making process, you may reply to the application email and share it with the team.
    </p>
    <p style="color:#1A1613;line-height:1.8;font-size:14px;margin:0;font-style:italic;">
      With respect for your work,<br/>NEEJEE
    </p>
  `);
}

function rejectionEmail(name: string, businessName: string, note: string) {
  const first = escapeHtml((name || 'friend').trim().split(/\s+/)[0]);
  const business = escapeHtml(businessName);
  const safeNote = escapeHtml(note);
  return shell(`
    <p style="font-size:10px;letter-spacing:0.35em;color:#8B2E2A;margin:0 0 12px;">A NOTE FROM US</p>
    <h1 style="font-size:30px;color:#1A1613;margin:0 0 18px;font-weight:400;">Dear ${first},</h1>
    <p style="color:#1A1613;line-height:1.8;font-size:15px;margin:0 0 18px;">
      Thank you for sharing <strong>${business}</strong> with us.
    </p>
    <p style="color:#6B6862;line-height:1.8;font-size:14px;margin:0 0 18px;">
      After reviewing the application, we are unable to approve it for the NEEJEE marketplace at this time. This decision reflects the present marketplace review criteria and is not a judgment on the value of your craft.
    </p>
    ${safeNote ? `<p style="color:#6B6862;line-height:1.8;font-size:14px;margin:0 0 18px;padding:14px 18px;background:#F4EFE6;border-left:2px solid #8B2E2A;font-style:italic;">${safeNote}</p>` : ''}
    <p style="color:#6B6862;line-height:1.8;font-size:14px;margin:0;">
      You may reapply when the relevant information or circumstances change.<br/>The NEEJEE team
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
    orderReleases,
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
  const admin = await getSession();
  if (!requireRole(admin, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const force = url.searchParams.get('force') === '1';

    const seller = await prisma.seller.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        businessName: true,
        userId: true,
        autoKycSummary: true,
        documents: { select: { fileUrl: true } },
      },
    });
    if (!seller) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const deps = await getSellerDependencyCounts(params.id);
    const hardBlock = deps.products > 0 || deps.payouts > 0;
    if (hardBlock && !force) {
      return NextResponse.json({
        error: 'Seller has dependent products or payouts. Resolve them first, or use force deletion only after manual review.',
        code: 'seller_delete_blocked',
        dependencies: deps,
      }, { status: 409 });
    }

    const privateStorageKeys = Array.from(new Set([
      ...seller.documents
        .map((document) => sellerDocumentStoragePathFromAdminUrl(document.fileUrl))
        .filter((value): value is string => Boolean(value)),
      ...pendingStorageKeys(seller.autoKycSummary),
    ]));

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
      if (seller.userId) {
        const linkedUser = await tx.user.findUnique({
          where: { id: seller.userId },
          select: { role: true },
        });
        if (linkedUser?.role === Role.SELLER) {
          await tx.user.update({
            where: { id: seller.userId },
            data: { role: Role.CUSTOMER },
          });
        }
      }
    });

    const storageCleanup = await Promise.allSettled(
      privateStorageKeys.map((storageKey) => deleteFile(privateSellerStorageRef(storageKey))),
    );
    const storageCleanupFailures = storageCleanup.filter((result) => result.status === 'rejected').length;
    if (storageCleanupFailures) {
      console.warn('[admin.sellers.delete] private storage cleanup incomplete', {
        sellerId: params.id,
        failures: storageCleanupFailures,
      });
    }

    return NextResponse.json({
      ok: true,
      deletedSellerId: params.id,
      deletedSellerName: seller.businessName || '',
      force,
      dependencies: deps,
      privateDocumentsDeleted: privateStorageKeys.length - storageCleanupFailures,
      privateDocumentCleanupFailures: storageCleanupFailures,
    });
  } catch (error) {
    console.error('[admin.sellers.delete] failed', {
      sellerId: params.id,
      message: error instanceof Error ? error.message : 'unknown_error',
    });
    return NextResponse.json({ error: 'Failed to delete seller' }, { status: 500 });
  }
}
