import { resolveVendorForSession } from '@/lib/vendor-auth-helpers';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import OwnerDashboard from './OwnerDashboard';

export default async function VendorDashboard() {
  const scope = await resolveVendorForSession(await getSession());
  if (!scope) redirect('/vendor/login');
  if (!scope.isOwner) redirect(scope.accessLevel === 'FINANCE_ONLY' ? '/vendor/payouts' : '/vendor/purchase-orders');
  return <OwnerDashboard />;
}
