import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function AdminSellerAgreementRedirect(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  redirect(`/agreement/admin/sellers/${params.id}`);
}