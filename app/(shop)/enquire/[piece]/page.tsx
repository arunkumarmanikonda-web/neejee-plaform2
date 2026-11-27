import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { studies } from '@/lib/shop-studies';
import { getPublicContact } from '@/lib/public-contact';
import { EnquiryForm } from './EnquiryForm';

export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{piece:string}>}){
  const {piece:id} = await params;
  const piece = studies.find(item=>item.id===id);
  if (!piece) notFound();
  const contact = await getPublicContact();
  return <><Header shop/><main className="mx-auto max-w-3xl px-5 py-10 sm:py-16">
    <Link href={'/edits/'+piece.group} className="inline-flex items-center min-h-11 font-ui text-sm text-mitti">← Back to {piece.group}</Link>
    <div className="mt-4 flex gap-5 items-center"><img src={piece.image} width="84" height="112" alt="" className="object-cover w-[84px] h-[112px]"/>
      <div><h1 className="font-display text-3xl text-banarasi">Ask about this piece</h1><p className="font-body text-xl mt-2">{piece.name}</p></div></div>
    <EnquiryForm piece={piece.id} email={contact.email} initialRequestId={randomUUID()}/>
  </main><Footer/></>;
}
