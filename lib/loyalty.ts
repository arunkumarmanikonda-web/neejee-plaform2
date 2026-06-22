// Loyalty engine — pure functions and Prisma helpers.
// Server-side only. Single source of truth for tiers, points, and referrals.
import { prisma } from './prisma';
import { sendEmail } from './email';
import { wrapMarketingHtml } from './marketing-email';
import { aiTextConfigured, openaiChat } from './ai';

export type LoyaltyTier = 'FOUND' | 'KNOWN' | 'PERSONAL' | 'FAMILY';

export interface LoyaltySettingsRow {
  paisePerPoint: number;
  multiplierFound: number;
  multiplierKnown: number;
  multiplierPersonal: number;
  multiplierFamily: number;
  redemptionValue: number;
  minRedemption: number;
  maxRedemptionPct: number;
  thresholdKnown: number;
  thresholdPersonal: number;
  thresholdFamily: number;
  referralRewardPoints: number;
  refereeDiscountPct: number;
  refereeMinOrder: number;
  pointsExpireMonths: number;
  familyNeverExpire: boolean;
}

export const TIER_LABELS: Record<LoyaltyTier, string> = {
  FOUND: 'Found',
  KNOWN: 'Known',
  PERSONAL: 'Personal',
  FAMILY: 'Family',
};

export const TIER_BLURBS: Record<LoyaltyTier, string> = {
  FOUND: "You've started a trunk with us.",
  KNOWN: "We know you now.",
  PERSONAL: "You're someone we know by name.",
  FAMILY: "Of the household.",
};

export const TIER_ORDER: LoyaltyTier[] = ['FOUND', 'KNOWN', 'PERSONAL', 'FAMILY'];

export async function getSettings(): Promise<LoyaltySettingsRow> {
  const s = await prisma.loyaltySettings.findUnique({ where: { id: 'singleton' } });
  if (s) return s as any;
  // First call — seed singleton with defaults
  const seeded = await prisma.loyaltySettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });
  return seeded as any;
}

export function multiplierFor(tier: LoyaltyTier, settings: LoyaltySettingsRow): number {
  switch (tier) {
    case 'KNOWN': return settings.multiplierKnown;
    case 'PERSONAL': return settings.multiplierPersonal;
    case 'FAMILY': return settings.multiplierFamily;
    default: return settings.multiplierFound;
  }
}

export function tierForSpend(lifetimeSpend: number, settings: LoyaltySettingsRow): LoyaltyTier {
  if (lifetimeSpend >= settings.thresholdFamily) return 'FAMILY';
  if (lifetimeSpend >= settings.thresholdPersonal) return 'PERSONAL';
  if (lifetimeSpend >= settings.thresholdKnown) return 'KNOWN';
  return 'FOUND';
}

export function pointsForOrder(orderPaise: number, tier: LoyaltyTier, settings: LoyaltySettingsRow): number {
  const base = Math.floor(orderPaise / settings.paisePerPoint);
  return Math.floor(base * multiplierFor(tier, settings));
}

/**
 * Compute the current redeemable points balance from the ledger.
 * Sums all unexpired entries; for FAMILY tier, expiry is ignored.
 */
export async function getCurrentBalance(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { loyaltyTier: true } });
  const now = new Date();
  const includeExpired = user?.loyaltyTier === 'FAMILY';
  const entries = await prisma.loyaltyLedger.findMany({
    where: {
      userId,
      ...(includeExpired ? {} : { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] }),
    },
    select: { points: true },
  });
  return entries.reduce((s, e) => s + e.points, 0);
}

/**
 * Award points to a user. Idempotent on orderId if provided.
 * Returns the ledger entry id (or null if already awarded).
 */
export async function awardPoints(args: {
  userId: string;
  points: number;
  type: 'EARN' | 'REFERRAL' | 'WELCOME' | 'TIER_BONUS' | 'ADJUST';
  reason?: string;
  orderId?: string;
  referralId?: string;
  awardedById?: string;
  customExpiry?: Date;
}): Promise<string | null> {
  // Idempotency check for order-based earn
  if (args.orderId && args.type === 'EARN') {
    const existing = await prisma.loyaltyLedger.findFirst({
      where: { orderId: args.orderId, type: 'EARN' },
    });
    if (existing) return null;
  }

  const settings = await getSettings();
  const expiresAt = args.customExpiry
    || (args.type !== 'ADJUST'
      ? new Date(Date.now() + settings.pointsExpireMonths * 30 * 24 * 60 * 60 * 1000)
      : undefined);

  const entry = await prisma.loyaltyLedger.create({
    data: {
      userId: args.userId,
      type: args.type,
      points: args.points,
      reason: args.reason,
      orderId: args.orderId,
      referralId: args.referralId,
      expiresAt,
      awardedById: args.awardedById,
    },
  });

  // Update user balance + lifetime points
  await prisma.user.update({
    where: { id: args.userId },
    data: {
      loyaltyPoints: { increment: args.points },
      lifetimePoints: { increment: args.points > 0 ? args.points : 0 },
    },
  });

  return entry.id;
}

