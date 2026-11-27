'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { lookUrl, selectedAccessories, slotNames,type Slot,type StyleOption, type Styling } from '@/lib/stylebook';
import { lineKey,readDressing } from '@/lib/outfit-closet';
import {styleHref,studyStyleHref} from '@/lib/pairing';
import { uploadAiImage } from '@/lib/client-upload';
import { formatINR } from '@/lib/money';
import { studioHref, type StudioMode } from '@/lib/studio';
import type { StudioPiece } from '@/lib/studio-catalog';
import { AiCommerceCompletion } from './AiCommerceCompletion';
import { SampleFitting } from './SampleFitting';
import { PhotoPair } from './PhotoPair';
import { DeleteAiPreviewButton } from './DeleteAiPreviewButton';
import styles from './Studio.module.css';

type Props={mode:StudioMode;piece:StudioPiece;initialVariant:string;signedIn:boolean;configured:boolean;styling?:Styling|null;accessories?:StyleOption[];editorial?:boolean;fromBag?:'sample'|'shop';ownSlots?:Slot[]};
export function StudioSession({mode,piece,initialVariant,signedIn,configured,styling,accessories=[],editorial=false,fromBag,ownSlots=[]}:Props) {
  const mirror=mode==='mirror';
  const router=useRouter();
  const variant=piece.variants.find(v=>v.id===initialVariant) || (piece.variants.length===1?piece.variants[0]:undefined);
  const missingVariantPhoto = mirror && !!variant && !variant.image;
  const displayedImage = missingVariantPhoto ? null : variant?.image || piece.image;
  const fittingLink=(id?:string)=>styling ? lookUrl('/ai/mirror',styling,editorial?undefined:piece.slug,editorial?undefined:id) : studioHref(mode,piece.slug,id);
  const bagUrl=fromBag==='sample'?'/cart?bag=sample':'/cart';
  const bagQuery=fromBag?'&fromBag='+fromBag+(ownSlots.length?'&own='+ownSlots.join(','):''):'';
  const back=fittingLink(variant?.id)+bagQuery;
  const guestBase=editorial&&styling?studyStyleHref(styling.look):styleHref(piece.id,variant?.id);
  const pairParams=new URLSearchParams();
  if(styling)for(const [oldSlot,newSlot] of [['shoe','footwear'],['jewel','jewellery'],['blouse','blouse']] as const){
    const id=styling[oldSlot];if(id?.startsWith('sku-'))pairParams.set(newSlot,id.slice(4));
  }
  const guestLink=guestBase+(pairParams.size?'&'+pairParams.toString():'');
  const ownKey=lineKey(piece.id,variant?.id||'');
  const [personal,setPersonal]=useState<Partial<Record<Slot,string>>>({});
  const slotList=ownSlots.join(',');
  useEffect(()=>{
    const stored=readDressing(ownKey);
    setPersonal(Object.fromEntries(ownSlots.filter(slot=>stored.choices[slot]==='mine' && stored.photos[slot]).map(slot=>[slot,stored.photos[slot]])));
  },[ownKey,slotList]);
  const missing=ownSlots.some(slot=>!personal[slot]);

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
    if (!file || !variant || missingVariantPhoto || !consent || pending.current || !signedIn || !configured || missing) return;
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
        body:JSON.stringify({productId:piece.id,variantId:variant.id,consent:true,...(styling?{styling,ownPhotos:personal}:{}),...(mirror?{personImageUrl:source}:{roomImageUrl:source})})});
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
      {displayedImage && <img src={displayedImage} alt={piece.name}/>}
      <div><p className={styles.eyebrow}>Your selection</p><h2>{piece.name}</h2><p>{editorial?'Editorial styling study':formatINR(piece.sellingPrice)}</p>
        {styling&&<div className={styles.selectedAcc}>{selectedAccessories(styling,accessories).map(a=><figure key={a.id}><img src={a.image} alt=""/><figcaption>{a.name}</figcaption></figure>)}</div>}
        {ownSlots.length>0&&<div className={styles.selectedAcc}>{ownSlots.map(slot=>personal[slot]?<figure key={slot}><img src={personal[slot]} alt={'Your own '+slotNames[slot]}/><figcaption>Your {slotNames[slot].toLowerCase()}</figcaption></figure>:null)}</div>}
        {fromBag?<Link href={bagUrl}>Back to my bag</Link>:<Link href={editing||studioHref(mode)}>{styling?'Change my styling':'Choose another piece'}</Link>}</div></aside>
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
        {!fromBag && piece.variants.length>1 && <label className={styles.field}>Colour or size
          <select value={initialVariant} disabled={!!status} onChange={e=>router.replace(fittingLink(e.target.value),{scroll:false})}>
            <option value="">Choose an option</option>{piece.variants.map((v,i)=><option key={v.id} value={v.id}>{[v.color,v.size].filter(Boolean).join(' / ') || 'Option '+(i+1)}</option>)}</select></label>}
        {missing && <p className={styles.notice}>Re-select your personal item photo in this tab. <Link href={bagUrl}>Return to my bag</Link></p>}
        {!signedIn ? <Link className={styles.primary} href={guestLink}>{mirror?'Style this look with my photos':'Style this space with my photos'}</Link> : missingVariantPhoto ? <p className={styles.notice}>A fitting photograph for this colour or size is not available yet. <Link href={fromBag?bagUrl:'/products/'+piece.slug}>{fromBag?'Back to my bag':'View the piece'}</Link></p> : !configured ? <p className={styles.notice}>{process.env.NEXT_PUBLIC_VERCEL_ENV==='preview'?'Personal photo rendering is off in this review.':'Personal photo rendering is temporarily unavailable.'} <Link href={fromBag?bagUrl:editing||'/products/'+piece.slug}>{fromBag?'Back to my bag':editorial?'Back to my look':'View the piece'}</Link></p> :
            <><label className={styles.field}>{file?'Change your photo':'Choose a photo'}<input disabled={!!status} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>selectPhoto(e.target.files?.[0])}/></label>
              {photo && <img className={styles.inputPhoto} src={photo} alt={mirror?'Your fitting photo':'Your room photo'}/>}
              <p className={styles.note}>JPG, PNG or WebP, up to 15 MB. Your photo uploads when you request the preview.</p>
              {file && <label className={styles.consent}><input type="checkbox" disabled={!!status} checked={consent} onChange={e=>setConsent(e.target.checked)}/>I agree to send my photo{ownSlots.length?' and the personal item photos shown here':''} for AI processing to create this fitting.</label>}
              <button className={styles.primary} onClick={generate} disabled={!file||!variant||!consent||!!status||missing}>Create my preview</button>
              {status && <p role="status" className={styles.note}>{status}</p>}
              {error && <p role="alert" className={styles.notice}>{error}</p>}</>}
      </>}
      {mirror && !configured && !fromBag && <SampleFitting/>}
      {!fromBag && displayedImage && <PhotoPair productImage={displayedImage} name={piece.name} wearable={mirror}/>}
    </section>
  </div>;
}
