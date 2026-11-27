import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { canOpenAdminPage } from './shop-access';

export function adminSection(section:string) {
  return async function SectionLayout({children}:{children:React.ReactNode}) {
    const user = await getSession();
    if (!user) redirect('/login?next=' + encodeURIComponent('/admin/' + section));
    if (!canOpenAdminPage(user.role,'/admin/' + section)) redirect('/admin');
    return children;
  };
}
