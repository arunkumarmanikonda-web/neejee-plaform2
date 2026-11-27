'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './Studio.module.css';

export function PhotoPair({productImage,name,wearable}:{productImage:string;name:string;wearable:boolean}) {
  const [file,setFile]=useState<File|null>(null);
  const [url,setUrl]=useState('');
  const [error,setError]=useState('');
  const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    if(!file){setUrl('');return;}
    const preview=URL.createObjectURL(file);
    setUrl(preview);
    return ()=>URL.revokeObjectURL(preview);
  },[file]);
  function clear(){
    if(input.current)input.current.value='';
    setFile(null);setError('');
  }
  return <details className={styles.pair}>
    <summary>{wearable?'Compare with something in your wardrobe':'Make a room moodboard'}</summary>
    <p>{wearable?'Put a photo of your blouse, dupatta or shoes beside the selected garment.':'Put a photo of your shelf or room beside the piece to see how the colours work together.'} Your photo stays on this device.</p>
    <label className={styles.field}>{file?'Change your photograph':'Choose a photograph'}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{
        const next=e.target.files?.[0];if(!next)return;
        if(!['image/jpeg','image/png','image/webp'].includes(next.type)||next.size>15*1024*1024){setError('Choose a JPG, PNG or WebP file up to 15 MB.');return;}
        setError('');setFile(next);
      }}/></label>
    {error&&<p role="alert">{error}</p>}
    {file&&url&&<><div className={styles.pairImages}>
      <figure><img src={productImage} alt={name}/><figcaption>{name}</figcaption></figure>
      <figure><img src={url} alt={wearable?'Your wardrobe photograph':'Your room photograph'}/><figcaption>Your photograph</figcaption></figure>
    </div><button type="button" onClick={clear}>Remove my photograph</button></>}
  </details>;
}
