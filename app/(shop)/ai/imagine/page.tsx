import { StudioPage,type StudioQuery } from '@/components/ai/StudioPage';
export const dynamic='force-dynamic';
export const metadata={title:'See décor in my room | Neejee'};
export default function Page({searchParams}:{searchParams:StudioQuery}) {
  return <StudioPage mode="imagine" query={searchParams}/>;
}
