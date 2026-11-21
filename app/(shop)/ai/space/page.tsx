import { redirect } from 'next/navigation';
import { studioHref } from '@/lib/studio';
import type { StudioQuery } from '@/components/ai/StudioPage';
export default function Page({searchParams}:{searchParams:StudioQuery}) {
  redirect(studioHref('imagine',searchParams.product,searchParams.variant,Number(searchParams.page)));
}
