import { permanentRedirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function LegacySellerApplyPage() {
  permanentRedirect('/sell/apply');
}