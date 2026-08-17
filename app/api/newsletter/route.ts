import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

function cleanSource(value: unknown): string {
  const source = String(value || 'website')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 64);
  return source || 'website';
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email || '').trim().toLowerCase();
    const source = cleanSource(body?.source);

    if (!email || email.length > 320 || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw`
        insert into public."NewsletterSubscriber"(
          email, source, status, "consentAt", "unsubscribedAt", "updatedAt"
        ) values (
          ${email}, ${source}, 'SUBSCRIBED', current_timestamp, null, current_timestamp
        )
        on conflict (email) do update set
          source = excluded.source,
          status = 'SUBSCRIBED',
          "consentAt" = current_timestamp,
          "unsubscribedAt" = null,
          "updatedAt" = current_timestamp
      `;

      // If this email already belongs to a NEEJEE account, the newsletter form
      // is an explicit fresh marketing-consent action for that account as well.
      await tx.user.updateMany({
        where: { email },
        data: { emailOptIn: true, marketingConsent: true },
      });
    });

    return NextResponse.json({ ok: true, message: 'Welcome to the trunk.' });
  } catch (error: any) {
    console.error('[newsletter] subscription failed', { message: error?.message });
    return NextResponse.json({ error: 'Unable to subscribe right now. Please try again.' }, { status: 500 });
  }
}
