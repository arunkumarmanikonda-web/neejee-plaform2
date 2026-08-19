import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Legacy endpoint retired for security.
 *
 * OTP verification now performs purpose/role validation and session creation
 * atomically in /api/auth/otp/verify. The former two-step design trusted a
 * recently consumed OTP as a reusable authentication proof, which created a
 * replay window and an alternate path around portal-specific authentication.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'Legacy post-OTP sign-in endpoint is disabled. Verify the OTP through the canonical flow.',
      code: 'LEGACY_OTP_SIGNIN_DISABLED',
    },
    {
      status: 410,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
