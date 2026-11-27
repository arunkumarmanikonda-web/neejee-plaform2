'use client';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {buildPricing} from '@/lib/catalog/pricing-read';
import {useEffect,useRef,useState} from 'react';
import { ArrowLeft,ArrowRight,Camera,Check,Plus,X } from 'lucide-react';
import {pairingSlots,styleHref,type PairBoard,type PairSlot,type PairPiece} from '@/lib/pairing';
import {localWardrobePhoto} from '@/lib/outfit-closet';
import {useCart} from '@/lib/cart-store';
import {useClientReady} from '@/lib/use-client-ready';
import {formatINR} from '@/lib/money';
import ui from './PairingRoom.module.css';

type Choice={photo?:string;variant?:string};
type Draft={layers:Partial<Record<PairSlot,Choice>>;background?:string};
const empty:Draft={layers:{}};
// Only this tab's memory holds personal photographs. Revisiting another cart item restores its board.
const drafts=new Map<string,Draft>();
const typeOfPhoto='image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif';
const endpoint='/api/styling/preview';
function PhotoInput({label,onFile}:{label:string;onFile:(file:File)=>void}){
  return <label className={ui.upload}><Camera size={17} aria-hidden/>{label}<input type="file" aria-label={label} accept={typeOfPhoto} onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)onFile(f);}}/></label>;
}
export function PairingRoom({board,initialOptions={}}:{board:PairBoard;initialOptions?:Partial<Record<PairSlot,string|undefined>>}){
  const {anchor}=board,room=board.mode==='room',key=anchor.id+'~'+anchor.variant;
  const [draft,setDraft]=useState<Draft>(()=>{
    const layers:Draft['layers']={...drafts.get(key)?.layers};
    for(const s of board.slots){const v=initialOptions[s];if(v&&board.options[s]?.some(p=>p.variant===v))layers[s]={variant:v};}
    return {...(drafts.get(key)||empty),layers};
  });
  const [slot,setSlot]=useState<PairSlot>(board.slots[0]);
  const [notice,setNotice]=useState(''),[consent,setConsent]=useState(false),[running,setRunning]=useState(false);
  const [result,setResult]=useState(''),[adding,setAdding]=useState(false);
  const worker=useRef<AbortController|null>(null),lock=useRef(false);
  const active=useRef(true),revision=useRef(0);
  const router=useRouter();
  const ready=useClientReady(),items=useCart(s=>s.items);
  const selection=(s:PairSlot)=>board.options[s]?.find(x=>x.variant===draft.layers[s]?.variant);
  const chosen=board.slots.filter(s=>draft.layers[s]?.photo||selection(s));
  const lines=ready?items:[];
  const checkout=lines.length>0;
  const anchorInCart=lines.some(i=>i.productId===anchor.id&&i.variantId===anchor.variant);
  useEffect(()=>{active.current=true;return ()=>{active.current=false;worker.current?.abort();};},[]);
  useEffect(()=>()=>{if(result)URL.revokeObjectURL(result);},[result]);
  function update(change:(old:Draft)=>Draft){
    worker.current?.abort();lock.current=false;setRunning(false);setNotice('');setResult('');
    setDraft(old=>{const next=change(old);drafts.set(key,next);return next;});
  }
  function choose(s:PairSlot,value?:Choice){
    revision.current++;
    update(old=>{const layers={...old.layers};if(value)layers[s]=value;else delete layers[s];return {...old,layers};});
  }
  async function load(file:File,s?:PairSlot){
    const version=++revision.current;
    try{const photo=await localWardrobePhoto(file);if(!active.current||version!==revision.current)return;
      if(s)choose(s,{photo});else update(old=>({...old,background:photo}));}
    catch(e){if(active.current)setNotice(e instanceof Error?e.message:'Choose a clear JPG, PNG or WebP photo up to 15 MB.');}
  }
  async function add(p:PairPiece){
    if(adding)return;setAdding(true);setNotice('');
    try{
      const res=await fetch('/api/products/'+encodeURIComponent(p.slug),{cache:'no-store'}),body=await res.json();
      const v=body.product?.variants?.find((x:{id:string;inStock:boolean})=>x.id===p.variant&&x.inStock);
      if(!res.ok||!v || body.product.id!==p.id || (body.product.catalogueCtaMode && body.product.catalogueCtaMode!=='SHOP_NOW'))throw Error('That option is unavailable. Your other pieces are still in the cart.');
      const cart=useCart.getState();if(cart.items.some(i=>i.productId===p.id&&i.variantId===p.variant)){setNotice('This option is already in your cart.');return;}
      const price=v.sellingPrice??buildPricing(body.product).effectivePrice;
      if(price!==p.price)throw Error('The price has changed. Refresh to see the new price before adding.');
      cart.addItem({id:p.id,slug:p.slug,name:p.name,variantId:p.variant,variantLabel:p.option,sellingPrice:price,images:[p.image],inventory:v.inventory??undefined});
      setNotice(p.name+' added to cart.');
    }catch(e){setNotice(e instanceof Error?e.message:'Could not add this piece.');}finally{setAdding(false);}
  }
  async function render(){
    if(lock.current||!consent)return;
    const ctl=new AbortController();worker.current=ctl;lock.current=true;setRunning(true);setNotice('');setResult('');
    try{
      const init={signal:ctl.signal,cache:'no-store' as const};
      const session=await fetch(endpoint+'?session=1',init);if(!session.ok)throw Error('Could not open the studio.');
      const id=crypto.randomUUID();
      const response=await fetch(endpoint,{...init,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        id,...(board.study?{study:anchor.id}:{product:anchor.id,variant:anchor.variant}),background:draft.background,
        layers:chosen.map(s=>({slot:s,...draft.layers[s]})),consent:true})});
      if(!response.ok)throw Error((await response.json()).error||'Could not start preview.');
      const until=Date.now()+5*60*1000;
      while(Date.now()<until){
        await new Promise(resolve=>setTimeout(resolve,3000));if(ctl.signal.aborted)return;
        const status=await fetch(endpoint+'?id='+encodeURIComponent(id),init);
        if(status.status===202)continue;
        if(!status.ok)throw Error((await status.json()).error||'Could not finish preview.');
        if(!status.headers.get('Content-Type')?.startsWith('image/'))throw Error('The preview could not be loaded.');
        const blob=await status.blob();if(!ctl.signal.aborted)setResult(URL.createObjectURL(blob));return;
      }
      throw Error('The preview took too long. You can continue with your cart.');
    }catch(e){if(!ctl.signal.aborted)setNotice(e instanceof Error?e.message:'Could not render this preview.');}
    finally{if(worker.current===ctl){lock.current=false;setRunning(false);}}
  }
  const options=board.options[slot]||[],picked=selection(slot);
  return <div className={ui.page}>
    <div className={ui.nav}><Link href={checkout?'/cart':'/products'}><ArrowLeft size={16}/>{checkout?'Back to cart':'Shop pieces'}</Link>
      {checkout&&<Link className={ui.checkout} href="/checkout">Skip styling &amp; check out <ArrowRight size={17}/></Link>}</div>
    <div className={ui.head}><p>Aaina <span lang="hi">आईना</span></p><h1>{room?'Style your space':'Style your look'}</h1></div>
    {lines.length>1&&<label className={ui.switcher}>Piece to style <select value={lines.find(i=>i.productId===anchor.id&&i.variantId===anchor.variant)?key:''}
      onChange={e=>{const line=lines.find(i=>i.productId+'~'+i.variantId===e.target.value);if(line)router.push(styleHref(line.productId,line.variantId));}}>
      <option value="" disabled>Choose a piece</option>{lines.map(i=><option key={i.productId+'~'+i.variantId} value={i.productId+'~'+i.variantId}>{i.product.name} {i.variantLabel}</option>)}</select></label>}
    <div className={ui.grid}>
      <div className={ui.visual}>
        <div className={ui.photos} aria-label="Your styling board"><figure className={ui.anchor}><img src={anchor.image} alt={anchor.name}/><figcaption><strong>{anchor.name}</strong><span>{anchor.option}{anchor.price>0?' · '+formatINR(anchor.price):' · Collection preview'}</span>{!board.study&&!anchorInCart&&ready&&<button className={ui.anchorBuy} disabled={adding} onClick={()=>add(anchor)}><Plus size={15}/>Add this piece to cart</button>}</figcaption></figure>
          {!!(chosen.length||draft.background)&&<div className={ui.refs}>{draft.background&&<figure><img src={draft.background} alt={room?'Your room':'Your photo'}/><figcaption>{room?'Your room':'Your photo'}</figcaption></figure>}
          {chosen.map(s=><figure key={s}><img src={draft.layers[s]?.photo||selection(s)?.image} alt={draft.layers[s]?.photo?'Your '+pairingSlots[s].label:selection(s)?.name}/><figcaption>{draft.layers[s]?.photo?'Your '+pairingSlots[s].label.toLowerCase():selection(s)?.name}</figcaption></figure>)}</div>}
        </div>
        {result&&<figure className={ui.output}><img src={result} alt={room?'Rendered preview of your styled room':'Rendered preview of your outfit'}/><figcaption>AI styling preview · Colour, scale and fit may vary.</figcaption></figure>}
      </div>
      <div className={ui.controls}>
        <h2>{room?'What goes with it?':'Wear it with'}</h2><div className={ui.tabs} aria-label="Pairing categories">{board.slots.map(s=><button key={s} aria-pressed={slot===s} onClick={()=>setSlot(s)}>{chosen.includes(s)&&<Check size={13}/>} {pairingSlots[s].label}</button>)}</div>
        <div className={ui.choices}>
          {options.length>0?<><label className={ui.option}>From Neejee<select value={picked?.variant||''} onChange={e=>choose(slot,e.target.value?{variant:e.target.value}:undefined)}>
            <option value="">Choose a piece</option>{options.map(o=><option key={o.variant} value={o.variant}>{o.name}{o.option?' · '+o.option:''} · {formatINR(o.price)}</option>)}</select></label>
            {!picked&&<div className={ui.candidates}>{options.filter((p,i,a)=>a.findIndex(o=>o.id===p.id)===i).slice(0,4).map(o=><button key={o.id} onClick={()=>choose(slot,{variant:o.variant})}><img src={o.image} alt=""/><span>{o.name}</span></button>)}</div>}</>:<p>No {pairingSlots[slot].label.toLowerCase()} in stock to pair today. Try one you own.</p>}
          {picked&&<div className={ui.picked}><img src={picked.image} alt=""/><div><strong>{picked.name}</strong><p>{picked.reason}</p>
            <button disabled={adding||lines.some(i=>i.variantId===picked.variant)} onClick={()=>add(picked)}><Plus size={15}/>{lines.some(i=>i.variantId===picked.variant)?'In your cart':'Add to cart · '+formatINR(picked.price)}</button></div></div>}
          <PhotoInput label={'Use my own '+pairingSlots[slot].label.toLowerCase()} onFile={f=>load(f,slot)}/>
          {chosen.includes(slot)&&<button className={ui.remove} onClick={()=>choose(slot)}><X size={14}/>Remove this pairing</button>}
        </div>
        <div className={ui.render}><h2>{room?'See it in your room':'See it on you'}</h2>
          <p>{room?'Add a photo of your room to place the pieces in your own space.':'Add a full-length photo to see the outfit on you.'} You can also preview the pairing on its own.</p>
          <PhotoInput label={room?'Add my room photo':'Add my photo'} onFile={f=>load(f)}/>
          {draft.background&&<button className={ui.remove} onClick={()=>update(old=>({...old,background:undefined}))}>Remove my photo</button>}
          <label className={ui.consent}><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> <span>I have permission to use these photos and send them to Neejee’s image provider to create this preview.</span></label>
          <button className={ui.generate} disabled={running||!consent||(!chosen.length&&!draft.background)} onClick={render}>{running?'Creating your preview…':'Create photo preview'} <ArrowRight size={16}/></button>
        </div>
        <p role="status" aria-live="polite" className={ui.notice}>{notice}</p>
        {checkout&&<Link href="/checkout" className={ui.checkout}>Continue to checkout <ArrowRight size={16}/></Link>}
      </div>
    </div>
  </div>;
}
