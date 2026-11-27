import { StudioPage,type StudioQuery } from '@/components/ai/StudioPage';
export const dynamic='force-dynamic';
export const metadata={title:'See décor in my room | Neejee'};
export default async function Page(props:{searchParams:Promise<StudioQuery>}) {
  const searchParams = await props.searchParams;
  return <StudioPage mode="imagine" query={searchParams}/>;
}
