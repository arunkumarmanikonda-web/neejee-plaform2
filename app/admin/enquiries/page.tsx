import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession,requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { studies } from '@/lib/shop-studies';
import { HandleEnquiry } from './HandleEnquiry';
export const dynamic='force-dynamic';
export default async function Enquiries({searchParams}:{searchParams:Promise<{page?:string;view?:string}>}){
  const user=await getSession();
  if(!requireRole(user,['ADMIN','SUPER_ADMIN'])) redirect('/admin');
  const query=await searchParams,handled=query.view==='handled';
  const page=Math.max(1,Math.min(100000,parseInt(query.page||'1',10)||1));
  const rows=await prisma.shopEnquiry.findMany({where:{handledAt:handled?{not:null}:null},orderBy:[{createdAt:'desc'},{id:'desc'}],take:26,skip:(page-1)*25});
  const href=(p:number)=>'/admin/enquiries?view='+(handled?'handled':'open')+'&page='+p;
  return <><h1 className="font-display text-4xl">Fashion enquiries</h1>
    <nav aria-label="Enquiry status" className="mt-4 flex gap-5 font-ui"><Link href="/admin/enquiries" aria-current={!handled?'page':undefined}>Open</Link><Link href="/admin/enquiries?view=handled" aria-current={handled?'page':undefined}>Handled</Link></nav>
    <div className="mt-5 grid gap-3">{rows.slice(0,25).map(row=><article key={row.id} className="border border-beige p-4">
      <h2 className="font-display text-xl">{studies.find(s=>s.id===row.pieceId)?.name||row.pieceId}</h2>
      <p className="text-sm font-ui mt-1">NJ-{row.id.slice(0,8).toUpperCase()} · {row.createdAt.toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata'})}</p>
      <p className="mt-2 whitespace-pre-wrap break-words">{row.message}</p>
      <a className="inline-flex items-center min-h-11 text-banarasi break-all" href={'mailto:'+encodeURIComponent(row.email)+'?subject='+encodeURIComponent('Neejee enquiry NJ-'+row.id.slice(0,8).toUpperCase())}>{row.email}</a>
      {!handled&&<HandleEnquiry id={row.id}/>}</article>)}</div>
    {!rows.length&&<p className="mt-8">No {handled?'handled':'open'} enquiries on this page.</p>}
    <nav aria-label="Enquiry pages" className="mt-4 flex gap-5">{page>1&&<Link href={href(page-1)}>Previous</Link>}{rows.length>25&&<Link href={href(page+1)}>Next</Link>}</nav></>;
}
