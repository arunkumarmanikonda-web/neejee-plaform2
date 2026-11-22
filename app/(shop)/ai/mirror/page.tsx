import { StudioPage,type StudioQuery } from '@/components/ai/StudioPage';
export const dynamic='force-dynamic';
export const metadata={title:'Aaina | Try it on | Neejee'};
export default function Page({searchParams}:{searchParams:StudioQuery}) {
  return <StudioPage mode="mirror" query={searchParams}/>;
}
