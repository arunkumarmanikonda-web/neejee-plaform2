// Marketing unsubscribe requires either a valid signed email token or the
// matching authenticated account. Signed cart-recovery opt-out is handled by
// its own endpoint and is intentionally not accepted here.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { verifyUnsubscribeToken } from '@/lib/marketing/unsubscribe-token';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email || '').trim().toLowerCase();
    const token = String(body?.token || '').trim();

    if (!email || email.length > 320 || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
    }

    const session = await getSession();
    const sessionMatches = !!session?.email && session.email.trim().toLowerCase() === email;
    if (!sessionMatches && !verifyUnsubscribeToken(email, token)) {
      return NextResponse.json({ error: 'This unsubscribe link is invalid or incomplete.' }, { status: 403 });
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.user.updateMany({
        where: { email },
        data: { emailOptIn: false, marketingConsent: false },
      });

      await tx.abandonedCart.updateMany({
        where: { email },
        data: { optedOut: true },
      });

      await tx.$executeRaw`
        insert into public."NewsletterSubscriber"(
          email, source, status, "consentAt", "unsubscribedAt", "updatedAt"
        ) values (
          ${email}, 'unsubscribe', 'UNSUBSCRIBED', current_timestamp, current_timestamp, current_timestamp
        )
        on conflict (email) do update set
          status = 'UNSUBSCRIBED',
          "unsubscribedAt" = current_timestamp,
          "updatedAt" = current_timestamp
      `;
    });

    return NextResponse.json({ ok: true, message: 'You have been unsubscribed.' });
  } catch (error: any) {
    console.error('[unsubscribe] failed', { message: error?.message });
    return NextResponse.json({ error: 'Unable to update your preferences right now.' }, { status: 500 });
  }
}
