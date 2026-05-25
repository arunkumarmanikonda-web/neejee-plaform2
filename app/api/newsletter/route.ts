import { NextResponse } from 'next/server';
import { isValidEmail } from '@/lib/utils';

export async function POST(request: Request) {
  const { email, source } = await request.json();
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  // PRODUCTION: Klaviyo subscribe
  //   await klaviyo.profiles.subscribeProfiles({
  //     data: { type: 'profile-subscription-bulk-create-job', attributes: { profiles: { data: [{ type: 'profile', attributes: { email, subscriptions: { email: { marketing: { consent: 'SUBSCRIBED' } } } } }] } } }
  //   });

  console.log('[NEEJEE Newsletter]', email, source || 'footer');
  return NextResponse.json({ success: true, message: 'Welcome to NEEJEE. Personally.' });
}
