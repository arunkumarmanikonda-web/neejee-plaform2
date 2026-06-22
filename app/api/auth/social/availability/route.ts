// Returns which social providers are configured server-side, plus the public
// IDs the client needs to render the OAuth buttons. This avoids the NEXT_PUBLIC_*
// build-time inlining problem (env vars added AFTER a build are invisible to
// the client bundle).
import { NextResponse } from 'next/server';
import { socialAuthAvailable } from '@/lib/oauth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const avail = socialAuthAvailable();
  return NextResponse.json({
    ...avail,
    // Public IDs — safe to expose; the browser needs them to render the SDK widgets.
    // Prefer NEXT_PUBLIC_* if present (build-time inlined), else fall back to the
    // server-side var (works even if NEXT_PUBLIC_ wasn't set at build time).
    googleClientId: avail.google
      ? (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '')
      : '',
    facebookAppId: avail.facebook
      ? (process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || process.env.FACEBOOK_APP_ID || '')
      : '',
    appleClientId: avail.apple
      ? (process.env.NEXT_PUBLIC_APPLE_CLIENT_ID || process.env.APPLE_CLIENT_ID || '')
      : '',
    // Phone-OTP login is gated by a server-side flag so we can flip it on later
    // (once DLT registration is approved) without a redeploy. Defaults to OFF
    // because Fast2SMS Quick SMS is ₹5/SMS and DLT requires approval.
    otpEnabled: process.env.OTP_LOGIN_ENABLED === 'true',
  });
}
