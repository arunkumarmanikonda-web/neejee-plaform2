// /seller — entry point. Redirects to dashboard or seller-branded sign-in. v26.1.7
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function SellerRoot() {
  const session = await getSession();
  if (!session) redirect('/seller/login');
  if (session.role !== 'SELLER' && session.role !== 'SELLER_STAFF' &&
      session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
    // v26.1.7 — signed-in customers get the seller-branded "apply" banner,
    // not the generic customer login.
    redirect('/seller/login?notseller=1');
  }
  redirect('/seller/dashboard');
}