/** Redeem points at checkout. Returns paise discount value. */
export async function redeemPoints(args: {
  userId: string;
  points: number;
  orderId: string;
}): Promise<{ ok: boolean; paiseValue: number; error?: string }> {
  const settings = await getSettings();
  if (args.points < settings.minRedemption) {
    return { ok: false, paiseValue: 0, error: `Minimum redemption is ${settings.minRedemption} points` };
  }
  const balance = await getCurrentBalance(args.userId);
  if (balance < args.points) {
    return { ok: false, paiseValue: 0, error: `Insufficient points (have ${balance})` };
  }

  const paiseValue = args.points * settings.redemptionValue;

  await prisma.loyaltyLedger.create({
    data: {
      userId: args.userId,
      type: 'REDEEM',
      points: -args.points,
      reason: `Order ${args.orderId}`,
      orderId: args.orderId,
    },
  });

  await prisma.user.update({
    where: { id: args.userId },
    data: { loyaltyPoints: { decrement: args.points } },
  });

  return { ok: true, paiseValue };
}

/**
 * Process a paid order: credit points, update lifetime spend, tier-up if eligible.
 * Idempotent on orderId.
 */
export async function processOrderForLoyalty(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, userId: true, total: true, paymentStatus: true, pointsEarned: true },
  });
  if (!order || !order.userId || order.paymentStatus !== 'PAID') return;
  if (order.pointsEarned > 0) return; // already processed

  const user = await prisma.user.findUnique({
    where: { id: order.userId },
    select: { id: true, name: true, email: true, loyaltyTier: true, lifetimeSpend: true },
  });
  if (!user) return;

  const settings = await getSettings();
  const oldTier = user.loyaltyTier as LoyaltyTier;
  const newSpend = user.lifetimeSpend + order.total;
  const newTier = tierForSpend(newSpend, settings);
  const points = pointsForOrder(order.total, oldTier, settings);

  // Update user lifetime spend + tier
  await prisma.user.update({
    where: { id: user.id },
    data: { lifetimeSpend: newSpend, loyaltyTier: newTier },
  });

  // Award points (idempotent via orderId)
  await awardPoints({
    userId: user.id,
    points,
    type: 'EARN',
    orderId: order.id,
    reason: `Order ${order.orderNumber}`,
  });

  // Mark on order
  await prisma.order.update({
    where: { id: order.id },
    data: { pointsEarned: points },
  });

  // Tier-up notification
  if (newTier !== oldTier && TIER_ORDER.indexOf(newTier) > TIER_ORDER.indexOf(oldTier)) {
    await sendTierUpNote(user.id, oldTier, newTier).catch(e => console.warn('[loyalty] tier-up email failed:', e.message));
    // Mirror on WhatsApp (best-effort, respects opt-in)
    try {
      const { notifyTierUp } = await import('./whatsapp');
      notifyTierUp(user.id, TIER_LABELS[newTier]).catch(() => {});
    } catch {}
  }

  // Referral check — if this is the user's first paid order and they were referred
  await checkReferralReward(user.id, order.id, order.total).catch(e => console.warn('[loyalty] referral reward failed:', e.message));
}

/**
 * Send a personalized tier-up email. Uses AI to draft a warm note signed by Nidhi.
 */
export async function sendTierUpNote(userId: string, oldTier: LoyaltyTier, newTier: LoyaltyTier): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, emailOptIn: true, marketingConsent: true },
  });
  if (!user || !user.emailOptIn) return;

  const firstName = (user.name || '').split(' ')[0] || 'friend';
  let bodyText: string;

  if (aiTextConfigured()) {
    const ai = await openaiChat({
      system: `You are writing a short personal note from Nidhi, founder of NEEJEE — a personal Indian craft brand (handwoven sarees, oxidised silver, mitti attars).
Voice: quiet, reverent, sincere, never sales-y. Indian English. No exclamation marks, no emoji, no marketing words.
Brand pillar: "Found. Personal."

The customer has just crossed into a new loyalty tier. Write a 60-90 word personal note that:
- Addresses them by first name
- Mentions the tier name in a way that feels poetic, not mechanical
- References what that tier means in the relationship
- Closes with something tactile — a piece they bought, a thread, an atelier moment
- Signs off "Personally, Nidhi" on a new line

Return only the body text. No HTML, no subject line, no preamble.`,
      messages: [{
        role: 'user',
        content: `Customer: ${firstName}
Old tier: ${TIER_LABELS[oldTier]}
New tier: ${TIER_LABELS[newTier]}
Meaning: ${TIER_BLURBS[newTier]}

Write the note now.`,
      }],
      temperature: 0.8,
    });
    bodyText = ai.ok && ai.text ? ai.text : fallbackTierUpNote(firstName, newTier);
  } else {
    bodyText = fallbackTierUpNote(firstName, newTier);
  }

  const html = wrapMarketingHtml({
    subject: `A small note, ${firstName}`,
    bodyHtml: bodyText.split('\n').map(p => `<p>${escapeHtml(p)}</p>`).join('\n'),
    recipientEmail: user.email,
  });

  await sendEmail({
    to: user.email,
    subject: `A small note, ${firstName}`,
    html,
  });
}

