// v23.40.20 — Post-purchase drip campaign.
//
// Runs daily. Sends a gentle "did it arrive?" + "you may also love" email
// 7 days after every DELIVERED order. Each order gets the email at most once
// (tracked via Order.postPurchaseSentAt — see migration in SPRINT_9_29).
//
// Tone: founder note, not a hard-sell. Showcases 3 hand-picked items from
// categories the customer hasn't ordered yet.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://neejee.com';
const DRIP_DELAY_DAYS = 7;

function isAuthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true; // dev mode
  const auth = req.headers.get('authorization') || '';
  const qsKey = new URL(req.url).searchParams.get('key') || '';
  return auth === `Bearer ${expected}` || qsKey === expected;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cutoff = new Date(Date.now() - DRIP_DELAY_DAYS * 86_400_000);

  // Orders DELIVERED ≥ 7 days ago, not yet contacted
  const candidates = await prisma.order.findMany({
    where: {
      status: 'DELIVERED',
      deliveredAt: { lte: cutoff },
      postPurchaseSentAt: null,
      OR: [{ userId: { not: null } }, { guestEmail: { not: null } }],
    },
    include: {
      user: { select: { id: true, email: true, name: true, emailOptIn: true, marketingConsent: true } },
      items: { include: { product: { select: { name: true, categoryId: true, slug: true } } } },
    },
    take: 30, // small batch per run; cron is daily
  });

  const sent: any[] = []; const skipped: any[] = [];
  for (const order of candidates) {
    const email = order.user?.email || order.guestEmail;
    if (!email) { skipped.push({ id: order.id, reason: 'no-email' }); continue; }
    // Respect opt-outs (transactional follow-up is still allowed but we honour marketingConsent)
    if (order.user && order.user.emailOptIn === false) { skipped.push({ id: order.id, reason: 'opted-out' }); continue; }

    // Find 3 "you may love" picks: published products in categories the customer hasn't ordered
    const orderedCategoryIds = new Set(order.items.map(i => i.product?.categoryId).filter(Boolean) as string[]);
    const picks = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        categoryId: orderedCategoryIds.size ? { notIn: Array.from(orderedCategoryIds) } : undefined,
      },
      select: { name: true, slug: true, sellingPrice: true },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    const firstName = (order.user?.name || order.guestName || 'friend').split(' ')[0];
    const subject = `${firstName}, did the parcel arrive well?`;
    const picksHtml = picks.length ? `
      <p style="margin:24px 0 8px;font-size:13px;letter-spacing:0.1em;color:#6B6862;text-transform:uppercase;">You may also love</p>
      <table role="presentation" style="width:100%;border-collapse:collapse;">
        ${picks.map(p => `
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #E6DCCC;">
              <a href="${BASE_URL}/products/${p.slug}" style="color:#1A1613;text-decoration:none;font-family:'Playfair Display',Georgia,serif;font-size:14pt;">${p.name}</a>
              <span style="display:block;color:#8B2E2A;font-size:11pt;margin-top:2px;">₹${(p.sellingPrice / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </td>
          </tr>`).join('')}
      </table>` : '';

    const html = `
      <div style="max-width:560px;margin:0 auto;font-family:'Inter',sans-serif;color:#1A1613;background:#F4EFE6;padding:32px;">
        <h2 style="font-family:'Playfair Display',Georgia,serif;font-weight:600;color:#1A1613;font-size:22pt;margin:0 0 16px;">Namaste, ${firstName}.</h2>
        <p style="font-size:13pt;line-height:1.6;color:#1A1613;">I hope your <em>${order.orderNumber}</em> reached you well. If anything didn't sit right — colour, fit, finish — just reply to this email and we'll make it personal.</p>
        <p style="font-size:13pt;line-height:1.6;color:#1A1613;">Your purchase supports artisans we know by name. Thank you for choosing the slow path.</p>
        ${picksHtml}
        <p style="margin-top:32px;font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:14pt;color:#8B2E2A;">With gratitude,<br/>Nidhi</p>
        <p style="margin-top:24px;font-size:10pt;color:#6B6862;">
          <a href="${BASE_URL}/account?tab=orders" style="color:#8B2E2A;">View your orders</a> ·
          <a href="${BASE_URL}/unsubscribe?email=${encodeURIComponent(email)}" style="color:#6B6862;">Unsubscribe from follow-ups</a>
        </p>
      </div>`;

    const r = await sendEmail({ to: email, subject, html });
    if (r.ok) {
      await prisma.order.update({ where: { id: order.id }, data: { postPurchaseSentAt: new Date() } });
      sent.push({ id: order.id, email });
    } else {
      skipped.push({ id: order.id, reason: 'send-failed', err: r.error });
    }
  }

  return NextResponse.json({ ok: true, sent: sent.length, skipped: skipped.length, sample: sent.slice(0, 5) });
}
