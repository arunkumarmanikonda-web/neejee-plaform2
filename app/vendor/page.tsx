// /vendor — clean entry point. Server-side decides:
//   signed-in vendor  → /vendor/dashboard
//   signed-in admin   → /admin (vendors should never see admin's view)
//   signed-out / wrong role → /vendor/login
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function VendorIndexPage() {
  const session = await getSession();
  if (!session) redirect('/vendor/login');
  if (session.role === 'VENDOR') redirect('/vendor/dashboard');
  // If an admin/customer/etc. lands here, send them to login (vendor portal only)
  redirect('/vendor/login');
}
