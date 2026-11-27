import { StudioPage,type StudioQuery } from '@/components/ai/StudioPage';
export const dynamic='force-dynamic';
export const metadata={title:'Aaina | Try it on | Neejee'};
export default async function Page(props:{searchParams:Promise<StudioQuery>}) {
  const searchParams = await props.searchParams;
  return <StudioPage mode="mirror" query={searchParams}/>;
}
