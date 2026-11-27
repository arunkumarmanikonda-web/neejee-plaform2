'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart-store';
import { lineStyling, reviewSizes, studyCartProduct } from '@/lib/collection-review';
import type { Study } from '@/lib/shop-studies';

export function StudyPurchase({piece, primary='loom-add', secondary='nj-buy-immediate'}:{piece:Study;primary?:string;secondary?:string}) {
  const [size,setSize] = useState('');
  const [busy,setBusy] = useState(false);
  const clicked = useRef(false);
  const router = useRouter();
  const sized = piece.group === 'suits';
  function purchase(buy:boolean) {
    if (clicked.current || (sized && !size)) return;
    clicked.current = true;
    setBusy(true);
    const product = studyCartProduct(piece,size);
    const cart = useCart.getState();
    if (!buy || !cart.items.some(i=>i.variantId===product.variantId)) cart.addItem(product);
    const line = useCart.getState().items.find(i=>i.variantId===product.variantId)!;
    router.push(buy ? lineStyling(line) : '/cart');
  }
  return <div className="nj-tile-purchase">{sized && <label className="nj-tile-options">Choose size
    <select aria-label={'Size for '+piece.name} value={size} onChange={e=>setSize(e.target.value)}>
      <option value="">Select size</option>{reviewSizes.map(s=><option key={s}>{s}</option>)}
    </select></label>}
    <div className="nj-purchase-buttons"><button className={primary} type="button" disabled={busy || (sized&&!size)} aria-label={'Add '+piece.name+' to cart'} onClick={()=>purchase(false)}>Add to cart</button>
    <button className={secondary} type="button" disabled={busy || (sized&&!size)} aria-label={'Buy '+piece.name+' now'} onClick={()=>purchase(true)}>Buy now</button></div>
  </div>;
}
