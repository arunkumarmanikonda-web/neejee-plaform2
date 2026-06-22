// Manual loyalty point adjustment by admin (gift, refund, correction)
// Optionally sends a warm "gift" email to the recipient.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import { awardPoints } from '@/lib/loyalty';
import { sendEmail as sendMail } from '@/lib/email';
import { wrapMarketingHtml } from '@/lib/marketing-email';
import { aiTextConfigured, openaiChat } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { userId, points, reason, sendEmail = true } = await request.json();
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
    if (typeof points !== 'number' || points === 0) {
      return NextResponse.json({ error: 'points must be a non-zero number (positive to credit, negative to debit)' }, { status: 400 });
    }
    if (!reason) return NextResponse.json({ error: 'reason required (audit trail)' }, { status: 400 });

    const entryId = await awardPoints({
      userId,
      points,
      type: 'ADJUST',
      reason,
      awardedById: user!.id,
    });

    // Send a warm note (only for positive awards, only if opted-in)
    if (sendEmail && points > 0) {
      const recipient = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true, emailOptIn: true },
      });
      if (recipient && recipient.emailOptIn !== false) {
        const firstName = (recipient.name || '').split(' ')[0] || 'friend';
        let bodyText: string;
        if (aiTextConfigured()) {
          const ai = await openaiChat({
            system: `You are writing a short personal note from Nidhi, founder of NEEJEE — a personal Indian craft brand.
Voice: quiet, reverent, sincere, never sales-y. Indian English. No exclamation marks, no emoji.
Brand pillar: "Found. Personal."

The customer has just received a gift of loyalty points from us. Write a 50-80 word personal note that:
- Addresses them by first name
- Acknowledges the gesture warmly without naming the reason explicitly (unless it's clearly celebratory)
- Tells them how many points and gently mentions what they can do with them (1 point = ₹1 off, redeem at checkout)
- Closes with "Personally, Nidhi" on a new line

Return only the body text. No HTML, no subject line, no preamble.`,
            messages: [{
              role: 'user',
              content: `Customer: ${firstName}
Points awarded: ${points}
Internal reason (for context, not always to repeat): ${reason}

Write the note.`,
            }],
            temperature: 0.8,
          });
          bodyText = ai.ok && ai.text ? ai.text : `Dear ${firstName},\n\nWe've added ${points} points to your trunk, with our thanks. Each point is ₹1 off your next piece.\n\nPersonally,\nNidhi`;
        } else {
          bodyText = `Dear ${firstName},\n\nWe've added ${points} points to your trunk, with our thanks. Each point is ₹1 off your next piece.\n\nPersonally,\nNidhi`;
        }

        const html = wrapMarketingHtml({
          subject: `${points} points, with our thanks`,
          bodyHtml: bodyText.split('\n').filter(p => p.trim()).map(p => `<p>${escapeHtml(p)}</p>`).join('\n'),
          recipientEmail: recipient.email,
        });
        await sendMail({
          to: recipient.email,
          subject: `${points} points, with our thanks`,
          html,
        }).catch(e => console.warn('[loyalty/adjust] email failed:', e.message));

        // Mirror on WhatsApp if opted-in
        try {
          const { sendWhatsappText, getWhatsappRecipient } = await import('@/lib/whatsapp');
          const wa = await getWhatsappRecipient(userId);
          if (wa) {
            await sendWhatsappText({
              to: wa.phone,
              body: `Dear ${firstName}, we've added ${points} points to your NEEJEE trunk, with our thanks. Each point is ₹1 off your next piece.\n\nPersonally,\nNidhi`,
            }).catch(() => {});
          }
        } catch {}
      }
    }

    return NextResponse.json({ ok: true, entryId });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
