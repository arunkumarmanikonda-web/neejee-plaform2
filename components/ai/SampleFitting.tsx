'use client';
import { useState } from 'react';
import Link from 'next/link';
import { lookUrl } from '@/lib/stylebook';
import styles from './Studio.module.css';

export function SampleFitting() {
  const [after,setAfter]=useState(true);
  const sample={look:'indigo',shoe:'jutti-ivory',jewel:'jewel-pearl'};
  return <section className={styles.sample} aria-labelledby="sample-fit-title">
    <div className={styles.sampleWords}><p className={styles.eyebrow}>Sample fitting</p><h2 id="sample-fit-title">Indigo, ivory and pearls.</h2>
      <p>See the same model before and after styling. This example pairs the copper-edged indigo saree with ivory floral juttis and pearl studs.</p>
      <div className={styles.sampleTabs} role="group" aria-label="Sample fitting photographs">
        <button aria-pressed={!after} onClick={()=>setAfter(false)}>Before</button><button aria-pressed={after} onClick={()=>setAfter(true)}>Styled</button>
      </div>
      <Link href={lookUrl('/looks',sample)}>Open this combination</Link>
      <p className={styles.note}>An illustrated fitting on a fictional model. Your own fitting uses the selections above.</p>
    </div>
    <figure><img src={after?'/brand/lookbook/sample-after.webp':'/brand/lookbook/sample-before.webp'} alt={after?'Sample model in the indigo saree, ivory floral juttis and pearl studs':'The same sample model in her everyday outfit'} width="500" height="750"/><figcaption aria-live="polite">{after?'The styled look':'The original portrait'}</figcaption></figure>
  </section>;
}
