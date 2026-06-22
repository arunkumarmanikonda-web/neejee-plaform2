// Abandoned-cart recovery cron — fires on a schedule (Vercel Cron).
// Sends 3-tier reminders: at 2h, 24h, 72h after abandonment.
// Honors opt-outs and recoveries.
//
// Secure with `?key=` query param matching CRON_SECRET env var,
// or with Vercel's built-in `Authorization: Bearer ${CRON_SECRET}` header.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { wrapMarketingHtml } from '@/lib/marketing-email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://neejee.com';

const HOUR = 60 * 60 * 1000;

interface Tier {
  reminder: number;        // 0 → first, 1 → second, 2 → third
  minAgeMs: number;        // cart must be at least this old
  maxAgeMs: number;        // and not older than this (so we don't spam)
  subject: (name?: string | null) => string;
  body: (name?: string | null, itemsHtml?: string) => string;
}

// Once-daily cron-friendly bands: each window is ~24h wide so we catch every cart
// even with a single daily run. Reminder 0 fires roughly 12-36h after abandonment.
const TIERS: Tier[] = [
  {
    reminder: 0,
    minAgeMs: 6 * HOUR,
    maxAgeMs: 36 * HOUR,
    subject: (n) => `${n?.split(' ')[0] || 'You'} left something in your trunk`,
    body: (n, itemsHtml) => `
      <p>Dear ${n?.split(' ')[0] || 'friend'},</p>
      <p>You were considering a piece, and stepped away. It is still waiting, quietly.</p>
      ${itemsHtml || ''}
      <p style="margin-top:24px;">
        <a href="${BASE_URL}/cart" style="background:#7C2D2D;color:#FFFEF9;padding:12px 24px;text-decoration:none;letter-spacing:0.15em;font-size:12px;">RETURN TO TRUNK</a>
      </p>
      <p style="font-style:italic;color:#8A7E70;font-size:13px;">No rush — we hold things personally.</p>
    `,
  },
  {
    reminder: 1,
    minAgeMs: 36 * HOUR,
    maxAgeMs: 72 * HOUR,
    subject: () => `A small note from Mumbai`,
    body: (n, itemsHtml) => `
      <p>Dear ${n?.split(' ')[0] || 'friend'},</p>
      <p>The piece you were looking at — it has been on our minds too.</p>
      <p>Many of our weaves are one-of-a-kind. If this is yours, take it home before someone else does.</p>
      ${itemsHtml || ''}
      <p style="margin-top:24px;">
        <a href="${BASE_URL}/cart" style="background:#7C2D2D;color:#FFFEF9;padding:12px 24px;text-decoration:none;letter-spacing:0.15em;font-size:12px;">COMPLETE YOUR ORDER</a>
      </p>
      <p style="font-style:italic;color:#8A7E70;font-size:13px;">Personally, Nidhi</p>
    `,
  },
  {
    reminder: 2,
    minAgeMs: 72 * HOUR,
    maxAgeMs: 168 * HOUR,  // up to 7 days
    subject: () => `A last quiet reminder`,
    body: (n, itemsHtml) => `
      <p>Dear ${n?.split(' ')[0] || 'friend'},</p>
      <p>If life simply got in the way, that is alright. Should you wish to return to your trunk, it is still there.</p>
      ${itemsHtml || ''}
      <p style="margin-top:24px;">
        <a href="${BASE_URL}/cart" style="background:#7C2D2D;color:#FFFEF9;padding:12px 24px;text-decoration:none;letter-spacing:0.15em;font-size:12px;">YOUR TRUNK</a>
      </p>
      <p style="font-style:italic;color:#8A7E70;font-size:13px;">If you would rather not receive these, simply unsubscribe below — we understand.</p>
    `,
  },
];

