import { EditorialPage, editorialMetadata } from '@/components/cms/EditorialPage';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Props = { params: Promise<{slug:string}> };
export async function generateMetadata(props:Props) {
  const params = await props.params;
  return editorialMetadata(params.slug,'journal');
}
export default async function Page(props:Props) {
  const params = await props.params;
  return <EditorialPage slug={params.slug} kind="journal" />;
}
