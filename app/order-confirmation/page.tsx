'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Check, Mail, MessageCircle } from 'lucide-react';
import { track } from '@/lib/analytics';
import { HouseHeading } from '@/components/checkout/HouseHeading';


function ConfirmationInner() {
  const params = useSearchParams();
  const orderNumber = params.get('order') || params.get('id') || '';
  const [status,setStatus] = useState<'loading'|'confirmed'|'lookup'>('loading');
  useEffect(()=>{
    const controller=new AbortController();
    if (!orderNumber) {setStatus('lookup');return;}
    setStatus('loading');
    fetch('/api/orders/'+encodeURIComponent(orderNumber),{cache:'no-store',signal:controller.signal}).then(async r=>{
      if (!r.ok) throw Error();
      const {order}=await r.json();
      const confirmed=order?.orderNumber===orderNumber && (order.paymentMethod==='COD' || order.paymentStatus==='PAID') && !['CANCELLED','REFUNDED'].includes(order.status);
      if (controller.signal.aborted) return;
      setStatus(confirmed?'confirmed':'lookup');
      if (confirmed) {
        const key='neejee:receipt:'+orderNumber;
        try { if(!sessionStorage.getItem(key)){sessionStorage.setItem(key,'1');track({type:'PURCHASE',value:order.total});} } catch {}
      }
    }).catch(()=>{if(!controller.signal.aborted)setStatus('lookup');});
    return ()=>controller.abort();
  },[orderNumber]);
  if(status!=='confirmed') return <main className="max-w-2xl mx-auto px-6 py-16"><HouseHeading title={status==='loading'?'Checking your order':'Find your order'} stage="Order details"/>{status==='lookup' && <p className="mt-6">Use your order number and checkout email to <Link href="/help/track" className="underline">check your order status</Link>.</p>}</main>;
  return (
    <main>
      <section className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="w-20 h-20 bg-madder text-ivory rounded-full mx-auto flex items-center justify-center">
          <Check className="w-10 h-10" aria-hidden="true" />
        </div>
        <p className="label text-madder mt-8">ORDER PLACED</p>
        <h1 className="font-display text-5xl text-kohl mt-4">Personally received.</h1>
        <p className="font-italic italic text-xl text-mitti mt-4">Thank you for choosing a piece from Neejee.</p>
        <div className="madder-divider mx-auto mt-8"></div>

        <div className="bg-beige p-8 mt-12 text-left">
          <p className="label text-madder">ORDER NUMBER</p>
          <p className="font-display text-3xl text-kohl mt-2">{orderNumber}</p>
          <p className="font-italic italic text-mitti mt-2">Keep this reference for tracking and care enquiries.</p>

          <div className="madder-divider mt-6"></div>

          <div className="mt-6 space-y-3 font-body text-kohl/85">
            <div className="flex gap-3"><Mail className="w-4 h-4 mt-1 text-mitti flex-shrink-0" aria-hidden="true" /><p>Your secure invoice and order confirmation are sent to the email used at checkout.</p></div>
            <div className="flex gap-3"><MessageCircle className="w-4 h-4 mt-1 text-mitti flex-shrink-0" aria-hidden="true" /><p>Where messaging is enabled, delivery updates will follow on your verified contact channel.</p></div>
            <div className="flex gap-3"><Check className="w-4 h-4 mt-1 text-mitti flex-shrink-0" aria-hidden="true" /><p>Use your order number and checkout email to retrieve order documents securely.</p></div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-10">
          <Link href="/help/track" className="btn-outline">TRACK MY ORDER</Link>
          <Link href="/" className="btn-primary">CONTINUE FINDING</Link>
        </div>

        <p className="font-italic italic text-mitti mt-16 text-lg">
          Personally, <br /><span className="font-display">Nidhi & the NEEJEE team</span>
        </p>
      </section>
    </main>
  );
}

export default function OrderConfirmationPage() {
  return (
    <>
      <Header />
      <Suspense fallback={<div className="py-20 text-center font-italic italic text-mitti">Loading...</div>}>
        <ConfirmationInner />
      </Suspense>
      <Footer />
    </>
  );
}
