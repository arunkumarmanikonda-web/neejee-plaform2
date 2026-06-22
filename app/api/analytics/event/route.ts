// Lightweight analytics event ingestion. Designed to be cheap and non-blocking.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_TYPES = new Set([
  'PAGE_VIEW', 'PRODUCT_VIEW', 'ADD_TO_CART', 'BEGIN_CHECKOUT',
  'PURCHASE', 'SEARCH', 'NEWSLETTER_SUBSCRIBE', 'WISHLIST_ADD', 'ABANDON',
]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body?.sessionId || !body?.type || !VALID_TYPES.has(body.type)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    // Attach userId if signed in (best-effort, never block)
    let userId: string | null = null;
    try {
      const session = await getSession();
      userId = session?.id || null;
    } catch {}

    // Country from Vercel headers (best-effort)
    const country = request.headers.get('x-vercel-ip-country') || null;

    await prisma.analyticsEvent.create({
      data: {
        sessionId: String(body.sessionId).slice(0, 64),
        userId: userId || undefined,
        type: body.type,
        path: body.path ? String(body.path).slice(0, 512) : undefined,
        productId: body.productId ? String(body.productId).slice(0, 64) : undefined,
        value: typeof body.value === 'number' ? body.value : undefined,
        referrer: body.referrer ? String(body.referrer).slice(0, 512) : undefined,
        utmSource: body.utmSource ? String(body.utmSource).slice(0, 128) : undefined,
        utmMedium: body.utmMedium ? String(body.utmMedium).slice(0, 128) : undefined,
        utmCampaign: body.utmCampaign ? String(body.utmCampaign).slice(0, 128) : undefined,
        device: body.device ? String(body.device).slice(0, 32) : undefined,
        country: country || undefined,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // Never expose errors to client; analytics must not break UX
    console.warn('[analytics] event ingest failed:', e.message);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
