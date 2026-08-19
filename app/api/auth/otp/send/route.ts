import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Legacy endpoint retired for security.
 *
 * This route previously accepted a caller-supplied OTP code and forwarded it
 * through the SMS provider. Public callers must never be able to use NEEJEE as
 * an arbitrary security-code SMS relay. All supported OTP delivery now starts
 * with /api/auth/otp/request, where the server generates, hashes, rate-limits
 * and persists the code before delivery.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'Legacy OTP send endpoint is disabled. Request a server-generated OTP instead.',
      code: 'LEGACY_OTP_SEND_DISABLED',
    },
    {
      status: 410,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
