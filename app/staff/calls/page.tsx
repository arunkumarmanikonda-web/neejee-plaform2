import Link from 'next/link';
import { redirect } from 'next/navigation';
import TelecallerPage from '@/app/admin/telecaller/page';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic='force-dynamic';
export default async function Calls(){
  const user=await getSession();
  if(!user) redirect('/login?next=%2Fstaff%2Fcalls');
  if(!requireRole(user,['ADMIN','SUPER_ADMIN','TELECALLER','MARKETING_MANAGER','MARKETING_OPERATOR'])) redirect('/account');
  return <main className="mx-auto max-w-6xl px-5 py-8"><Link href="/" className="inline-flex min-h-11 items-center text-banarasi">Back to Neejee</Link><TelecallerPage/></main>;
}
