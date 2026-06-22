// v23.40.20 — Win-back drip for dormant customers.
//
// Runs weekly (Wed 09:00 IST). Targets users whose last order was 90+ days ago
// but ≤ 365 days ago. Sends a personal note with a one-time 10% comeback
// coupon (auto-generated, valid for 30 days, per-customer single-use).
//
// Each user is contacted at most once every 60 days via User.lastWinBackAt
// (added in SPRINT_9_29).

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://neejee.com';
const DORMANT_DAYS_MIN = 90;     // dormant ≥ 90 days
const DORMANT_DAYS_MAX = 365;    // …but not lost (> 1 year = different campaign)
const REPEAT_COOLDOWN_DAYS = 60; // don't pester same user twice in 60 days

function isAuthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  const auth = req.headers.get('authorization') || '';
  const qsKey = new URL(req.url).searchParams.get('key') || '';
  return auth === `Bearer ${expected}` || qsKey === expected;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const dormantCutoff = new Date(now.getTime() - DORMANT_DAYS_MIN * 86_400_000);
  const lostCutoff    = new Date(now.getTime() - DORMANT_DAYS_MAX * 86_400_000);
  const cooldownCutoff = new Date(now.getTime() - REPEAT_COOLDOWN_DAYS * 86_400_000);

  // Find users whose MOST RECENT delivered order is in the dormant window
  // and haven't received a win-back in the last 60 days.
  const candidates = await prisma.user.findMany({
    where: {
      emailOptIn: true,
      marketingConsent: true,
      OR: [{ lastWinBackAt: null }, { lastWinBackAt: { lt: cooldownCutoff } }],
      orders: {
        some: { status: 'DELIVERED', createdAt: { gte: lostCutoff, lte: dormantCutoff } },
        // and NONE more recent than the dormant cutoff
        none: { createdAt: { gt: dormantCutoff } },
      },
    },
    select: {
      id: true, email: true, name: true,
      orders: { select: { id: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
    take: 25,
  });

  const sent: any[] = []; const skipped: any[] = [];

  for (const u of candidates) {
    if (!u.email) { skipped.push({ id: u.id, reason: 'no-email' }); continue; }

    // Auto-generate a per-user coupon valid 30 days, single-use
    const code = 'COMEBACK' + randomBytes(3).toString('hex').toUpperCase();
    try {
      await prisma.coupon.create({
        data: {
          code,
          userId: u.id,                  // restrict to this user only
          perUserOnce: true,
          type: 'PERCENT',
          value: 10,
          minCart: 100_000,              // min cart ₹1,000
          maxDiscount: 200_000,          // cap discount at ₹2,000
          maxUses: 1,
          validFrom: now,
          validTo: new Date(now.getTime() + 30 * 86_400_000),
          active: true,
        },
      });
    } catch (e: any) {
      skipped.push({ id: u.id, reason: 'coupon-failed', err: e?.message });
      continue;
    }

    const firstName = (u.name || 'friend').split(' ')[0];
    const lastOrderDate = u.orders[0] ? new Date(u.orders[0].createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '';
    const subject = `${firstName}, something new arrived since we last met`;

    const html = `
      <div style="max-width:560px;margin:0 auto;font-family:'Inter',sans-serif;color:#1A1613;background:#F4EFE6;padding:32px;">
        <h2 style="font-family:'Playfair Display',Georgia,serif;font-weight:600;color:#1A1613;font-size:22pt;margin:0 0 16px;">Hello again, ${firstName}.</h2>
        <p style="font-size:13pt;line-height:1.6;">It's been a while since ${lastOrderDate}. Our artisans have been busy — new Banarasis, fresh Phulkari, attars distilled this season.</p>
        <p style="font-size:13pt;line-height:1.6;">I'd love to welcome you back personally. Use <strong style="color:#8B2E2A;letter-spacing:0.1em;">${code}</strong> at checkout for <strong>10% off</strong> your next order (min ₹1,000, valid 30 days).</p>
        <p style="text-align:center;margin:32px 0;">
          <a href="${BASE_URL}/?coupon=${code}" style="background:#1A1613;color:#F4EFE6;padding:14px 28px;text-decoration:none;font-size:11pt;letter-spacing:0.18em;text-transform:uppercase;">Explore what's new</a>
        </p>
        <p style="font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:14pt;color:#8B2E2A;">With gratitude,<br/>Nidhi</p>
        <p style="margin-top:24px;font-size:10pt;color:#6B6862;">
          <a href="${BASE_URL}/unsubscribe?email=${encodeURIComponent(u.email)}" style="color:#6B6862;">Unsubscribe</a>
        </p>
      </div>`;

    const r = await sendEmail({ to: u.email, subject, html });
    if (r.ok) {
      await prisma.user.update({ where: { id: u.id }, data: { lastWinBackAt: now } });
      sent.push({ id: u.id, email: u.email, coupon: code });
    } else {
      skipped.push({ id: u.id, reason: 'send-failed', err: r.error });
    }
  }

  return NextResponse.json({ ok: true, sent: sent.length, skipped: skipped.length, sample: sent.slice(0, 5) });
}
