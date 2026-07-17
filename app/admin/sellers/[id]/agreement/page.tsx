import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function AdminSellerAgreementRedirect({ params }: { params: { id: string } }) {
  redirect(`/agreement/admin/sellers/${params.id}`);
}