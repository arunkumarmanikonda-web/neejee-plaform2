import { EditorialPage, editorialMetadata } from '@/components/cms/EditorialPage';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Props = { params: {slug:string} };
export function generateMetadata({params}:Props) { return editorialMetadata(params.slug,'pages'); }
export default function Page({params}:Props) { return <EditorialPage slug={params.slug} kind="pages" />; }
