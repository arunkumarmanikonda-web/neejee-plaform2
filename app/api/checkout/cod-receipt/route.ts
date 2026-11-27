import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { codAttemptKey, findCodAttempt } from '@/lib/checkout/cod-attempt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const key = codAttemptKey(req.headers.get('Idempotency-Key') || '');
  const session = await getSession();
  const order = key ? await findCodAttempt(key) : null;
  const options = { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Idempotency-Key' } };
  if (!order || order.userId !== (session?.id ?? null)) {
    return NextResponse.json({ found: false }, { ...options, status: 404 });
  }
  // The browser's high-entropy capability can recover only the confirmation number.
  return NextResponse.json({ found: true, orderNumber: order.orderNumber }, options);
}