function renderItemsHtml(itemsJson: string, subtotal: number): string {
  try {
    const items = JSON.parse(itemsJson) as any[];
    const rows = items.slice(0, 5).map(i => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #E8DDD0;color:#2A2622;font-size:14px;">${escapeHtml(i.name || i.productName || 'A piece')}</td>
        <td style="padding:12px 0;border-bottom:1px solid #E8DDD0;text-align:right;color:#8A7E70;font-size:13px;">× ${i.quantity || 1}</td>
      </tr>
    `).join('');
    return `<table style="width:100%;border-collapse:collapse;margin:16px 0;background:#F4EFE6;">
      <tbody>${rows}</tbody>
      <tfoot><tr><td style="padding:12px 0;font-weight:600;">Subtotal</td><td style="padding:12px 0;text-align:right;font-weight:600;">₹${(subtotal/100).toLocaleString('en-IN')}</td></tr></tfoot>
    </table>`;
  } catch {
    return '';
  }
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export async function GET(request: Request) {
  // Auth: support both `?key=` and `Authorization: Bearer`
  const url = new URL(request.url);
  const secret = process.env.CRON_SECRET;
  const provided = url.searchParams.get('key') || (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (secret && provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = Date.now();
  const results: any[] = [];

  for (const tier of TIERS) {
    // Find carts in this tier's age band that haven't received this reminder
    const carts = await prisma.abandonedCart.findMany({
      where: {
        recoveredOrderId: null,
        optedOut: false,
        remindersSent: tier.reminder,
        createdAt: {
          gte: new Date(now - tier.maxAgeMs),
          lte: new Date(now - tier.minAgeMs),
        },
      },
      take: 50, // cap per cron run
    });

    for (const c of carts) {
      // STRICT opt-in check: only send if user has opted in (or guest — anonymous shoppers
      // who entered email at checkout effectively consented to transactional reminders;
      // we still respect unsubscribes via optedOut flag).
      let recipientName: string | null = null;
      if (c.userId) {
        const u = await prisma.user.findUnique({
          where: { id: c.userId },
          select: { emailOptIn: true, marketingConsent: true, name: true },
        });
        if (!u || u.emailOptIn === false) continue; // hard skip
        recipientName = u.name;
      }

      const itemsHtml = renderItemsHtml(c.itemsJson, c.subtotal);
      const subject = tier.subject(recipientName);
      const bodyHtml = wrapMarketingHtml({
        subject,
        bodyHtml: tier.body(recipientName, itemsHtml),
        recipientEmail: c.email,
        unsubscribeUrl: `${BASE_URL}/unsubscribe?cart=${c.id}`,
      });

      const sent = await sendEmail({ to: c.email, subject, html: bodyHtml });
      if (sent.ok) {
        await prisma.abandonedCart.update({
          where: { id: c.id },
          data: { remindersSent: tier.reminder + 1, lastRemindedAt: new Date() },
        });
        results.push({ email: c.email, tier: tier.reminder, status: 'sent' });
        // Mirror on WhatsApp (only on tier 0 — don't spam)
        if (tier.reminder === 0 && c.userId) {
          try {
            const { notifyAbandonedCart } = await import('@/lib/whatsapp');
            notifyAbandonedCart(c.userId, c.email, c.itemCount, c.subtotal).catch(() => {});
          } catch {}
        }
        // v23.37.3: Mirror on SMS (tier 0 only, requires phone). Defensive typing
        // (all recipient fields explicitly cast to string, optional fields conditionally spread).
        if (tier.reminder === 0 && c.userId) {
          try {
            const user = await prisma.user.findUnique({
              where: { id: c.userId },
              select: { phone: true },
            });
            const phoneStr = user?.phone ? String(user.phone) : '';
            if (phoneStr) {
              const { notify } = await import('@/lib/notifications');
              const nameStr = recipientName ? String(recipientName) : '';
              notify({
                event: 'ABANDONED_CART' as any,
                recipients: [{
                  email: c.email,
                  phone: phoneStr,
                  ...(nameStr ? { name: nameStr } : {}),
                }],
                data: { itemCount: c.itemCount, subtotalPaise: c.subtotal },
                context: {
                  type: 'CART',
                  id: c.id,
                  smsVars: {}, // abandoned_cart template has no variables
                } as any,
              }).catch(e => console.warn('[notify ABANDONED_CART]', e?.message));
            }
          } catch {}
        }
      } else {
        results.push({ email: c.email, tier: tier.reminder, status: 'failed' });
      }
    }
  }

  return NextResponse.json({ ok: true, count: results.length, results });
}
