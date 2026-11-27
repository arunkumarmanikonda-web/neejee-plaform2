import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getSession, requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function EditorialPreview({params}:{params:Promise<{id:string}>}) {
  if (!requireRole(await getSession(),['SUPER_ADMIN','ADMIN','CONTENT_EDITOR'])) notFound();
  const {id} = await params;
  const block = await prisma.editorialBlock.findUnique({where:{id},select:{title:true,subhead:true,body:true,kicker:true,coverImage:true}});
  if (!block) notFound();
  return <article className="max-w-3xl mx-auto px-6 py-10 space-y-6">
    <Link href={'/admin/editorial-blocks/'+encodeURIComponent(id)} className="text-madder">Back to editor</Link>
    <p className="label">Staff preview · Saved version</p>
    {block.kicker && <p>{block.kicker}</p>}
    <h1 className="font-display text-4xl">{block.title}</h1>
    {block.subhead && <p className="text-xl">{block.subhead}</p>}
    {block.coverImage && <img src={block.coverImage} alt="" className="max-h-96 object-contain"/>}
    <div className="whitespace-pre-wrap">{block.body}</div>
  </article>;
}
