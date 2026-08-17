import { randomInt } from 'crypto';
import bcrypt from 'bcryptjs';
import { Role, SellerDocStatus, SellerDocType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { syncSellerKycStatus } from '@/lib/seller-onboarding/status';
import { privateSellerStoragePath } from '@/lib/storage';
import { sellerDocumentAdminUrl } from '@/lib/seller-onboarding/document-storage';

const EMAIL_OTP_TTL_MIN = 10;
const EMAIL_OTP_MAX_PER_HOUR = 5;
const EMAIL_OTP_MAX_ATTEMPTS = 5;
const PURPOSE = 'EMAIL_VERIFY_OTP';
const LINKABLE_ROLES = new Set<Role>([Role.CUSTOMER, Role.SELLER]);

type PendingSellerDocument = {
  docType: SellerDocType;
  title: string | null;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
};

type VerificationResult =
  | { ok: true; role: Role; sellerId: string }
  | { ok: false; reason: string };

function generateCode() {
  let code = '';
  for (let i = 0; i < 6; i += 1) code += String(randomInt(0, 10));
  return code;
}

function normalizeEmail(value: string) {
  return String(value || '').trim().toLowerCase();
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pendingDocumentsFromSummary(summary: any): PendingSellerDocument[] {
  const raw: any[] = Array.isArray(summary?.pendingDocuments) ? summary.pendingDocuments : [];
  return raw
    .map((doc: any): PendingSellerDocument => ({
      docType: String(doc?.docType || '') as SellerDocType,
      title: doc?.title == null ? null : String(doc.title).slice(0, 120),
      fileUrl: String(doc?.fileUrl || ''),
      fileName: String(doc?.fileName || '').slice(0, 255),
      fileSize: Number(doc?.fileSize || 0),
      mimeType: String(doc?.mimeType || ''),
      storageKey: String(doc?.storageKey || ''),
    }))
    .filter((doc: PendingSellerDocument) =>
      Object.values(SellerDocType).includes(doc.docType)
      && Boolean(doc.fileUrl)
      && Boolean(doc.fileName)
      && doc.fileSize > 0
      && Boolean(doc.mimeType)
      && Boolean(doc.storageKey)
      && privateSellerStoragePath(doc.fileUrl) === doc.storageKey,
    );
}

export async function requestSellerEmailOtp(input: {
  sellerId: string;
  email: string;
  recipientName?: string | null;
}) {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const recentCount = await prisma.sellerMagicToken.count({
    where: {
      sellerId: input.sellerId,
      purpose: PURPOSE,
      createdAt: { gte: oneHourAgo },
    },
  });

  if (recentCount >= EMAIL_OTP_MAX_PER_HOUR) {
    throw new Error('Too many email OTP requests. Please try again later.');
  }

  const code = generateCode();
  const tokenHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(now.getTime() + EMAIL_OTP_TTL_MIN * 60 * 1000);

  await prisma.sellerMagicToken.updateMany({
    where: { sellerId: input.sellerId, purpose: PURPOSE, consumedAt: null },
    data: { consumedAt: now },
  });

  const token = await prisma.sellerMagicToken.create({
    data: { sellerId: input.sellerId, tokenHash, purpose: PURPOSE, expiresAt },
    select: { id: true },
  });

  const sent = await sendEmail({
    to: input.email,
    subject: 'NEEJEE seller application email verification code',
    html: `
      <div style="font-family:Arial,sans-serif;color:#1f1c18;line-height:1.6">
        <h2>Verify your seller application email</h2>
        <p>Hello ${escapeHtml(input.recipientName || 'there')},</p>
        <p>Your verification code is:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>
        <p>This code expires in ${EMAIL_OTP_TTL_MIN} minutes and allows ${EMAIL_OTP_MAX_ATTEMPTS} attempts.</p>
        <p>Do not share this code with anyone.</p>
        <p style="margin-top:28px;font-size:12px;color:#6b6258">NEEJEE · FOUND. PERSONAL.</p>
      </div>
    `,
  });

  if (!sent.ok) {
    await prisma.sellerMagicToken.update({
      where: { id: token.id },
      data: { consumedAt: new Date() },
    });
    throw new Error('Email verification code could not be delivered');
  }

  return {
    ok: true as const,
    expiresInMin: EMAIL_OTP_TTL_MIN,
    maxAttempts: EMAIL_OTP_MAX_ATTEMPTS,
  };
}

async function emailOtpAttempts(tokenId: string) {
  const rows = await prisma.$queryRaw<Array<{ attempts: number }>>`
    select "attempts"
    from public."SellerMagicToken"
    where "id" = ${tokenId}
    limit 1
  `;
  return Number(rows[0]?.attempts || 0);
}

async function recordWrongEmailOtpAttempt(tokenId: string, now: Date) {
  const rows = await prisma.$queryRaw<Array<{ attempts: number }>>`
    update public."SellerMagicToken"
    set "attempts" = "attempts" + 1
    where "id" = ${tokenId}
      and "consumedAt" is null
    returning "attempts"
  `;
  const attempts = Number(rows[0]?.attempts || EMAIL_OTP_MAX_ATTEMPTS);
  if (attempts >= EMAIL_OTP_MAX_ATTEMPTS) {
    await prisma.sellerMagicToken.updateMany({
      where: { id: tokenId, consumedAt: null },
      data: { consumedAt: now },
    });
  }
  return attempts;
}

export async function verifySellerEmailOtp(input: {
  sellerId: string;
  code: string;
  verifiedPhone: string;
}): Promise<VerificationResult> {
  const now = new Date();

  const token = await prisma.sellerMagicToken.findFirst({
    where: { sellerId: input.sellerId, purpose: PURPOSE, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!token) return { ok: false, reason: 'no_active_otp' };

  if (token.expiresAt.getTime() <= now.getTime()) {
    await prisma.sellerMagicToken.update({ where: { id: token.id }, data: { consumedAt: now } });
    return { ok: false, reason: 'expired' };
  }

  const attempts = await emailOtpAttempts(token.id);
  if (attempts >= EMAIL_OTP_MAX_ATTEMPTS) {
    await prisma.sellerMagicToken.updateMany({
      where: { id: token.id, consumedAt: null },
      data: { consumedAt: now },
    });
    return { ok: false, reason: 'max_attempts' };
  }

  const matches = await bcrypt.compare(String(input.code || '').trim(), token.tokenHash);
  if (!matches) {
    const nextAttempts = await recordWrongEmailOtpAttempt(token.id, now);
    return {
      ok: false,
      reason: nextAttempts >= EMAIL_OTP_MAX_ATTEMPTS ? 'max_attempts' : 'wrong_code',
    };
  }

  const result = await prisma.$transaction(async (tx): Promise<VerificationResult> => {
    const claimed = await tx.$queryRaw<Array<{ id: string }>>`
      update public."SellerMagicToken"
      set "consumedAt" = ${now}
      where "id" = ${token.id}
        and "sellerId" = ${input.sellerId}
        and "purpose" = ${PURPOSE}
        and "consumedAt" is null
        and "expiresAt" > ${now}
        and "attempts" < ${EMAIL_OTP_MAX_ATTEMPTS}
      returning "id"
    `;
    if (!claimed.length) return { ok: false, reason: 'no_active_otp' };

    const seller = await tx.seller.findUnique({
      where: { id: input.sellerId },
      select: {
        id: true,
        userId: true,
        email: true,
        phone: true,
        contactName: true,
        autoKycSummary: true,
      },
    });

    if (!seller) return { ok: false, reason: 'seller_not_found' };
    if (seller.phone !== input.verifiedPhone) {
      return { ok: false, reason: 'phone_session_mismatch' };
    }

    const email = normalizeEmail(seller.email);
    const matchingUsers = await tx.user.findMany({
      where: {
        OR: [
          { email },
          { phone: seller.phone },
          ...(seller.userId ? [{ id: seller.userId }] : []),
        ],
      },
      select: { id: true, email: true, phone: true, role: true },
    });

    const distinctIds = Array.from(new Set(matchingUsers.map((user) => user.id)));
    if (distinctIds.length > 1) {
      return { ok: false, reason: 'account_identity_conflict' };
    }

    const existingUser = matchingUsers[0] || null;
    if (existingUser && !LINKABLE_ROLES.has(existingUser.role)) {
      return { ok: false, reason: 'protected_account_conflict' };
    }

    const summary = seller.autoKycSummary && typeof seller.autoKycSummary === 'object'
      ? (seller.autoKycSummary as any)
      : {};
    const pendingDocuments = pendingDocumentsFromSummary(summary);
    if (!pendingDocuments.length) {
      return { ok: false, reason: 'pending_documents_missing' };
    }

    const user = existingUser
      ? await tx.user.update({
          where: { id: existingUser.id },
          data: {
            name: seller.contactName,
            email,
            phone: seller.phone,
            emailVerified: now,
            phoneVerified: true,
            phoneVerifiedAt: now,
          },
          select: { id: true, role: true },
        })
      : await tx.user.create({
          data: {
            email,
            name: seller.contactName,
            phone: seller.phone,
            role: Role.CUSTOMER,
            emailVerified: now,
            phoneVerified: true,
            phoneVerifiedAt: now,
          },
          select: { id: true, role: true },
        });

    const docTypes = Array.from(
      new Set<SellerDocType>(pendingDocuments.map((doc: PendingSellerDocument) => doc.docType)),
    );
    if (docTypes.length) {
      await tx.sellerDocument.updateMany({
        where: {
          sellerId: seller.id,
          docType: { in: docTypes },
          status: SellerDocStatus.SUBMITTED,
        },
        data: {
          status: SellerDocStatus.SUPERSEDED,
          reviewedAt: now,
          reviewNote: 'Superseded by a newly verified seller application',
        },
      });
    }

    await tx.sellerDocument.createMany({
      data: pendingDocuments.map((doc: PendingSellerDocument) => ({
        sellerId: seller.id,
        docType: doc.docType,
        title: doc.title,
        fileName: doc.fileName,
        fileUrl: sellerDocumentAdminUrl(doc.storageKey, doc.fileName),
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        status: SellerDocStatus.SUBMITTED,
        uploadedByUserId: user.id,
        uploadedOnBehalf: false,
      })),
    });

    const { pendingDocuments: _pending, pendingDocumentsCreatedAt: _pendingAt, ...restSummary } = summary;
    await tx.seller.update({
      where: { id: seller.id },
      data: {
        userId: user.id,
        autoKycSummary: {
          ...restSummary,
          documentsVerifiedAt: now.toISOString(),
        } as any,
      },
    });

    return { ok: true, role: user.role, sellerId: seller.id };
  });

  if (result.ok) await syncSellerKycStatus(result.sellerId);
  return result;
}
