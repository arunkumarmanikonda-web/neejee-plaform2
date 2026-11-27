'use client';
import {useRouter} from 'next/navigation';
import {useState} from 'react';
export function HandleEnquiry({id}:{id:string}){
  const router=useRouter(),[state,setState]=useState<'idle'|'saving'|'error'>('idle');
  return <form method="post" action="/api/admin/shop-enquiries" className="inline" onSubmit={async event=>{
    event.preventDefault();
    setState('saving');try{const r=await fetch('/api/admin/shop-enquiries',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});if(!r.ok)throw Error();router.refresh();}catch{setState('error');}
  }}><input type="hidden" name="id" value={id}/>
    <button type="submit" className="min-h-11 px-3 text-banarasi" disabled={state==='saving'}>{state==='saving'?'Saving…':'Mark as handled'}</button>{state==='error'&&<span role="alert">Please try again.</span>}</form>;
}
