'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import Link from 'next/link';
import styles from './HouseCampaign.module.css';

type Props = {
  name: string;
  photo: { src: string; alt: string };
  label: string;
  styling?: string;
  onClose: () => void;
};

export function ClothViewer({ name, photo, label, styling, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [zoom, setZoom] = useState(false);
  const [own, setOwn] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => () => { if (own) URL.revokeObjectURL(own); }, [own]);

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024) {
      setError('Choose a JPG, PNG or WebP image smaller than 15 MB.');
      return;
    }
    setOwn(URL.createObjectURL(file));
    setError('');
  }

  return <dialog ref={dialog} className={styles.viewer} aria-labelledby="cloth-view-title" onClose={onClose}
    onClick={e => { if (e.target === dialog.current) dialog.current.close(); }}>
    <div className={styles.viewerPaper}>
      <header><div><h2 id="cloth-view-title">{name}</h2><p>{label}</p></div>
        <button autoFocus type="button" className={styles.iconButton} aria-label="Close cloth view" onClick={()=>dialog.current?.close()}><X size={20}/></button>
      </header>
      <div className={styles.comparison} data-paired={Boolean(own)}>
        <div className={styles.fabricWindow} tabIndex={0} role="region" aria-label={zoom ? 'Enlarged cloth. Scroll to explore.' : 'Saree cloth'}>
          <img src={photo.src} alt={photo.alt} className={styles.fabricPhoto} data-zoom={zoom}/>
        </div>
        {own && <figure className={styles.ownPhoto}><img src={own} alt="Your blouse or accessory" onError={()=>{setOwn('');setError('This image could not be opened. Please choose another photo.');}}/><figcaption>Your piece</figcaption></figure>}
      </div>
      <div className={styles.viewerTools}>
        <button type="button" aria-pressed={zoom} onClick={()=>setZoom(!zoom)}>{zoom ? <Minus size={16}/> : <Plus size={16}/>}{zoom ? 'Show whole photo' : 'Magnify cloth'}</button>
        <button type="button" onClick={()=>input.current?.click()}>{own ? 'Change my photo' : 'Compare with my blouse'}</button>
        {own && <button type="button" onClick={()=>setOwn('')}>Remove my photo</button>}
        {styling && <Link href={styling}>Try on with Aaina</Link>}
      </div>
      <input type="file" ref={input} accept="image/jpeg,image/png,image/webp" hidden onChange={choose}/>
      <p className={styles.privacy}>{error || 'Your comparison photo stays on this device.'}</p>
    </div>
  </dialog>;
}
