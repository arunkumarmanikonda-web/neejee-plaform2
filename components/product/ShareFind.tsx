'use client';
import { useState } from 'react';
import { Share2 } from 'lucide-react';
import { NEEJEE_BRAND } from '@/lib/brand';

export function ShareFind({name,href}:{name:string;href:string}) {
  const [message,setMessage]=useState('');
  const [manual,setManual]=useState('');
  async function share() {
    const url=new URL(href,NEEJEE_BRAND.canonicalUrl).href;
    try{
      if(navigator.share){await navigator.share({title:name+' | Neejee',url});setMessage('');return;}
      await navigator.clipboard.writeText(url);setMessage('Link copied.');
    }catch(e){if(e instanceof Error&&e.name==='AbortError')return;setManual(url);setMessage('Copy the link below.');}
  }
  return <div className="font-ui text-sm"><button type="button" className="inline-flex min-h-10 items-center gap-2 underline underline-offset-4" onClick={share}><Share2 size={15} aria-hidden="true"/>Send this find</button>
    <span className="ml-2" role="status">{message}</span>{manual&&<input className="block w-full p-2 border" aria-label="Link to this piece" readOnly value={manual} onFocus={e=>e.target.select()}/>}</div>;
}
