'use client';
import {useRouter} from 'next/navigation';
import {useState} from 'react';
export function HandleEnquiry({id}:{id:string}){
  const router=useRouter(),[state,setState]=useState<'idle'|'saving'|'error'>('idle');
  return <><button className="min-h-11 px-3 text-banarasi" disabled={state==='saving'} onClick={async()=>{
    setState('saving');try{const r=await fetch('/api/admin/shop-enquiries',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});if(!r.ok)throw Error();router.refresh();}catch{setState('error');}
  }}>{state==='saving'?'Saving…':'Mark as handled'}</button>{state==='error'&&<span role="alert">Please try again.</span>}</>;
}
