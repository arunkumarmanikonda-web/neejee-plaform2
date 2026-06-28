import { NextResponse } from 'next/server';
import { socialAuthAvailable } from '@/lib/oauth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function otpReady(): boolean {
  const apiKey = !!process.env.FAST2SMS_API_KEY;
  const senderId = !!process.env.FAST2SMS_SENDER_ID;
  const otpTemplateId = !!(process.env.FAST2SMS_TPL_OTP || process.env.FAST2SMS_OTP_TEMPLATE_ID);

  return apiKey && senderId && otpTemplateId;
}

export async function GET() {
  const avail = socialAuthAvailable();

  return NextResponse.json({
    ...avail,
    googleClientId: avail.google
      ? (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '')
      : '',
    facebookAppId: avail.facebook
      ? (process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || process.env.FACEBOOK_APP_ID || '')
      : '',
    appleClientId: avail.apple
      ? (process.env.NEXT_PUBLIC_APPLE_CLIENT_ID || process.env.APPLE_CLIENT_ID || '')
      : '',
    otpEnabled: otpReady(),
  });
}
