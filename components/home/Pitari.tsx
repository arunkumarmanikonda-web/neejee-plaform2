'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { X, Send } from 'lucide-react';
import { pitariTopics, type PitariReply } from '@/lib/pitari';
import styles from './Pitari.module.css';

type Turn = { question: string; answer: PitariReply };
const eventName = 'neejee:ask-pitari';

export function Pitari({ showLauncher = true }: { showLauncher?: boolean } = {}) {
  const pathname = usePathname();
  const activeProduct = pathname?.match(/^\/products\/([^/]+)\/?$/)?.[1];
  const dialog = useRef<HTMLDialogElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const order = useRef<string>();
  const version = useRef(0);
  const clear = useCallback(() => {
    version.current++;
    busy.current=false;
    order.current=undefined;
    piece.current=undefined;
    setTurns([]); setInput(''); setPending('');
  },[]);
  const busy = useRef(false);
  const piece = useRef<string>();
  const [turns,setTurns] = useState<Turn[]>([]);
  const [pending,setPending] = useState('');
  const [input,setInput] = useState('');
  const ask = useCallback(async (q: string) => {
    const question = q.trim().slice(0,320);
    if (!question || busy.current) return;
    const id=version.current;
    busy.current=true;
    setPending(question);
    setInput('');
    try {
      const locationSlug=window.location.pathname.match(/^\/products\/([^/]+)\/?$/)?.[1];
      const variant=locationSlug===piece.current ? new URLSearchParams(window.location.search).get('variant') : undefined;
      const res = await fetch('/api/pitari',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:question,piece:piece.current,order:order.current,variant}),signal:AbortSignal.timeout(15000)});
      const answer: PitariReply = await res.json();
      if (typeof answer.text !== 'string' || !Array.isArray(answer.links)) throw Error();
      if (id!==version.current) return;
      order.current=answer.order;
      if (answer.piece) piece.current=answer.piece;
      setTurns(prev=>[...prev.slice(-15),{question,answer}]);
    } catch {
      if (id!==version.current) return;
      setTurns(prev=>[...prev.slice(-15),{question,answer:{text:'The shop counter couldn’t connect just now. You can try again or browse the collection.',links:[{label:'Browse all pieces',href:'/products'}]}}]);
    } finally {
      if (id===version.current) { busy.current=false; setPending(''); }
    }
  },[]);
  useEffect(()=>{
    const open = (e:Event) => {
      if (!dialog.current?.open) dialog.current?.showModal();
      const q=(e as CustomEvent<string>).detail;
      if (activeProduct) piece.current=activeProduct;
      if(q) void ask(q);
    };
    const onHide = () => { dialog.current?.close(); clear(); };
    if (new URLSearchParams(location.search).get('ask')==='sakhi') {
      open(new Event(eventName));
      const url=new URL(location.href); url.searchParams.delete('ask'); history.replaceState(history.state,'',url);
    }
    window.addEventListener('pagehide',onHide);
    window.addEventListener(eventName,open);
    return ()=>{window.removeEventListener(eventName,open); window.removeEventListener('pagehide',onHide);};
  },[ask,activeProduct,clear]);
  useEffect(()=>{if(dialog.current?.open) end.current?.scrollIntoView({block:'nearest'});},[turns,pending]);
  return <>
    {showLauncher && <button type="button" className={styles.launch} title="Ask Sakhi" aria-label="Ask Sakhi, shopping help" aria-haspopup="dialog" onClick={()=>{if(activeProduct)piece.current=activeProduct; dialog.current?.showModal();}}>
      Ask Sakhi
    </button>}
    <dialog ref={dialog} onClose={clear} className={styles.dialog} aria-labelledby="pitari-heading" onClick={e=>{if(e.target===dialog.current) dialog.current.close();}}>
      <div className={styles.panel}>
        <header>
          <div><h2 id="pitari-heading">Ask Sakhi</h2></div>
          <button autoFocus aria-label="Close shopping help" onClick={()=>dialog.current?.close()}><X size={22}/></button></header>
        <div className={styles.history} role="log" aria-live="polite" aria-relevant="additions text">
          <p className={styles.welcome}>I’m Sakhi, your companion for all things Neejee. Tell me what you’re dressing for, ask about a piece, or let me check an order for you.</p>
          {turns.map((t,i)=><div className={styles.turn} key={i}><b>{t.question}</b><p>{t.answer.text}</p>
            {t.answer.links.map(link=><Link key={link.href} href={link.href} onClick={()=>dialog.current?.close()}>{link.label}</Link>)}</div>)}
          {pending && <div className={styles.turn}><b>{pending}</b><p>One moment…</p></div>}<div ref={end}/>
        </div>
        <Link href="/help/contact" className={styles.contact}>Contact the Neejee team</Link>
        <div className={styles.prompts}>{(activeProduct ? ["What comes with this piece?", "Where is it from?", "How do I care for it?"] : pitariTopics).map(q=><button key={q} disabled={!!pending} onClick={()=>void ask(q)}>{q}</button>)}</div>
        <form onSubmit={e=>{e.preventDefault();void ask(input);}}>
          <input aria-label="Your shopping question" placeholder="Ask Sakhi…" maxLength={320} value={input} onChange={e=>setInput(e.target.value)}/>
          <button type="submit" disabled={!!pending || !input.trim()} aria-label="Send question"><Send size={19}/></button>
        </form>
      </div>
    </dialog>
  </>;
}