function fallbackTierUpNote(name: string, tier: LoyaltyTier): string {
  return `Dear ${name},

You've crossed into ${TIER_LABELS[tier]} today. ${TIER_BLURBS[tier]}

It means something to us that pieces from our atelier have found a home in yours. Thank you for letting them.

Personally,
Nidhi`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/**
 * Generate a unique referral code for a user. Format: FIRSTNAME-XXXX.
 */
export async function ensureReferralCode(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true, name: true, email: true },
  });
  if (user?.referralCode) return user.referralCode;

  const baseName = (user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'NEEJEE')
    .toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8) || 'NEEJEE';

  for (let attempts = 0; attempts < 10; attempts++) {
    const suffix = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    const code = `${baseName}-${suffix}`;
    try {
      await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
      return code;
    } catch {
      // collision — try again
    }
  }
  throw new Error('Could not generate unique referral code');
}

/**
 * If user has a referral lineage AND this is their first paid order ≥ refereeMinOrder,
 * reward the referrer.
 */
export async function checkReferralReward(userId: string, orderId: string, orderTotal: number): Promise<void> {
  const settings = await getSettings();
  if (orderTotal < settings.refereeMinOrder) return;

  // Find pending referral where this user is the referee
  const referral = await prisma.referral.findFirst({
    where: { refereeId: userId, status: 'PENDING' },
  });
  if (!referral) return;

  // Check this is their first paid order
  const paidOrderCount = await prisma.order.count({
    where: { userId, paymentStatus: 'PAID' },
  });
  // Note: caller passes orderId which is already PAID; count includes it
  if (paidOrderCount > 1) {
    // Mark expired — referral only applies on first order
    await prisma.referral.update({
      where: { id: referral.id },
      data: { status: 'EXPIRED' },
    });
    return;
  }

  // Reward referrer with points
  await awardPoints({
    userId: referral.referrerId,
    points: settings.referralRewardPoints,
    type: 'REFERRAL',
    referralId: referral.id,
    reason: 'Referral reward',
  });

  await prisma.referral.update({
    where: { id: referral.id },
    data: { status: 'REWARDED', firstOrderId: orderId, rewardedAt: new Date() },
  });

  // Notify referrer
  const referrer = await prisma.user.findUnique({
    where: { id: referral.referrerId },
    select: { email: true, name: true, emailOptIn: true },
  });
  if (referrer?.emailOptIn) {
    const firstName = (referrer.name || '').split(' ')[0] || 'friend';
    const html = wrapMarketingHtml({
      subject: `${settings.referralRewardPoints} points from someone you sent our way`,
      bodyHtml: `
        <p>Dear ${escapeHtml(firstName)},</p>
        <p>Someone you sent to NEEJEE just made their first piece their own. We've added <strong>${settings.referralRewardPoints} points</strong> to your trunk, with our thanks.</p>
        <p>Personally,<br/>Nidhi</p>
      `,
      recipientEmail: referrer.email,
    });
    await sendEmail({ to: referrer.email, subject: `${settings.referralRewardPoints} points from someone you sent our way`, html }).catch(() => {});
  }
}

/** Expire points older than the configured window. Called by cron. */
export async function expireOldPoints(): Promise<{ usersAffected: number; pointsExpired: number }> {
  const now = new Date();
  const settings = await getSettings();

  // Find expired EARN/REFERRAL/WELCOME entries that haven't been countered
  const candidates = await prisma.loyaltyLedger.findMany({
    where: {
      expiresAt: { lt: now },
      type: { in: ['EARN', 'REFERRAL', 'WELCOME', 'TIER_BONUS'] },
      points: { gt: 0 },
    },
  });

  // Group by user; skip FAMILY tier if configured
  let usersAffected = 0;
  let pointsExpired = 0;
  const byUser = new Map<string, number>();
  for (const c of candidates) {
    byUser.set(c.userId, (byUser.get(c.userId) || 0) + c.points);
  }

  for (const [userId, points] of byUser.entries()) {
    if (settings.familyNeverExpire) {
      const u = await prisma.user.findUnique({ where: { id: userId }, select: { loyaltyTier: true } });
      if (u?.loyaltyTier === 'FAMILY') continue;
    }
    // Write a counter ledger entry
    await prisma.loyaltyLedger.create({
      data: {
        userId,
        type: 'EXPIRE',
        points: -points,
        reason: 'Points expired (12 month window)',
      },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { loyaltyPoints: { decrement: points } },
    });
    // Mark the original entries as already expired (set expiresAt to far past so they don't get re-counted)
    await prisma.loyaltyLedger.updateMany({
      where: { userId, expiresAt: { lt: now }, type: { in: ['EARN', 'REFERRAL', 'WELCOME', 'TIER_BONUS'] }, points: { gt: 0 } },
      data: { expiresAt: new Date(0) },
    });
    usersAffected++;
    pointsExpired += points;
  }

  return { usersAffected, pointsExpired };
}
