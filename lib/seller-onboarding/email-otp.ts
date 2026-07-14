import { randomInt } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { syncSellerKycStatus } from '@/lib/seller-onboarding/status';

const EMAIL_OTP_TTL_MIN = 10;
const EMAIL_OTP_MAX_PER_HOUR = 5;
const PURPOSE = 'EMAIL_VERIFY_OTP';

function generateCode() {
  let code = '';
  for (let i = 0; i < 6; i += 1) code += String(randomInt(0, 10));
  return code;
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

  await prisma.sellerMagicToken.create({
    data: {
      sellerId: input.sellerId,
      tokenHash,
      purpose: PURPOSE,
      expiresAt,
    },
  });

  await sendEmail({
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
      </div>
    `,
  });

  return {
    ok: true as const,
    expiresInMin: EMAIL_OTP_TTL_MIN,
  };
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
    select: { id: true, userId: true },
  });

  if (!seller?.userId) {
    return { ok: false as const, reason: 'seller_not_found' };
  }

  await prisma.user.update({
    where: { id: seller.userId },
    data: { emailVerified: now },
  });

  await syncSellerKycStatus(seller.id);

  return { ok: true as const };
}