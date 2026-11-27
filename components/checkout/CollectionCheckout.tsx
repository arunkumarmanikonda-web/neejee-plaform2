'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useClientReady } from '@/lib/use-client-ready';
import { reviewCart, useCart } from '@/lib/cart-store';
import { formatINR } from '@/lib/money';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { HouseHeading } from './HouseHeading';
import '@/components/shop/shop.css';

export function CollectionCheckout(){
  const cart=useCart();
  const ready=useClientReady();
  const [stage,setStage]=useState<'delivery'|'payment'|'complete'>('delivery');
  const [express,setExpress]=useState(false);
  const [paid,setPaid]=useState(0);
  const receiptKey='neejee.collection.review.receipt';
  useEffect(()=>{
    if(new URLSearchParams(location.search).get('complete')==='1' && !useCart.getState().items.length){
      const amount=Number(sessionStorage.getItem(receiptKey));
      if(amount>0){setPaid(amount);setStage('complete');}
    }
  },[]);
  const subtotal=cart.itemsSubtotal(),shipping=express?25000:subtotal>=250000?0:15000,total=cart.total()+shipping;
  function complete(){
    if(!reviewCart || !cart.items.length)return;
    setPaid(total);setStage('complete');sessionStorage.setItem(receiptKey,String(total));
    history.replaceState(history.state,'','/checkout?complete=1');
    cart.clear();window.scrollTo(0,0);
  }
  return <><Header shop/><main className="nj-order-page house-cart">
    <HouseHeading title={stage==='complete'?'Checkout complete':'Delivery and payment'} stage="Collection preview"/>
    {ready && !reviewCart?<section className="nj-order-paper"><h2>Open the collection preview</h2><p>Your live cart is saved.</p><a className="nj-primary" href="/collection-preview">Open preview cart</a></section>:!ready?<p role="status">Opening your cart…</p>:stage==='complete'?<section className="nj-order-paper"><h2>Thank you for trying Neejee.</h2><p>Your preview order came to {formatINR(paid)}. No payment was taken.</p><Link className="nj-primary" href="/">Continue shopping</Link></section>:
      !cart.items.length?<section className="nj-order-paper"><h2>Your cart is empty.</h2><Link href="/edits/clothing">Shop sarees and suits</Link></section>:
      <div className="nj-order-grid"><section className="nj-order-paper"><Link className="nj-text-link" href="/cart">Back to cart</Link>
      {stage==='delivery'?<><h2>Choose delivery</h2><p className="nj-example-address">Example address · New Delhi, Delhi 110001</p>
        <fieldset className="nj-delivery"><legend>Delivery method</legend><label><input type="radio" name="delivery" checked={!express} onChange={()=>setExpress(false)}/>Standard <b>{subtotal>=250000?'Free':formatINR(15000)}</b></label>
        <label><input type="radio" name="delivery" checked={express} onChange={()=>setExpress(true)}/>Express <b>{formatINR(25000)}</b></label></fieldset>
        <button className="nj-primary" onClick={()=>setStage('payment')}>Continue to payment</button></>:
        <><h2>Review payment</h2><p>This checkout simulates an order. No payment details are needed.</p>
        <button className="nj-primary" onClick={complete}>Complete preview order</button><button className="nj-text-link nj-back" onClick={()=>setStage('delivery')}>Change delivery</button></>}
      </section><aside className="nj-order-summary"><h2>Order summary</h2>
        {cart.items.map(i=><div className="nj-summary-piece" key={i.variantId||i.productId}><img src={i.product.images?.[0]} alt=""/><span>{i.product.name}<small>{i.variantLabel} · Qty {i.quantity}</small></span><b>{formatINR(i.product.sellingPrice*i.quantity)}</b></div>)}
        <div className="nj-total"><span>Subtotal</span><b>{formatINR(subtotal)}</b></div>
        {cart.giftWrap&&<div className="nj-total"><span>Gift wrap</span><b>{formatINR(cart.giftWrapPaise())}</b></div>}
        <div className="nj-total"><span>Delivery</span><b>{shipping?formatINR(shipping):'Free'}</b></div>
        <div className="nj-total nj-grand"><b>Total</b><b>{formatINR(total)}</b></div>
      </aside></div>}
  </main><Footer/></>;
}
