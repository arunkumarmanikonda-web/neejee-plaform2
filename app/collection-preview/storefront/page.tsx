import { FashionStorefront } from '@/components/home/FashionStorefront';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { reviewCookie } from '@/lib/collection-review';
export const metadata = { robots:{index:false,follow:false} };
export default async function Page(){
  if((await cookies()).get(reviewCookie)?.value!=='1')redirect('/collection-preview');
  return <FashionStorefront review/>;
}
