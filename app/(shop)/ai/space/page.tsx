import { redirect } from 'next/navigation';
import { studioHref } from '@/lib/studio';
import type { StudioQuery } from '@/components/ai/StudioPage';
export default async function Page(props:{searchParams:Promise<StudioQuery>}) {
  const searchParams = await props.searchParams;
  redirect(studioHref('imagine',searchParams.product,searchParams.variant,Number(searchParams.page)));
}
