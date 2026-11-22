'use client';

import { useEffect,useRef,useState } from 'react';
import { Check,Copy } from 'lucide-react';
import { counterHref,type CounterState } from '@/lib/counter';
import styles from './Counter.module.css';

export function CounterShare({state,pick,onClose}:{state:CounterState;pick?:string;onClose:()=>void}) {
  const modal=useRef<HTMLDialogElement>(null),field=useRef<HTMLInputElement>(null);
  const [copied,setCopied]=useState(false);
  const link=new URL(counterHref(state,pick?'reply':'ask',pick),window.location.origin).href;
  useEffect(()=>{const d=modal.current;d?.showModal();return ()=>{if(d?.open)d.close();};},[]);
  async function copy(){
    try {await navigator.clipboard.writeText(link);setCopied(true);}
    catch {field.current?.focus();field.current?.select();}
  }
  return <dialog ref={modal} onCancel={onClose} className={styles.dialog} aria-labelledby="share-counter-title">
    <div className={styles.shareCard}><p className={styles.eyebrow}>Neejee · Found. Personal.</p>
      <h2 id="share-counter-title">{pick?'Send your pick back.':'Which one would you pick for me?'}</h2>
      <p>{pick?'Give this link back to the person who asked. It opens with your choice marked.':'Send this counter to someone whose eye you trust. They can look at both pieces and return their pick.'}</p>
      <p className={styles.small}>The card contains the two pieces and the colour. Your original photograph stays with you.</p>
      <label>Link to this card<input ref={field} readOnly value={link} onFocus={e=>e.target.select()}/></label>
      <div className={styles.actions}><button className={styles.primary} onClick={()=>void copy()}>{copied?<Check size={16}/>:<Copy size={16}/>} {copied?'Copied':'Copy link'}</button>
      {typeof navigator.share==='function'&&<button className={styles.secondary} onClick={()=>void navigator.share({title:pick?'My pick for you':'Which one would you pick for me?',url:link}).catch(()=>{})}>Share…</button>}
      <button className={styles.textButton} onClick={onClose}>Close</button></div>
    </div></dialog>;
}
