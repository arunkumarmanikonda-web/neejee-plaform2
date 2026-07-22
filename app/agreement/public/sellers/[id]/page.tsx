import AgreementPrintClient from '@/app/agreement/admin/sellers/[id]/AgreementPrintClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PublicAgreementPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { token?: string };
}) {
  const token = String(searchParams?.token || '');
  const qs = token ? `?token=${encodeURIComponent(token)}` : '';

  return (
    <AgreementPrintClient
      id={params.id}
      dataUrl={`/api/admin/sellers/${params.id}/agreement${qs}`}
    />
  );
}