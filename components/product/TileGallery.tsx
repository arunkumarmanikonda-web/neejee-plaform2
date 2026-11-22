'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { usePhotoRail } from '@/components/gallery/usePhotoRail';
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
  const rail = usePhotoRail(views.length, initialView);
  return <div className="nj-photo nj-gallery" role="group" aria-roledescription="carousel"
    aria-label={'Photographs of '+name} onKeyDown={rail.onKeyDown}>
    <div className="photo-rail nj-photo-rail" {...rail.props}>
      {views.map((view, i) => {
        const picture = <img src={view.src} loading={eager && i===0 ? 'eager' : 'lazy'} decoding="async"
          alt={name+' · '+view.label} draggable={false}
          style={{transform:view.zoom?'scale('+view.zoom+')':undefined,transformOrigin:view.focus,objectPosition:view.focus}}/>;
        return <div data-slide="" key={view.src+'-'+i} aria-hidden={rail.active!==i}>
          {href ? <Link className="nj-image-open" href={href} tabIndex={rail.active===i ? 0 : -1} aria-label={'View '+name}>{picture}</Link>
            : <button type="button" className="nj-image-open" tabIndex={rail.active===i ? 0 : -1} onClick={()=>onOpen?.(i)} aria-label={'View '+name}>{picture}</button>}
        </div>;
      })}
      {!views.length && (href ? <Link href={href} className="nj-image-open">View piece</Link> : <button onClick={()=>onOpen?.(0)}>View piece</button>)}
    </div>
    {children}
    {views.length>1 && <div className="loom-gallery-nav">
      <button type="button" aria-label={'Previous photo of '+name} aria-disabled={rail.active===0} onClick={()=>rail.step(-1)}><ChevronLeft size={18}/></button>
      <span className="loom-gallery-caption" aria-live="polite" aria-atomic="true">{views[rail.active]?.label} <i>{rail.active+1}/{views.length}</i></span>
      <button type="button" aria-label={'Next photo of '+name} aria-disabled={rail.active===views.length-1} onClick={()=>rail.step(1)}><ChevronRight size={18}/></button>
    </div>}
  </div>;
}
