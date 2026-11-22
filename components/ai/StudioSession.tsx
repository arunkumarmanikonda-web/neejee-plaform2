'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { lookUrl, selectedAccessories, type StyleOption, type Styling } from '@/lib/stylebook';
import { uploadAiImage } from '@/lib/client-upload';
import { formatINR } from '@/lib/money';
import { studioHref, type StudioMode } from '@/lib/studio';
import type { StudioPiece } from '@/lib/studio-catalog';
import { AiCommerceCompletion } from './AiCommerceCompletion';
import { PhotoPair } from './PhotoPair';
import { DeleteAiPreviewButton } from './DeleteAiPreviewButton';
import styles from './Studio.module.css';

type Props={mode:StudioMode;piece:StudioPiece;initialVariant:string;signedIn:boolean;configured:boolean;styling?:Styling|null;accessories?:StyleOption[];editorial?:boolean};
export function StudioSession({mode,piece,initialVariant,signedIn,configured,styling,accessories=[],editorial=false}:Props) {
  const mirror=mode==='mirror';
  const router=useRouter();
  const variant=piece.variants.find(v=>v.id===initialVariant) || (piece.variants.length===1?piece.variants[0]:undefined);
  const fittingLink=(id?:string)=>styling ? lookUrl('/ai/mirror',styling,editorial?undefined:piece.slug,editorial?undefined:id) : studioHref(mode,piece.slug,id);
  const back=fittingLink(variant?.id);
  const editing=styling?lookUrl('/looks',styling,editorial?undefined:piece.slug,editorial?undefined:variant?.id):'';
  const [file,setFile]=useState<File|null>(null);
  const [photo,setPhoto]=useState('');
  const [consent,setConsent]=useState(false);
  const [status,setStatus]=useState('');
  const [error,setError]=useState('');
  const [result,setResult]=useState('');
  const [previewId,setPreviewId]=useState('');
  const [showOriginal,setShowOriginal]=useState(false);
  const pending=useRef(false);
  const cachedPhoto=useRef('');
  const controller=useRef<AbortController|null>(null);

  useEffect(()=>{if(!file){setPhoto('');return;}const url=URL.createObjectURL(file);setPhoto(url);return ()=>URL.revokeObjectURL(url);},[file]);
  useEffect(()=>()=>controller.current?.abort(),[]);
  function selectPhoto(next:File|undefined) {
    if (!next) return;
    if (!/^image\/(jpeg|png|webp)$/.test(next.type) || next.size>15*1024*1024) {
      setError('Choose a JPG, PNG or WebP photo smaller than 15 MB.');return;
    }
    cachedPhoto.current='';setError('');setFile(next);setConsent(false);
  }
  async function generate() {
    if (!file || !variant || !consent || pending.current || !signedIn || !configured) return;
    pending.current=true;
    const abort=new AbortController();
    controller.current=abort;
    setError('');setStatus('Uploading your photo…');
    try {
      const source=cachedPhoto.current || (await uploadAiImage(file,mirror?'ai-mirror':'ai-space')).url;
      cachedPhoto.current=source;
      if (abort.signal.aborted) return;
      setStatus(mirror?'Preparing your fitting…':'Placing the piece in your room…');
      const res=await fetch(mirror?'/api/ai/mirror':'/api/ai/space',{method:'POST',headers:{'Content-Type':'application/json'},signal:abort.signal,
        body:JSON.stringify({productId:piece.id,variantId:variant.id,consent:true,...(styling?{styling}:{}),...(mirror?{personImageUrl:source}:{roomImageUrl:source})})});
      const job=await res.json();
      if (!res.ok || job.configured===false) throw Error(job.error || 'The studio is unavailable right now.');
      setPreviewId(job.previewId||'');
      if(job.outputUrl){setResult(job.outputUrl);return;}
      if(!job.pollUrl?.startsWith('/api/ai/')) throw Error('The preview could not start. Please try again.');
      const deadline=Date.now()+300000;
      while(Date.now()<deadline && !abort.signal.aborted){
        await new Promise(resolve=>setTimeout(resolve,2500));
        if(abort.signal.aborted) return;
        const next=await fetch(job.pollUrl,{cache:'no-store',signal:abort.signal});
        const frame=await next.json();
        if(!next.ok)throw Error('The studio could not finish this preview. Please try another photo.');
        if(frame.done && frame.outputUrl){setResult(frame.outputUrl);return;}
        setStatus(frame.status==='IN_QUEUE'?'Your preview is queued…':mirror?'Trying the piece on your photo…':'Matching the light in your room…');
      }
      throw Error('This preview is taking longer than expected. Please try again later.');
    } catch(e) {
      if(!abort.signal.aborted)setError(e instanceof Error?e.message:'Please try again.');
    } finally {pending.current=false;if(!abort.signal.aborted)setStatus('');}
  }
  return <div className={styles.workspace}>
    <aside className={styles.piece}>
      <img src={variant?.image || piece.image} alt={piece.name}/>
      <div><p className={styles.eyebrow}>Your selection</p><h2>{piece.name}</h2><p>{editorial?'Editorial styling study':formatINR(piece.sellingPrice)}</p>
        {styling&&<div className={styles.selectedAcc}>{selectedAccessories(styling,accessories).map(a=><figure key={a.id}><img src={a.image} alt=""/><figcaption>{a.name}</figcaption></figure>)}</div>}
        <Link href={editing||studioHref(mode)}>{styling?'Change my styling':'Choose another piece'}</Link></div></aside>
    <section className={styles.workspaceBody}>
      {result ? <><h2>{mirror?'Your fitting':'Your room preview'}</h2>
        <div className={styles.compare} aria-label="Compare photographs">
          <button aria-pressed={showOriginal} onClick={()=>setShowOriginal(true)}>Original photo</button>
          <button aria-pressed={!showOriginal} onClick={()=>setShowOriginal(false)}>With the piece</button></div>
        <img className={styles.result} src={showOriginal?photo:result} alt={showOriginal?'Your original photograph':'Your generated preview with '+piece.name}/>
        <p className={styles.note}>{mirror?'The preview shows styling. Check garment measurements before ordering.':'Perspective, scale and colour are approximate. Check the product dimensions before ordering.'}</p>
        <DeleteAiPreviewButton previewId={previewId} onDeleted={()=>{setFile(null);setConsent(false);setResult('');setShowOriginal(false);setPreviewId('');cachedPhoto.current='';}}/>
        {!editorial&&<AiCommerceCompletion mode={mirror?'mirror':'space'} sourceProduct={piece} sourceVariantId={variant?.id}/>}
      </> : <>
        <h2>{mirror?'Try it on your photo':'See it in your room'}</h2>
        <p>{mirror?'Use a full-length, front-facing photo with your feet in frame to see the shoes.':'A daylight photo works best. Include the surface or corner where you would put the piece.'}</p>
        {piece.variants.length>1 && <label className={styles.field}>Colour or size
          <select value={initialVariant} disabled={!!status} onChange={e=>router.replace(fittingLink(e.target.value),{scroll:false})}>
            <option value="">Choose an option</option>{piece.variants.map((v,i)=><option key={v.id} value={v.id}>{[v.color,v.size].filter(Boolean).join(' / ') || 'Option '+(i+1)}</option>)}</select></label>}
        {!configured ? <p className={styles.notice}>Photo rendering is temporarily unavailable. <Link href={editing||'/products/'+piece.slug}>{editorial?'Back to my look':'View the piece'}</Link></p> :
          !signedIn ? <><p className={styles.note}>Sign in to add your photo. We’ll keep this piece selected.</p>
            <Link className={styles.primary} href={'/login?next='+encodeURIComponent(back)}>Sign in to add a photo</Link></> :
            <><label className={styles.field}>{file?'Change your photo':'Choose a photo'}<input disabled={!!status} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>selectPhoto(e.target.files?.[0])}/></label>
              {photo && <img className={styles.inputPhoto} src={photo} alt={mirror?'Your fitting photo':'Your room photo'}/>}
              <p className={styles.note}>JPG, PNG or WebP, up to 15 MB. Your photo uploads when you request the preview.</p>
              {file && <label className={styles.consent}><input type="checkbox" disabled={!!status} checked={consent} onChange={e=>setConsent(e.target.checked)}/>I agree to have my photo processed to create this preview.</label>}
              <button className={styles.primary} onClick={generate} disabled={!file||!variant||!consent||!!status}>Create my preview</button>
              {status && <p role="status" className={styles.note}>{status}</p>}
              {error && <p role="alert" className={styles.notice}>{error}</p>}</>}
      </>}
      <PhotoPair productImage={variant?.image || piece.image} name={piece.name} wearable={mirror}/>
    </section>
  </div>;
}
