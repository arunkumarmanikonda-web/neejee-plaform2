import {NextResponse} from 'next/server';
import {getSession, requireRole} from '@/lib/auth';
import {readCookieValue, sellerIntakePhoneVerified} from './phone-verification';

export async function requireIntakeAccess(request: Request) {
  if (sellerIntakePhoneVerified(request)) return null;
  if (readCookieValue(request.headers.get('cookie'), 'neejee-session')) {
    const user = await getSession();
    if (requireRole(user, ['ADMIN','SUPER_ADMIN','FINANCE'])) return null;
  }
  return NextResponse.json(
    {error:'Verify your mobile number before submitting seller documents.', code:'SELLER_PHONE_VERIFICATION_REQUIRED'},
    {status:401, headers:{'Cache-Control':'private, no-store'}},
  );
}
