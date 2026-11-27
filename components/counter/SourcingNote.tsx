'use client';

import { useState } from 'react';
import { shadeName, type CounterCloth } from '@/lib/counter';
import styles from './Counter.module.css';

export function SourcingNote({email,pieces,colour,selected}:{email:string;pieces:CounterCloth[];colour:string;selected:string}) {
  const [id,setId] = useState(pieces.find(piece=>piece.id===selected)?.id || pieces[0]?.id);
  const [budget,setBudget] = useState('');
  const [wish,setWish] = useState('');
  const piece = pieces.find(item=>item.id===id) || pieces[0];
  if (!piece || !email) return null;
  const note = [
    'Hello Neejee,',
    '',
    'I’m looking for a wearable piece inspired by '+piece.name+'.',
    'Museum reference: '+piece.href,
    'My blouse colour: '+shadeName(colour)+' ('+colour+').',
    ...(budget.trim() ? ['My budget: '+budget.trim()] : []),
    ...(wish.trim() ? ['What I’m looking for: '+wish.trim()] : []),
    '',
    'Could you let me know if you have something suitable, its price, and when it might be available?',
  ].join('\n');
  const draft='mailto:'+email+'?subject='+encodeURIComponent('A request from the Neejee saree counter')+'&body='+encodeURIComponent(note);
  return <details className={styles.sourcing}>
    <summary>Find me a piece like this</summary>
    <p>Tell Neejee which detail caught your eye. You can review and send the request from your email.</p>
    <div className={styles.sourceFields}>
      <label>My reference<select value={piece.id} onChange={e=>setId(e.target.value)}>{pieces.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>My budget (optional)<input value={budget} onChange={e=>setBudget(e.target.value)} maxLength={80} placeholder="e.g. up to ₹12,000"/></label>
      <label>What I love about it (optional)<input value={wish} onChange={e=>setWish(e.target.value)} maxLength={180} placeholder="The narrow border, in a lighter silk…"/></label>
    </div>
    <a className={styles.secondary} href={draft}>Open email draft</a>
  </details>;
}
