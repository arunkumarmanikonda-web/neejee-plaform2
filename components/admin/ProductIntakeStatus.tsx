'use client';
import { useEffect, useRef, useState } from 'react';
type Job = {status:string; variants:{url:string;sceneNote?:string | null}[]};
export function ProductIntakeStatus({productId,openStudio}:{productId:string;openStudio:()=>void}) {
  const endpoint = '/api/admin/products/' + encodeURIComponent(productId) + '/photo-intake';
  const [job,setJob] = useState<Job | null>(null);
  const [message,setMessage] = useState('');
  const [canReview,setCanReview] = useState(false);
  const [retrying,setRetrying] = useState(false);
  const [refresh,setRefresh] = useState(0);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    let current = true, timer:ReturnType<typeof setTimeout> | undefined, started = false;
    async function check() {
      try {
        const res = await fetch(endpoint,{cache:'no-store'});
        if (!res.ok) throw new Error();
        const {job:latest,canReview:reviewAllowed} = await res.json();
        if (!current) return;
        setJob(latest); setCanReview(!!reviewAllowed); setMessage('');
        if (!latest || !['QUEUED','RUNNING'].includes(latest.status)) return;
        if (latest.status === 'QUEUED' && !started) {
          started = true;
          // The queue and claim live on the server; closing the page leaves the draft intact.
          void fetch(endpoint,{method:'POST'}).catch(() => {});
        }
      } catch {
        if (!current) return;
        setMessage('Your product is saved. Reconnecting to Photo Studio…');
      }
      if (current) timer=setTimeout(check,5000);
    }
    void check();
    return () => { current=false; live.current=false; clearTimeout(timer); };
  },[endpoint,refresh]);
  async function retry() {
    setRetrying(true); setMessage('');
    try {
      const res = await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({retry:true})});
      if (!res.ok) throw new Error();
      if (live.current) setRefresh(n=>n+1);
    } catch { if (live.current) setMessage('Could not reach Photo Studio. Try again.'); }
    finally { if (live.current) setRetrying(false); }
  }
  if (!job && !message) return null;
  const completed=job?.status==='COMPLETED';
  return <section className="mt-4 p-4 bg-beige" aria-label="Product photography">
    <p className="font-ui text-sm" role="status">{message || (completed ? 'Creative options are ready for review.' :
      job?.status==='QUEUED' ? 'Product saved. Photography is queued.' : job?.status==='RUNNING' || retrying ? 'Product saved. Preparing creative options from your photos…' :
      'Your product and original photographs are saved. Creative generation stopped.')}</p>
    {completed && <div className="flex gap-2 flex-wrap mt-2">{job?.variants.map((v,i)=><img className="w-20 h-24 object-contain" key={i}
      src={v.url} alt={v.sceneNote || 'Creative option ' + (i+1)}/>)}{canReview && <button type="button" className="btn-outline" onClick={openStudio}>Open Photo Studio</button>}</div>}
    {job?.status==='FAILED' && <button type="button" className="btn-outline mt-2" disabled={retrying} onClick={retry}>{retrying?'Retrying…':'Retry creative generation'}</button>}
  </section>;
}
