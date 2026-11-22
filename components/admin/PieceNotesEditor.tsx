'use client';
import { useEffect, useState } from 'react';
import { pieceFields, type PieceFacts } from '@/lib/catalog/piece-notes';

export function PieceNotesEditor({ id }: {id:string}) {
  const [facts,setFacts]=useState<PieceFacts>({});
  const [version,setVersion]=useState<string|null>(null);
  const [ready,setReady]=useState(false);
  const [refresh,setRefresh]=useState(0);
  const [message,setMessage]=useState('');
  const url='/api/admin/products/'+encodeURIComponent(id)+'/piece-notes';
  useEffect(()=>{
    const controller=new AbortController();
    setReady(false);
    fetch(url,{cache:'no-store',signal:controller.signal}).then(async r=>{
      if(!r.ok) throw Error('Unable to load the notes.');
      const d=await r.json();
      if (!controller.signal.aborted) {setFacts(d.facts);setVersion(d.version);setMessage('');setReady(true);}
    }).catch(e=>{if(!controller.signal.aborted)setMessage(e.message);});
    return ()=>controller.abort();
  },[url,refresh]);
  async function save() {
    setReady(false);
    try {
      const r=await fetch(url,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({facts,version})});
      const d=await r.json();
      if(!r.ok) throw Error(d.error||'Unable to save.');
      setVersion(d.version);setMessage('Published to the piece page.');
    } catch(e) {setMessage(e instanceof Error?e.message:'Unable to save.');}
    finally {setReady(true);}
  }
  return <section className="my-5 border border-mitti/30 p-4"><h3 className="font-display text-xl">The piece, up close</h3>
    <p className="text-sm my-3">Enter details confirmed for this item. Empty fields stay off the shop page.</p>
    <div className="grid sm:grid-cols-2 gap-3">{(Object.keys(pieceFields) as (keyof PieceFacts)[]).map(key=><label key={key} className="text-sm">{pieceFields[key]}<input disabled={!ready} value={facts[key]||''} maxLength={400} className="block border p-2 w-full mt-1" onChange={e=>setFacts({...facts,[key]:e.target.value})}/></label>)}</div>
    <button type="button" className="btn-outline mt-3" onClick={save} disabled={!ready}>Publish piece notes</button>
    {message&&<p role="status" className="mt-2">{message} <button type="button" className="underline" onClick={()=>setRefresh(refresh+1)}>Reload notes</button></p>}
  </section>;
}
