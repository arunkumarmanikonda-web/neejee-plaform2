import { NextResponse } from 'next/server';
import { clearSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST-only on purpose. A GET handler used to exist here, but Next.js prefetches
// every visible <Link> with GET — which silently logged users out when the
// Sign-out link rendered in the account sidebar. POST cannot be prefetched.
export async function POST(request: Request) {
  await clearSession();
  const origin = new URL(request.url).origin;
  return NextResponse.redirect(new URL('/', origin), { status: 303 });
}

// Reject GET cleanly so any stale prefetch hitting this endpoint is harmless.
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed. Use POST to sign out.' }, { status: 405 });
}
