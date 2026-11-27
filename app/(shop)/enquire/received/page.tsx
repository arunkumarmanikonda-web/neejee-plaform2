import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export default async function Received({searchParams}:{searchParams:Promise<{ref?:string}>}){
  const {ref}=await searchParams;
  const reference=ref && /^NJ-[A-F0-9]{8}$/.test(ref) ? ref : null;
  return <><Header shop/><main className="mx-auto max-w-2xl px-5 py-16">
    <h1 className="font-display text-3xl">{reference?'Your enquiry is with Neejee.':'Fashion enquiries'}</h1>
    {reference&&<p role="status" className="mt-4 font-ui">Keep your reference {reference}. We’ll reply to the email you provided.</p>}
    <Link href="/edits/sarees" className="inline-flex min-h-11 mt-5 items-center text-banarasi">Explore sarees</Link>
  </main><Footer/></>;
}
