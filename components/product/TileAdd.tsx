'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '@/lib/cart-store';
import { buildPricing } from '@/lib/catalog/pricing-read';
import { isSoldOut, type FulfilmentProduct } from '@/lib/fulfilment';
import { formatINR } from '@/lib/money';

type Option = {id:string; inStock:boolean; sku:string; size?:string; color?:string; material?:string; images?:string[]; inventory?:number|null; sellingPrice?:number|null};
type Piece = FulfilmentProduct & {id:string; name:string; slug:string; images:string[]; mrp?:number; catalogueCtaMode?:string|null; variants:Option[]};
const optionName=(v:Option)=>[v.color,v.size,v.material].filter(Boolean).join(' · ') || v.sku;
export function TileAdd({slug,name,soldOut=false}:{slug:string;name:string;soldOut?:boolean}) {
  const [piece,setPiece]=useState<Piece|null>(null),[options,setOptions]=useState<Option[]>([]);
  const [choice,setChoice]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const lock=useRef(false),router=useRouter(),add=useCart(s=>s.addItem);
  const [detailsRequired,setDetailsRequired]=useState(false);
  async function choose() {
    if(lock.current)return;
    lock.current=true;setBusy(true);setMessage('');
    let added=false;
    try{
      const response=await fetch('/api/products/'+encodeURIComponent(slug),{cache:'no-store'});
      if(!response.ok) throw Error('This piece could not be loaded. Please try again.');
      const {product:p}:{product:Piece}=await response.json();
      if(!p?.id)throw Error('This piece is currently unavailable.');
      if((p.catalogueCtaMode && p.catalogueCtaMode!=='SHOP_NOW')||p.fulfilmentMode==='PREORDER'){setDetailsRequired(true);return;}
      if(isSoldOut(p))throw Error('This edition has sold out.');
      const available=p.variants.filter(v=>v.inStock);
      if(!available.length)throw Error('This piece is currently out of stock.');
      const option=choice?available.find(v=>v.id===choice):available.length===1?available[0]:null;
      if(!option){setPiece(p);setOptions(available);setChoice('');if(choice)setMessage('That option has sold out. Choose another.');return;}
      const price=option.sellingPrice??buildPricing(p).effectivePrice;
      if(!(price>0))throw Error('The price is being updated. Please try again.');
      const qty=useCart.getState().items.find(i=>i.productId===p.id&&i.variantId===option.id)?.quantity||0;
      if(option.inventory!=null && qty>=option.inventory)throw Error('All available pieces in this option are already in your bag.');
      add({id:p.id,name:p.name,slug:p.slug,sellingPrice:price,mrp:p.mrp,variantId:option.id,variantLabel:optionName(option),inventory:option.inventory??undefined,images:option.images?.length?option.images:p.images});
      added=true;
      router.push('/cart');
    }catch(error){setMessage(error instanceof Error?error.message:'Please try again.');}
    finally{if(!added){lock.current=false;setBusy(false);}}
  }
  if(detailsRequired)return <Link className="nj-add-tile" href={'/products/'+encodeURIComponent(slug)}>See purchase options</Link>;
  return <div className="nj-tile-purchase">
    {options.length>0&&piece&&<label className="nj-tile-options">Choose an option<select aria-label={'Option for '+name} value={choice} onChange={e=>setChoice(e.target.value)}><option value="">Colour / size</option>{options.map(v=><option key={v.id} value={v.id}>{optionName(v)} · {formatINR(v.sellingPrice??buildPricing(piece).effectivePrice)}</option>)}</select></label>}
    <button type="button" className="nj-add-tile" disabled={busy||soldOut||(options.length>0&&!choice)} aria-label={'Add '+name+' to bag'} onClick={choose}><ShoppingBag size={15}/>{soldOut?'Sold out':busy?'Checking…':'Add to bag'}</button>
    {message&&<p role="status" className="nj-tile-message">{message}</p>}
  </div>;
}
