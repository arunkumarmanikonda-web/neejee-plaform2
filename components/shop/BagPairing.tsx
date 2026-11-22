'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Camera, Check, ChevronDown, X } from 'lucide-react';
import { slots,slotNames,lookUrl,type Slot,type StyleOption,type Styling } from '@/lib/stylebook';
import { describeSwatch,type Garment } from '@/lib/outfit-rank';
import { suggestColours } from '@/lib/photo-colours';
import { lineKey,localWardrobePhoto,readDressing,saveDressing,type Dressing } from '@/lib/outfit-closet';
import { useCart } from '@/lib/cart-store';
import './dressing.css';

type Source={product:string;variant?:string|null;study?:boolean;name:string};
type Data={garment:Garment;options:StyleOption[]};
const group=(a:StyleOption)=>(a.productId||a.id)+'|'+(a.colour||'');
const requestUrl=(p:Source)=>'/api/styling?'+new URLSearchParams(p.study?{study:p.product}:{product:p.product,variant:p.variant||''});
export function BagPairing(props:Source) {
  const [open,setOpen]=useState(false);
  const [data,setData]=useState<Data|null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{
    if(!open||data)return;
    const controller=new AbortController();setError('');
    fetch(requestUrl(props),{signal:controller.signal}).then(async res=>{
      const payload=await res.json();if(!res.ok)throw Error(payload.error||'Try again shortly.');setData(payload);
    }).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
    return ()=>controller.abort();
  },[open,data,props.product,props.variant,props.study]);
  return <div className="nj-dressing">
    <button className="nj-style-trigger" type="button" aria-expanded={open} aria-label={'Style this saree: '+props.name} onClick={()=>setOpen(!open)}><img alt="" src="/brand/house/floral-sprig.svg"/>Style this saree <ChevronDown size={15} className={open?'turned':''}/></button>
    {open && (data?<DressingBoard key={data.garment.id+data.garment.variant} data={data} sampleBag={!!props.study}/>:
      <p role="status" className="nj-style-status">{error||'Finding blouse, jutti and jewellery pairings…'}</p>)}
  </div>;
}
function DressingBoard({data:{garment:g,options},sampleBag}:{data:Data;sampleBag:boolean}) {
  const key=lineKey(g.id,g.variant);
  const [state,setState]=useState<Dressing>(()=>readDressing(key));
  const [slot,setSlot]=useState<Slot>('blouse');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const adding=useRef(false);
  const photoSeq=useRef(0);
  const [confirmedSize,setConfirmedSize]=useState<Record<string,string>>({});
  const cart=useCart(s=>s.items);
  const addItem=useCart(s=>s.addItem);
  const recommended=(role:Slot)=>options.find(a=>a.slot===role);
  function selected(role:Slot) {
    const id=state.choices[role];
    return id===undefined?recommended(role):options.find(a=>a.slot===role&&a.id===id);
  }
  function update(next:Dressing){setState(next);saveDressing(key,next);}
  function choose(role:Slot,id:string){
    photoSeq.current++;
    const photos={...state.photos};delete photos[role];
    update({choices:{...state.choices,[role]:id},photos});setMessage('');
  }
  async function takePhoto(file:File|undefined,role:Slot) {
    if(!file)return;
    const seq=++photoSeq.current;
    try {
      const photo=await localWardrobePhoto(file);
      if(seq!==photoSeq.current)return;
      setState(prev=>{const next={choices:{...prev.choices,[role]:'mine'},photos:{...prev.photos,[role]:photo}};saveDressing(key,next);return next;});
      setMessage('Your photo is beside the saree.');
    }catch(e){if(seq===photoSeq.current)setMessage(e instanceof Error?e.message:'Could not open the image.');}
  }
  const picked=selected(slot);
  const style:Styling={look:g.study||'sage',shoe:selected('shoe')?.id||'none',jewel:selected('jewel')?.id||'none',blouse:selected('blouse')?.id||'none'};
  const own=slots.filter(k=>state.photos[k] && state.choices[k]==='mine');
  const mirror=lookUrl('/ai/mirror',style,g.study?undefined:g.slug,g.study?undefined:g.variant)+'&fromBag='+(sampleBag?'sample':'shop')+(own.length?'&own='+own.join(','):'');
  const optionsHere=options.filter(a=>a.slot===slot);
  const groups=[...new Set(optionsHere.map(group))].map(k=>optionsHere.find(a=>group(a)===k)!);
  const sizes=picked?optionsHere.filter(a=>group(a)===group(picked) && a.size):[];
  const inBag=picked&&cart.some(line=>line.variantId===picked.id.slice(4));
  async function add(){
    if(!picked?.productId||adding.current||sampleBag)return;
    adding.current=true;setBusy(true);setMessage('');
    try{
      const res=await fetch('/api/styling?accessory='+encodeURIComponent(picked.id),{cache:'no-store'});
      const payload=await res.json();const a:StyleOption=payload.option;
      if(!res.ok||!a?.productId||!a.slug||a.pricePaise==null)throw Error(payload.error||'This option is no longer available.');
      addItem({id:a.productId,slug:a.slug,name:a.name,images:[a.image],sellingPrice:a.pricePaise,variantId:a.id.slice(4),variantLabel:[a.colour,a.size].filter(Boolean).join(' / ')});
      setMessage(a.name+' added to your bag.');
    }catch(e){setMessage(e instanceof Error?e.message:'Could not add this piece.');}
    finally{adding.current=false;setBusy(false);}
  }
  return <section className="nj-dress-board" aria-label={'Pairings for '+g.name}>
    <div className="nj-dress-heading"><div><span lang="hi">संगत</span><h3>Wear it with</h3></div>{g.mirror&&<Link className="nj-dress-mirror" href={mirror}>Try this look on me</Link>}</div>
    <div className="nj-outfit-tray"><figure className="nj-anchor">{g.image&&<img src={g.image} alt={g.name}/>}<figcaption>{g.name}</figcaption></figure>
      {slots.map(role=>{const a=selected(role),photo=state.photos[role];return <button type="button" key={role} aria-pressed={slot===role} onClick={()=>{setSlot(role);setMessage('');}}>
        <span className="nj-tray-image">{photo?<img src={photo} alt={'Your own '+slotNames[role]}/>:a?<img src={a.image} alt={a.name}/>:<Camera size={20}/>}</span><b>{slotNames[role]}</b><small>{photo?'From home':a?.productId?'From the shop':a?'Style study':'Choose'}</small></button>;})}
    </div>
    <div className="nj-options-title"><h4>{slotNames[slot]}</h4><label><Camera size={15}/>{state.photos[slot]?'Change my photo':'Use my own'}<input aria-label={'Upload your own '+slotNames[slot]} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const file=e.target.files?.[0];e.target.value='';void takePhoto(file,slot);}}/></label></div>
    {state.photos[slot] ? <div className="nj-match-note"><b>Your own {slotNames[slot].toLowerCase()}</b><p>Compare it beside the saree above. Your photo stays in this tab until you request a fitting.</p>
      <SwatchMatch key={state.photos[slot]} garment={g} photo={state.photos[slot]!}/><button onClick={()=>choose(slot,recommended(slot)?.id||'none')}>Remove my photo</button></div>:<>
    {groups.length>0?<div className="nj-options">{groups.map(a=><button type="button" key={group(a)} aria-pressed={!!picked&&group(picked)===group(a)} onClick={()=>choose(slot,a.id)}><img src={a.image} alt=""/><span>{a.name}{a.colour?' · '+a.colour:''}</span>{a.price&&<strong>{a.price}</strong>}</button>)}</div>:<p className="nj-match-note">There’s no {slotNames[slot].toLowerCase()} in the current shop selection. You can try a photo of your own.</p>}
    {picked&&<div className="nj-match-note"><b>{picked.name}</b><p>{picked.reason}</p>
      {sizes.length>0 && !sampleBag && <label>Size <select aria-label={'Size for '+picked.name} value={confirmedSize[group(picked)]||''} onChange={e=>{const id=e.target.value;setConfirmedSize({...confirmedSize,[group(picked)]:id});choose(slot,id||picked.id);}}><option value="">Choose size</option>{sizes.map(a=><option key={a.id} value={a.id}>{a.size}</option>)}</select></label>}
      {picked.productId&&!sampleBag&&<button className="nj-add-pair" disabled={busy||inBag||!!(sizes.length&&confirmedSize[group(picked)]!==picked.id)} onClick={add}>{inBag?<><Check size={14}/> In your bag</>:busy?'Checking availability…':'Add '+slotNames[slot].toLowerCase()+' · '+picked.price}</button>}
      <button className="nj-remove-slot" onClick={()=>choose(slot,'none')}><X size={12}/> Leave this out</button></div>}
    </>}
    {message&&<p role="status" className="nj-style-status">{message}</p>}
  </section>;
}
export function useBagSarees(productIds:string[]) {
  const key=[...new Set(productIds)].sort().join(',');
  const [sarees,setSarees]=useState<string[]>([]);
  useEffect(()=>{
    if(!key){setSarees([]);return;}
    const ids=key.split(','),ctl=new AbortController();
    const batches=Array.from({length:Math.ceil(ids.length/60)},(_,i)=>ids.slice(60*i,60*i+60));
    Promise.all(batches.map(async batch=>{
      const res=await fetch('/api/styling?lines='+encodeURIComponent(batch.join(',')),{signal:ctl.signal});
      return res.ok ? (await res.json()).ids as string[] : [];
    })).then(groups=>{if(!ctl.signal.aborted)setSarees(groups.flat());}).catch(()=>{});
    return ()=>ctl.abort();
  },[key]);
  return sarees;
}

function SwatchMatch({garment,photo}:{garment:Garment;photo:string}) {
  const [palette,setPalette]=useState<string[]>([]),[picked,setPicked]=useState('');
  useEffect(()=>{
    let alive=true;
    const img=new Image();img.src=photo;
    img.decode().then(()=>{
      if(!alive)return;
      const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
      const ctx=canvas.getContext('2d');if(!ctx)return;
      ctx.drawImage(img,0,0,64,64);const list=suggestColours(ctx.getImageData(0,0,64,64).data);
      setPalette(list);setPicked(list[0]||'');
    }).catch(()=>{});
    return ()=>{alive=false;};
  },[photo]);
  if(!picked)return null;
  return <div className="nj-own-swatches"><span>Compare a colour from your photo</span><div>{palette.map(hex=><button key={hex} aria-pressed={picked===hex} aria-label={'Compare colour '+hex} title={hex} onClick={()=>setPicked(hex)} style={{background:hex}}/>)}</div><p aria-live="polite">{describeSwatch(garment,picked)}</p></div>;
}
