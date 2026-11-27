'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { HouseHeading } from '@/components/checkout/HouseHeading';
import { BagPairing } from './BagPairing';
import { changeSample, emptySampleBag, useSampleBag } from '@/lib/sample-bag';
import { studies } from '@/lib/shop-studies';
import { formatINR } from '@/lib/money';
import { useClientReady } from '@/lib/use-client-ready';
import './shop.css';
import './dressing.css';

export function SampleShopping({checkout = false, liveCount = 0}: {checkout?: boolean; liveCount?: number}) {
  const bag = useSampleBag();
  const ready = useClientReady();
  const pieces = studies.filter(s => bag[s.id] > 0);
  const subtotal = pieces.reduce((n, s) => n + bag[s.id] * s.price, 0);
  const [step, setStep] = useState<'delivery' | 'payment'>('delivery');
  const [express, setExpress] = useState(false);
  const [receipt, setReceipt] = useState<number | null>(null);
  const shipping = express ? 25000 : subtotal >= 250000 ? 0 : 15000;
  const total = subtotal + shipping;
  useEffect(() => {
    if (!checkout || !ready || pieces.length) return;
    if (new URLSearchParams(location.search).get('complete') === '1') {
      try {
        const saved = Number(sessionStorage.getItem('neejee.sample-receipt'));
        if (saved > 0) setReceipt(saved);
      } catch {}
    }
  }, [checkout, ready, pieces.length]);
  function complete() {
    if (!pieces.length) return;
    setReceipt(total);
    try { sessionStorage.setItem('neejee.sample-receipt', String(total)); } catch {}
    window.history.replaceState(window.history.state, '', '/checkout/sample?complete=1');
    emptySampleBag();
    window.scrollTo(0, 0);
  }
  const toShop = <Link className="nj-text-link" href="/edits/sarees">Continue shopping</Link>;
  return <><Header shop/><main className="nj-order-page house-cart">
    <HouseHeading title={receipt !== null ? 'Checkout complete' : checkout ? 'Delivery and payment' : 'Your bag'} stage={receipt !== null ? 'Confirmation' : checkout ? 'Checkout' : 'Shopping bag'}/>
    {!ready ? <p role="status">Opening your bag…</p> : receipt !== null ? <section className="nj-order-paper nj-finished" aria-live="polite">
      <Check size={28}/><h2>Thank you for trying Neejee.</h2><p>Sample total <strong>{formatINR(receipt)}</strong>. No payment was taken or order placed.</p>{toShop}
    </section> : !pieces.length ? <section className="nj-order-paper"><h2>Your bag is empty.</h2>{toShop}{liveCount > 0 && <p><Link className="nj-text-link" href="/cart">View your shop items</Link></p>}</section> :
    <div className={'nj-order-grid'+(checkout?'':' nj-bag-grid')}>
      <section className="nj-order-paper">
        {checkout ? <><Link className="nj-text-link" href="/cart?bag=sample">Back to bag</Link>
          <ol aria-label="Checkout progress" className="nj-steps"><li aria-current={step==='delivery'?'step':undefined}>1 · Delivery</li><li aria-current={step==='payment'?'step':undefined}>2 · Payment</li></ol>
          {step==='delivery' ? <><h2>Choose delivery</h2><p>Use the example delivery details to try checkout.</p>
            <div className="nj-example-address">Sample delivery address<br/>New Delhi, Delhi · 110001</div>
            <fieldset className="nj-delivery"><legend>Delivery method</legend>
              <label><input type="radio" name="sample-shipping" checked={!express} onChange={()=>setExpress(false)}/> Standard <b>{subtotal>=250000?'Free':formatINR(15000)}</b></label>
              <label><input type="radio" name="sample-shipping" checked={express} onChange={()=>setExpress(true)}/> Express <b>{formatINR(25000)}</b></label>
            </fieldset><button className="nj-primary" onClick={()=>setStep('payment')}>Continue to payment</button></> :
          <><h2>Review payment</h2><p>This is a sample checkout. No payment details are needed.</p><div className="nj-total"><span>Total</span><strong>{formatINR(total)}</strong></div>
          <button className="nj-primary" onClick={complete}>Complete sample order</button><button className="nj-text-link nj-back" onClick={()=>setStep('delivery')}>Change delivery</button></>}</>
          : <><h2>Your pieces</h2>{pieces.map(s=><div className="nj-bag-row" key={s.id}>
            <img src={s.image} alt={s.name}/><div><b>{s.name}</b><small>{s.alias}</small>
            <div className="nj-qty"><button aria-label={'Decrease '+s.name+' quantity'} onClick={()=>changeSample(s.id,-1)}><Minus size={14}/></button>{bag[s.id]}<button disabled={bag[s.id]>=9} aria-label={'Increase '+s.name+' quantity'} onClick={()=>changeSample(s.id,1)}><Plus size={14}/></button></div></div>
            <strong>{formatINR(s.price*bag[s.id])}</strong>{s.group==='sarees'&&<BagPairing study product={s.id} name={s.name}/>}</div>)}
            {toShop}{liveCount>0&&<p><Link href="/cart" className="nj-text-link">View your shop items ({liveCount})</Link></p>}</>}
      </section>
      <aside className="nj-order-summary"><h2>Order summary</h2>
        {checkout && pieces.map(s=><div key={s.id} className="nj-summary-piece"><img src={s.image} alt=""/><span>{s.name}<small>Qty {bag[s.id]}</small></span><strong>{formatINR(s.price*bag[s.id])}</strong></div>)}
        <div className="nj-total"><span>{checkout?'Subtotal':'Bag total'}</span><b>{formatINR(subtotal)}</b></div>
        {checkout && <><div className="nj-total"><span>Delivery</span><span>{shipping?formatINR(shipping):'Free'}</span></div><div className="nj-total nj-grand"><b>Total</b><b>{formatINR(total)}</b></div></>}
        {!checkout && <Link className="nj-primary" href="/checkout/sample">Checkout · {formatINR(subtotal)}</Link>}
        <small>Sample pieces. No payment will be taken.</small>
      </aside>
    </div>}
  </main><Footer/></>;
}
