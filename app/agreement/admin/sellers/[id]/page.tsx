import { redirect } from 'next/navigation';
import { getSession, requireRole } from '@/lib/auth';
import AgreementPrintClientV2 from './AgreementPrintClientV2';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function AgreementStandalonePage({ params }: { params: { id: string } }) {
  const user = await getSession();
  if (!user) {
    redirect('/login');
  }

  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'QC_TEAM', 'CONTENT_EDITOR'])) {
    redirect('/admin');
  }

  return (
    <AgreementPrintClientV2
      id={params.id}
      dataUrl={`/api/admin/sellers/${params.id}/agreement-current`}
    />
  );
}
