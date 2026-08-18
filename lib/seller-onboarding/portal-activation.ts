import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { sendSellerTransactionalEmail } from '@/lib/seller-onboarding/transactional-email';

const PURPOSE = 'SELLER_PORTAL_ACTIVATION';
const ACTIVATION_TTL_HOURS = 72;

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const sellerIdentitySelect = {
  id: true,
  userId: true,
  email: true,
  contactName: true,
  businessName: true,
  kycStatus: true,
  user: {
    select: {
      id: true,
    },
  },
} as const;

export async function issueSellerPortalActivation(input: {
  sellerId: string;
  reapproved?: boolean;
}) {
  // Explicit select is intentional. Production Seller schema has legacy Prisma
  // fields that are not present in the live DB; selecting the whole row can make
  // unrelated lifecycle actions fail on those stale columns.
  const seller = await prisma.seller.findUnique({
    where: { id: input.sellerId },
    select: sellerIdentitySelect,
  });

  if (!seller?.userId || !seller.user) {
    throw new Error('Seller user account is unavailable.');
  }
  if (String(seller.kycStatus) !== 'APPROVED') {
    throw new Error('Seller must be approved before portal activation is issued.');
  }

  const now = new Date();
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = await bcrypt.hash(rawToken, 10);
  const expiresAt = new Date(now.getTime() + ACTIVATION_TTL_HOURS * 60 * 60 * 1000);

  await prisma.sellerMagicToken.updateMany({
    where: {
      sellerId: seller.id,
      purpose: PURPOSE,
      consumedAt: null,
    },
    data: { consumedAt: now },
  });

  await prisma.sellerMagicToken.create({
    data: {
      sellerId: seller.id,
      tokenHash,
      purpose: PURPOSE,
      expiresAt,
    },
  });

  // IMPORTANT: approval alone does not promote the linked user to SELLER.
  // The role is granted only after the applicant consumes this one-time token
  // and chooses their own password in activateSellerPortal().

  const activationUrl = `https://www.neejee.com/seller/activate?sellerId=${encodeURIComponent(seller.id)}&token=${encodeURIComponent(rawToken)}`;
  const loginUrl = 'https://www.neejee.com/seller/login';
  const first = escapeHtml(String(seller.contactName || 'there').trim().split(/\s+/)[0] || 'there');
  const business = escapeHtml(seller.businessName || 'your business');
  const email = escapeHtml(seller.email);
  const reapproved = Boolean(input.reapproved);

  const html = `
    <div style="max-width:580px;margin:0 auto;background:#fff;font-family:Georgia,serif;color:#1A1613;">
      <div style="background:#1A1613;padding:34px 24px;text-align:center;">
        <div style="color:#F4EFE6;font-size:30px;letter-spacing:.18em;">NEE<span style="display:inline-block;width:7px;height:7px;background:#8B2E2A;border-radius:50%;margin:0 8px;vertical-align:middle"></span>JEE</div>
        <div style="color:#A47E3B;font-size:10px;letter-spacing:.32em;margin-top:12px;">FOUND. PERSONAL.</div>
      </div>
      <div style="padding:44px 34px;">
        <p style="font-size:10px;letter-spacing:.3em;color:#8B2E2A;margin:0 0 12px;">${reapproved ? 'ACCESS RESTORED' : 'SELLER APPLICATION APPROVED'}</p>
        <h1 style="font-size:30px;font-weight:400;margin:0 0 18px;">${reapproved ? `Welcome back, ${first}.` : `Welcome to NEEJEE, ${first}.`}</h1>
        <p style="font-size:15px;line-height:1.8;margin:0 0 18px;">${reapproved ? `Seller onboarding access for <strong>${business}</strong> has been restored.` : `Your seller application for <strong>${business}</strong> has been approved for the next onboarding stage.`}</p>
        <p style="font-size:14px;line-height:1.8;color:#6B6862;margin:0 0 18px;">Your Seller Studio login ID is <strong style="color:#1A1613;">${email}</strong>.</p>
        <p style="font-size:14px;line-height:1.8;color:#6B6862;margin:0 0 18px;">Use the secure button below to create your own password. NEEJEE never sends reusable passwords or passcodes by email.</p>
        <p style="font-size:14px;line-height:1.8;color:#6B6862;margin:0 0 18px;">After activation, Seller Studio will guide you through the seller agreement. Marketplace operations unlock only after the agreement has been completed and finalised by NEEJEE.</p>
        <a href="${activationUrl}" style="display:inline-block;margin-top:12px;background:#1A1613;color:#F4EFE6;padding:14px 28px;text-decoration:none;letter-spacing:.16em;font-size:12px;">ACTIVATE SELLER STUDIO</a>
        <p style="font-size:12px;line-height:1.7;color:#9C8B7A;margin:18px 0 0;">This activation link expires in ${ACTIVATION_TTL_HOURS} hours. After activation you can sign in at <a href="${loginUrl}" style="color:#8B2E2A;">neejee.com/seller/login</a>.</p>
      </div>
      <div style="background:#F4EFE6;padding:22px;text-align:center;color:#6B6862;font-size:11px;">
        <a href="https://www.neejee.com" style="color:#8B2E2A;text-decoration:none;">neejee.com</a>
      </div>
    </div>
  `;

  const delivery = await sendSellerTransactionalEmail({
    to: seller.email,
    subject: reapproved
      ? 'NEEJEE Seller Studio onboarding access restored'
      : 'Your NEEJEE seller application has been approved',
    html,
  });

  return {
    ok: true as const,
    sellerId: seller.id,
    recipient: seller.email,
    deliveryId: delivery.id,
    expiresAt,
  };
}

export async function activateSellerPortal(input: {
  sellerId: string;
  token: string;
  password: string;
}) {
  const now = new Date();
  const seller = await prisma.seller.findUnique({
    where: { id: input.sellerId },
    select: sellerIdentitySelect,
  });

  if (!seller?.userId || !seller.user) return { ok: false as const, reason: 'seller_not_found' };
  if (String(seller.kycStatus) !== 'APPROVED') return { ok: false as const, reason: 'seller_not_approved' };

  const activation = await prisma.sellerMagicToken.findFirst({
    where: {
      sellerId: seller.id,
      purpose: PURPOSE,
      consumedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!activation) return { ok: false as const, reason: 'activation_not_found' };
  if (activation.expiresAt.getTime() <= now.getTime()) {
    await prisma.sellerMagicToken.update({ where: { id: activation.id }, data: { consumedAt: now } });
    return { ok: false as const, reason: 'activation_expired' };
  }

  const matches = await bcrypt.compare(String(input.token || ''), activation.tokenHash);
  if (!matches) return { ok: false as const, reason: 'activation_invalid' };

  const passwordHash = await bcrypt.hash(input.password, 12);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: seller.userId },
      data: {
        role: 'SELLER',
        passwordHash,
      },
    }),
    prisma.sellerMagicToken.update({
      where: { id: activation.id },
      data: { consumedAt: now },
    }),
  ]);

  return { ok: true as const, email: seller.email };
}
