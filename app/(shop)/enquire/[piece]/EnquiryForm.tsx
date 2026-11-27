'use client';
import { useRef, useState } from 'react';
export function EnquiryForm({piece,email}:{piece:string;email:string}) {
  const key=useRef(''),busy=useRef(false);
  const [sending,setSending]=useState(false),[reference,setReference]=useState(''),[error,setError]=useState('');
  if (reference) return <div role="status" className="mt-8 border border-beige bg-ivory p-6"><h2 className="font-display text-3xl">Your enquiry is with Neejee.</h2>
    <p className="mt-2 font-ui">Keep your reference {reference}. We’ll reply to the email you provided.</p></div>;
  return <form className="mt-7 grid gap-5 font-ui" onChange={()=>{key.current='';setError('');}} onSubmit={async event=>{
    event.preventDefault(); if(busy.current) return;
    const data=new FormData(event.currentTarget);
    busy.current=true;setSending(true);setError('');
    try {
      key.current ||= crypto.randomUUID();
      const res=await fetch('/api/shop-enquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:key.current,piece,email:data.get('email'),message:data.get('message')})});
      const body=await res.json();if(!res.ok||!body.reference) throw Error(body.error||'Please try again.');
      setReference(body.reference);
    } catch(e){setError(e instanceof TypeError?'Please check your connection and try again.':e instanceof Error?e.message:'Please try again.');}
    finally {busy.current=false;setSending(false);}
  }}>
    <label className="grid gap-2">Your email<input name="email" type="email" autoComplete="email" required maxLength={254} className="border border-mitti/50 p-3" /></label>
    <label className="grid gap-2">What would you like to know? (optional)<textarea name="message" rows={3} maxLength={600} placeholder="Availability, blouse details, delivery…" className="border border-mitti/50 p-3"/></label>
    <p className="text-sm text-mitti">We’ll use your email to answer this enquiry.</p>
    {error&&<p role="alert">{error} You can also write to <a href={'mailto:'+email}>{email}</a>.</p>}
    <button disabled={sending} className="justify-self-start bg-banarasi text-ivory px-6 py-3">{sending?'Sending…':'Send my enquiry'}</button>
  </form>;
}
