import { randomInt } from 'crypto';
import bcrypt from 'bcryptjs';
import { Role, SellerDocStatus, SellerDocType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { syncSellerKycStatus } from '@/lib/seller-onboarding/status';
import { privateSellerStoragePath } from '@/lib/storage';

const EMAIL_OTP_TTL_MIN = 10;
const EMAIL_OTP_MAX_PER_HOUR = 5;
const PURPOSE = 'EMAIL_VERIFY_OTP';
const LINKABLE_ROLES = new Set<Role>([Role.CUSTOMER, Role.SELLER]);

function generateCode() {
  let code = '';
  for (let i = 0; i < 6; i += 1) code += String(randomInt(0, 10));
  return code;
}

function normalizeEmail(value: string) {
  return String(value || '').trim().toLowerCase();
}

function pendingDocumentsFromSummary(summary: any) {
  const raw = Array.isArray(summary?.pendingDocuments) ? summary.pendingDocuments : [];
  return raw
    .map((doc: any) => ({
      docType: String(doc?.docType || '') as SellerDocType,
      title: doc?.title == null ? null : String(doc.title).slice(0, 120),
      fileUrl: String(doc?.fileUrl || ''),
      fileName: String(doc?.fileName || '').slice(0, 255),
      fileSize: Number(doc?.fileSize || 0),
      mimeType: String(doc?.mimeType || ''),
      storageKey: String(doc?.storageKey || ''),
    }))
    .filter((doc: any) =>
      Object.values(SellerDocType).includes(doc.docType)
      && doc.fileUrl
      && doc.fileName
      && doc.fileSize > 0
      && doc.mimeType
      && doc.storageKey
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

  await prisma.sellerMagicToken.create({
    data: { sellerId: input.sellerId, tokenHash, purpose: PURPOSE, expiresAt },
  });

  const sent = await sendEmail({
    to: input.email,
    subject: 'NEEJEE seller application email verification code',
    html: `
      <div style="font-family:Arial,sans-serif;color:#1f1c18;line-height:1.6">
        <h2>Verify your seller application email</h2>
        <p>Hello ${String(input.recipientName || 'there')},</p>
        <p>Your verification code is:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>
        <p>This code expires in ${EMAIL_OTP_TTL_MIN} minutes.</p>
        <p>Do not share this code with anyone.</p>
        <p style="margin-top:28px;font-size:12px;color:#6b6258">NEEJEE · FOUND. PERSONAL.</p>
      </div>
    `,
  });

  if (!sent.ok) {
    await prisma.sellerMagicToken.updateMany({
      where: { sellerId: input.sellerId, purpose: PURPOSE, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    throw new Error('Email verification code could not be delivered');
  }

  return { ok: true as const, expiresInMin: EMAIL_OTP_TTL_MIN };
}

export async function verifySellerEmailOtp(input: {
  sellerId: string;
  code: string;
  verifiedPhone: string;
}) {
  const now = new Date();

  const token = await prisma.sellerMagicToken.findFirst({
    where: { sellerId: input.sellerId, purpose: PURPOSE, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!token) return { ok: false as const, reason: 'no_active_otp' };

  if (token.expiresAt.getTime() <= now.getTime()) {
    await prisma.sellerMagicToken.update({ where: { id: token.id }, data: { consumedAt: now } });
    return { ok: false as const, reason: 'expired' };
  }

  const matches = await bcrypt.compare(String(input.code || '').trim(), token.tokenHash);
  if (!matches) return { ok: false as const, reason: 'wrong_code' };

  const seller = await prisma.seller.findUnique({
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

  if (!seller) return { ok: false as const, reason: 'seller_not_found' };
  if (seller.phone !== input.verifiedPhone) {
    return { ok: false as const, reason: 'phone_session_mismatch' };
  }

  const email = normalizeEmail(seller.email);
  const matchingUsers = await prisma.user.findMany({
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
    await prisma.sellerMagicToken.update({ where: { id: token.id }, data: { consumedAt: now } });
    return { ok: false as const, reason: 'account_identity_conflict' };
  }

  const existingUser = matchingUsers[0] || null;
  if (existingUser && !LINKABLE_ROLES.has(existingUser.role)) {
    await prisma.sellerMagicToken.update({ where: { id: token.id }, data: { consumedAt: now } });
    return { ok: false as const, reason: 'protected_account_conflict' };
  }

  const summary = seller.autoKycSummary && typeof seller.autoKycSummary === 'object'
    ? (seller.autoKycSummary as any)
    : {};
  const pendingDocuments = pendingDocumentsFromSummary(summary);
  if (!pendingDocuments.length) {
    return { ok: false as const, reason: 'pending_documents_missing' };
  }

  const user = existingUser
    ? await prisma.user.update({
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
    : await prisma.user.create({
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

  const docTypes = Array.from(new Set(pendingDocuments.map((doc) => doc.docType)));
  if (docTypes.length) {
    await prisma.sellerDocument.updateMany({
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

  await prisma.sellerDocument.createMany({
    data: pendingDocuments.map((doc) => ({
      sellerId: seller.id,
      docType: doc.docType,
      title: doc.title,
      fileName: doc.fileName,
      fileUrl: doc.fileUrl,
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
      status: SellerDocStatus.SUBMITTED,
      uploadedByUserId: user.id,
      uploadedOnBehalf: false,
    })),
  });

  const { pendingDocuments: _pending, pendingDocumentsCreatedAt: _pendingAt, ...restSummary } = summary;
  await prisma.seller.update({
    where: { id: seller.id },
    data: {
      userId: user.id,
      autoKycSummary: {
        ...restSummary,
        documentsVerifiedAt: now.toISOString(),
      } as any,
    },
  });

  await prisma.sellerMagicToken.update({ where: { id: token.id }, data: { consumedAt: now } });
  await syncSellerKycStatus(seller.id);

  return { ok: true as const, role: user.role, sellerId: seller.id };
}
