'use client';

import { useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './tile-gallery.css';

export type PieceView = { src: string; label: string; focus?: string; zoom?: number };

export function catalogueViews(images: string[]): PieceView[] {
  const photos = [...new Set(images.filter(Boolean))];
  const views = photos.map((src,i) => ({ src, label: i ? 'Photo ' + (i+1) : 'Full view' }));
  return photos.length ? [...views, {src:photos[0],label:'Detail crop',focus:'50% 62%',zoom:2.3}] : views;
}

export function TileGallery({name, views, href, onOpen, children, eager = false, initialView = 0}: {
  name:string; views:PieceView[]; href?:string; onOpen?:(index:number)=>void; children?:ReactNode; eager?:boolean; initialView?:number;
}) {
  const [index,setIndex] = useState(initialView);
  const start = useRef<{x:number;y:number} | null>(null);
  const swiped = useRef(false);
  const pos = Math.min(index, Math.max(views.length-1,0));
  const view = views[pos];
  const move = (step:number) => setIndex((pos+step+views.length)%views.length);
  const photo = view ? <img key={view.src} src={view.src} loading={eager?'eager':'lazy'} draggable={false}
    alt={name+' · '+view.label} style={{transform:view.zoom?'scale('+view.zoom+')':undefined,transformOrigin:view.focus,objectPosition:view.focus}}/> : <span>View piece</span>;
  return <div className="nj-photo nj-gallery" role="group" aria-label={'Photographs of '+name}
    onTouchStart={e=>{swiped.current=false;start.current={x:e.touches[0].clientX,y:e.touches[0].clientY};}}
    onTouchCancel={()=>{start.current=null;}}
    onTouchEnd={e=>{if(!start.current||!e.changedTouches.length)return;const dx=e.changedTouches[0].clientX-start.current.x;const dy=e.changedTouches[0].clientY-start.current.y;start.current=null;
      if(views.length>1&&Math.abs(dx)>38&&Math.abs(dx)>Math.abs(dy)*1.4){swiped.current=true;move(dx<0?1:-1);}}}
    onClickCapture={e=>{if(swiped.current){swiped.current=false;e.preventDefault();e.stopPropagation();}}}
    onKeyDown={e=>{if(views.length<2)return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();move(e.key==='ArrowLeft'?-1:1);}}}>
    {href ? <Link className="nj-image-open" href={href} aria-label={'View '+name}>{photo}</Link>
      : <button className="nj-image-open" onClick={()=>onOpen?.(pos)} aria-label={'View '+name}>{photo}</button>}
    {children}
    {views.length>1 && <div className="loom-gallery-nav">
      <button type="button" aria-label={'Previous photo of '+name} onClick={()=>move(-1)}><ChevronLeft size={17}/></button>
      <span aria-live="polite" aria-atomic="true">{view.label} <i>{pos+1}/{views.length}</i></span>
      <button type="button" aria-label={'Next photo of '+name} onClick={()=>move(1)}><ChevronRight size={17}/></button>
    </div>}
  </div>;
}
