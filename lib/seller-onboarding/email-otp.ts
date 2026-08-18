import { randomInt } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { sendSellerTransactionalEmail } from '@/lib/seller-onboarding/transactional-email';
import { syncSellerKycStatus } from '@/lib/seller-onboarding/status';

const EMAIL_OTP_TTL_MIN = 10;
const EMAIL_OTP_MAX_PER_HOUR = 5;
const PURPOSE = 'EMAIL_VERIFY_OTP';

function generateCode() {
  let code = '';
  for (let i = 0; i < 6; i += 1) code += String(randomInt(0, 10));
  return code;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function sellerApplicationAcknowledgement(input: {
  contactName?: string | null;
  businessName?: string | null;
  sellerId: string;
}) {
  const firstName = escapeHtml(String(input.contactName || 'there').trim().split(/\s+/)[0] || 'there');
  const businessName = escapeHtml(input.businessName || 'your business');
  const reference = escapeHtml(input.sellerId);

  return `
    <div style="max-width:580px;margin:0 auto;background:#ffffff;font-family:Georgia,serif;color:#1A1613;">
      <div style="background:#1A1613;padding:34px 24px;text-align:center;">
        <div style="color:#F4EFE6;font-size:30px;letter-spacing:.18em;">NEE<span style="display:inline-block;width:7px;height:7px;background:#8B2E2A;border-radius:50%;margin:0 8px;vertical-align:middle"></span>JEE</div>
        <div style="color:#A47E3B;font-size:10px;letter-spacing:.32em;margin-top:12px;">FOUND. PERSONAL.</div>
      </div>
      <div style="padding:44px 34px;">
        <p style="font-size:10px;letter-spacing:.3em;color:#8B2E2A;margin:0 0 12px;">APPLICATION RECEIVED</p>
        <h1 style="font-size:30px;font-weight:400;margin:0 0 18px;">Thank you, ${firstName}.</h1>
        <p style="font-size:15px;line-height:1.8;margin:0 0 18px;">Your seller application for <strong>${businessName}</strong> has been successfully submitted and your communication email has been verified.</p>
        <p style="font-size:14px;line-height:1.8;color:#6B6862;margin:0 0 18px;">Our team will now review the application, KYC information and supporting documents. If we need any clarification or an additional document, we will write to this same communication email rather than asking you to start again.</p>
        <p style="font-size:14px;line-height:1.8;color:#6B6862;margin:0 0 18px;">Once the application is approved, we will send a separate activation message with secure access instructions for NEEJEE Seller Studio. We will never send a permanent password by email.</p>
        <div style="margin-top:26px;padding:16px 18px;background:#F4EFE6;font-size:12px;line-height:1.7;color:#6B6862;">
          Application reference: <strong style="color:#1A1613;">${reference}</strong>
        </div>
        <p style="font-size:13px;line-height:1.8;color:#1A1613;margin:28px 0 0;font-style:italic;">With respect for your work,<br/>NEEJEE</p>
      </div>
      <div style="background:#F4EFE6;padding:22px;text-align:center;color:#6B6862;font-size:11px;">
        <a href="https://www.neejee.com" style="color:#8B2E2A;text-decoration:none;">neejee.com</a>
      </div>
    </div>
  `;
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
    where: {
      sellerId: input.sellerId,
      purpose: PURPOSE,
      consumedAt: null,
    },
    data: {
      consumedAt: now,
    },
  });

  const token = await prisma.sellerMagicToken.create({
    data: {
      sellerId: input.sellerId,
      tokenHash,
      purpose: PURPOSE,
      expiresAt,
    },
  });

  try {
    const delivery = await sendSellerTransactionalEmail({
      to: input.email,
      subject: 'NEEJEE seller application email verification code',
      html: `
        <div style="font-family:Arial,sans-serif;color:#1f1c18;line-height:1.6">
          <h2>Verify your seller application email</h2>
          <p>Hello ${escapeHtml(input.recipientName || 'there')},</p>
          <p>Your verification code is:</p>
          <p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>
          <p>This code expires in ${EMAIL_OTP_TTL_MIN} minutes.</p>
          <p>Do not share this code with anyone.</p>
        </div>
      `,
    });

    return {
      ok: true as const,
      expiresInMin: EMAIL_OTP_TTL_MIN,
      deliveryId: delivery.id,
      recipient: input.email,
    };
  } catch (error) {
    await prisma.sellerMagicToken.update({
      where: { id: token.id },
      data: { consumedAt: new Date() },
    }).catch(() => null);

    throw error;
  }
}

export async function verifySellerEmailOtp(input: {
  sellerId: string;
  code: string;
}) {
  const now = new Date();

  const token = await prisma.sellerMagicToken.findFirst({
    where: {
      sellerId: input.sellerId,
      purpose: PURPOSE,
      consumedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!token) {
    return { ok: false as const, reason: 'no_active_otp' };
  }

  if (token.expiresAt.getTime() <= now.getTime()) {
    await prisma.sellerMagicToken.update({
      where: { id: token.id },
      data: { consumedAt: now },
    });
    return { ok: false as const, reason: 'expired' };
  }

  const matches = await bcrypt.compare(String(input.code || '').trim(), token.tokenHash);
  if (!matches) {
    return { ok: false as const, reason: 'wrong_code' };
  }

  await prisma.sellerMagicToken.update({
    where: { id: token.id },
    data: { consumedAt: now },
  });

  const seller = await prisma.seller.findUnique({
    where: { id: input.sellerId },
    select: {
      id: true,
      userId: true,
      email: true,
      contactName: true,
      businessName: true,
      autoKycSummary: true,
    },
  });

  if (!seller?.userId) {
    return { ok: false as const, reason: 'seller_not_found' };
  }

  await prisma.user.update({
    where: { id: seller.userId },
    data: { emailVerified: now },
  });

  // Email verification is the point at which a submitted application enters the
  // human review queue. Persist that review state separately from operational
  // seller status so admin tabs cannot confuse an application with an old seller.
  const summary = asObject(seller.autoKycSummary);
  const onboarding = asObject(summary.onboarding);
  await prisma.seller.update({
    where: { id: seller.id },
    data: {
      autoKycSummary: {
        ...summary,
        onboarding: {
          ...onboarding,
          applicationReviewStatus: 'UNDER_REVIEW',
          applicationReviewUpdatedAt: now.toISOString(),
          emailVerifiedAt: now.toISOString(),
        },
      } as any,
    },
    select: { id: true },
  });

  const status = await syncSellerKycStatus(seller.id);

  let acknowledgementSent = false;
  try {
    const delivery = await sendSellerTransactionalEmail({
      to: seller.email,
      subject: 'NEEJEE seller application received',
      html: sellerApplicationAcknowledgement({
        contactName: seller.contactName,
        businessName: seller.businessName,
        sellerId: seller.id,
      }),
    });
    acknowledgementSent = Boolean(delivery.ok);
  } catch (error: any) {
    console.warn('[seller-onboarding] application acknowledgement failed', {
      sellerId: seller.id,
      message: String(error?.message || 'unknown error').slice(0, 240),
    });
  }

  return {
    ok: true as const,
    acknowledgementSent,
    status: status?.kycStatus || null,
  };
}
